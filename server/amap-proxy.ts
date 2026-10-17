import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

type AmapResult = { status?: string; info?: string; infocode?: string }
type AmapGeocode = AmapResult & { geocodes?: Array<{ adcode?: string }> }
type AmapConvert = AmapResult & { locations?: string }
type AmapRegeocode = AmapResult & { regeocode?: { formatted_address?: string; addressComponent?: { province?: string; city?: string | string[]; district?: string } } }
type AmapDistricts = AmapResult & { districts?: Array<{ name?: string; adcode?: string; level?: string; districts?: Array<{ name?: string; adcode?: string; level?: string }> }> }
type AmapLive = AmapResult & { lives?: Array<{ weather?: string; temperature?: string; reporttime?: string }> }
type AmapForecast = AmapResult & { forecasts?: Array<{ casts?: Array<{ date?: string; dayweather?: string; nightweather?: string; daytemp?: string; nighttemp?: string }> }> }
type AmapPlaces = AmapResult & { pois?: Array<{ id?: string; name?: string; type?: string; address?: string | string[]; location?: string; distance?: string; photos?: Array<{ url?: string }> }> }
type AmapInputTips = AmapResult & { tips?: Array<{ id?: string; name?: string; address?: string | string[]; district?: string; location?: string }> }
type AmapWalking = AmapResult & { route?: { paths?: Array<{ distance?: string; duration?: string; steps?: Array<{ instruction?: string; polyline?: string }> }> } }
type AmapDriving = AmapWalking
type AmapTransit = AmapResult & { route?: { transits?: Array<{
  distance?: string
  duration?: string
  walking_distance?: string
  segments?: Array<{
    walking?: { steps?: Array<{ instruction?: string; polyline?: string }> }
    bus?: { buslines?: Array<{ name?: string; departure_stop?: { name?: string }; arrival_stop?: { name?: string }; polyline?: string }> }
    railway?: { name?: string; departure_stop?: { name?: string }; arrival_stop?: { name?: string }}
  }>
}> } }
let nextAmapRequestAt = 0

async function throttleAmap() {
  const now = Date.now()
  const delay = Math.max(0, nextAmapRequestAt - now)
  nextAmapRequestAt = now + delay + 300
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
}

function coordinate(value: string): string | null {
  const parts = value.split(',').map(Number)
  if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1]) || Math.abs(parts[0]!) > 180 || Math.abs(parts[1]!) > 90) return null
  return `${parts[0]!.toFixed(6)},${parts[1]!.toFixed(6)}`
}

function firstPhoto(pois?: AmapPlaces['pois']) {
  return pois?.[0]?.photos?.find((photo) => typeof photo.url === 'string' && photo.url.startsWith('https://'))?.url || ''
}

async function placePhoto(id: string, key: string) {
  const detail = await requestAmap<AmapPlaces>('/v3/place/detail', { id, extensions: 'all' }, key)
  return firstPhoto(detail.pois)
}

async function walking(origin: string, destination: string, key: string) {
  const result = await requestAmap<AmapWalking>('/v3/direction/walking', { origin, destination }, key)
  const path = result.route?.paths?.[0]
  if (!path) throw new Error('没有可用的步行路线')
  return {
    mode: 'walking' as const,
    modeLabel: '步行',
    distanceMeters: Number(path.distance) || 0,
    durationMinutes: Math.max(1, Math.ceil((Number(path.duration) || 0) / 60)),
    instructions: (path.steps || []).map((step) => step.instruction).filter(Boolean),
    polyline: (path.steps || []).map((step) => step.polyline).filter(Boolean).join(';'),
  }
}

async function driving(origin: string, destination: string, key: string) {
  const result = await requestAmap<AmapDriving>('/v3/direction/driving', { origin, destination, strategy: '10' }, key)
  const path = result.route?.paths?.[0]
  if (!path) throw new Error('没有可用的驾车路线')
  return {
    mode: 'driving' as const,
    modeLabel: '打车/驾车',
    distanceMeters: Number(path.distance) || 0,
    durationMinutes: Math.max(1, Math.ceil((Number(path.duration) || 0) / 60)),
    instructions: (path.steps || []).map((step) => step.instruction).filter(Boolean),
    polyline: (path.steps || []).map((step) => step.polyline).filter(Boolean).join(';'),
  }
}

async function transit(origin: string, destination: string, city: string, key: string) {
  const result = await requestAmap<AmapTransit>('/v3/direction/transit/integrated', { origin, destination, city, strategy: '0' }, key)
  const path = result.route?.transits?.[0]
  if (!path) throw new Error('没有可用的公交路线')
  const instructions: string[] = []
  const polylines: string[] = []
  for (const segment of path.segments || []) {
    for (const step of segment.walking?.steps || []) {
      if (step.instruction) instructions.push(step.instruction)
      if (step.polyline) polylines.push(step.polyline)
    }
    for (const line of segment.bus?.buslines || []) {
      const stations = line.departure_stop?.name && line.arrival_stop?.name ? `（${line.departure_stop.name} → ${line.arrival_stop.name}）` : ''
      if (line.name) instructions.push(`乘坐 ${line.name}${stations}`)
      if (line.polyline) polylines.push(line.polyline)
    }
    if (segment.railway?.name) instructions.push(`乘坐 ${segment.railway.name}`)
  }
  return {
    mode: 'transit' as const,
    modeLabel: '公交/地铁',
    distanceMeters: Number(path.distance) || 0,
    durationMinutes: Math.max(1, Math.ceil((Number(path.duration) || 0) / 60)),
    instructions: instructions.filter(Boolean),
    polyline: polylines.join(';'),
  }
}

function navigationUrl(destination: string, name: string, mode: 'walking' | 'transit' | 'driving') {
  const url = new URL('https://uri.amap.com/navigation')
  const uriMode = mode === 'walking' ? 'walk' : mode === 'transit' ? 'bus' : 'car'
  url.search = new URLSearchParams({ to: `${destination},${name}`, mode: uriMode, src: 'NextStop', coordinate: 'gaode', callnative: '0' }).toString()
  return url.toString()
}

async function recommendedRoute(origin: string, destination: string, city: string, key: string, destinationName = '目的地') {
  const walk = await walking(origin, destination, key)
  let selected: Awaited<ReturnType<typeof walking>> | Awaited<ReturnType<typeof driving>> | Awaited<ReturnType<typeof transit>> = walk
  if (walk.distanceMeters > 1800) {
    const alternatives = await Promise.allSettled([
      transit(origin, destination, city, key),
      driving(origin, destination, key),
    ])
    const publicTransport = alternatives[0].status === 'fulfilled' ? alternatives[0].value : null
    const car = alternatives[1].status === 'fulfilled' ? alternatives[1].value : null
    if (walk.distanceMeters <= 8000 && publicTransport) selected = publicTransport
    else if (publicTransport && car) selected = publicTransport.durationMinutes <= car.durationMinutes + 12 ? publicTransport : car
    else selected = publicTransport || car || walk
  }
  return { ...selected, navigationUrl: navigationUrl(destination, destinationName, selected.mode) }
}

function send(response: ServerResponse, status: number, body: object) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(body))
}

async function requestAmap<T extends AmapResult>(path: string, params: Record<string, string>, key: string): Promise<T> {
  const url = new URL(path, 'https://restapi.amap.com')
  url.search = new URLSearchParams({ ...params, key, output: 'JSON' }).toString()
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await throttleAmap()
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw new Error('高德服务暂时不可用')
    const data = await response.json() as T
    if (data.status === '1') return data
    if (data.info === 'CUQPS_HAS_EXCEEDED_THE_LIMIT' && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)))
      continue
    }
    throw new Error(`高德服务返回错误：${data.info || data.infocode || '未知错误'}`)
  }
  throw new Error('高德服务暂时不可用')
}

async function handle(request: IncomingMessage, response: ServerResponse, key: string) {
  const url = new URL(request.url || '/', 'http://localhost')
  if (!url.pathname.startsWith('/api/amap/')) return false
  if (request.method !== 'GET') {
    send(response, 405, { error: '仅支持 GET 请求' })
    return true
  }
  if (!key) {
    send(response, 503, { error: '未配置高德 Web 服务 Key，请检查 .env.local 中的 AMAP_WEB_KEY' })
    return true
  }
  try {
    if (url.pathname === '/api/amap/districts') {
      const parent = url.searchParams.get('parent')?.trim() || '中国'
      if (parent.length > 40 || !/^[\p{Script=Han}0-9]+$/u.test(parent)) {
        send(response, 400, { error: '行政区名称无效' })
        return true
      }
      const result = await requestAmap<AmapDistricts>('/v3/config/district', { keywords: parent, subdistrict: '1', extensions: 'base' }, key)
      const districts = (result.districts?.[0]?.districts || []).filter((item) => item.name && item.adcode).map((item) => ({ name: item.name!, adcode: item.adcode!, level: item.level || '' }))
      send(response, 200, { districts })
      return true
    }
    if (url.pathname === '/api/amap/location-context') {
      const latitude = Number(url.searchParams.get('latitude'))
      const longitude = Number(url.searchParams.get('longitude'))
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        send(response, 400, { error: '经纬度无效' })
        return true
      }
      const converted = await requestAmap<AmapConvert>('/v3/assistant/coordinate/convert', { locations: `${longitude},${latitude}`, coordsys: 'gps' }, key)
      const location = coordinate(converted.locations || '')
      if (!location) throw new Error('当前位置坐标转换失败')
      const result = await requestAmap<AmapRegeocode>('/v3/geocode/regeo', { location, extensions: 'base' }, key)
      const component = result.regeocode?.addressComponent
      const city = typeof component?.city === 'string' && component.city ? component.city : component?.province || ''
      if (!city) throw new Error('无法识别当前位置所在城市')
      send(response, 200, { city, province: component?.province || '', location })
      return true
    }
    if (url.pathname === '/api/amap/place-suggestions') {
      const keyword = url.searchParams.get('keyword')?.trim() || ''
      const city = url.searchParams.get('city')?.trim() || ''
      if (keyword.length < 2 || keyword.length > 50 || city.length > 40) {
        send(response, 400, { error: '地点关键词或城市名称无效' })
        return true
      }
      const result = await requestAmap<AmapInputTips>('/v3/assistant/inputtips', {
        keywords: keyword,
        datatype: 'poi',
        ...(city ? { city, citylimit: 'true' } : {}),
      }, key)
      const suggestions = (result.tips || []).filter((tip) => tip.name && coordinate(tip.location || '')).slice(0, 6).map((tip, index) => {
        const [longitude, latitude] = coordinate(tip.location || '')!.split(',').map(Number)
        return {
          id: tip.id || `${tip.name}-${index}`,
          name: tip.name!,
          address: Array.isArray(tip.address) ? tip.address.join('') : tip.address || '',
          district: tip.district || '',
          coordinate: { longitude, latitude, coordinateSystem: 'gcj02' },
        }
      })
      send(response, 200, { suggestions })
      return true
    }
    if (url.pathname === '/api/amap/place-photo') {
      const id = url.searchParams.get('id')?.trim() || ''
      if (!/^[A-Za-z0-9]{5,32}$/.test(id)) {
        send(response, 400, { error: '地点 ID 无效' })
        return true
      }
      send(response, 200, { image: await placePhoto(id, key) })
      return true
    }
    if (url.pathname === '/api/amap/scenic-search') {
      const city = url.searchParams.get('city')?.trim() || ''
      const keyword = url.searchParams.get('keyword')?.trim() || ''
      if (!city || city.length > 40 || keyword.length < 2 || keyword.length > 80) {
        send(response, 400, { error: '城市或景点名称无效' })
        return true
      }
      const result = await requestAmap<AmapPlaces>('/v3/place/text', { keywords: keyword, city, citylimit: 'true', extensions: 'all', offset: '25' }, key)
      const places = (result.pois || []).filter((poi) => poi.id && poi.name && poi.type?.startsWith('风景名胜') && coordinate(poi.location || '') && firstPhoto([poi])).map((poi) => ({
        id: poi.id!, name: poi.name!, category: (poi.type || '').split(';')[0] || '景点',
        address: Array.isArray(poi.address) ? poi.address.join('') : poi.address || '',
        location: coordinate(poi.location || '')!, image: firstPhoto([poi]),
        distanceMeters: 0, durationMinutes: 0, routeAvailable: false,
      }))
      send(response, 200, { places })
      return true
    }
    if (url.pathname === '/api/amap/scenic-pool') {
      const city = url.searchParams.get('city')?.trim() || ''
      if (!city || city.length > 40) {
        send(response, 400, { error: '城市名称无效' })
        return true
      }
      const seen = new Set<string>()
      const places = []
      for (let page = 1; page <= 4; page += 1) {
        const result = await requestAmap<AmapPlaces>('/v3/place/text', { types: '110000', city, citylimit: 'true', extensions: 'all', offset: '20', page: String(page) }, key)
        for (const poi of result.pois || []) {
          if (!poi.id || !poi.name || !coordinate(poi.location || '') || !firstPhoto([poi]) || seen.has(poi.id)) continue
          seen.add(poi.id)
          places.push({
            id: poi.id, name: poi.name, category: (poi.type || '').split(';')[0] || '景点',
            address: Array.isArray(poi.address) ? poi.address.join('') : poi.address || '',
            location: coordinate(poi.location || '')!, image: firstPhoto([poi]),
            distanceMeters: 0, durationMinutes: 0, routeAvailable: false,
          })
        }
        if ((result.pois || []).length < 20) break
      }
      send(response, 200, { places })
      return true
    }
    if (url.pathname === '/api/amap/reverse-geocode') {
      const latitude = Number(url.searchParams.get('latitude'))
      const longitude = Number(url.searchParams.get('longitude'))
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        send(response, 400, { error: '经纬度无效' })
        return true
      }
      const converted = await requestAmap<AmapConvert>('/v3/assistant/coordinate/convert', {
        locations: `${longitude},${latitude}`, coordsys: 'gps',
      }, key)
      if (!converted.locations) throw new Error('坐标转换没有返回结果')
      const place = await requestAmap<AmapRegeocode>('/v3/geocode/regeo', {
        location: converted.locations, extensions: 'base',
      }, key)
      const name = place.regeocode?.formatted_address
      if (!name) throw new Error('当前位置没有可用的地点名称')
      send(response, 200, { name })
      return true
    }
    if (url.pathname === '/api/amap/weather') {
      const city = url.searchParams.get('city')?.trim() || ''
      if (!city || city.length > 40) {
        send(response, 400, { error: '城市名称无效' })
        return true
      }
      const geocode = await requestAmap<AmapGeocode>('/v3/geocode/geo', { address: city }, key)
      const adcode = geocode.geocodes?.find((item) => item.adcode)?.adcode
      if (!adcode) throw new Error(`找不到“${city}”的天气区域编码`)
      const [live, forecast] = await Promise.all([
        requestAmap<AmapLive>('/v3/weather/weatherInfo', { city: adcode, extensions: 'base' }, key),
        requestAmap<AmapForecast>('/v3/weather/weatherInfo', { city: adcode, extensions: 'all' }, key),
      ])
      const current = live.lives?.[0]
      if (!current?.weather || !current.temperature) throw new Error('没有查询到实时天气')
      send(response, 200, {
        condition: current.weather,
        temperature: current.temperature,
        reportTime: current.reporttime || '',
        forecast: (forecast.forecasts?.[0]?.casts || []).slice(0, 3).map((cast) => ({
          date: cast.date || '',
          dayWeather: cast.dayweather || '',
          nightWeather: cast.nightweather || '',
          dayTemperature: cast.daytemp || '',
          nightTemperature: cast.nighttemp || '',
        })),
      })
      return true
    }
    if (url.pathname === '/api/amap/places') {
      const city = url.searchParams.get('city')?.trim() || ''
      if (!city || city.length > 40) {
        send(response, 400, { error: '城市名称无效' })
        return true
      }
      const geo = await requestAmap<AmapGeocode & { geocodes?: Array<{ adcode?: string; location?: string }> }>('/v3/geocode/geo', { address: city }, key)
      const center = coordinate(geo.geocodes?.[0]?.location || '')
      if (!center) throw new Error(`找不到“${city}”的中心位置`)
      const latitude = url.searchParams.get('latitude')
      const longitude = url.searchParams.get('longitude')
      let origin = center
      if (latitude && longitude && coordinate(`${longitude},${latitude}`)) {
        const converted = await requestAmap<AmapConvert>('/v3/assistant/coordinate/convert', { locations: `${longitude},${latitude}`, coordsys: 'gps' }, key)
        origin = coordinate(converted.locations || '') || center
      }
      const scenic = await requestAmap<AmapPlaces>('/v3/place/around', {
        location: origin, types: '110000', radius: '20000', offset: '25', sortrule: 'distance', extensions: 'all',
      }, key)
      const seen = new Set<string>()
      const candidates = (scenic.pois || []).filter((poi) => {
        if (!poi.id || !poi.name || !coordinate(poi.location || '') || !firstPhoto([poi]) || seen.has(poi.id)) return false
        seen.add(poi.id)
        return true
      }).slice(0, 6)
      if (!candidates.length) throw new Error(`“${city}”附近没有找到可推荐地点`)
      const places = []
      for (const poi of candidates) {
        let route = null
        try { route = await walking(origin, coordinate(poi.location || '')!, key) } catch { /* 单个路线失败不影响真实 POI */ }
        places.push({
          id: poi.id,
          name: poi.name,
          category: (poi.type || '').split(';')[0] || '地点',
          address: Array.isArray(poi.address) ? poi.address.join('') : poi.address || '',
          location: coordinate(poi.location || ''),
          image: firstPhoto([poi]),
          distanceMeters: route?.distanceMeters || Number(poi.distance) || 0,
          durationMinutes: route?.durationMinutes || 0,
          routeAvailable: Boolean(route),
        })
      }
      send(response, 200, { origin, places })
      return true
    }
    if (url.pathname === '/api/amap/route') {
      const points = (url.searchParams.get('points') || '').split('|').map(coordinate)
      const city = url.searchParams.get('city')?.trim() || ''
      const names = (url.searchParams.get('names') || '').split('|')
      if (points.length < 2 || points.length > 5 || points.some((point) => !point)) {
        send(response, 400, { error: '路线坐标无效' })
        return true
      }
      if (!city || city.length > 40) {
        send(response, 400, { error: '路线城市名称无效' })
        return true
      }
      const legs = []
      for (let index = 1; index < points.length; index += 1) {
        legs.push(await recommendedRoute(points[index - 1]!, points[index]!, city, key, names[index] || `第 ${index} 站`))
      }
      send(response, 200, { legs })
      return true
    }
    if (url.pathname === '/api/amap/static-map' || url.pathname === '/api/amap/footprint-map') {
      const footprint = url.pathname === '/api/amap/footprint-map'
      let points = (url.searchParams.get('points') || '').split('|').map(coordinate)
      if (!points.length || points.length > (footprint ? 10 : 5) || points.some((point) => !point)) {
        send(response, 400, { error: '地图坐标无效' })
        return true
      }
      if (footprint) {
        const systems = (url.searchParams.get('systems') || '').split('|')
        if (systems.length === 1 && !systems[0]) systems.splice(0, 1, ...points.map(() => 'wgs84'))
        if (systems.length !== points.length || systems.some((system) => system !== 'wgs84' && system !== 'gcj02')) {
          send(response, 400, { error: '足迹坐标系无效' })
          return true
        }
        const gpsIndexes = systems.flatMap((system, index) => system === 'wgs84' ? [index] : [])
        if (gpsIndexes.length) {
          const converted = await requestAmap<AmapConvert>('/v3/assistant/coordinate/convert', {
            locations: gpsIndexes.map((index) => points[index]).join('|'), coordsys: 'gps',
          }, key)
          const convertedPoints = (converted.locations || '').split(';').map(coordinate)
          if (convertedPoints.length !== gpsIndexes.length || convertedPoints.some((point) => !point)) throw new Error('足迹坐标转换失败')
          gpsIndexes.forEach((index, position) => { points[index] = convertedPoints[position]! })
        }
      }
      const mapUrl = new URL('/v3/staticmap', 'https://restapi.amap.com')
      mapUrl.searchParams.set('key', key)
      if (!footprint) mapUrl.searchParams.set('zoom', '13')
      mapUrl.searchParams.set('size', '750*440')
      if (footprint) {
        const start = Number(url.searchParams.get('start') || '0')
        if (!Number.isInteger(start) || start < 0 || start > 100000) {
          send(response, 400, { error: '足迹顺序无效' })
          return true
        }
        mapUrl.searchParams.set('labels', points.map((point, index) => `${start + index + 1},0,1,16,0xFFFFFF,0x367452:${point}`).join('|'))
        if (points.length > 1) mapUrl.searchParams.set('paths', `5,0x367452,1,,:${points.join(';')}`)
      } else {
        mapUrl.searchParams.set('markers', `mid,,A:${points.join(';')}`)
      }
      if (!footprint && points.length > 1) {
        try {
          const city = url.searchParams.get('city')?.trim() || ''
          const names = (url.searchParams.get('names') || '').split('|')
          const legs = []
          for (let index = 1; index < points.length; index += 1) {
            legs.push(city
              ? await recommendedRoute(points[index - 1]!, points[index]!, city, key, names[index] || `第 ${index} 站`)
              : await walking(points[index - 1]!, points[index]!, key))
          }
          const polyline = legs.map((leg) => leg.polyline).filter(Boolean).join(';')
          if (polyline) mapUrl.searchParams.set('paths', `5,0x367452,1,,:${polyline}`)
        } catch { /* 路线失败时仍展示真实地图和真实地点标记 */ }
      }
      const mapResponse = await fetch(mapUrl, { signal: AbortSignal.timeout(10000) })
      const contentType = mapResponse.headers.get('content-type') || ''
      if (!mapResponse.ok || !contentType.startsWith('image/')) {
        const body = await mapResponse.text()
        let info = ''
        try { info = (JSON.parse(body) as AmapResult).info || '' } catch { /* 非 JSON 响应 */ }
        throw new Error(`高德地图图片暂时不可用${info ? `：${info}` : ''}`)
      }
      response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=300' })
      response.end(Buffer.from(await mapResponse.arrayBuffer()))
      return true
    }
    send(response, 404, { error: '接口不存在' })
  } catch (error) {
    send(response, 502, { error: error instanceof Error ? error.message : '高德服务暂时不可用' })
  }
  return true
}

export function amapProxy(key: string): Plugin {
  const middleware = (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    void handle(request, response, key).then((handled) => { if (!handled) next() })
  }
  return {
    name: 'amap-web-service-proxy',
    configureServer(server) { server.middlewares.use(middleware) },
    configurePreviewServer(server) { server.middlewares.use(middleware) },
  }
}
