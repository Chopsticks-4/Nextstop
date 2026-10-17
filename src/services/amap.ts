import type { GeoPoint } from '../types'

export interface WeatherForecast {
  date: string
  dayWeather: string
  nightWeather: string
  dayTemperature: string
  nightTemperature: string
}

export interface WeatherData {
  condition: string
  temperature: string
  reportTime: string
  forecast: WeatherForecast[]
}

export interface PlaceData {
  id: string
  name: string
  category: string
  address: string
  location: string
  image: string
  distanceMeters: number
  durationMinutes: number
  routeAvailable: boolean
}

export interface PlacesData {
  origin: string
  places: PlaceData[]
}

export interface PlaceSuggestion {
  id: string
  name: string
  address: string
  district: string
  coordinate: GeoPoint
}

export interface DistrictOption { name: string; adcode: string; level: string }
export interface LocationContext { city: string; province: string; location: string }

export async function fetchDistricts(parent = '中国'): Promise<DistrictOption[]> {
  const query = new URLSearchParams({ parent })
  const data = await getJson<{ districts: DistrictOption[] }>(`/api/amap/districts?${query}`)
  return data.districts
}

export async function fetchLocationContext(point: GeoPoint): Promise<LocationContext> {
  const query = new URLSearchParams({ latitude: String(point.latitude), longitude: String(point.longitude) })
  return getJson<LocationContext>(`/api/amap/location-context?${query}`)
}

export async function searchPlaceSuggestions(keyword: string, city: string): Promise<PlaceSuggestion[]> {
  const query = new URLSearchParams({ keyword, city })
  const data = await getJson<{ suggestions: PlaceSuggestion[] }>(`/api/amap/place-suggestions?${query}`)
  return data.suggestions
}

export async function fetchPlacePhoto(id: string): Promise<string> {
  const query = new URLSearchParams({ id })
  const data = await getJson<{ image: string }>(`/api/amap/place-photo?${query}`)
  return data.image || ''
}

export async function searchScenicPlaces(city: string, keyword: string): Promise<PlaceData[]> {
  const query = new URLSearchParams({ city, keyword })
  const data = await getJson<{ places: PlaceData[] }>(`/api/amap/scenic-search?${query}`)
  return data.places
}

export async function fetchScenicPool(city: string): Promise<PlaceData[]> {
  const query = new URLSearchParams({ city })
  const data = await getJson<{ places: PlaceData[] }>(`/api/amap/scenic-pool?${query}`)
  return data.places
}

export interface RouteLeg {
  mode: 'walking' | 'transit' | 'driving'
  modeLabel: string
  distanceMeters: number
  durationMinutes: number
  instructions: string[]
  polyline: string
  navigationUrl: string
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  const data = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(data.error || '服务暂时不可用')
  return data
}

export async function reverseGeocode(point: GeoPoint): Promise<string> {
  const query = new URLSearchParams({ latitude: String(point.latitude), longitude: String(point.longitude) })
  const data = await getJson<{ name: string }>(`/api/amap/reverse-geocode?${query}`)
  if (!data.name) throw new Error('未找到地点名称')
  return data.name
}

export async function fetchCityWeather(city: string): Promise<WeatherData> {
  const query = new URLSearchParams({ city })
  return getJson<WeatherData>(`/api/amap/weather?${query}`)
}

export async function fetchPlaces(city: string, interests: string[], point?: GeoPoint): Promise<PlacesData> {
  const query = new URLSearchParams({ city, interests: interests.join(',') })
  if (point) {
    query.set('latitude', String(point.latitude))
    query.set('longitude', String(point.longitude))
  }
  return getJson<PlacesData>(`/api/amap/places?${query}`)
}

export async function fetchRecommendedRoute(points: string[], city: string, names: string[]): Promise<RouteLeg[]> {
  const query = new URLSearchParams({ points: points.join('|'), city, names: names.join('|') })
  const data = await getJson<{ legs: RouteLeg[] }>(`/api/amap/route?${query}`)
  return data.legs
}

export function staticMapUrl(points: string[], city = '', names: string[] = []): string {
  const query = new URLSearchParams({ points: points.join('|'), city, names: names.join('|') })
  return `/api/amap/static-map?${query}`
}

export function footprintMapUrl(points: GeoPoint[]): string {
  const visible = points.slice(-10)
  const query = new URLSearchParams({
    points: visible.map((point) => `${point.longitude},${point.latitude}`).join('|'),
    systems: visible.map((point) => point.coordinateSystem === 'gcj02' ? 'gcj02' : 'wgs84').join('|'),
    start: String(points.length - visible.length),
  })
  return `/api/amap/footprint-map?${query}`
}
