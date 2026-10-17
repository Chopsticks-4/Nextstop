import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { test } from 'node:test'

test('published stories persist and influence counts distinct followers', async () => {
  const originalDirectory = process.cwd()
  const directory = await mkdtemp(join(tmpdir(), 'nextstop-community-'))
  process.chdir(directory)
  const { createCommunityMiddleware } = await import('../server/community.ts')
  const middleware = createCommunityMiddleware()
  const server = createServer((req, res) => { void middleware(req, res, () => { res.writeHead(404); res.end() }) })
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/community`
    const post = async (path, data) => {
      const response = await fetch(`${base}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      assert.equal(response.status, 200)
      return response.json()
    }
    const payload = { userId: 'author-1', tripId: 'trip-1', title: '上海的一天', city: '上海', place: '外滩', body: '沿着江边慢慢走。', image: '/assets/shanghai-bund.jpg' }
    const { post: published } = await post('publish', payload)
    assert.match(published.id, /^post-/)
    assert.equal((await post('publish', { ...payload, title: '更新的标题' })).post.id, published.id)
    assert.equal((await post('follow', { userId: 'reader-1', id: published.id })).reaction.influence, 1)
    assert.equal((await post('follow', { userId: 'reader-1', id: published.id })).reaction.influence, 1)
    assert.equal((await post('follow', { userId: 'reader-2', id: published.id })).reaction.influence, 2)
    assert.equal((await post('like', { userId: 'reader-1', id: published.id })).reaction.likes, 1)
    assert.equal((await post('comment', { userId: 'reader-2', id: published.id, text: '我也想去' })).reaction.comments[0].text, '我也想去')
    const authorImpact = await post('impact', { userId: 'author-1' })
    assert.equal(authorImpact.posts[0].influence, 2)
    assert.equal(authorImpact.received.filter((item) => item.kind === 'follow').length, 2)
    assert.equal(authorImpact.received.filter((item) => item.kind === 'like').length, 1)
    assert.equal(authorImpact.received.find((item) => item.kind === 'comment')?.text, '我也想去')
    const readerImpact = await post('impact', { userId: 'reader-2' })
    assert.equal(readerImpact.given.find((item) => item.kind === 'follow')?.storyId, published.id)
    assert.equal(readerImpact.given.find((item) => item.kind === 'comment')?.text, '我也想去')
    const response = await fetch(base)
    const listing = await response.json()
    assert.equal(listing.posts.length, 1)
    assert.equal(listing.posts[0].title, '更新的标题')
    assert.equal(listing.reactions[published.id].influence, 2)
    const disk = JSON.parse(await readFile(join(directory, 'data', 'community.json'), 'utf8'))
    assert.equal(disk.posts.length, 1)
  } finally {
    await new Promise((done) => server.close(done))
    process.chdir(originalDirectory)
    if (resolve(directory).startsWith(resolve(tmpdir()) + '\\')) await rm(directory, { recursive: true, force: true })
  }
})
