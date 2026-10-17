import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { test } from 'node:test'
import { createWechatDraftMiddleware } from '../server/wechat-draft.ts'

const photo = `data:image/jpeg;base64,${Buffer.from('a local picture').toString('base64')}`
const extraPhoto = `data:image/jpeg;base64,${Buffer.from('an extra picture').toString('base64')}`
const cover = `data:image/jpeg;base64,${Buffer.from('selected cover').toString('base64')}`

test('saves complete illustrated story and selected cover as a WeChat draft', async () => {
  const calls = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, options = {}) => {
    const endpoint = new URL(url).pathname
    calls.push({ endpoint, options })
    const response = endpoint.endsWith('/token') ? { access_token: 'test-token', expires_in: 7200 }
      : endpoint.endsWith('/media/uploadimg') ? { url: 'https://mmbiz.qpic.cn/test-photo' }
        : endpoint.endsWith('/material/add_material') ? { media_id: 'cover-media' }
          : endpoint.endsWith('/draft/add') ? { media_id: 'draft-media' }
            : { errcode: 404, errmsg: 'unexpected endpoint' }
    return new Response(JSON.stringify(response), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  const middleware = createWechatDraftMiddleware({ appId: 'wx0000000000000000', appSecret: 'test-only-secret' })
  const server = createServer((req, res) => { void middleware(req, res, () => { res.writeHead(404); res.end() }) })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const { port } = server.address()
    const payload = JSON.stringify({
      title: '完整旅行故事', city: '杭州', date: '2026-10-17', cover,
      sections: [
        { title: '开场', text: '第一段文字', images: [photo] },
        { title: '收束', text: '第二段文字', images: [] },
      ], extraImages: [extraPhoto],
    })
    const result = await new Promise((resolve, reject) => {
      const req = request({ hostname: '127.0.0.1', port, path: '/api/wechat/draft', method: 'POST', headers: {
        Origin: `http://127.0.0.1:${port}`, 'Content-Type': 'application/json',
      } }, (res) => {
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }))
      })
      req.on('error', reject)
      req.end(payload)
    })
    assert.equal(result.status, 200)
    assert.equal(result.body.mediaId, 'draft-media')
    assert.deepEqual(calls.map((call) => call.endpoint), ['/cgi-bin/token', '/cgi-bin/media/uploadimg', '/cgi-bin/media/uploadimg', '/cgi-bin/material/add_material', '/cgi-bin/draft/add'])
    const article = JSON.parse(calls[4].options.body).articles[0]
    assert.equal(article.thumb_media_id, 'cover-media')
    assert.match(article.content, /第一段文字/)
    assert.match(article.content, /第二段文字/)
    assert.match(article.content, /https:\/\/mmbiz\.qpic\.cn\/test-photo/)
    assert.equal((article.content.match(/<img /g) || []).length, 2)
    assert.equal(article.title, '完整旅行故事')
  } finally {
    globalThis.fetch = originalFetch
    await new Promise((resolve) => server.close(resolve))
  }
})
