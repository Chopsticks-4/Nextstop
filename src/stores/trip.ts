import { computed, reactive, toRaw, watch } from 'vue'
import { createEmptyTrip, createIdleTrip, createInitialState, createSampleTrip } from '../fixtures/sample-trip'
import { clearWorkspace, readWorkspace, writeWorkspace } from '../services/local-storage'
import { sampleAdapter } from '../services/sample-adapter'
import { doubaoAdapter } from '../services/doubao-adapter'
import { planLocalRoute } from '../services/local-route-planner'
import { fetchCityWeather, fetchLocationContext, fetchPlaces, fetchRecommendedRoute, fetchScenicPool, searchScenicPlaces } from '../services/amap'
import { getCurrentLocation } from '../services/browser-location'
import { placeToSuggestion } from '../services/place-suggestions'
import { localPlacePhoto } from '../services/place-photo-overrides'
import { fetchCtripRank } from '../services/ctrip'
import type { CtripGuideEvidence } from '../services/ctrip'
import type { WeatherForecast } from '../services/amap'
import type { GeneratedVideo, ModuleId, PersistedState, RecordDraft, SaveStatus, Suggestion, Trip } from '../types'

const primaryNavigation: ModuleId[] = ['home', 'routes', 'records', 'story', 'profile']

const state = reactive<PersistedState>(createInitialState())
const weatherMeta = reactive({
  status: 'idle' as 'idle' | 'loading' | 'ready' | 'error',
  city: '',
  condition: '',
  temperature: '',
  error: '',
  reportTime: '',
  forecast: [] as WeatherForecast[],
})
let weatherEpoch = 0
let placesEpoch = 0
let routeEpoch = 0
const homeMeta = reactive({
  status: 'idle' as 'idle' | 'loading' | 'ready' | 'fallback',
  city: '',
  province: '',
  originLocation: '',
  usingLocation: false,
  suggestions: [] as Suggestion[],
  error: '',
  ranking: false,
})
const blindBoxMeta = reactive({
  status: 'idle' as 'idle' | 'loading' | 'ready' | 'error',
  city: '',
  pool: [] as Suggestion[],
  current: null as Suggestion | null,
  error: '',
})
const placeMeta = reactive({
  status: 'idle' as 'idle' | 'loading' | 'ready' | 'fallback',
  error: '',
  usingLocation: false,
})
const guideMeta = reactive({
  status: 'idle' as 'idle' | 'loading' | 'ready',
  source: 'local' as 'local' | 'doubao',
})

async function refreshRouteMetrics() {
  if (state.trip.status !== 'active' || state.trip.dataSource !== 'amap' || !state.trip.originLocation) return
  const epoch = ++routeEpoch
  const tripId = state.trip.id
  const stops = state.trip.routeStops.filter((stop) => stop.status === 'current' || stop.status === 'upcoming').slice(0, 4)
  const points = [state.trip.originLocation, ...stops.map((stop) => state.trip.suggestions.find((item) => item.id === stop.suggestionId)?.amapLocation)]
  if (points.some((point) => !point) || points.length < 2) return
  try {
    const names = [state.trip.originLabel || '当前位置', ...stops.map((stop) => stop.name)]
    const legs = await fetchRecommendedRoute(points as string[], state.trip.city, names)
    if (epoch !== routeEpoch || state.trip.id !== tripId) return
    legs.forEach((leg, index) => {
      const stop = state.trip.routeStops.find((item) => item.id === stops[index]?.id)
      if (stop) {
        stop.transport = `${leg.modeLabel}约 ${leg.durationMinutes} 分钟 · ${leg.distanceMeters < 1000 ? `${leg.distanceMeters} 米` : `${(leg.distanceMeters / 1000).toFixed(1)} 公里`}`
        stop.route = leg
      }
    })
  } catch { /* 已有地点仍可使用；地图和路线各自显示失败状态 */ }
}

function rankMatch(name: string, rankedName: string) {
  const clean = (value: string) => value.replace(/风景名胜区|景区|公园|博物馆|市|区|\s/g, '')
  const left = clean(name)
  const right = clean(rankedName)
  return left.length >= 2 && right.length >= 2 && (left === right || left.includes(right) || right.includes(left))
}

async function refreshRecommendations(forceLocation = false) {
  const epoch = ++placesEpoch
  homeMeta.status = 'loading'
  homeMeta.error = ''
  homeMeta.suggestions = []
  const manual = Boolean(state.homeSelection?.manual) && !forceLocation
  let city = manual ? state.homeSelection?.city || '' : ''
  let province = manual ? state.homeSelection?.province || '' : ''
  if (manual) homeMeta.city = city
  let point: Awaited<ReturnType<typeof getCurrentLocation>> | undefined
  try {
    if (!manual) {
      try {
        point = await getCurrentLocation()
        const context = await fetchLocationContext(point)
        city = context.city
        province = context.province
      } catch (error) {
        homeMeta.error = error instanceof Error ? error.message : '定位失败'
        city = state.trip.city || '杭州'
        point = undefined
      }
    }
    if (epoch !== placesEpoch) return
    homeMeta.city = city
    homeMeta.province = province
    if (blindBoxMeta.city !== city) {
      blindBoxMeta.city = city
      blindBoxMeta.pool = []
      blindBoxMeta.current = null
      blindBoxMeta.status = 'idle'
      blindBoxMeta.error = ''
    }
    void refreshWeather()
    const [placesResult, rankResult] = await Promise.allSettled([
      fetchPlaces(city, state.trip.interests, point),
      fetchCtripRank(city),
    ])
    if (epoch !== placesEpoch) return
    if (placesResult.status === 'rejected') throw placesResult.reason
    const ranked = rankResult.status === 'fulfilled' ? rankResult.value : []
    const suggestions = placesResult.value.places.map((place) => placeToSuggestion(place, city))
    const extras = await Promise.allSettled(ranked.slice(0, 4).filter((item) => !suggestions.some((suggestion) => rankMatch(suggestion.name, item.name))).map(async (item) => {
      const matches = await searchScenicPlaces(city, item.name)
      const match = matches.find((candidate) => rankMatch(candidate.name, item.name))
      if (!match) return null
      const rankedName = city.replace(/市$/, '') === '上海' && (item.name === '外滩' || item.name === '豫园') ? item.name : match.name
      return {
        ...placeToSuggestion({ ...match, name: rankedName }, city),
        rankPosition: item.rank || undefined,
        reason: item.reason || `携程${city}景点榜单推荐`,
        whyNow: `来自携程${city}景点榜单，位置已用高德核对。`,
      } satisfies Suggestion
    }))
    if (epoch !== placesEpoch) return
    for (const result of extras) {
      if (result.status === 'fulfilled' && result.value && !suggestions.some((item) => item.id === result.value?.id)) suggestions.push(result.value)
    }
    if (!suggestions.length) throw new Error('附近没有可用地点')
    for (const suggestion of suggestions) {
      const rankedPlace = ranked.find((item) => rankMatch(suggestion.name, item.name))
      if (rankedPlace) {
        suggestion.rankPosition = rankedPlace.rank || undefined
        if (rankedPlace.reason) suggestion.reason = rankedPlace.reason
      }
    }
    suggestions.sort((left, right) => {
      const leftRank = ranked.findIndex((item) => rankMatch(left.name, item.name))
      const rightRank = ranked.findIndex((item) => rankMatch(right.name, item.name))
      return (leftRank < 0 ? 99 : leftRank) - (rightRank < 0 ? 99 : rightRank)
    })
    homeMeta.city = city
    homeMeta.province = province
    homeMeta.originLocation = placesResult.value.origin
    homeMeta.usingLocation = Boolean(point)
    homeMeta.suggestions = suggestions
    homeMeta.ranking = Boolean(ranked.length)
    homeMeta.status = 'ready'
    placeMeta.status = 'ready'
    placeMeta.usingLocation = Boolean(point)
    placeMeta.error = ''
    if (!manual) state.homeSelection = { city, province, manual: false }
  } catch (error) {
    if (epoch !== placesEpoch) return
    homeMeta.city = city || '杭州'
    homeMeta.province = province
    void refreshWeather()
    homeMeta.originLocation = ''
    homeMeta.usingLocation = false
    homeMeta.suggestions = []
    homeMeta.ranking = false
    homeMeta.error = error instanceof Error ? error.message : '地点查询失败'
    homeMeta.status = 'fallback'
    placeMeta.status = 'fallback'
    placeMeta.error = homeMeta.error
  }
}

async function drawBlindBox() {
  const city = homeMeta.city
  if (!city) return false
  if (blindBoxMeta.city !== city) {
    blindBoxMeta.city = city
    blindBoxMeta.pool = []
    blindBoxMeta.current = null
  }
  blindBoxMeta.status = 'loading'
  blindBoxMeta.error = ''
  try {
    if (!blindBoxMeta.pool.length) {
      const places = await fetchScenicPool(city)
      if (homeMeta.city !== city) return false
      blindBoxMeta.pool = places.filter((place) => place.location).map((place) => placeToSuggestion(place, city)).filter((item) => item.image)
    }
    const choices = blindBoxMeta.pool.filter((item) => item.id !== blindBoxMeta.current?.id)
    if (!choices.length) throw new Error('这座城市暂时没有足够的带实景照景点可抽取')
    const random = new Uint32Array(1)
    const limit = Math.floor(0x100000000 / choices.length) * choices.length
    do { crypto.getRandomValues(random) } while (random[0]! >= limit)
    blindBoxMeta.current = choices[random[0]! % choices.length]!
    blindBoxMeta.status = 'ready'
    return true
  } catch (error) {
    if (homeMeta.city !== city) return false
    blindBoxMeta.error = error instanceof Error ? error.message : '景点盲盒暂不可用'
    blindBoxMeta.status = 'error'
    return false
  }
}

async function setHomeCity(province: string, city: string) {
  state.homeSelection = { city, province, manual: true }
  await refreshRecommendations()
}

async function useCurrentCity() {
  state.homeSelection = { city: '', province: '', manual: false }
  await refreshRecommendations(true)
}

async function refreshWeather() {
  const epoch = ++weatherEpoch
  const city = homeMeta.city || state.homeSelection?.city || state.trip.city
  weatherMeta.city = city
  weatherMeta.status = 'loading'
  weatherMeta.error = ''
  weatherMeta.condition = ''
  weatherMeta.temperature = ''
  weatherMeta.forecast = []
  try {
    const data = await fetchCityWeather(city)
    if (epoch !== weatherEpoch) return
    weatherMeta.condition = data.condition
    weatherMeta.temperature = `${data.temperature}°C`
    if (state.trip.status === 'active' && state.trip.city === city) {
      state.trip.weather = data.condition
      state.trip.temperature = weatherMeta.temperature
    }
    weatherMeta.reportTime = data.reportTime
    weatherMeta.forecast = data.forecast
    weatherMeta.status = 'ready'
  } catch (error) {
    if (epoch !== weatherEpoch) return
    weatherMeta.error = error instanceof Error ? error.message : '天气查询失败'
    weatherMeta.status = 'error'
  }
}
const meta = reactive({
  hydrated: false,
  storageLoaded: false,
  saveStatus: 'idle' as SaveStatus,
  lastSaved: '',
  saveError: '',
})

let saveTimer: number | undefined
let revisionCounter = 0
let writeQueue: Promise<void> = Promise.resolve()
let watching = false

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function snapshot(): PersistedState {
  return clone(toRaw(state))
}

function updateBadges(trip: Trip = state.trip) {
  for (const badge of trip.badges) {
    if (badge.id === 'first-record') {
      badge.progress = Math.min(trip.records.length, 1)
      badge.earned = trip.records.length >= 1
    }
    if (badge.id === 'three-moments') {
      badge.progress = Math.min(trip.records.length, 3)
      badge.earned = trip.records.length >= 3
    }
    if (badge.id === 'story-finisher') {
      badge.progress = trip.storySections.length ? 1 : 0
      badge.earned = trip.storySections.length > 0
    }
    if (badge.id === 'city-explorer') {
      badge.progress = Math.min(trip.records.length, 3)
      badge.earned = trip.records.length >= 3
    }
    if (badge.id === 'voice-memory') {
      const hasAudio = trip.records.some((record) => Boolean(record.audio)) || Boolean(trip.narrationAudio)
      badge.progress = hasAudio ? 1 : 0
      badge.earned = hasAudio
    }
  }
  trip.updatedAt = new Date().toISOString()
}

function queuePersist(revision: number) {
  const value = snapshot()
  value.revision = revision
  meta.saveStatus = 'saving'
  meta.saveError = ''
  writeQueue = writeQueue
    .then(() => writeWorkspace(value))
    .then(() => {
      if (revision === revisionCounter) {
        meta.saveStatus = 'saved'
        meta.lastSaved = new Date().toISOString()
      }
    })
    .catch((error: unknown) => {
      meta.saveStatus = 'error'
      meta.saveError = error instanceof Error ? error.message : '本地存储不可用'
    })
  return writeQueue
}

function scheduleSave() {
  if (!meta.hydrated) return
  revisionCounter += 1
  window.clearTimeout(saveTimer)
  meta.saveStatus = 'saving'
  const revision = revisionCounter
  saveTimer = window.setTimeout(() => void queuePersist(revision), 500)
}

function flushSave() {
  window.clearTimeout(saveTimer)
  revisionCounter += 1
  return queuePersist(revisionCounter)
}

function findTrip(tripId?: string) {
  if (!tripId || tripId === state.trip.id) return state.trip
  return state.historyTrips.find((trip) => trip.id === tripId)
}

function hasTripContent(trip: Trip) {
  return trip.records.length > 0 || Boolean(trip.generatedVideos?.length) || trip.storySections.length > 0 || trip.routeStops.some((stop) => stop.status === 'done' || stop.status === 'skipped')
}

function isLegacyAutoTrip(current: Trip, previous?: Trip) {
  if (!previous || current.status !== 'active' || previous.status !== 'completed' || hasTripContent(current)) return false
  const gap = new Date(current.updatedAt).getTime() - new Date(previous.updatedAt).getTime()
  return gap >= 0 && gap <= 2000
    && current.city === previous.city
    && current.availableMinutes === previous.availableMinutes
    && JSON.stringify(current.interests) === JSON.stringify(previous.interests)
}

function archiveCurrentTrip(force = false) {
  if (!force && !hasTripContent(state.trip)) return
  const current = clone(state.trip)
  state.historyTrips = [current, ...state.historyTrips.filter((trip) => trip.id !== current.id)].slice(0, 12)
}

async function hydrate() {
  meta.hydrated = false
  meta.storageLoaded = false
  let migratedDemoVideos = false
  try {
    const saved = await readWorkspace()
    if (saved) {
      Object.assign(state, saved)
      for (const trip of [state.trip, ...state.historyTrips]) {
        for (const video of trip.generatedVideos ?? []) {
          if (video.id === `demo-${trip.id}` && video.src === '/videos/demo.mp4') {
            video.src = '/videos/demo1.mp4'
            migratedDemoVideos = true
          }
        }
        for (const suggestion of trip.suggestions) {
          const photo = localPlacePhoto(trip.city, suggestion.name)
          if (photo) suggestion.image = photo
        }
      }
      if (!state.homeSelection) state.homeSelection = { city: '', province: '', manual: false }
      const sample = createSampleTrip()
      if (state.trip.id === sample.id
        && JSON.stringify(state.trip.records) === JSON.stringify(sample.records)
        && JSON.stringify(state.trip.storySections) === JSON.stringify(sample.storySections)) {
        state.trip = createIdleTrip(state.trip.city, state.trip.availableMinutes, state.trip.interests)
      }
      state.historyTrips = state.historyTrips.filter((trip) => trip.id !== 'trip-qingdao-sample'
        || JSON.stringify(trip.records) !== JSON.stringify(sample.records.slice(0, 2))
        || JSON.stringify(trip.storySections) !== JSON.stringify(sample.storySections)
        || JSON.stringify(trip.routeStops) !== JSON.stringify(sample.routeStops))
      if (isLegacyAutoTrip(state.trip, state.historyTrips[0])) {
        state.trip = createIdleTrip(state.trip.city, state.trip.availableMinutes, state.trip.interests)
      }
      const hasLegacyNavigation = state.toolbarModuleIds.some((id) => !primaryNavigation.includes(id))
      if (hasLegacyNavigation || state.toolbarModuleIds.length === 0) {
        state.toolbarModuleIds = [...primaryNavigation]
      }
    }
    meta.storageLoaded = true
    revisionCounter = state.revision || 0
    meta.saveStatus = saved ? 'saved' : 'idle'
    meta.lastSaved = saved ? state.trip.updatedAt : ''
  } catch (error: unknown) {
    meta.saveStatus = 'error'
    meta.saveError = error instanceof Error ? error.message : '无法读取本地草稿'
  } finally {
    meta.hydrated = true
    if (meta.storageLoaded && !watching) {
      watching = true
      watch(state, scheduleSave, { deep: true })
      watch(() => state.trip.city, () => { if (!homeMeta.city) void refreshWeather() })
    }
    if (migratedDemoVideos) scheduleSave()
    if (meta.storageLoaded) {
      void refreshWeather()
      void refreshRecommendations()
    }
  }
}

function currentSuggestion() {
  return state.trip.suggestions.find((item) => item.id === state.trip.currentSuggestionId) ?? state.trip.suggestions[0]
}

async function loadCurrentGuide(evidence?: CtripGuideEvidence) {
  const current = currentSuggestion()
  if (!current || state.trip.status !== 'active') return 'local' as const
  guideMeta.status = 'loading'
  const key = `${state.trip.id}:${state.trip.currentSuggestionId}`
  const result = await doubaoAdapter.getStopGuide(state.trip, evidence)
  if (`${state.trip.id}:${state.trip.currentSuggestionId}` === key) {
    Object.assign(current, {
      reason: result.data.reason,
      whyNow: result.data.whyNow,
      suggestedMinutes: result.data.suggestedMinutes,
      activities: result.data.activities,
      highlights: result.data.highlights,
      foodIdea: result.data.foodIdea,
      caution: result.data.caution,
    })
    guideMeta.source = result.source
    guideMeta.status = 'ready'
  }
  return result.source
}

async function replaceSuggestion() {
  if (state.trip.status !== 'active' || !state.trip.suggestions.length) return
  const next = state.trip.dataSource === 'amap'
    ? state.trip.suggestions[(state.trip.suggestions.findIndex((item) => item.id === state.trip.currentSuggestionId) + 1) % state.trip.suggestions.length]!
    : await sampleAdapter.getNextSuggestion(state.trip.currentSuggestionId)
  state.trip.currentSuggestionId = next.id
  const currentStop = state.trip.routeStops.find((stop) => stop.status === 'current')
  if (currentStop) {
    currentStop.suggestionId = next.id
    currentStop.name = next.name
    currentStop.transport = next.transport
  }
  updateBadges()
  void refreshRouteMetrics()
  return next
}

function followSuggestion() {
  if (state.trip.status !== 'active') return
  const suggestion = currentSuggestion()
  if (!suggestion) return
  let stop = state.trip.routeStops.find((item) => item.status === 'current')
  if (!stop) {
    stop = state.trip.routeStops.find((item) => item.status === 'upcoming')
  }
  if (stop) {
    stop.suggestionId = suggestion.id
    stop.name = suggestion.name
    stop.transport = suggestion.transport
    stop.status = 'current'
  } else {
    state.trip.routeStops.push({
      id: `stop-${crypto.randomUUID()}`,
      suggestionId: suggestion.id,
      name: suggestion.name,
      plannedTime: '下一站',
      status: 'current',
      transport: suggestion.transport,
    })
  }
  updateBadges()
  void refreshRouteMetrics()
}

function setNextStop(suggestionId: string) {
  if (state.trip.status !== 'active') return
  state.trip.currentSuggestionId = suggestionId
  followSuggestion()
}

function moveCurrentStop(kind: 'done' | 'skipped') {
  if (state.trip.status !== 'active') return
  const current = state.trip.routeStops.find((stop) => stop.status === 'current')
  if (current) current.status = kind
  const next = state.trip.routeStops.find((stop) => stop.status === 'upcoming')
  if (next) {
    next.status = 'current'
    state.trip.currentSuggestionId = next.suggestionId
  }
  state.trip.remainingMinutes = Math.max(0, state.trip.remainingMinutes - 30)
  updateBadges()
  void refreshRouteMetrics()
}

function replanRoute() {
  if (state.trip.status !== 'active') return
  if (state.trip.planningMode === 'single') return
  state.trip.routeStops = planLocalRoute(state.trip)
  updateBadges()
  void refreshRouteMetrics()
}

function addRecord(draft: RecordDraft) {
  if (state.trip.status !== 'active') return
  const record = {
    id: `record-${crypto.randomUUID()}`,
    ...draft,
    weather: weatherMeta.status === 'ready' && weatherMeta.city === state.trip.city ? `${weatherMeta.condition} ${weatherMeta.temperature}` : '天气未获取',
    recordedAt: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
  }
  state.trip.records.push(record)
  if (draft.coordinate) {
    const tripId = state.trip.id
    const label = draft.location || '最新记录地点'
    if (draft.coordinate.coordinateSystem === 'gcj02') {
      state.trip.originLocation = `${draft.coordinate.longitude},${draft.coordinate.latitude}`
      state.trip.originLabel = label
      void refreshRouteMetrics()
    } else {
      void fetchLocationContext(draft.coordinate).then((context) => {
        if (state.trip.id !== tripId || !state.trip.records.some((item) => item.id === record.id)) return
        state.trip.originLocation = context.location
        state.trip.originLabel = label
        void refreshRouteMetrics()
      }).catch(() => { /* 记录仍保留；定位转换失败不改变既有路线 */ })
    }
  }
  updateBadges()
}

function deleteRecord(recordId: string) {
  state.trip.records = state.trip.records.filter((record) => record.id !== recordId)
  updateBadges()
}

function saveGeneratedVideo(tripId: string, video: GeneratedVideo) {
  const trip = findTrip(tripId)
  if (!trip) return false
  trip.generatedVideos = [...(trip.generatedVideos ?? []).filter((item) => item.id !== video.id), video]
  trip.updatedAt = new Date().toISOString()
  return true
}

async function generateStory(tripId?: string) {
  const trip = findTrip(tripId)
  if (!trip) return 'local' as const
  const { data: story, source } = await doubaoAdapter.generateStory(clone(trip))
  trip.storyTitle = story.title
  trip.storySections = story.sections
  trip.narration = story.narration
  updateBadges(trip)
  scheduleSave()
  return source
}

async function completeTrip() {
  if (state.trip.status !== 'active' || !state.trip.records.length) throw new Error('当前没有可结束的旅行')
  if (!state.trip.storySections.length) await generateStory()
  const completedTrip = state.trip
  completedTrip.status = 'completed'
  completedTrip.updatedAt = new Date().toISOString()
  updateBadges()
  const completedId = completedTrip.id
  archiveCurrentTrip(true)
  state.trip = createIdleTrip(completedTrip.city, completedTrip.availableMinutes, completedTrip.interests)
  await flushSave()
  return completedId
}

async function saveStoryToHistory(tripId?: string) {
  const trip = findTrip(tripId)
  if (!trip || !trip.storySections.length) return false
  updateBadges(trip)
  if (trip.id === state.trip.id) archiveCurrentTrip()
  await flushSave()
  return meta.saveStatus !== 'error'
}

function markExported(tripId?: string) {
  const trip = findTrip(tripId)
  if (!trip) return
  const badge = trip.badges.find((item) => item.id === 'first-export')
  if (badge) {
    badge.earned = true
    badge.progress = 1
  }
  trip.updatedAt = new Date().toISOString()
  if (trip.id === state.trip.id) archiveCurrentTrip()
  scheduleSave()
}

function createTrip(city: string, minutes: number, interests: string[]) {
  archiveCurrentTrip()
  state.trip = createEmptyTrip(city || '杭州', minutes, interests.length ? [...interests] : ['散步', '拍照'])
  scheduleSave()
}

function startFullTrip(minutes: number, interests: string[]) {
  const selected = homeMeta.suggestions[0]
  if (!selected) return false
  createTrip(homeMeta.city, minutes, interests)
  state.trip.planningMode = 'full'
  if (weatherMeta.status === 'ready' && weatherMeta.city === homeMeta.city) {
    state.trip.weather = weatherMeta.condition
    state.trip.temperature = weatherMeta.temperature
  }
  state.trip.suggestions = clone(homeMeta.suggestions)
  state.trip.currentSuggestionId = selected.id
  state.trip.originLocation = homeMeta.originLocation || undefined
  state.trip.originLabel = homeMeta.usingLocation ? '当前位置' : `${homeMeta.city}市中心`
  state.trip.dataSource = selected.amapLocation && state.trip.originLocation ? 'amap' : 'fallback'
  state.trip.routeStops = [{ id: `stop-${crypto.randomUUID()}`, suggestionId: selected.id, name: selected.name, plannedTime: '现在', status: 'current', transport: selected.transport }]
  state.trip.routeStops = planLocalRoute(state.trip)
  void refreshRouteMetrics()
  return true
}

function selectNextStop(suggestionId: string) {
  const selected = homeMeta.suggestions.find((item) => item.id === suggestionId)
    || (blindBoxMeta.current?.id === suggestionId ? blindBoxMeta.current : undefined)
  if (!selected) return false
  const continuing = state.trip.status === 'active' && state.trip.city.replace(/市$/, '') === homeMeta.city.replace(/市$/, '')
  const previousOrigin = continuing ? state.trip.originLocation : undefined
  const previousOriginLabel = continuing ? state.trip.originLabel : undefined
  if (!continuing) {
    createTrip(homeMeta.city, state.trip.availableMinutes || 240, state.trip.interests)
  }
  const prior = state.trip.routeStops.filter((stop) => stop.status === 'done' || stop.status === 'skipped')
  const current = state.trip.routeStops.find((stop) => stop.status === 'current')
  if (current && current.suggestionId !== suggestionId) prior.push({ ...current, status: 'skipped' })
  state.trip.planningMode = 'single'
  state.trip.suggestions = [...state.trip.suggestions.filter((item) => item.id !== suggestionId), clone(selected)]
  state.trip.currentSuggestionId = suggestionId
  state.trip.originLocation = previousOrigin || homeMeta.originLocation || undefined
  state.trip.originLabel = previousOriginLabel || (homeMeta.usingLocation ? '当前位置' : `${homeMeta.city}市中心`)
  state.trip.dataSource = selected.amapLocation && state.trip.originLocation ? 'amap' : 'fallback'
  state.trip.routeStops = [...prior, current?.suggestionId === suggestionId ? current : {
    id: `stop-${crypto.randomUUID()}`, suggestionId, name: selected.name, plannedTime: '下一站', status: 'current', transport: selected.transport,
  }]
  void refreshRouteMetrics()
  return true
}

function selectCommunityStop(suggestion: Suggestion, city = '上海') {
  if (homeMeta.city.replace(/市$/, '') !== city) {
    homeMeta.originLocation = ''
    homeMeta.usingLocation = false
  }
  homeMeta.city = city
  homeMeta.province = city === '上海' ? '上海市' : ''
  homeMeta.suggestions = [suggestion, ...homeMeta.suggestions.filter((item) => item.id !== suggestion.id)]
  homeMeta.status = 'ready'
  state.homeSelection = { city, province: homeMeta.province, manual: true }
  return selectNextStop(suggestion.id)
}

function resumeTrip(tripId?: string) {
  if (tripId && tripId !== state.trip.id) {
    const historical = state.historyTrips.find((trip) => trip.id === tripId)
    if (historical) {
      archiveCurrentTrip()
      state.trip = clone(historical)
    }
  }
  state.trip.status = 'active'
  state.trip.updatedAt = new Date().toISOString()
  scheduleSave()
}

async function saveAndExit() {
  if (state.trip.status === 'idle') return true
  state.trip.status = 'exited'
  state.trip.updatedAt = new Date().toISOString()
  archiveCurrentTrip()
  try {
    await flushSave()
    return meta.saveStatus !== 'error'
  } catch {
    return false
  }
}

function moveToolbarModule(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= state.toolbarModuleIds.length) return
  const next = [...state.toolbarModuleIds]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  state.toolbarModuleIds = next
}

function toggleToolbarModule(moduleId: ModuleId) {
  const index = state.toolbarModuleIds.indexOf(moduleId)
  if (index >= 0) {
    if (state.toolbarModuleIds.length <= 3) return false
    state.toolbarModuleIds.splice(index, 1)
    return true
  }
  if (state.toolbarModuleIds.length >= 5) return false
  state.toolbarModuleIds.push(moduleId)
  return true
}

async function resetAll() {
  await clearWorkspace()
  const fresh = createInitialState()
  Object.assign(state, fresh)
  await flushSave()
}

export function useTripStore() {
  return {
    state,
    meta,
    weatherMeta,
    refreshWeather,
    placeMeta,
    homeMeta,
    blindBoxMeta,
    drawBlindBox,
    guideMeta,
    refreshPlaces: refreshRecommendations,
    refreshRecommendations,
    setHomeCity,
    useCurrentCity,
    startFullTrip,
    selectNextStop,
    selectCommunityStop,
    trip: computed(() => state.trip),
    currentSuggestion: computed(currentSuggestion),
    loadCurrentGuide,
    earnedBadges: computed(() => state.trip.badges.filter((badge) => badge.earned)),
    hydrate,
    flushSave,
    replaceSuggestion,
    followSuggestion,
    setNextStop,
    moveCurrentStop,
    replanRoute,
    addRecord,
    deleteRecord,
    saveGeneratedVideo,
    generateStory,
    completeTrip,
    saveStoryToHistory,
    markExported,
    createTrip,
    resumeTrip,
    saveAndExit,
    moveToolbarModule,
    toggleToolbarModule,
    resetAll,
    updateBadges,
  }
}
