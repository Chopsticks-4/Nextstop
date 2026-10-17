import type { IncomingMessage, ServerResponse } from 'node:http'

interface DraftSection { title: string; text: string; images: string[] }
interface DraftInput { title: string; city: string; date: string; sections: DraftSection[]; extraImages: string[]; cover: string }
interface WechatConfig { appId?: string; appSecret?: string }
interface WechatResponse { errcode?: number; errmsg?: string; access_token?: string; expires_in?: number; url?: string; media_id?: string }

const api = 'https://api.weixin.qq.com/cgi-bin'
const maxRequestBytes = 60 * 1024 * 1024
let cachedToken: { value: string; expiresAt: number; appId: string } | null = null

class DraftError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function send(res: ServerResponse, status: number, body: object) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maxRequestBytes) throw new DraftError(413, '照片总量过大，请减少照片后重试')
    chunks.push(buffer)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown }
  catch { throw new DraftError(400, '草稿内容格式不正确') }
}

function plain(value: unknown, max: number, name: string): string {
  if (typeof value !== 'string' || value.length > max) throw new DraftError(400, `${name}无效或过长`)
  return value.trim()
}

function image(value: unknown): string {
  if (typeof value !== 'string' || !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new DraftError(400, '只能上传本地 JPG 或 PNG 照片')
  }
  const estimatedBytes = Math.ceil((value.length - value.indexOf(',') - 1) * 0.75)
  if (estimatedBytes > 1024 * 1024) throw new DraftError(400, '单张图片须小于 1 MB')
  return value
}

function validate(value: unknown): DraftInput {
  if (!value || typeof value !== 'object') throw new DraftError(400, '草稿内容为空')
  const source = value as Record<string, unknown>
  const title = plain(source.title, 32, '标题（最多 32 字）')
  if (!title) throw new DraftError(400, '请先为故事填写标题')
  if (!Array.isArray(source.sections) || source.sections.length > 30) throw new DraftError(400, '故事片段数量无效')
  const sections = source.sections.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new DraftError(400, '故事片段格式无效')
    const section = entry as Record<string, unknown>
    if (!Array.isArray(section.images) || section.images.length > 20) throw new DraftError(400, '片段照片数量过多')
    return {
      title: plain(section.title, 100, '片段标题'),
      text: plain(section.text, 20000, '片段正文'),
      images: section.images.map(image),
    }
  })
  if (!sections.length) throw new DraftError(400, '请先生成旅行故事')
  if (!Array.isArray(source.extraImages) || source.extraImages.length > 40) throw new DraftError(400, '额外照片数量过多')
  return {
    title, city: plain(source.city, 80, '城市'), date: plain(source.date, 40, '日期'),
    sections, extraImages: source.extraImages.map(image), cover: image(source.cover),
  }
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

function paragraphs(value: string) {
  return value.split(/\n\s*\n/).map((part) => `<p style="font-size:15px;line-height:1.9;color:#3f4c43;white-space:pre-wrap">${escapeHtml(part).replaceAll('\n', '<br>')}</p>`).join('')
}

function buildHtml(draft: DraftInput, uploaded: Map<string, string>) {
  const picture = (src: string) => `<p style="margin:16px 0"><img src="${escapeHtml(uploaded.get(src) || '')}" style="max-width:100%;height:auto" /></p>`
  const sections = draft.sections.map((section) => [
    `<h2 style="font-size:19px;color:#23372e;margin:28px 0 12px">${escapeHtml(section.title)}</h2>`,
    ...section.images.map(picture), paragraphs(section.text),
  ].join('')).join('')
  const extras = draft.extraImages.length
    ? `<h2 style="font-size:19px;color:#23372e;margin:28px 0 12px">更多旅途照片</h2>${draft.extraImages.map(picture).join('')}` : ''
  return `<section><p style="color:#78847c;font-size:12px">${escapeHtml([draft.city, draft.date].filter(Boolean).join(' · '))}</p>${sections}${extras}</section>`
}

async function wechatJson(url: URL, init?: RequestInit): Promise<WechatResponse> {
  let response: Response
  try { response = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) }) }
  catch { throw new DraftError(502, '连接微信接口失败，请检查网络') }
  let result: WechatResponse
  try { result = await response.json() as WechatResponse }
  catch { throw new DraftError(502, '微信接口返回了无法识别的内容') }
  if (!response.ok || (typeof result.errcode === 'number' && result.errcode !== 0)) {
    const code = result.errcode
    if (code === 40164) throw new DraftError(502, '微信拒绝了当前电脑的出口 IP，请将其加入公众号 IP 白名单')
    if (code === 48001) throw new DraftError(502, '公众号尚无此接口权限，请检查草稿箱和素材管理权限')
    if (code === 40013 || code === 40125) throw new DraftError(502, 'AppID 或 AppSecret 不正确，请检查本地配置')
    throw new DraftError(502, `微信接口失败（${code ?? response.status}）：${result.errmsg || '未知错误'}`)
  }
  return result
}

async function token(config: Required<WechatConfig>) {
  if (cachedToken?.appId === config.appId && cachedToken.expiresAt > Date.now()) return cachedToken.value
  const url = new URL(`${api}/token`)
  url.search = new URLSearchParams({ grant_type: 'client_credential', appid: config.appId, secret: config.appSecret }).toString()
  const response = await wechatJson(url)
  if (!response.access_token) throw new DraftError(502, '微信未返回调用凭据')
  cachedToken = { value: response.access_token, appId: config.appId, expiresAt: Date.now() + Math.max(0, (response.expires_in || 7200) - 300) * 1000 }
  return response.access_token
}

async function uploadImage(accessToken: string, dataUrl: string, path: string) {
  const [header, encoded] = dataUrl.split(',', 2)
  const mime = header === 'data:image/png;base64' ? 'image/png' : 'image/jpeg'
  const form = new FormData()
  form.append('media', new Blob([Buffer.from(encoded!, 'base64')], { type: mime }), mime === 'image/png' ? 'photo.png' : 'photo.jpg')
  const url = new URL(`${api}/${path}`)
  url.searchParams.set('access_token', accessToken)
  if (path === 'material/add_material') url.searchParams.set('type', 'thumb')
  return wechatJson(url, { method: 'POST', body: form })
}

async function createDraft(config: Required<WechatConfig>, draft: DraftInput) {
  const accessToken = await token(config)
  const allImages = [...new Set(draft.sections.flatMap((section) => section.images).concat(draft.extraImages))]
  const uploaded = new Map<string, string>()
  for (const source of allImages) {
    const result = await uploadImage(accessToken, source, 'media/uploadimg')
    if (!result.url) throw new DraftError(502, '微信未返回正文图片地址')
    uploaded.set(source, result.url)
  }
  const cover = await uploadImage(accessToken, draft.cover, 'material/add_material')
  if (!cover.media_id) throw new DraftError(502, '微信未返回封面素材 ID')
  const content = buildHtml(draft, uploaded)
  if (content.length > 20000 || Buffer.byteLength(content, 'utf8') > 1024 * 1024) throw new DraftError(400, '微信图文正文过长，请精简故事后重试')
  const url = new URL(`${api}/draft/add`)
  url.searchParams.set('access_token', accessToken)
  const result = await wechatJson(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ articles: [{ article_type: 'news', title: draft.title, thumb_media_id: cover.media_id, content, show_cover_pic: 1 }] }),
  })
  if (!result.media_id) throw new DraftError(502, '微信未返回草稿 ID，请到公众平台检查草稿箱')
  return result.media_id
}

export function createWechatDraftMiddleware(config: WechatConfig) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (new URL(req.url || '/', 'http://localhost').pathname !== '/api/wechat/draft') return next()
    try {
      if (req.method !== 'POST') throw new DraftError(405, '仅支持 POST 请求')
      const host = req.headers.host || ''
      if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || req.headers.origin !== `http://${host}`) {
        throw new DraftError(403, '仅允许从本地网页提交草稿')
      }
      if (!config.appId || !/^wx[a-fA-F0-9]{16}$/.test(config.appId) || !config.appSecret) {
        throw new DraftError(503, '请先在 .env.local 配置 WECHAT_APP_SECRET，并确认 WECHAT_APP_ID 是 wx 开头的开发者 ID')
      }
      const draft = validate(await readBody(req))
      send(res, 200, { mediaId: await createDraft(config as Required<WechatConfig>, draft) })
    } catch (error) {
      send(res, error instanceof DraftError ? error.status : 500, { error: error instanceof Error ? error.message : '草稿提交失败' })
    }
  }
}
