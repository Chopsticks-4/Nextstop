<script setup lang="ts">
import { computed, onActivated, onDeactivated, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowRight,
  BookOpenText,
  Camera,
  ChevronRight,
  Clock3,
  CloudSun,
  Footprints,
  MapPin,
  Mic,
  NotebookPen,
  Plus,
  RefreshCw,
  Route,
  Sparkles,
} from 'lucide-vue-next'
import BaseModal from '../../shared/ui/BaseModal.vue'
import { fetchDistricts, fetchLocationContext } from '../../services/amap'
import type { DistrictOption } from '../../services/amap'
import { useTripStore } from '../../stores/trip'
import { showToast } from '../../stores/ui'
import type { RecordType } from '../../types'

const store = useTripStore()
const router = useRouter()
const cityOpen = ref(false)
const fullPlanOpen = ref(false)
const planningBusy = ref(false)
const planningError = ref('')
const provinces = ref<DistrictOption[]>([])
const cities = ref<DistrictOption[]>([])
const provinceCode = ref('')
const cityCode = ref('')
const cityLoading = ref(false)
const cityError = ref('')
const failedPhotos = ref(new Set<string>())
const newMinutes = ref(240)
const newInterests = ref(['散步', '拍照'])
const interestChoices = ['散步', '拍照', '自然', '美食', '老街']
const isActive = computed(() => store.state.trip.status === 'active')
const currentHour = ref(new Date().getHours())
const greeting = computed(() => {
  const hour = currentHour.value
  if (hour < 5) return { salutation: '夜深了，', message: '把期待留给明天。' }
  if (hour < 11) return { salutation: '早上好，', message: '今天去遇见新风景。' }
  if (hour < 13) return { salutation: '中午好，', message: '给自己一点惊喜。' }
  if (hour < 18) return { salutation: '下午好，', message: '下一站有惊喜。' }
  return { salutation: '晚上好，', message: '去邂逅城市灯火。' }
})
let greetingTimer: number | null = null
function updateGreeting() { currentHour.value = new Date().getHours() }
function stopGreetingTimer() {
  if (greetingTimer !== null) window.clearInterval(greetingTimer)
  greetingTimer = null
}
const recommendations = computed(() => store.homeMeta.suggestions)
const selectedProvince = computed(() => provinces.value.find((item) => item.adcode === provinceCode.value))
const selectedCity = computed(() => cities.value.find((item) => item.adcode === cityCode.value))
const nextStop = computed(() => store.state.trip.routeStops.find((stop) => stop.status === 'upcoming'))
const storyCover = computed(() => store.state.trip.records.find((record) => record.image)?.image)
const currentCity = ref('')
const locationStatus = ref<'loading' | 'ready' | 'unavailable'>('loading')
const currentLocationLabel = computed(() => locationStatus.value === 'ready' ? currentCity.value : locationStatus.value === 'loading' ? '定位中…' : '位置未获取')
let locationWatchId: number | null = null
let locationEpoch = 0
let locationLookup = 0
let homeVisible = false

function stopCurrentLocation() {
  locationEpoch++
  if (locationWatchId !== null) navigator.geolocation.clearWatch(locationWatchId)
  locationWatchId = null
}

function startCurrentLocation() {
  if (!homeVisible || document.visibilityState === 'hidden' || !isActive.value || locationWatchId !== null) return
  locationStatus.value = 'loading'
  currentCity.value = ''
  if (!window.isSecureContext || !navigator.geolocation) {
    locationStatus.value = 'unavailable'
    return
  }
  const epoch = ++locationEpoch
  locationWatchId = navigator.geolocation.watchPosition(
    async ({ coords }) => {
      const lookup = ++locationLookup
      try {
        const context = await fetchLocationContext({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy })
        if (epoch !== locationEpoch || lookup !== locationLookup) return
        currentCity.value = context.city
        locationStatus.value = context.city ? 'ready' : 'unavailable'
      } catch {
        if (epoch === locationEpoch && lookup === locationLookup) locationStatus.value = 'unavailable'
      }
    },
    () => { if (epoch === locationEpoch) locationStatus.value = 'unavailable' },
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 30000 },
  )
}

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') stopCurrentLocation()
  else { updateGreeting(); startCurrentLocation() }
}

watch(isActive, (active) => { if (active) startCurrentLocation(); else stopCurrentLocation() })
onActivated(() => {
  homeVisible = true
  updateGreeting()
  greetingTimer = window.setInterval(updateGreeting, 60_000)
  startCurrentLocation()
  document.addEventListener('visibilitychange', onVisibilityChange)
})
onDeactivated(() => {
  homeVisible = false
  stopGreetingTimer()
  stopCurrentLocation()
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
onBeforeUnmount(() => {
  stopGreetingTimer()
  stopCurrentLocation()
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

async function openCityPicker() {
  cityOpen.value = true
  cityLoading.value = true
  cityError.value = ''
  try {
    provinces.value = await fetchDistricts()
    if (!provinces.value.length) throw new Error('没有获取到省份列表')
  } catch (error) {
    cityError.value = error instanceof Error ? error.message : '城市列表暂不可用'
  } finally {
    cityLoading.value = false
  }
}

async function onProvinceChange() {
  cityCode.value = ''
  cities.value = []
  if (!provinceCode.value) return
  cityLoading.value = true
  cityError.value = ''
  try {
    cities.value = await fetchDistricts(provinceCode.value)
    if (!cities.value.length || selectedProvince.value?.name.endsWith('市')) {
      const province = selectedProvince.value
      cities.value = province ? [province] : []
    }
  } catch (error) {
    cityError.value = error instanceof Error ? error.message : '城市列表暂不可用'
  } finally {
    cityLoading.value = false
  }
}

async function confirmCity() {
  if (!selectedProvince.value || !selectedCity.value) return
  cityOpen.value = false
  await store.setHomeCity(selectedProvince.value.name, selectedCity.value.name)
}

async function useLocation() {
  cityOpen.value = false
  await store.useCurrentCity()
}

function chooseNextStop(suggestionId: string) {
  if (!store.selectNextStop(suggestionId)) return
  void router.push('/route')
}

function quickRecord(type: RecordType) {
  void router.push({ path: '/records', query: { compose: type } })
}

function toggleInterest(interest: string) {
  const index = newInterests.value.indexOf(interest)
  if (index >= 0) newInterests.value.splice(index, 1)
  else newInterests.value.push(interest)
}

function openNewTrip() {
  planningError.value = ''
  fullPlanOpen.value = true
}

async function createTrip() {
  if (planningBusy.value) return
  planningBusy.value = true
  planningError.value = ''
  try {
    if (!recommendations.value.length) await store.refreshRecommendations()
    if (!store.startFullTrip(newMinutes.value, newInterests.value)) {
      throw new Error(store.homeMeta.error || '暂无可规划的景点，请切换城市后重试')
    }
    fullPlanOpen.value = false
    await router.push('/route')
  } catch (error) {
    planningError.value = error instanceof Error ? error.message : '全程规划暂时无法生成'
  } finally {
    planningBusy.value = false
  }
}

function photoFailed(id: string, image: string) { return failedPhotos.value.has(`${id}:${image}`) }
function onRecommendationImageError(id: string, image: string) { failedPhotos.value.add(`${id}:${image}`) }
</script>

<template>
  <div class="page home-page">
    <section class="home-intro">
      <div>
        <p class="eyebrow">{{ isActive ? `${store.state.trip.date} · ${currentLocationLabel}` : '下一段旅程，由你决定' }}</p>
        <h1>{{ greeting.salutation }}<br /><em>{{ greeting.message }}</em></h1>
      </div>
      <div class="weather-pill"><CloudSun :size="19" /><span>{{ store.weatherMeta.status === 'ready' ? store.weatherMeta.temperature : '天气' }}<small>{{ store.weatherMeta.status === 'ready' ? store.weatherMeta.condition : store.weatherMeta.status === 'loading' ? '获取中…' : '暂不可用' }}</small></span></div>
    </section>
    <section class="weather-detail" aria-live="polite">
      <div class="weather-detail-heading"><span>{{ store.weatherMeta.city || store.homeMeta.city }}天气 · 高德</span><button type="button" :disabled="store.weatherMeta.status === 'loading'" @click="store.refreshWeather()"><RefreshCw :size="13" /> 刷新</button></div>
      <p v-if="store.weatherMeta.status === 'error'">实时天气暂不可用：{{ store.weatherMeta.error }}</p>
      <p v-else-if="store.weatherMeta.status === 'loading'">正在获取实时天气和未来三天预报…</p>
      <template v-else-if="store.weatherMeta.status === 'ready'">
        <div v-if="store.weatherMeta.forecast.length" class="weather-forecast">
          <div v-for="day in store.weatherMeta.forecast" :key="day.date"><strong>{{ day.date.slice(5) }}</strong><span>{{ day.dayWeather }}</span><small>{{ day.nightTemperature }}–{{ day.dayTemperature }}°C</small></div>
        </div>
        <p v-if="store.weatherMeta.reportTime">实况发布于 {{ store.weatherMeta.reportTime }}</p>
      </template>
    </section>

    <button v-if="store.state.trip.status === 'exited'" class="resume-banner" type="button" @click="store.resumeTrip(); showToast('已恢复上次旅行')">
      <span><Route :size="18" /> 上次旅行已保存到本机</span><strong>继续 <ChevronRight :size="15" /></strong>
    </button>

    <div class="city-toolbar card">
      <div><span>当前推荐城市</span><strong><MapPin :size="15" /> {{ store.homeMeta.city || '定位中…' }}</strong><small>{{ store.state.homeSelection?.manual ? '手动选择' : store.homeMeta.usingLocation ? '按实时位置' : '定位不可用时按城市推荐' }}</small></div>
      <button type="button" @click="openCityPicker">切换城市 <ChevronRight :size="14" /></button>
    </div>

    <button class="new-trip-launch" type="button" @click="openNewTrip">
      <span class="new-trip-launch-icon"><Plus :size="22" /></span>
      <span><strong>开启全程旅途规划</strong><small>自动生成完整路线与后续站点</small></span>
      <ArrowRight :size="19" />
    </button>

    <div class="section-heading"><h2>{{ store.homeMeta.city || '附近' }}值得去</h2><span class="light-label">左右滑动查看更多</span></div>
    <p v-if="store.homeMeta.status === 'loading'" class="sample-disclaimer">正在获取地点与携程景点榜单…</p>
    <p v-else-if="store.homeMeta.error" class="sample-disclaimer">{{ store.homeMeta.error }}；请刷新或切换城市重试。</p>
    <div v-if="recommendations.length" class="recommendation-rail" aria-label="地点推荐，横向滚动">
      <article v-for="recommendation in recommendations" :key="recommendation.id" class="suggestion-card">
        <div class="suggestion-image">
          <img v-if="recommendation.image && !photoFailed(recommendation.id, recommendation.image)" :src="recommendation.image" :alt="`${recommendation.name}实景照片`" @error="onRecommendationImageError(recommendation.id, recommendation.image)" />
          <div v-else class="photo-unavailable">实景照片暂不可用</div>
          <div class="image-topline">
            <span class="sample-tag"><Sparkles :size="11" /> {{ recommendation.rankPosition ? `携程景点榜 #${recommendation.rankPosition}` : recommendation.image.startsWith('/assets/shanghai-') ? '本地实景照片' : '高德景点实景' }}</span>
            <span class="category-tag">{{ recommendation.category }}</span>
          </div>
          <div class="image-title"><span>NEXT STOP</span><h2>{{ recommendation.name }}</h2></div>
        </div>
        <div class="suggestion-content">
          <p class="suggestion-reason">{{ recommendation.reason }}</p>
          <div class="meta-row">
            <span class="meta-item"><Clock3 :size="14" /> 建议 {{ recommendation.suggestedMinutes }} 分钟</span>
            <span class="meta-item"><MapPin :size="14" /> {{ recommendation.distance }}</span>
          </div>
          <button class="primary-button full-width" type="button" @click="chooseNextStop(recommendation.id)">选为 NextStop <ArrowRight :size="16" /></button>
        </div>
      </article>
    </div>

    <section class="blind-box card" aria-label="景点盲盒">
      <div class="blind-box-heading"><span class="blind-icon"><Sparkles :size="19" /></span><div><h2>景点盲盒</h2><p>从{{ store.homeMeta.city || '当前城市' }}的景点里随机抽一个 NextStop</p></div></div>
      <template v-if="store.blindBoxMeta.current">
        <div class="blind-photo">
          <img v-if="store.blindBoxMeta.current.image && !photoFailed(store.blindBoxMeta.current.id, store.blindBoxMeta.current.image)" :src="store.blindBoxMeta.current.image" :alt="`${store.blindBoxMeta.current.name}实景照片`" @error="onRecommendationImageError(store.blindBoxMeta.current.id, store.blindBoxMeta.current.image)" />
          <span v-else>实景照片暂不可用</span>
        </div>
        <div class="blind-place"><span>随机抽中 · 高德景点</span><h3>{{ store.blindBoxMeta.current.name }}</h3><p><MapPin :size="13" /> {{ store.blindBoxMeta.current.address || store.homeMeta.city }}</p></div>
        <div class="blind-actions"><button class="secondary-button" type="button" :disabled="store.blindBoxMeta.status === 'loading'" @click="store.drawBlindBox()"><RefreshCw :size="15" /> {{ store.blindBoxMeta.status === 'loading' ? '抽取中…' : '换一个盲盒' }}</button><button class="primary-button" type="button" @click="chooseNextStop(store.blindBoxMeta.current.id)">选为 NextStop <ArrowRight :size="15" /></button></div>
      </template>
      <button v-else class="primary-button full-width" type="button" :disabled="!store.homeMeta.city || store.blindBoxMeta.status === 'loading'" @click="store.drawBlindBox()"><Sparkles :size="16" /> {{ store.blindBoxMeta.status === 'loading' ? '正在抽取景点…' : '抽一个景点' }}</button>
      <p v-if="store.blindBoxMeta.error" class="blind-error">{{ store.blindBoxMeta.error }}</p>
    </section>

    <template v-if="isActive">

    <div class="section-heading">
      <h2>随手记一笔</h2>
      <span class="light-label">不用组织语言</span>
    </div>
    <section class="quick-record-grid">
      <button type="button" @click="quickRecord('image')"><span class="quick-icon photo"><Camera :size="21" /></span><strong>拍一张</strong><small>留住此刻</small></button>
      <button type="button" @click="quickRecord('audio')"><span class="quick-icon audio"><Mic :size="21" /></span><strong>说一句</strong><small>录下原声</small></button>
      <button type="button" @click="quickRecord('text')"><span class="quick-icon text"><NotebookPen :size="21" /></span><strong>写一句</strong><small>想到什么</small></button>
    </section>

    <div v-if="nextStop" class="section-heading">
      <h2>接下来</h2>
      <router-link to="/route">完整路线 <ChevronRight :size="14" /></router-link>
    </div>
    <router-link v-if="nextStop" to="/route" class="next-preview card">
      <span class="next-number">02</span>
      <div><strong>{{ nextStop.name }}</strong><p>{{ nextStop.plannedTime }} · {{ nextStop.transport }}</p></div>
      <ChevronRight :size="18" />
    </router-link>

    <router-link to="/story" class="story-teaser">
      <img v-if="storyCover" :src="storyCover" alt="我的旅行记录封面" />
      <div class="story-shade"></div>
      <div class="story-teaser-content">
        <span><BookOpenText :size="15" /> 你的完整故事</span>
        <h2>{{ store.state.trip.storyTitle || '旅行结束后，故事会在这里等你' }}</h2>
        <p>把散落的时刻，重新读成一次旅行。</p>
        <strong>翻开故事 <ArrowRight :size="16" /></strong>
      </div>
    </router-link>
    <p class="sample-disclaimer">推荐来自高德真实地点，并参考携程景点榜单；路线以当前旅途选择为准。</p>
    </template>

    <BaseModal :open="cityOpen" title="切换推荐城市" eyebrow="按省份与城市逐级选择" @close="cityOpen = false">
      <div class="form-field"><label>省份 / 直辖市</label><select v-model="provinceCode" :disabled="cityLoading && !provinces.length" @change="onProvinceChange"><option value="">请选择省份</option><option v-for="province in provinces" :key="province.adcode" :value="province.adcode">{{ province.name }}</option></select></div>
      <div class="form-field"><label>城市</label><select v-model="cityCode" :disabled="!provinceCode || cityLoading"><option value="">请选择城市</option><option v-for="city in cities" :key="city.adcode" :value="city.adcode">{{ city.name }}</option></select></div>
      <p v-if="cityError" class="new-trip-note">{{ cityError }}</p>
      <button class="primary-button full-width" type="button" :disabled="!selectedCity || cityLoading" @click="confirmCity">查看这座城市的推荐</button>
      <button class="secondary-button full-width location-reset" type="button" @click="useLocation"><MapPin :size="14" /> 恢复按实时位置推荐</button>
    </BaseModal>

    <BaseModal :open="fullPlanOpen" title="开启全程旅途规划" eyebrow="自动安排整段旅途" @close="fullPlanOpen = false">
      <p class="new-trip-note">目的城市：{{ store.homeMeta.city }}。选择时间与兴趣后，会自动安排第一站及后续路线。</p>
      <div class="form-field"><label>大概有多少时间？</label><select v-model.number="newMinutes"><option :value="120">2 小时</option><option :value="240">4 小时</option><option :value="360">6 小时</option><option :value="480">一整天</option></select></div>
      <div class="form-field"><label>现在对什么感兴趣？</label><div class="chip-row"><button v-for="interest in interestChoices" :key="interest" class="chip" :class="{ active: newInterests.includes(interest) }" type="button" @click="toggleInterest(interest)">{{ interest }}</button></div></div>
      <p v-if="planningError" class="new-trip-note" role="alert">{{ planningError }}</p>
      <button class="primary-button full-width" type="button" :disabled="planningBusy || store.homeMeta.status === 'loading'" @click="createTrip">{{ planningBusy ? '正在生成路线…' : store.homeMeta.status === 'loading' ? '正在获取景点…' : recommendations.length ? '生成全程路线' : '重试并生成全程路线' }} <ArrowRight :size="16" /></button>
    </BaseModal>
  </div>
</template>

<style scoped>
.home-intro { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin: 4px 0 22px; }
.home-intro h1 { margin: 7px 0 0; font-size: 34px; line-height: 1.13; letter-spacing: -1.5px; }
.home-intro h1 em { color: var(--green); font-style: normal; }
.weather-pill { display: flex; align-items: center; gap: 7px; padding: 9px 10px; border-radius: 14px; background: #edf0e7; color: var(--green); }
.weather-pill span { font-size: 12px; font-weight: 700; }
.weather-pill small { display: block; margin-top: 1px; color: var(--muted); font-size: 8px; font-weight: 400; }
.weather-detail { margin: -10px 0 18px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 14px; background: #fff; font-size: 10px; color: var(--muted); }
.weather-detail-heading { display: flex; justify-content: space-between; align-items: center; color: var(--ink); font-weight: 650; }
.weather-detail-heading button { display: inline-flex; align-items: center; gap: 4px; border: 0; background: transparent; color: var(--green); font-size: 10px; cursor: pointer; }
.weather-detail-heading button:disabled { opacity: .5; cursor: wait; }
.weather-detail p { margin: 7px 0 0; }
.weather-forecast { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; margin-top: 8px; }
.weather-forecast div { display: flex; flex-direction: column; gap: 3px; padding: 7px; border-radius: 9px; background: var(--green-soft); }
.weather-forecast strong { color: var(--ink); }
.weather-forecast small { color: var(--muted); }
.resume-banner { width: 100%; min-height: 48px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; padding: 0 13px; border: 0; border-radius: 14px; background: var(--orange-soft); color: #815d3d; font-size: 11px; }
.resume-banner span, .resume-banner strong { display: flex; align-items: center; gap: 6px; }
.city-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; padding: 13px 15px; border-radius: 16px; }
.city-toolbar > div { display: grid; gap: 3px; }
.city-toolbar span, .city-toolbar small { color: var(--muted); font-size: 10px; }
.city-toolbar strong { display: flex; align-items: center; gap: 5px; color: var(--ink); font-size: 16px; }
.city-toolbar button { display: inline-flex; align-items: center; gap: 2px; min-height: 36px; padding: 0 10px; border: 1px solid var(--line); border-radius: 11px; background: var(--green-soft); color: var(--green); font-size: 11px; white-space: nowrap; }
.new-trip-launch { width: 100%; min-height: 70px; display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 12px 16px; border: 0; border-radius: 20px; background: var(--green); color: #fff; box-shadow: 0 10px 26px rgb(44 90 68 / 22%); text-align: left; }
.new-trip-launch > span:nth-child(2) { flex: 1; }
.new-trip-launch strong, .new-trip-launch small { display: block; }
.new-trip-launch strong { font-size: 16px; }
.new-trip-launch small { margin-top: 4px; color: rgb(255 255 255 / 72%); font-size: 10px; }
.new-trip-launch-icon { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 13px; background: rgb(255 255 255 / 14%); }
.new-trip-note { color: var(--muted); font-size: 10px; line-height: 1.6; }
.recommendation-rail { display: flex; gap: 13px; overflow-x: auto; margin: 0 -18px; padding: 4px 18px 24px; scroll-snap-type: x mandatory; scrollbar-width: thin; }
.suggestion-card { flex: 0 0 min(82vw, 340px); overflow: hidden; border-radius: 23px; background: #fff; box-shadow: 0 12px 30px rgb(30 58 43 / 11%); scroll-snap-align: center; }
.suggestion-image { position: relative; height: 185px; overflow: hidden; background: #dce4db; }
.suggestion-image::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgb(15 29 22 / 12%) 35%, rgb(13 27 20 / 72%) 100%); }
.suggestion-image img { width: 100%; height: 100%; object-fit: cover; }
.photo-unavailable { display: grid; place-items: center; width: 100%; height: 100%; color: #52665a; font-size: 12px; }
.blind-box { margin: 20px 0 26px; padding: 17px; }
.blind-box-heading { display: flex; align-items: center; gap: 11px; margin-bottom: 14px; }
.blind-icon { width: 39px; height: 39px; display: grid; place-items: center; border-radius: 12px; background: var(--green-soft); color: var(--green); }
.blind-box-heading h2 { margin: 0; font-size: 16px; }
.blind-box-heading p { margin: 3px 0 0; color: var(--muted); font-size: 10px; }
.blind-photo { display: grid; place-items: center; height: 176px; overflow: hidden; border-radius: 13px; background: #dce4db; color: var(--muted); font-size: 11px; }
.blind-photo img { width: 100%; height: 100%; object-fit: cover; }
.blind-place { padding: 12px 2px; }
.blind-place > span { color: var(--green); font-size: 9px; }
.blind-place h3 { margin: 4px 0; font-size: 19px; }
.blind-place p { display: flex; align-items: center; gap: 4px; margin: 0; color: var(--muted); font-size: 10px; }
.blind-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.blind-actions button { display: flex; align-items: center; justify-content: center; gap: 5px; padding-inline: 5px; font-size: 10px; }
.blind-error { margin: 10px 0 0; color: #a25d4c; font-size: 10px; }
.image-topline { position: absolute; z-index: 2; top: 14px; left: 14px; right: 14px; display: flex; justify-content: space-between; gap: 8px; }
.category-tag { padding: 5px 9px; border-radius: 999px; background: rgb(32 49 40 / 42%); color: #fff; font-size: 9px; backdrop-filter: blur(8px); }
.image-title { position: absolute; z-index: 2; left: 20px; bottom: 18px; color: #fff; }
.image-title span { font-size: 9px; font-weight: 600; letter-spacing: 2.2px; opacity: 0.8; }
.image-title h2 { margin: 4px 0 0; font-size: 31px; letter-spacing: -1px; }
.suggestion-content { padding: 18px; }
.suggestion-content .primary-button { margin-top: 12px; }
.suggestion-reason { margin-bottom: 14px; color: #405249; font-size: 14px; line-height: 1.75; }
.suggestion-actions { display: grid; grid-template-columns: 1fr 50px; gap: 9px; margin-top: 18px; }
.suggestion-actions .primary-button { width: 100%; }
.icon-only { padding: 0; }
.time-button { width: 100%; min-height: 38px; display: flex; align-items: center; justify-content: center; gap: 5px; margin-top: 7px; border: 0; background: transparent; color: var(--muted); font-size: 11px; }
.suggestion-loading { display: grid; gap: 16px; padding: 24px 18px; }
.light-label { color: #98a199; font-size: 10px; }
.quick-record-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.quick-record-grid button { display: flex; flex-direction: column; align-items: flex-start; min-height: 116px; padding: 13px; border: 1px solid var(--line); border-radius: 19px; background: #fff; color: var(--ink); }
.quick-icon { width: 37px; height: 37px; display: grid; place-items: center; margin-bottom: 10px; border-radius: 12px; }
.quick-icon.photo { background: #e7efe5; color: #47735a; }
.quick-icon.audio { background: #f7e9df; color: #b47a51; }
.quick-icon.text { background: #e8edf3; color: #5c7187; }
.quick-record-grid strong { font-size: 13px; }
.quick-record-grid small { margin-top: 3px; color: var(--muted); font-size: 9px; }
.next-preview { display: flex; align-items: center; gap: 13px; padding: 15px; }
.next-number { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 13px; background: var(--orange-soft); color: var(--orange); font-size: 12px; font-weight: 700; }
.next-preview div { flex: 1; }
.next-preview strong { font-size: 14px; }
.next-preview p { margin: 4px 0 0; color: var(--muted); font-size: 10px; }
.next-preview > svg { color: #9aa49d; }
.story-teaser { position: relative; height: 230px; display: block; overflow: hidden; margin-top: 26px; border-radius: 24px; color: #fff; }
.story-teaser > img { width: 100%; height: 100%; object-fit: cover; }
.story-shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgb(18 35 26 / 82%), rgb(18 35 26 / 12%)); }
.story-teaser-content { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; padding: 22px; }
.story-teaser-content > span { display: flex; align-items: center; gap: 6px; font-size: 10px; opacity: 0.85; }
.story-teaser-content h2 { max-width: 250px; margin: 10px 0 7px; font-size: 23px; line-height: 1.3; }
.story-teaser-content p { max-width: 230px; margin-bottom: 15px; font-size: 11px; line-height: 1.6; opacity: 0.78; }
.story-teaser-content strong { display: flex; align-items: center; gap: 7px; font-size: 12px; }
.sample-disclaimer { margin: 16px 10px 0; color: #9aa39c; font-size: 9px; line-height: 1.6; text-align: center; }
.place-actions { display: flex; justify-content: flex-end; margin: -4px 0 10px; }
.place-actions button { display: inline-flex; align-items: center; gap: 4px; border: 0; background: transparent; color: var(--green); font-size: 10px; cursor: pointer; }
.location-reset { display: flex; align-items: center; justify-content: center; gap: 5px; margin-top: 8px; }
</style>
