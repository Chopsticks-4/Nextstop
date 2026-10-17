<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, BookOpenText, Clock3, FilePenLine, MapPin, RotateCcw, Trash2 } from 'lucide-vue-next'
import BaseModal from '../../shared/ui/BaseModal.vue'
import EmptyState from '../../shared/ui/EmptyState.vue'
import FootprintMap from '../../shared/ui/FootprintMap.vue'
import LocalMap from '../../shared/ui/LocalMap.vue'
import { useTripStore } from '../../stores/trip'
import { showToast } from '../../stores/ui'
import type { Trip } from '../../types'
import { getRecordImages } from '../../utils/records'

const store = useTripStore()
const route = useRoute()
const router = useRouter()
const tab = ref<'trips' | 'drafts'>('trips')
const previewTrip = ref<Trip | null>(null)
const trips = computed(() => store.state.historyTrips)
const hasDraft = computed(() => store.state.trip.status !== 'completed' && (store.state.trip.records.length > 0 || store.state.trip.storySections.length > 0))

watch(() => route.query.tab, (value) => {
  tab.value = value === 'drafts' ? 'drafts' : 'trips'
}, { immediate: true })

function resume(trip: Trip) {
  previewTrip.value = null
  store.resumeTrip(trip.id)
  showToast(`已恢复「${trip.title}」`)
  void router.push('/home')
}

function openStory(trip: Trip) {
  previewTrip.value = null
  void router.push({ path: '/story/edit', query: { trip: trip.id } })
}

function clearDraft() {
  if (!window.confirm('清空当前旅行的本地记录和故事？历史快照不会被删除。')) return
  store.state.trip.records = []
  store.state.trip.storySections = []
  store.state.trip.storyTitle = ''
  store.state.trip.narration = ''
  store.state.trip.narrationAudio = undefined
  store.updateBadges()
  showToast('当前草稿已清空')
}
</script>

<template>
  <div class="page history-page">
    <header class="page-header">
      <div><p class="eyebrow">LOCAL HISTORY</p><h1>旅行不会走丢</h1><p>每次旅行的足迹、时间线和故事，都一起留在这台设备。</p></div>
    </header>

    <div class="segmented history-tabs">
      <button :class="{ active: tab === 'trips' }" type="button" @click="tab = 'trips'">历史旅行</button>
      <button :class="{ active: tab === 'drafts' }" type="button" @click="tab = 'drafts'">未完成草稿</button>
    </div>

    <div v-if="tab === 'trips'">
      <div v-if="trips.length" class="history-list">
        <article v-for="trip in trips" :key="trip.id" class="trip-card card">
          <img v-if="trip.records.find((record) => record.image)?.image || trip.storySections[0]?.image" :src="trip.records.find((record) => record.image)?.image || trip.storySections[0]?.image" :alt="trip.title" />
          <div class="trip-card-content">
            <div class="trip-status"><span :class="trip.status">{{ trip.status === 'completed' ? '已完成' : trip.status === 'exited' ? '已保存退出' : '进行中' }}</span><time>{{ trip.date }}</time></div>
            <h2>{{ trip.title }}</h2>
            <p><MapPin :size="12" /> {{ trip.city }} · {{ trip.records.length }} 条记录 · {{ trip.storySections.length }} 段故事</p>
            <button type="button" @click="previewTrip = trip">查看旅行 <ArrowRight :size="15" /></button>
          </div>
        </article>
      </div>
      <EmptyState v-else title="还没有历史旅行" description="结束旅行或在故事页保存故事后，完整旅行会归档在这里。">
        <button class="primary-button" type="button" @click="router.push('/home')">去首页开启新旅行 <ArrowRight :size="16" /></button>
      </EmptyState>
    </div>

    <div v-else>
      <section v-if="hasDraft" class="draft-card card">
        <div class="draft-icon"><FilePenLine :size="23" /></div>
        <div class="draft-info"><span>当前旅行草稿</span><h2>{{ store.state.trip.title }}</h2><p>最近编辑 {{ new Date(store.state.trip.updatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}</p><div class="draft-tags"><em>{{ store.state.trip.records.length }} 条记录</em><em>{{ store.state.trip.storySections.length }} 段故事</em><em>已保存到本机</em></div></div>
        <div class="draft-actions"><button class="primary-button" type="button" @click="router.push(store.state.trip.storySections.length ? '/story/edit' : '/records')">继续编辑 <ArrowRight :size="15" /></button><button class="icon-button" type="button" aria-label="清空草稿" @click="clearDraft"><Trash2 :size="16" /></button></div>
      </section>
      <EmptyState v-else title="没有未完成草稿" description="新建旅行或写下第一条记录后，草稿会自动出现在这里。">
        <button class="primary-button" type="button" @click="router.push('/home')">去首页开启新旅行 <ArrowRight :size="16" /></button>
      </EmptyState>
    </div>

    <p class="history-note"><Clock3 :size="12" /> 每次旅行的路线、记录和故事作为同一份快照保存；清理浏览器数据会移除这些本地内容。</p>

    <BaseModal :open="Boolean(previewTrip)" :title="previewTrip?.title || '旅行详情'" eyebrow="足迹 · 时间线 · 故事" @close="previewTrip = null">
      <template v-if="previewTrip">
        <p class="trip-detail-meta">{{ previewTrip.city }} · {{ previewTrip.date }} · {{ previewTrip.records.length }} 条记录</p>
        <section class="trip-detail-section">
          <h3>足迹路线</h3>
          <FootprintMap v-if="previewTrip.records.some((record) => record.coordinate)" :records="previewTrip.records" :compact="true" />
          <LocalMap v-else :stops="previewTrip.routeStops" :compact="true" />
          <div class="detail-stops"><span v-for="stop in previewTrip.routeStops" :key="stop.id">{{ stop.name }}</span></div>
        </section>
        <section class="trip-detail-section">
          <h3>时间线</h3>
          <article v-for="record in previewTrip.records" :key="record.id" class="detail-record">
            <time>{{ record.recordedAt }}</time>
            <div><strong>{{ record.location || '旅途记录' }}</strong><p>{{ record.text || (getRecordImages(record).length ? '图片记录' : record.audio ? '声音记录' : '这一刻已记录') }}</p><span v-if="record.mood"># {{ record.mood }}</span></div>
          </article>
          <p v-if="!previewTrip.records.length" class="detail-empty">这次旅行没有记录。</p>
        </section>
        <section class="trip-detail-section">
          <h3>旅行故事</h3>
          <template v-if="previewTrip.storySections.length">
            <h4>{{ previewTrip.storyTitle }}</h4>
            <article v-for="section in previewTrip.storySections" :key="section.id" class="detail-story"><strong>{{ section.title }}</strong><p>{{ section.text }}</p></article>
          </template>
          <p v-else class="detail-empty">这次旅行还没有故事。</p>
        </section>
        <div class="detail-actions">
          <button class="secondary-button" type="button" @click="resume(previewTrip)"><RotateCcw :size="15" /> 恢复这次旅行</button>
          <button v-if="previewTrip.storySections.length" class="primary-button" type="button" @click="openStory(previewTrip)"><BookOpenText :size="15" /> 查看故事</button>
        </div>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.history-tabs { margin-bottom: 20px; }
.history-tabs button { font-size: 11px; }
.history-list { display: grid; gap: 16px; }
.trip-card { overflow: hidden; }
.trip-card > img { width: 100%; height: 155px; object-fit: cover; }
.trip-card-content { padding: 15px; }
.trip-status { display: flex; align-items: center; justify-content: space-between; }
.trip-status span { padding: 4px 7px; border-radius: 7px; background: var(--green-soft); color: var(--green); font-size: 8px; }
.trip-status span.exited { background: var(--orange-soft); color: var(--orange); }
.trip-status time { color: var(--muted); font-size: 9px; }
.trip-card h2 { margin: 10px 0 6px; font-size: 18px; }
.trip-card p { display: flex; align-items: center; gap: 4px; margin-bottom: 10px; color: var(--muted); font-size: 10px; }
.trip-card-content > button { min-height: 38px; display: flex; align-items: center; gap: 5px; margin-left: auto; border: 0; background: transparent; color: var(--green); font-size: 11px; }
.draft-card { display: grid; grid-template-columns: 46px 1fr; gap: 12px; padding: 17px; }
.draft-icon { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 15px; background: var(--orange-soft); color: var(--orange); }
.draft-info > span { color: var(--muted); font-size: 9px; }
.draft-info h2 { margin: 5px 0; font-size: 18px; }
.draft-info > p { color: var(--muted); font-size: 9px; }
.draft-tags { display: flex; flex-wrap: wrap; gap: 5px; }
.draft-tags em { padding: 4px 6px; border-radius: 6px; background: #f0f3ed; color: #6f7b72; font-size: 8px; font-style: normal; }
.draft-actions { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 46px; gap: 8px; }
.history-note { display: flex; align-items: flex-start; justify-content: center; gap: 5px; margin: 20px 10px; color: var(--muted); font-size: 8px; line-height: 1.5; }
.trip-detail-meta { margin-bottom: 20px; color: var(--muted); font-size: 10px; }
.trip-detail-section { margin-top: 22px; }
.trip-detail-section > h3 { margin-bottom: 10px; font-size: 15px; }
.trip-detail-section > h4 { margin-bottom: 10px; font-size: 18px; }
.detail-stops { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.detail-stops span { padding: 5px 8px; border-radius: 8px; background: var(--green-soft); color: var(--green); font-size: 9px; }
.detail-record { display: grid; grid-template-columns: 44px 1fr; gap: 8px; padding: 11px 0; border-top: 1px solid var(--line); }
.detail-record time { color: var(--muted); font-size: 9px; }
.detail-record strong { font-size: 12px; }
.detail-record p { margin: 4px 0; color: var(--muted); font-size: 11px; line-height: 1.65; }
.detail-record span { color: var(--green); font-size: 9px; }
.detail-story { margin-top: 12px; }
.detail-story strong { font-size: 12px; }
.detail-story p, .detail-empty { margin: 5px 0 0; color: var(--muted); font-size: 11px; line-height: 1.75; }
.detail-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 24px; }
.detail-actions button { display: flex; align-items: center; justify-content: center; gap: 5px; }
</style>
