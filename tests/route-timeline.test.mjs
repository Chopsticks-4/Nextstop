import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRouteTimeline } from '../src/services/route-timeline.ts'

test('a new record appears after its matching stop without changing planned stops', () => {
  const stops = [
    { id: 'first', name: '西湖风景名胜区', status: 'current' },
    { id: 'later', name: '灵隐飞来峰景区', status: 'upcoming' },
  ]
  const records = [
    { id: 'at-first', location: '西湖风景名胜区', recordedAt: '10:15' },
    { id: 'elsewhere', location: '湖滨步行街', recordedAt: '10:40' },
  ]
  const entries = buildRouteTimeline(stops, records)
  assert.deepEqual(entries.map((entry) => entry.id), ['first', 'at-first', 'elsewhere', 'later'])
  assert.deepEqual(stops.map((stop) => stop.id), ['first', 'later'])
})

test('single-stop mode adds actual records to the live timeline', () => {
  const entries = buildRouteTimeline(
    [{ id: 'selected', name: '西湖', status: 'current' }],
    [{ id: 'record', location: '湖边茶馆', recordedAt: '15:20' }],
  )
  assert.deepEqual(entries.map((entry) => entry.kind), ['stop', 'record'])
})
