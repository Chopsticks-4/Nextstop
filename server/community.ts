import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

interface Comment { author: string; text: string; userId?: string; createdAt?: string }
interface Post {
  id: string; ownerId: string; tripId: string; author: string; avatar: string; avatarColor: string
  city: string; place: string; title: string; excerpt: string; body: string; image: string; publishedAt: string
}
interface Reaction {
  likedBy: string[]; followedBy: string[]; comments: Comment[]
  likedAt?: Record<string, string>; followedAt?: Record<string, string>
}
interface State { posts: Post[]; reactions: Record<string, Reaction> }

const dataFile = join(process.cwd(), 'data', 'community.json')
let cache: State | null = null
let queue = Promise.resolve()

function send(res: ServerResponse, status: number, value: object) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(value))
}

async function state(): Promise<State> {
  if (cache) return cache
  try {
    const saved = JSON.parse(await readFile(dataFile, 'utf8')) as State
    cache = { posts: Array.isArray(saved.posts) ? saved.posts : [], reactions: saved.reactions || {} }
  } catch { cache = { posts: [], reactions: {} } }
  return cache
}

async function save(value: State) {
  await mkdir(join(process.cwd(), 'data'), { recursive: true })
  await writeFile(dataFile, JSON.stringify(value), 'utf8')
}

async function mutate<T>(operation: (value: State) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const value = await state()
    const result = await operation(value)
    await save(value)
    return result
  })
  queue = run.then(() => undefined, () => undefined)
  return run
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += part.length
    if (size > 8 * 1024 * 1024) throw new Error('故事内容过大，请选择较小的封面照片')
    chunks.push(part)
  }
  const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('请求内容无效')
  return parsed as Record<string, unknown>
}

function field(value: unknown, max: number, name: string) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${name}无效`)
  return value.trim()
}

function reaction(value: State, id: string) {
  return value.reactions[id] ||= { likedBy: [], followedBy: [], comments: [] }
}

function publicState(value: State) {
  return {
    posts: [...value.posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).map((post) => ({
      ...post, likes: 0, influence: value.reactions[post.id]?.followedBy.length || 0,
      comments: value.reactions[post.id]?.comments.map((comment) => comment.text) || [],
    })),
    reactions: Object.fromEntries(Object.entries(value.reactions).map(([id, item]) => [id, {
      likes: item.likedBy.length, influence: item.followedBy.length, comments: item.comments,
    }])),
  }
}

function impactState(value: State, userId: string) {
  const ownPosts = value.posts.filter((post) => post.ownerId === userId)
  const ownIds = new Set(ownPosts.map((post) => post.id))
  const received: { kind: 'like' | 'comment' | 'follow'; storyId: string; storyTitle: string; text?: string; at: string }[] = []
  const given: typeof received = []
  for (const [storyId, item] of Object.entries(value.reactions)) {
    const post = value.posts.find((entry) => entry.id === storyId)
    const storyTitle = post?.title || ''
    const own = ownIds.has(storyId)
    if (own) {
      for (const actor of item.likedBy || []) if (actor !== userId) received.push({ kind: 'like', storyId, storyTitle, at: item.likedAt?.[actor] || '' })
      for (const actor of item.followedBy || []) if (actor !== userId) received.push({ kind: 'follow', storyId, storyTitle, at: item.followedAt?.[actor] || '' })
      for (const comment of item.comments || []) if (comment.userId !== userId) received.push({ kind: 'comment', storyId, storyTitle, text: comment.text, at: comment.createdAt || '' })
    } else {
      if (item.likedBy?.includes(userId)) given.push({ kind: 'like', storyId, storyTitle, at: item.likedAt?.[userId] || '' })
      if (item.followedBy?.includes(userId)) given.push({ kind: 'follow', storyId, storyTitle, at: item.followedAt?.[userId] || '' })
      for (const comment of item.comments || []) if (comment.userId === userId) given.push({ kind: 'comment', storyId, storyTitle, text: comment.text, at: comment.createdAt || '' })
    }
  }
  const byRecent = (a: { at: string }, b: { at: string }) => b.at.localeCompare(a.at)
  return {
    posts: ownPosts.map((post) => {
      const item = value.reactions[post.id]
      return { ...post, likes: item?.likedBy?.filter((id) => id !== userId).length || 0,
        comments: item?.comments?.filter((entry) => entry.userId !== userId).length || 0,
        influence: item?.followedBy?.filter((id) => id !== userId).length || 0 }
    }).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    received: received.sort(byRecent), given: given.sort(byRecent),
  }
}

export function createCommunityMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = new URL(req.url || '/', 'http://localhost').pathname
    if (!path.startsWith('/api/community')) return next()
    try {
      if (req.method === 'GET' && path === '/api/community') return send(res, 200, publicState(await state()))
      if (req.method !== 'POST' || !/^\/api\/community\/(publish|follow|like|comment|impact)$/.test(path)) return send(res, 405, { error: '不支持的请求' })
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return send(res, 403, { error: '只允许从当前站点发布' })
      const input = await body(req)
      const userId = field(input.userId, 80, '用户标识')
      if (path === '/api/community/impact') return send(res, 200, impactState(await state(), userId))
      if (path === '/api/community/publish') {
        const tripId = field(input.tripId, 100, '旅行标识')
        const title = field(input.title, 100, '标题')
        const city = field(input.city, 80, '城市')
        const place = field(input.place, 100, '地点')
        const text = field(input.body, 20000, '故事正文')
        const image = typeof input.image === 'string' && (input.image.startsWith('/assets/') || /^data:image\/(jpeg|png|webp);base64,/.test(input.image)) && input.image.length < 5_000_000 ? input.image : ''
        const post = await mutate((value) => {
          const existing = value.posts.find((item) => item.ownerId === userId && item.tripId === tripId)
          const published: Post = {
            id: existing?.id || `post-${randomUUID()}`, ownerId: userId, tripId,
            author: 'NextStop 旅行者', avatar: 'N', avatarColor: '#dcecc8', city, place, title,
            excerpt: text.slice(0, 90), body: text, image, publishedAt: new Date().toISOString(),
          }
          if (existing) Object.assign(existing, published)
          else value.posts.push(published)
          return published
        })
        return send(res, 200, { post })
      }
      const id = field(input.id, 100, '故事标识')
      const result = await mutate((value) => {
        const post = value.posts.find((item) => item.id === id)
        if (!post && !/^[a-z][a-z0-9-]{1,50}$/.test(id)) throw new Error('故事不存在')
        const item = reaction(value, id)
        if (path.endsWith('/follow')) {
          if (post?.ownerId === userId) throw new Error('不能跟随自己发布的故事')
          if (!item.followedBy.includes(userId)) {
            item.followedBy.push(userId)
            ;(item.followedAt ||= {})[userId] = new Date().toISOString()
          }
        } else if (path.endsWith('/like')) {
          if (item.likedBy.includes(userId)) {
            item.likedBy = item.likedBy.filter((value) => value !== userId)
            if (item.likedAt) delete item.likedAt[userId]
          } else {
            item.likedBy.push(userId)
            ;(item.likedAt ||= {})[userId] = new Date().toISOString()
          }
        } else {
          const text = field(input.text, 200, '评论')
          item.comments.push({ author: '旅行者', text, userId, createdAt: new Date().toISOString() })
        }
        return { likes: item.likedBy.length, influence: item.followedBy.length, comments: item.comments }
      })
      return send(res, 200, { reaction: result })
    } catch (error) {
      return send(res, 400, { error: error instanceof Error ? error.message : '社区请求失败' })
    }
  }
}
