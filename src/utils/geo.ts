import type { GeoPoint } from '../types'

const EARTH_RADIUS_METERS = 6_371_000
const toRadians = (degrees: number) => degrees * Math.PI / 180

export function straightLineDistanceMeters(a: GeoPoint, b: GeoPoint): number {
  const latitudeDelta = toRadians(b.latitude - a.latitude)
  const longitudeDelta = toRadians(b.longitude - a.longitude)
  const arc = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(longitudeDelta / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(arc)))
}

export function totalStraightLineDistanceMeters(points: GeoPoint[]): number {
  return points.slice(1).reduce((total, point, index) => total + straightLineDistanceMeters(points[index], point), 0)
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} 米` : `${(meters / 1000).toFixed(1)} 公里`
}

export function projectPoints(points: GeoPoint[], width: number, height: number, padding = 28) {
  if (!points.length) return []
  const middleLatitude = points.reduce((sum, point) => sum + point.latitude, 0) / points.length
  const longitudeScale = Math.cos(toRadians(middleLatitude))
  const minLatitude = Math.min(...points.map((point) => point.latitude))
  const maxLatitude = Math.max(...points.map((point) => point.latitude))
  const minLongitude = Math.min(...points.map((point) => point.longitude * longitudeScale))
  const maxLongitude = Math.max(...points.map((point) => point.longitude * longitudeScale))
  const latitudeSpan = maxLatitude - minLatitude
  const longitudeSpan = maxLongitude - minLongitude
  const latitudeRange = latitudeSpan || 0.001
  const longitudeRange = longitudeSpan || 0.001
  const drawableWidth = width - padding * 2
  const drawableHeight = height - padding * 2
  const scale = Math.min(drawableWidth / longitudeRange, drawableHeight / latitudeRange)
  const offsetX = (width - longitudeRange * scale) / 2
  const offsetY = (height - latitudeRange * scale) / 2

  return points.map((point) => ({
    x: longitudeSpan ? offsetX + (point.longitude * longitudeScale - minLongitude) * scale : width / 2,
    y: latitudeSpan ? offsetY + (maxLatitude - point.latitude) * scale : height / 2,
  }))
}
