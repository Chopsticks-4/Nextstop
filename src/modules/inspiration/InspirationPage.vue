<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, Clock3, Compass, Footprints, MapPin, SlidersHorizontal, Sparkles } from 'lucide-vue-next'
import EmptyState from '../../shared/ui/EmptyState.vue'
import { amapPlaceSearchUrl } from '../../services/external-map'
import { rankLocalSuggestions } from '../../services/local-route-planner'
import { useTripStore } from '../../stores/trip'
import { showToast } from '../../stores/ui'

const store = useTripStore()
const router = useRouter()
const filter = ref('全部')
const filters = ['全部', '60 分钟内', '少走路', '想坐下']
const suggestions = computed(() => {
  const candidates = store.state.trip.suggestions.filter((item) => {
    if (filter.value === '60 分钟内') return item.suggestedMinutes + item.travelMinutes <= 60
    if (filter.value === '少走路') return item.travelMinutes <= 20
    if (filter.value === '想坐下') return /咖啡|茶|餐饮|休息/.test(`${item.name}${item.category}`)
    return true
  })
  return rankLocalSuggestions(candidates, store.state.trip.interests, store.state.trip.remainingMinutes)
})

function setNext(id: string, name: string) {
  if (store.state.trip.status !== 'active') return
  store.setNextStop(id)
  showToast(`已把「${name}」设为下一站`)
  void router.replace('/route')
}
</script>

<template>
  <div class="page inspiration-page">
    <template v-if="store.state.trip.status === 'active'">
    <header class="page-header">
      <div><p class="eyebrow">NEXT STOP · {{ store.state.trip.dataSource === 'amap' ? '高德真实地点' : '失败回退样例' }}</p><h1>下一站，去哪儿？</h1><p>按剩余时间和兴趣排序的{{ store.state.trip.dataSource === 'amap' ? '真实地点' : '本地样例建议' }}。</p></div>
      <span class="round-icon"><Compass :size="21" /></span>
    </header>

    <div class="context-card">
      <Sparkles :size="17" />
      <p>你已经留下了 <strong>{{ store.state.trip.records.length }}</strong> 个时刻，现在还有约 <strong>{{ store.state.trip.remainingMinutes }}</strong> 分钟。</p>
    </div>

    <div class="filter-heading"><SlidersHorizontal :size="15" /><span>按现在的状态筛选</span></div>
    <div class="chip-row">
      <button v-for="item in filters" :key="item" class="chip" :class="{ active: filter === item }" type="button" @click="filter = item">{{ item }}</button>
    </div>

    <p v-if="store.placeMeta.status === 'loading'" class="inspiration-note">正在查询高德真实地点…</p>
    <div v-else-if="suggestions.length" class="inspiration-list">
      <article v-for="(item, index) in suggestions" :key="item.id" class="inspiration-card">
        <div class="inspiration-image">
          <img v-if="item.image" :src="item.image" :alt="`${item.name}地点照片`" />
          <span class="choice-index">0{{ index + 1 }}</span>
          <span class="sample-tag">{{ store.state.trip.dataSource === 'amap' ? item.image ? '高德地点照片' : '高德地点' : '回退样例配图' }}</span>
        </div>
        <div class="inspiration-content">
          <div class="inspiration-title"><div><span>{{ item.category }}</span><h2>{{ item.name }}</h2></div><ArrowRight :size="20" /></div>
          <p class="why-now">{{ item.whyNow }}</p>
          <p class="reason">“{{ item.reason }}”</p>
          <div class="meta-row">
            <span class="meta-item"><MapPin :size="13" />{{ item.distance }}</span>
            <span class="meta-item"><Clock3 :size="13" />{{ item.suggestedMinutes }} 分钟</span>
            <span class="meta-item"><Footprints :size="13" />{{ item.transport }}</span>
          </div>
          <button class="primary-button full-width" type="button" @click="setNext(item.id, item.name)">设为下一站 <ArrowRight :size="16" /></button>
          <a class="external-place-link" :href="amapPlaceSearchUrl(item.name, store.state.trip.city)" target="_blank" rel="noopener noreferrer">在高德查找地点 <ArrowRight :size="13" /></a>
        </div>
      </article>
    </div>
    <EmptyState v-else title="暂时没有匹配的灵感" description="换一个筛选条件，或者让路线保持现在的样子。">
      <button class="ghost-button" type="button" @click="filter = '全部'">查看全部</button>
    </EmptyState>
    <p class="inspiration-note">{{ store.state.trip.dataSource === 'amap' ? '地点来自高德，步行时间和距离优先采用高德路线；不可用时标明直线距离。' : `高德不可用，当前为本地回退样例。${store.placeMeta.error}` }}</p>
    </template>
    <template v-else>
      <header class="page-header"><div><p class="eyebrow">NEXT STOP</p><h1>下一站，去哪儿？</h1><p>开始新旅行后，再一起看看真实地点。</p></div></header>
      <EmptyState title="还没有下一站" description="开启旅行后，才会按城市和兴趣查询可去的地点。">
        <router-link to="/home" class="primary-button">到首页开启旅行</router-link>
      </EmptyState>
    </template>
  </div>
</template>

<style scoped>
.round-icon { width: 46px; height: 46px; display: grid; place-items: center; border-radius: 16px; background: var(--green-soft); color: var(--green); }
.context-card { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; padding: 13px 14px; border-radius: 15px; background: #eaf0e4; color: var(--green); }
.context-card p { margin: 0; color: #5d6e62; font-size: 11px; line-height: 1.5; }
.context-card strong { color: var(--green); }
.filter-heading { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; color: var(--muted); font-size: 11px; }
.inspiration-list { display: grid; gap: 18px; margin-top: 16px; }
.inspiration-card { overflow: hidden; border-radius: 23px; background: #fff; box-shadow: var(--shadow); }
.inspiration-image { position: relative; height: 180px; }
.inspiration-image::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, transparent, rgb(18 35 26 / 24%)); }
.inspiration-image img { width: 100%; height: 100%; object-fit: cover; }
.inspiration-image .sample-tag { position: absolute; z-index: 1; right: 12px; bottom: 12px; }
.choice-index { position: absolute; z-index: 1; left: 15px; top: 14px; color: #fff; font-size: 12px; font-weight: 700; letter-spacing: 1px; text-shadow: 0 2px 8px rgb(0 0 0 / 25%); }
.inspiration-content { padding: 17px; }
.inspiration-title { display: flex; align-items: center; justify-content: space-between; color: var(--green); }
.inspiration-title span { color: var(--green); font-size: 9px; }
.inspiration-title h2 { margin: 3px 0 0; color: var(--ink); font-size: 23px; }
.why-now { margin: 11px 0 7px; color: #4e6155; font-size: 12px; line-height: 1.6; }
.reason { margin-bottom: 14px; color: var(--muted); font-size: 11px; line-height: 1.65; }
.inspiration-content .meta-row { margin-bottom: 16px; }
.inspiration-note { margin: 20px 12px 0; color: #9aa39c; font-size: 9px; line-height: 1.6; text-align: center; }
.external-place-link { display: inline-flex; align-items: center; gap: 4px; margin-top: 11px; color: var(--green); font-size: 11px; }
</style>
