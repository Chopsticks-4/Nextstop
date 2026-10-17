export async function prepareWechatImage(source: string, thumbnail = false): Promise<string> {
  if (!source.startsWith('data:image/') && !source.startsWith('/assets/') && !source.startsWith('https://')) {
    throw new Error('这张照片无法用于微信图文')
  }
  const picture = new Image()
  if (source.startsWith('https://')) picture.crossOrigin = 'anonymous'
  picture.src = source
  try { await picture.decode() }
  catch { throw new Error('照片读取失败，请换一张或上传本地封面') }
  const limit = thumbnail ? 320 : 1200
  const scale = Math.min(1, limit / Math.max(picture.naturalWidth, picture.naturalHeight))
  let width = Math.max(1, Math.round(picture.naturalWidth * scale))
  let height = Math.max(1, Math.round(picture.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  const maxBytes = thumbnail ? 60 * 1024 : 950 * 1024
  for (let attempt = 0; attempt < 8; attempt += 1) {
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器无法处理照片')
    context.drawImage(picture, 0, 0, width, height)
    let result: string
    try { result = canvas.toDataURL('image/jpeg', thumbnail ? 0.7 : Math.max(0.48, 0.82 - attempt * 0.05)) }
    catch { throw new Error('这张网络图片不允许转换，请换一张或上传本地封面') }
    if (Math.ceil((result.length - result.indexOf(',') - 1) * 0.75) < maxBytes) return result
    width = Math.max(1, Math.round(width * 0.8))
    height = Math.max(1, Math.round(height * 0.8))
  }
  throw new Error('照片压缩后仍然过大，请换一张照片')
}
