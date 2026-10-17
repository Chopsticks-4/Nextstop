import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'

test('recommendation, blind box and full-plan selections accept reactive suggestions', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true } })
  try {
    const { useTripStore } = await server.ssrLoadModule('/src/stores/trip.ts')
    const store = useTripStore()
    const place = (id, name) => ({
      id, name, image: '', category: '景点', reason: '', whyNow: '', distance: '',
      travelMinutes: 10, suggestedMinutes: 30, transport: '步行', activities: [],
      highlights: [], foodIdea: '', caution: '', interestTags: [],
    })
    store.homeMeta.city = '上海'
    store.homeMeta.suggestions = [place('bund', '外滩'), place('tower', '东方明珠')]
    assert.equal(store.selectNextStop('bund'), true)
    assert.equal(store.state.trip.currentSuggestionId, 'bund')
    assert.deepEqual(store.state.trip.routeStops.map((stop) => stop.name), ['外滩'])

    store.blindBoxMeta.current = place('garden', '豫园')
    assert.equal(store.selectNextStop('garden'), true)
    assert.equal(store.state.trip.currentSuggestionId, 'garden')
    assert.equal(store.state.trip.routeStops.at(-1)?.name, '豫园')

    assert.equal(store.startFullTrip(240, ['散步']), true)
    assert.equal(store.state.trip.planningMode, 'full')
    assert.equal(store.state.trip.routeStops[0]?.status, 'current')
    assert.ok(store.state.trip.routeStops.some((stop) => stop.status === 'upcoming'))
  } finally {
    await server.close()
  }
})
