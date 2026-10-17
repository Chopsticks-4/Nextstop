import assert from 'node:assert/strict'
import test from 'node:test'
import { formatDistance, projectPoints, straightLineDistanceMeters, totalStraightLineDistanceMeters } from '../src/utils/geo.ts'
import { planLocalRoute, rankLocalSuggestions } from '../src/services/local-route-planner.ts'
import { amapPlaceSearchUrl } from '../src/services/external-map.ts'

test('straight-line distance uses coordinates and sums adjacent points', () => {
  const a = { latitude: 0, longitude: 0 }
  const b = { latitude: 0, longitude: 1 }
  const meters = straightLineDistanceMeters(a, b)
  assert.ok(meters > 111_000 && meters < 112_000)
  assert.equal(totalStraightLineDistanceMeters([a, b, a]), meters * 2)
  assert.equal(formatDistance(850), '850 米')
})

test('single-point footprint is centered in its view box', () => {
  assert.deepEqual(projectPoints([{ latitude: 30, longitude: 120 }], 400, 230), [{ x: 200, y: 115 }])
  assert.deepEqual(projectPoints([], 400, 230), [])
})

test('local route keeps completed/current stops, respects time budget and does not mutate input', () => {
  const suggestions = [
    { id: 'current', interestTags: ['散步'], travelMinutes: 10, suggestedMinutes: 40, name: '当前站', transport: '样例' },
    { id: 'rest', interestTags: ['美食'], travelMinutes: 5, suggestedMinutes: 20, name: '休息站', transport: '样例' },
    { id: 'long', interestTags: ['散步'], travelMinutes: 20, suggestedMinutes: 80, name: '远处站', transport: '样例' },
  ]
  const current = { id: 'stop-current', suggestionId: 'current', status: 'current', name: '当前站', plannedTime: '现在', transport: '样例' }
  const trip = { routeStops: [current], suggestions, interests: ['散步'], remainingMinutes: 80 }
  const result = planLocalRoute(trip)
  assert.deepEqual(result.map((stop) => stop.suggestionId), ['current', 'rest'])
  assert.equal(trip.remainingMinutes, 80)
  assert.deepEqual(trip.routeStops, [current])
  assert.equal(rankLocalSuggestions(suggestions.slice(1), ['散步'], 30)[0].id, 'rest')
})

test('external place link encodes the place and city as search parameters', () => {
  const url = new URL(amapPlaceSearchUrl('九溪烟树', '杭州'))
  assert.equal(url.origin, 'https://uri.amap.com')
  assert.equal(url.searchParams.get('keyword'), '九溪烟树')
  assert.equal(url.searchParams.get('city'), '杭州')
})

test('older saved suggestions without interest tags still rank by matching description', () => {
  const candidates = [
    { id: 'rest', name: '茶馆', category: '休息', reason: '坐坐', activities: [], highlights: [], foodIdea: '喝茶', travelMinutes: 10, suggestedMinutes: 30 },
    { id: 'walk', name: '林间小路', category: '漫步', reason: '走走', activities: [], highlights: [], foodIdea: '', travelMinutes: 10, suggestedMinutes: 30 },
  ]
  assert.equal(rankLocalSuggestions(candidates, ['自然'], 60)[0].id, 'walk')
})
