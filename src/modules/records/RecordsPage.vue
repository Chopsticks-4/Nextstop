<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BookOpenText, CloudSun, List, LoaderCircle, Map, MapPin, Mic, Plus, Sparkles, Trash2 } from 'lucide-vue-next'
import RecordComposer from './RecordComposer.vue'
import EmptyState from '../../shared/ui/EmptyState.vue'
import FootprintMap from '../../shared/ui/FootprintMap.vue'
import LocalMap from '../../shared/ui/LocalMap.vue'
import { useTripStore } from '../../stores/trip'
import { showToast } from '../../stores/ui'
import type { RecordDraft, RecordType } from '../../types'
import { countRecordImages, getRecordImages } from '../../utils/records'

const store = useTripStore()
const route = useRoute()
const router = useRouter()
const view = ref<'timeline' | 'map'>('timeline')
const composerOpen = ref(false)
const composerType = ref<RecordType>('text')
const generating = ref(false)
const records = computed(() => [...store.state.trip.records].reverse())
const locatedRecordCount = computed(() => store.state.trip.records.filter((record) => record.coordinate).length)

function openComposer(type: RecordType = 'text') {
  if (store.state.trip.status !== 'active') return
  composerType.value = type
  composerOpen.value = true
}

function handleQuery() {
  const type = route.query.compose
  if (type === 'text' || type === 'image' || type === 'audio') {
    openComposer(type)
    void router.replace({ path: '/records' })
  }
}

onMounted(handleQuery)
onActivated(handleQuery)
watch(() => route.query.compose, handleQuery)

function saveRecord(draft: RecordDraft) {
  store.addRecord(draft)
  showToast('这一刻已保存到本机')
}

function removeRecord(id: string) {
  if (!window.confirm('删除这条本地记录？已生成的故事内容不会自动改变。')) return
  store.deleteRecord(id)
  showToast('记录已删除')
}

async function finishTrip() {
  if (store.state.trip.status !== 'active' || !store.state.trip.records.length) {
    showToast('先留下至少一条记录，再结束旅行并生成故事')
    return
  }
  generating.value = true
  try {
    const tripId = await store.completeTrip()
    showToast('旅行已归档；当前记录已清零，足迹和故事保存在历史旅行中')
    await router.push({ path: '/story', query: { latest: tripId } })
  } catch {
    showToast('结束旅行失败，原始记录仍然保留')
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <div class="page records-page">
    <template v-if="store.state.trip.status === 'active'">
    <header class="page-header">
      <div><p class="eyebrow">MY MOMENTS · {{ store.state.trip.records.length }} 条</p><h1>随手记，就很好</h1><p>照片、几句话和声音，都是故事的线索。</p></div>
      <button class="finish-button" type="button" @click="finishTrip"><BookOpenText :size="15" /> 结束旅行</button>
    </header>

    <div class="records-toolbar">
      <div class="segmented">
        <button :class="{ active: view === 'timeline' }" type="button" @click="view = 'timeline'"><List :size="14" /> 时间线</button>
        <button :class="{ active: view === 'map' }" type="button" @click="view = 'map'"><Map :size="14" /> 足迹</button>
      </div>
      <span>仅存本机</span>
    </div>

    <template v-if="view === 'timeline'">
      <div v-if="records.length" class="timeline">
        <article v-for="record in records" :key="record.id" class="record-item">
          <div class="record-time"><time>{{ record.recordedAt }}</time><span></span></div>
          <div class="record-card">
            <div v-if="getRecordImages(record).length" class="record-images" :class="`count-${Math.min(getRecordImages(record).length, 4)}`">
              <img v-for="(image, index) in getRecordImages(record)" :key="`${record.id}-${index}`" :src="image" :alt="`${record.text || '旅行记录'} · 第 ${index + 1} 张图片`" class="record-image" />
            </div>
            <div class="record-body">
              <div v-if="record.audio" class="record-audio">
                <span><Mic :size="14" /> {{ record.audioName || '我的旅行原声' }}</span>
                <audio :src="record.audio" controls preload="metadata"></audio>
              </div>
              <p v-if="record.text" class="record-text">{{ record.text }}</p>
              <div class="record-meta">
                <span><MapPin :size="12" /> {{ record.location || (record.coordinate ? '已标记坐标' : '未标记位置') }}</span>
                <span><CloudSun :size="12" /> {{ record.weather }}</span>
              </div>
              <div class="record-footer">
                <span v-if="record.mood" class="mood-tag"># {{ record.mood }}</span>
                <button type="button" aria-label="删除记录" @click="removeRecord(record.id)"><Trash2 :size="14" /></button>
              </div>
            </div>
          </div>
        </article>
      </div>
      <EmptyState v-else title="第一条记录，从此刻开始" description="不用写完整，也不用挑最好看的照片。先留下一点真实感受。">
        <button class="primary-button" type="button" @click="openComposer('text')"><Plus :size="16" /> 写第一句</button>
      </EmptyState>
    </template>

    <template v-else>
      <FootprintMap v-if="locatedRecordCount" :records="store.state.trip.records" />
      <LocalMap v-else :stops="store.state.trip.routeStops" :compact="false" />
      <section class="map-stats card">
        <div><strong>{{ store.state.trip.records.length }}</strong><span>足迹记录</span></div>
        <div><strong>{{ locatedRecordCount }}</strong><span>定位点</span></div>
        <div><strong>{{ countRecordImages(store.state.trip.records) }}</strong><span>旅行照片</span></div>
      </section>
      <p class="map-caption">{{ locatedRecordCount ? '按记录先后顺序连接定位点和选中的地点；线段为直线，不代表真实道路。' : '还没有定位点；记录时可标记当前位置，或输入并选择地点建议。上方是静态路线示意。' }}</p>
    </template>

    <button class="record-fab" type="button" aria-label="新增记录" @click="openComposer('text')"><Plus :size="25" /></button>

    <RecordComposer :open="composerOpen" :initial-type="composerType" :city="store.state.trip.city" @close="composerOpen = false" @save="saveRecord" />
    </template>
    <template v-else>
      <header class="page-header"><div><p class="eyebrow">MY MOMENTS</p><h1>旅行记录</h1><p>开始新旅行后，再把沿途的时刻记在这里。</p></div></header>
      <EmptyState title="还没有正在进行的旅行" description="已结束的记录和足迹保存在历史旅行中；新记录从下一次旅行开始。">
        <router-link to="/home" class="primary-button">到首页开启旅行</router-link>
      </EmptyState>
    </template>

    <Teleport to="body">
      <div v-if="generating" class="generating-overlay">
        <div class="generating-card">
          <span class="generating-icon"><Sparkles :size="25" /><LoaderCircle :size="40" class="spin" /></span>
          <p class="eyebrow">旅行故事生成</p>
          <h2>正在串起你的足迹</h2>
          <p>优先由豆包根据记录生成；接口不可用时使用本地故事。</p>
          <div class="loading-line"><i></i></div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.finish-button { min-height: 40px; display: flex; align-items: center; gap: 5px; padding: 0 11px; border: 0; border-radius: 12px; background: var(--green-soft); color: var(--green); font-size: 11px; white-space: nowrap; }
.records-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 22px; }
.records-toolbar .segmented { flex: 1; }
.records-toolbar .segmented button { display: flex; align-items: center; justify-content: center; gap: 5px; }
.records-toolbar > span { color: var(--muted); font-size: 9px; }
.timeline { display: grid; gap: 4px; }
.record-item { display: grid; grid-template-columns: 48px 1fr; gap: 9px; }
.record-time { display: flex; flex-direction: column; align-items: center; }
.record-time time { padding-top: 7px; color: var(--muted); font-size: 10px; }
.record-time span { flex: 1; width: 1px; margin-top: 8px; background: #dce2da; }
.record-item:last-child .record-time span { background: linear-gradient(#dce2da, transparent); }
.record-card { overflow: hidden; margin-bottom: 18px; border: 1px solid var(--line); border-radius: 20px; background: #fff; box-shadow: 0 8px 24px rgb(34 62 46 / 5%); }
.record-images { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2px; background: #eef1ec; }
.record-images.count-1 { grid-template-columns: 1fr; }
.record-image { width: 100%; height: 145px; object-fit: cover; }
.record-images.count-1 .record-image { height: auto; max-height: 300px; }
.record-body { padding: 14px; }
.record-text { margin-bottom: 13px; color: #3c4d43; font-size: 13px; line-height: 1.75; white-space: pre-wrap; }
.record-meta { display: flex; flex-wrap: wrap; gap: 7px 12px; color: var(--muted); font-size: 9px; }
.record-meta span { display: flex; align-items: center; gap: 4px; }
.record-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }
.mood-tag { color: var(--green); font-size: 10px; }
.record-footer button { width: 34px; height: 34px; display: grid; place-items: center; border: 0; background: transparent; color: #a3aca5; }
.record-audio { margin-bottom: 12px; }
.record-audio span { display: flex; align-items: center; gap: 5px; margin-bottom: 7px; color: var(--green); font-size: 10px; }
.record-audio audio { width: 100%; height: 34px; }
.record-fab { position: fixed; z-index: 30; right: max(18px, calc((100vw - 480px) / 2 + 18px)); bottom: calc(88px + env(safe-area-inset-bottom)); width: 56px; height: 56px; display: grid; place-items: center; border: 4px solid var(--bg); border-radius: 20px; background: var(--green); color: #fff; box-shadow: 0 10px 24px rgb(44 90 68 / 25%); }
.map-stats { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 14px; padding: 17px 8px; }
.map-stats div { text-align: center; border-right: 1px solid var(--line); }
.map-stats div:last-child { border: 0; }
.map-stats strong { display: block; font-size: 22px; }
.map-stats span { color: var(--muted); font-size: 9px; }
.map-caption { margin-top: 12px; color: var(--muted); font-size: 9px; text-align: center; }
.generating-overlay { position: fixed; inset: 0; z-index: 120; display: grid; place-items: center; padding: 24px; background: rgb(24 43 33 / 65%); backdrop-filter: blur(8px); }
.generating-card { width: min(100%, 360px); padding: 30px 24px; border-radius: 26px; background: #fbfcf8; text-align: center; }
.generating-icon { position: relative; width: 64px; height: 64px; display: grid; place-items: center; margin: 0 auto 18px; border-radius: 22px; background: var(--green-soft); color: var(--green); }
.generating-icon > svg:last-child { position: absolute; inset: -5px; width: 74px; height: 74px; opacity: 0.35; }
.generating-card h2 { margin: 8px 0; font-size: 23px; }
.generating-card > p:not(.eyebrow) { color: var(--muted); font-size: 11px; }
.loading-line { height: 4px; overflow: hidden; margin-top: 20px; border-radius: 5px; background: #e7ece4; }
.loading-line i { display: block; width: 45%; height: 100%; border-radius: 5px; background: var(--green); animation: loading 1s infinite ease-in-out; }
.spin { animation: spin 1.4s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes loading { from { transform: translateX(-100%); } to { transform: translateX(320%); } }
</style>
