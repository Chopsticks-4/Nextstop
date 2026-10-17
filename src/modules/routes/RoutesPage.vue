<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, Check, Clock3, Coffee, Footprints, Lightbulb, MapPin, NotebookPen, RefreshCw, SkipForward, Sparkles, TriangleAlert } from 'lucide-vue-next'
import LocalMap from '../../shared/ui/LocalMap.vue'
import EmptyState from '../../shared/ui/EmptyState.vue'
import { amapPlaceSearchUrl } from '../../services/external-map'
import { fetchCtripGuide, visibleCtripResults } from '../../services/ctrip'
import type { CtripGuideEvidence } from '../../services/ctrip'
import { useTripStore } from '../../stores/trip'
import { showToast } from '../../stores/ui'
import { buildRouteTimeline } from '../../services/route-timeline'

const store = useTripStore()
const router = useRouter()
const isActive = computed(() => store.state.trip.status === 'active')
const suggestion = computed(() => store.currentSuggestion.value)
const currentStop = computed(() => store.state.trip.routeStops.find((stop) => stop.status === 'current'))
const timeline = computed(() => buildRouteTimeline(store.state.trip.routeStops, store.state.trip.records))
const routeStops = computed(() => store.state.trip.routeStops.filter((stop) => stop.status === 'current' || stop.status === 'upcoming').slice(0, 4))
const ctripState = ref<'loading' | 'ready' | 'missing' | 'error'>('loading')
const ctripEvidence = ref<CtripGuideEvidence | null>(null)
const ctripResults = computed(() => visibleCtripResults(ctripEvidence.value))
const guideKey = computed(() => currentStop.value ? `${store.state.trip.id}:${currentStop.value.id}:${currentStop.value.suggestionId}` : '')
const guideLabel = computed(() => {
  if (store.guideMeta.status === 'loading' || ctripState.value === 'loading') return '正在生成…'
  if (ctripState.value === 'ready' && store.guideMeta.source === 'doubao') return '携程数据 · 豆包整理'
  return store.guideMeta.source === 'doubao' ? '豆包介绍' : '地点基础信息'
})
const mapPoints = computed(() => {
  if (store.state.trip.dataSource !== 'amap' || !store.state.trip.originLocation) return []
  return [store.state.trip.originLocation, ...routeStops.value.map((stop) => store.state.trip.suggestions.find((item) => item.id === stop.suggestionId)?.amapLocation || '')].filter(Boolean)
})

watch(guideKey, async (key) => {
  if (!key || !currentStop.value) return
  ctripState.value = 'loading'
  ctripEvidence.value = null
  try {
    const evidence = await fetchCtripGuide(store.state.trip.city, currentStop.value.name)
    if (guideKey.value !== key) return
    ctripEvidence.value = evidence
    ctripState.value = evidence.configured && (evidence.ticket || evidence.restaurant) ? 'ready' : evidence.configured ? 'error' : 'missing'
    await store.loadCurrentGuide(evidence)
  } catch {
    if (guideKey.value !== key) return
    ctripState.value = 'error'
    await store.loadCurrentGuide()
  }
}, { immediate: true })

function arriveAndRecord() {
  store.moveCurrentStop('done')
  void router.push({ path: '/records', query: { compose: 'image' } })
}

function skip() {
  store.moveCurrentStop('skipped')
  showToast('已跳过，已完成的记录没有改变')
}

function replan() {
  store.replanRoute()
  showToast(store.state.trip.dataSource === 'amap' ? '已按剩余时间和真实地点重排路线' : '已按剩余时间和兴趣重排样例站点')
}
</script>

<template>
  <div class="page routes-page">
    <template v-if="isActive">
    <header class="page-header">
      <div><p class="eyebrow">{{ store.state.trip.planningMode === 'full' ? 'FULL ROUTE · 全程规划' : 'NEXT STOP · 单点探索' }}</p><h1>今天，这样走</h1><p>{{ store.state.trip.city }} · {{ store.state.trip.planningMode === 'full' ? `还剩约 ${store.state.trip.remainingMinutes} 分钟` : '只规划你选定的下一站' }}。</p></div>
      <button v-if="store.state.trip.planningMode === 'full'" class="icon-button" type="button" aria-label="重新规划" @click="replan"><RefreshCw :size="18" /></button>
    </header>

    <LocalMap :stops="routeStops" :points="mapPoints" :city="store.state.trip.city" :live="store.state.trip.dataSource === 'amap'" />
    <p class="route-disclaimer">{{ store.state.trip.dataSource === 'amap' ? `路线从${store.state.trip.originLabel || '当前位置'}出发；交通方式与道路来自高德。` : '当前显示本地示例，实际路线待高德服务恢复后查询。' }}</p>

    <section class="route-summary">
      <span><strong>{{ store.state.trip.routeStops.filter((stop) => stop.status === 'done').length }}</strong> 已完成</span>
      <i></i>
      <span><strong>{{ store.state.trip.routeStops.filter((stop) => ['current', 'upcoming'].includes(stop.status)).length }}</strong> 待探索</span>
      <i></i>
      <span><strong>{{ store.state.trip.records.length }}</strong> 条记录</span>
    </section>

    <div class="section-heading"><h2>现在怎么玩</h2><span class="sample-tag" style="background: var(--green-soft)"><Sparkles :size="11" /> {{ guideLabel }}</span></div>
    <section v-if="currentStop && suggestion" class="guide-card card">
      <div class="guide-heading">
        <div><span>{{ suggestion.category }}</span><h2>{{ currentStop?.name || suggestion.name }}</h2></div>
        <span class="guide-time"><Clock3 :size="14" /> {{ suggestion.suggestedMinutes }} min</span>
      </div>
      <p class="guide-reason">{{ suggestion.whyNow }}</p>
      <ol class="activity-list">
        <li v-for="(activity, index) in suggestion.activities" :key="activity"><span>0{{ index + 1 }}</span><p>{{ activity }}</p></li>
      </ol>
      <div class="guide-details">
        <div><Lightbulb :size="17" /><span><strong>看什么</strong>{{ suggestion.highlights.join('、') }}</span></div>
        <div><Coffee :size="17" /><span><strong>吃什么</strong>{{ suggestion.foodIdea }}</span></div>
        <div><Footprints :size="17" /><span><strong>怎么去</strong>{{ suggestion.transport }}</span></div>
      </div>
      <section v-if="ctripResults.ticketUrl || ctripResults.restaurants.length" class="ctrip-results" aria-label="携程查询结果">
        <div class="ctrip-heading"><strong>携程查询结果</strong><span>查询后请以携程页面的最新信息为准</span></div>
        <a v-if="ctripResults.ticketUrl" class="ctrip-ticket" :href="ctripResults.ticketUrl" target="_blank" rel="noopener noreferrer">查看相关门票 <ArrowRight :size="13" /></a>
        <div v-if="ctripResults.restaurants.length" class="ctrip-restaurants">
          <strong>附近餐馆</strong>
          <div v-for="restaurant in ctripResults.restaurants" :key="`${restaurant.name}-${restaurant.address}`" class="ctrip-restaurant">
            <div><b>{{ restaurant.name }}</b><small v-if="restaurant.averagePrice">人均参考 ¥{{ Math.round(restaurant.averagePrice) }}</small></div>
            <p>{{ [restaurant.cuisine, restaurant.address].filter(Boolean).join(' · ') }}</p>
            <a v-if="restaurant.link" :href="restaurant.link" target="_blank" rel="noopener noreferrer">查看餐馆 <ArrowRight :size="12" /></a>
          </div>
        </div>
      </section>
      <p class="caution"><TriangleAlert :size="14" /> {{ suggestion.caution }}</p>
      <p v-if="ctripState === 'missing'" class="integration-note">配置 CTRIP_MCP_TOKEN 后，“看什么 / 吃什么”会结合携程门票和餐馆实时结果。</p>
      <p v-else-if="ctripState === 'error'" class="integration-note">携程实时结果暂不可用，当前内容由地点信息与豆包生成。</p>
      <div class="guide-actions">
        <button class="primary-button" type="button" @click="arriveAndRecord"><Check :size="17" /> 到达并记录</button>
        <button class="secondary-button" type="button" @click="skip"><SkipForward :size="16" /> 跳过</button>
      </div>
      <a class="external-place-link" :href="amapPlaceSearchUrl(currentStop?.name || suggestion.name, store.state.trip.city)" target="_blank" rel="noopener noreferrer">在高德查找这个地点 <ArrowRight :size="13" /></a>
    </section>
    <section v-else class="guide-card card"><p class="guide-reason">当前站点已完成。回首页选择新的 NextStop，就能继续探索。</p><router-link to="/home" class="primary-button">去选下一站 <ArrowRight :size="15" /></router-link></section>

    <div class="section-heading"><h2>实时路线时间轴</h2><button v-if="store.state.trip.planningMode === 'full'" type="button" @click="replan">重排未完成 <RefreshCw :size="13" /></button></div>
    <section class="route-timeline">
      <div v-for="(entry, index) in timeline" :key="entry.id" class="route-stop" :class="entry.kind === 'stop' ? entry.stop.status : 'recorded'">
        <div class="stop-rail"><span><NotebookPen v-if="entry.kind === 'record'" :size="13" /><Check v-else-if="entry.stop.status === 'done'" :size="13" /><MapPin v-else :size="13" /></span><i></i></div>
        <div v-if="entry.kind === 'record'" class="stop-content"><div><strong>{{ entry.record.location || '途中记录' }}</strong><time>{{ entry.record.recordedAt }}</time></div><p>{{ entry.record.text || '已记录这一刻' }}</p><em>真实记录</em></div>
        <div v-else class="stop-content">
          <div><strong>{{ entry.stop.name }}</strong><time>{{ entry.stop.plannedTime }}</time></div>
          <p>{{ entry.stop.transport }}</p>
          <details v-if="entry.stop.route?.instructions.length" class="route-steps">
            <summary>查看真实路线步骤</summary>
            <ol><li v-for="instruction in entry.stop.route.instructions.slice(0, 8)" :key="instruction">{{ instruction }}</li></ol>
          </details>
          <a v-if="entry.stop.route?.navigationUrl" class="navigation-link" :href="entry.stop.route.navigationUrl" target="_blank" rel="noopener noreferrer">打开高德导航 <ArrowRight :size="12" /></a>
          <em v-if="entry.stop.status === 'current'">正在这一站</em>
          <em v-else-if="entry.stop.status === 'done'">已完成</em>
          <em v-else-if="entry.stop.status === 'skipped'">已跳过</em>
          <em v-else>第 {{ index + 1 }} 站</em>
        </div>
      </div>
    </section>
    <router-link to="/inspiration" class="ghost-button full-width">看看别的下一站 <ArrowRight :size="16" /></router-link>
    </template>
    <template v-else>
      <header class="page-header"><div><p class="eyebrow">MY ROUTE</p><h1>路线</h1><p>开始一段新旅行后，路线会显示在这里。</p></div></header>
      <EmptyState title="还没有正在进行的旅行" description="上一段旅行已经结束；只有你主动开启新旅行，才会加载地点和路线。">
        <router-link to="/home" class="primary-button">到首页开启旅行 <ArrowRight :size="16" /></router-link>
      </EmptyState>
    </template>
  </div>
</template>

<style scoped>
.route-disclaimer { margin: 9px 4px 0; color: var(--muted); font-size: 9px; line-height: 1.5; }
.external-place-link { display: inline-flex; align-items: center; gap: 4px; margin-top: 12px; color: var(--green); font-size: 11px; }
.route-summary { display: flex; align-items: center; justify-content: center; gap: 15px; padding: 15px 8px; color: var(--muted); font-size: 10px; }
.route-summary strong { margin-right: 3px; color: var(--ink); font-size: 15px; }
.route-summary i { width: 1px; height: 17px; background: #dce2da; }
.guide-card { padding: 18px; }
.guide-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.guide-heading > div > span { color: var(--green); font-size: 10px; }
.guide-heading h2 { margin: 4px 0 0; font-size: 23px; }
.guide-time { display: flex; align-items: center; gap: 4px; padding: 6px 8px; border-radius: 9px; background: var(--green-soft); color: var(--green); font-size: 10px; white-space: nowrap; }
.guide-reason { margin: 12px 0 16px; color: var(--muted); font-size: 12px; line-height: 1.6; }
.activity-list { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
.activity-list li { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-top: 1px solid var(--line); }
.activity-list span { color: #9cab9f; font-size: 10px; font-weight: 700; }
.activity-list p { margin: 0; font-size: 13px; line-height: 1.55; }
.guide-details { display: grid; gap: 12px; margin: 14px 0; padding: 15px; border-radius: 16px; background: #f4f6f1; }
.guide-details > div { display: flex; align-items: flex-start; gap: 10px; color: var(--green); }
.guide-details span { color: var(--muted); font-size: 11px; line-height: 1.55; }
.guide-details strong { display: block; margin-bottom: 2px; color: var(--ink); font-size: 11px; }
.ctrip-results { display: grid; gap: 10px; margin: 14px 0; padding: 14px; border: 1px solid var(--line); border-radius: 14px; background: #fff; }
.ctrip-heading { display: flex; flex-wrap: wrap; align-items: baseline; gap: 5px 8px; }
.ctrip-heading strong, .ctrip-restaurants > strong { color: var(--ink); font-size: 11px; }
.ctrip-heading span { color: var(--muted); font-size: 9px; }
.ctrip-ticket, .ctrip-restaurant a { display: inline-flex; align-items: center; gap: 4px; color: var(--green); font-size: 11px; }
.ctrip-restaurants { display: grid; gap: 9px; }
.ctrip-restaurant { padding-top: 9px; border-top: 1px solid var(--line); }
.ctrip-restaurant > div { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px; }
.ctrip-restaurant b { color: var(--ink); font-size: 11px; }
.ctrip-restaurant small { color: var(--green); font-size: 10px; }
.ctrip-restaurant p { margin: 4px 0; color: var(--muted); font-size: 10px; line-height: 1.4; }
.caution { display: flex; align-items: flex-start; gap: 6px; color: #9a8067; font-size: 9px; line-height: 1.5; }
.caution svg { flex: 0 0 auto; }
.integration-note { margin: 10px 0 0; color: var(--muted); font-size: 9px; line-height: 1.5; }
.guide-actions { display: grid; grid-template-columns: 1fr 100px; gap: 8px; margin-top: 16px; }
.route-timeline { margin-bottom: 20px; padding: 4px 0; }
.route-stop { display: grid; grid-template-columns: 34px 1fr; min-height: 82px; }
.stop-rail { display: flex; flex-direction: column; align-items: center; }
.stop-rail span { z-index: 1; width: 26px; height: 26px; display: grid; place-items: center; border: 2px solid #d9e0d8; border-radius: 50%; background: var(--bg); color: #94a097; }
.stop-rail i { flex: 1; width: 1px; background: #dce2da; }
.route-stop:last-child .stop-rail i { display: none; }
.route-stop.current .stop-rail span { border-color: var(--green); background: var(--green); color: #fff; }
.route-stop.done .stop-rail span { border-color: #a7bda9; background: #dfe9df; color: var(--green); }
.route-stop.recorded .stop-rail span { border-color: #adc4af; background: #eaf1e9; color: var(--green); }
.stop-content { padding: 3px 0 16px 8px; }
.stop-content > div { display: flex; justify-content: space-between; gap: 8px; }
.stop-content strong { font-size: 14px; }
.stop-content time { color: var(--muted); font-size: 10px; }
.stop-content p { margin: 4px 0; color: var(--muted); font-size: 10px; }
.route-steps { margin: 7px 0; color: var(--muted); font-size: 10px; }
.route-steps summary { cursor: pointer; color: var(--green); }
.route-steps ol { display: grid; gap: 4px; margin: 7px 0 0; padding-left: 18px; line-height: 1.45; }
.navigation-link { display: inline-flex; align-items: center; gap: 3px; margin: 3px 0 5px; color: var(--green); font-size: 10px; }
.stop-content em { color: var(--green); font-size: 9px; font-style: normal; }
.route-stop.skipped .stop-content { opacity: 0.5; }
</style>
