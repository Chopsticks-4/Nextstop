import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'

test('following a community story selects its Shanghai place as the active NextStop', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true } })
  try {
    const { useTripStore } = await server.ssrLoadModule('/src/stores/trip.ts')
    const store = useTripStore()
    const suggestion = {
      id: 'community-bund', name: '外滩', image: '/assets/shanghai-bund.jpg', category: '上海景点',
      reason: '沿江散步', whyNow: '看故事去旅行', distance: '路线待规划', travelMinutes: 0,
      suggestedMinutes: 60, transport: '请按当前位置选择交通方式', activities: [], highlights: [],
      foodIdea: '', caution: '',
    }
    assert.equal(store.selectCommunityStop(suggestion), true)
    assert.equal(store.state.trip.city, '上海')
    assert.equal(store.state.trip.status, 'active')
    assert.equal(store.state.trip.currentSuggestionId, suggestion.id)
    assert.equal(store.state.trip.routeStops.find((stop) => stop.status === 'current')?.name, '外滩')
    assert.equal(store.currentSuggestion.value?.name, '外滩')
    assert.equal(store.selectCommunityStop({ ...suggestion, id: 'community-west-lake', name: '西湖' }, '杭州'), true)
    assert.equal(store.state.trip.city, '杭州')
    assert.equal(store.state.trip.routeStops.find((stop) => stop.status === 'current')?.name, '西湖')
  } finally {
    await server.close()
  }
})
