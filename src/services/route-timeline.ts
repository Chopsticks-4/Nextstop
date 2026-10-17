import type { RouteStop, TravelRecord } from '../types'

export type RouteTimelineEntry =
  | { kind: 'stop'; id: string; stop: RouteStop }
  | { kind: 'record'; id: string; record: TravelRecord }

function samePlace(left: string, right: string) {
  const clean = (value: string) => value.replace(/\s/g, '').toLowerCase()
  const a = clean(left)
  const b = clean(right)
  return Boolean(a && b && (a === b || (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a)))))
}

export function buildRouteTimeline(stops: RouteStop[], records: TravelRecord[]): RouteTimelineEntry[] {
  const grouped = new Map<string, TravelRecord[]>()
  const unmatched: TravelRecord[] = []
  for (const record of records) {
    const stop = stops.find((item) => samePlace(item.name, record.location))
    if (stop) grouped.set(stop.id, [...(grouped.get(stop.id) || []), record])
    else unmatched.push(record)
  }
  const entries: RouteTimelineEntry[] = []
  let addedUnmatched = false
  for (const stop of stops) {
    if (!addedUnmatched && stop.status === 'upcoming') {
      entries.push(...unmatched.map((record) => ({ kind: 'record' as const, id: record.id, record })))
      addedUnmatched = true
    }
    entries.push({ kind: 'stop', id: stop.id, stop })
    entries.push(...(grouped.get(stop.id) || []).map((record) => ({ kind: 'record' as const, id: record.id, record })))
  }
  if (!addedUnmatched) entries.push(...unmatched.map((record) => ({ kind: 'record' as const, id: record.id, record })))
  return entries
}
