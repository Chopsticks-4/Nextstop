<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowDown, ArrowRight, ArrowUp, BookOpenText, Check, FileAudio, Image, Mic, RefreshCw, Save, Sparkles, Video } from 'lucide-vue-next'
import EmptyState from '../../shared/ui/EmptyState.vue'
import { useTripStore } from '../../stores/trip'
import { showToast } from '../../stores/ui'
import { readFileAsDataUrl } from '../../utils/files'
import type { StorySection } from '../../types'
import { getRecordImages } from '../../utils/records'

const store = useTripStore()
const route = useRoute()
const router = useRouter()
const generating = ref(false)
const audioBusy = ref(false)
const storyTrip = computed(() => {
  const tripId = typeof route.query.trip === 'string' ? route.query.trip : ''
  if (!tripId || tripId === store.state.trip.id) return store.state.trip
  return store.state.historyTrips.find((trip) => trip.id === tripId) ?? store.state.trip
})
const isArchived = computed(() => storyTrip.value.id !== store.state.trip.id)
const availableImages = computed(() => [
  ...storyTrip.value.records.flatMap(getRecordImages),
])
function hasStoryImage(section: StorySection) {
  return Boolean(section.image && availableImages.value.includes(section.image))
}
const tripAudio = computed(() => storyTrip.value.records.find((record) => record.audio)?.audio)

async function generateStory() {
  if (!storyTrip.value.records.length) {
    showToast('先添加旅行记录，再生成对应的故事')
    return
  }
  generating.value = true
  try {
    const source = await store.generateStory(storyTrip.value.id)
    showToast(source === 'doubao' ? '豆包已根据本次记录生成故事' : '豆包暂不可用，已生成本地故事')
  } catch {
    showToast('故事生成失败，旅行记录仍然保留')
  } finally {
    generating.value = false
  }
}

function cycleImage(section: StorySection) {
  const images = availableImages.value
  if (!images.length) return
  const index = images.indexOf(section.image)
  section.image = images[(index + 1) % images.length]
  showToast('已替换为下一张本地图片')
}

function moveSection(index: number, direction: -1 | 1) {
  const target = index + direction
  const sections = storyTrip.value.storySections
  if (target < 0 || target >= sections.length) return
  const [section] = sections.splice(index, 1)
  sections.splice(target, 0, section)
}

function useTripAudio() {
  if (!tripAudio.value) return
  storyTrip.value.narrationAudio = tripAudio.value
  store.updateBadges(storyTrip.value)
  showToast('已选用旅行中的原声')
}

async function selectAudio(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > 15 * 1024 * 1024) {
    showToast('请选择 15MB 以内的音频')
    return
  }
  audioBusy.value = true
  try {
    storyTrip.value.narrationAudio = await readFileAsDataUrl(file)
    store.updateBadges(storyTrip.value)
    showToast('音频已保存到本机')
  } catch {
    showToast('音频读取失败')
  } finally {
    audioBusy.value = false
  }
}

async function saveStory() {
  const saved = await store.saveStoryToHistory(storyTrip.value.id)
  showToast(saved ? '故事已随本次旅行保存到历史旅行' : '故事保存失败，请稍后重试')
}

function goExport() {
  void router.push({ path: '/export', query: { trip: storyTrip.value.id } })
}
</script>

<template>
  <div class="page story-page">
    <header class="page-header">
      <div><p class="eyebrow">MY TRAVEL STORY · 豆包优先</p><h1>我的完整故事</h1><p>不是逐点日记，而是这一次旅行的起承转合。</p></div>
      <router-link class="icon-button" to="/history" aria-label="历史旅行"><BookOpenText :size="18" /></router-link>
    </header>

    <template v-if="storyTrip.storySections.length">
      <div class="story-status"><span><Check :size="13" /> 故事可编辑</span><span>{{ isArchived ? '已保存到历史旅行' : '保存后放入历史旅行' }}</span></div>
      <input v-model="storyTrip.storyTitle" class="story-title-input" aria-label="故事标题" maxlength="40" />
      <p class="story-subtitle">{{ storyTrip.city }} · {{ storyTrip.date }} · {{ storyTrip.records.length }} 个记录时刻</p>

      <section class="narration-card">
        <div class="narration-heading"><span><Mic :size="17" /></span><div><strong>用我的声音讲</strong><p>当前仅使用本地原声，不做 ASR 或音色处理</p></div></div>
        <textarea v-model="storyTrip.narration" aria-label="旁白文本" placeholder="写下想亲口讲述的旁白……"></textarea>
        <div v-if="storyTrip.narrationAudio" class="narration-player">
          <span><FileAudio :size="14" /> 我的原声</span>
          <audio :src="storyTrip.narrationAudio" controls preload="metadata"></audio>
        </div>
        <div class="narration-actions">
          <button v-if="tripAudio" type="button" @click="useTripAudio"><Mic :size="14" /> 使用旅行原声</button>
          <label><FileAudio :size="14" /> {{ audioBusy ? '读取中…' : '选择本地音频' }}<input type="file" accept="audio/*" @change="selectAudio" /></label>
        </div>
      </section>

      <div class="section-heading"><h2>故事正文</h2><button type="button" @click="saveStory"><Save :size="14" /> 保存故事</button></div>
      <div class="story-sections">
        <article v-for="(section, index) in storyTrip.storySections" :key="section.id" class="story-section">
          <div v-if="hasStoryImage(section)" class="section-photo">
            <img :src="section.image" :alt="section.title" />
            <span>{{ String(index + 1).padStart(2, '0') }} · {{ section.beat }}</span>
            <button v-if="availableImages.length" type="button" @click="cycleImage(section)"><RefreshCw :size="14" /> 换一张</button>
          </div>
          <div class="section-editor">
            <span v-if="!hasStoryImage(section)" class="section-beat">{{ String(index + 1).padStart(2, '0') }} · {{ section.beat }}</span>
            <div class="section-title-row">
              <input v-model="section.title" aria-label="段落小标题" />
              <div class="reorder-buttons">
                <button type="button" aria-label="上移段落" :disabled="index === 0" @click="moveSection(index, -1)"><ArrowUp :size="14" /></button>
                <button type="button" aria-label="下移段落" :disabled="index === storyTrip.storySections.length - 1" @click="moveSection(index, 1)"><ArrowDown :size="14" /></button>
              </div>
            </div>
            <textarea v-model="section.text" class="story-textarea" :aria-label="`第 ${index + 1} 段正文`"></textarea>
            <button v-if="availableImages.length && !hasStoryImage(section)" class="add-section-photo" type="button" @click="cycleImage(section)"><Image :size="14" /> 添加旅行照片</button>
            <div class="section-source"><Image :size="12" /> 关联 {{ section.sourceRecordIds.length }} 条素材 · 修改后自动保存到本机</div>
          </div>
        </article>
      </div>

      <section v-if="storyTrip.generatedVideos?.length" class="story-videos">
        <div class="section-heading"><h2>这次旅行的视频</h2></div>
        <article v-for="video in storyTrip.generatedVideos" :key="video.id" class="story-video-card card">
          <video :src="video.src" :poster="video.poster" controls playsinline preload="metadata" :aria-label="video.title"></video>
          <strong><Video :size="15" /> {{ video.title }}</strong>
        </article>
      </section>

      <div class="story-actions">
        <button class="secondary-button" type="button" @click="saveStory"><Save :size="16" /> 保存故事</button>
        <button class="primary-button" type="button" @click="goExport">去导出 <ArrowRight :size="17" /></button>
      </div>
    </template>

    <EmptyState v-else title="故事还没有开始" description="故事会由本次旅行的记录和用户图片生成，并和足迹一起归档。">
      <button class="primary-button" type="button" :disabled="generating" @click="generateStory"><Sparkles :size="16" /> {{ generating ? '正在整理记录…' : '生成我的旅行故事' }}</button>
    </EmptyState>
    <p class="story-note"><BookOpenText :size="13" /> 优先由豆包根据记录和用户图片生成；接口不可用时使用本地故事。编辑和排序仍保存在本机。</p>
  </div>
</template>

<style scoped>
.story-status { display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; color: var(--muted); font-size: 9px; }
.story-status span:first-child { display: flex; align-items: center; gap: 4px; color: var(--green); }
.story-title-input { width: 100%; border: 0; outline: none; background: transparent; color: var(--ink); font-size: 30px; font-weight: 700; line-height: 1.3; letter-spacing: -1px; }
.story-subtitle { margin: 8px 0 20px; color: var(--muted); font-size: 10px; }
.narration-card { margin-bottom: 26px; padding: 16px; border-radius: 20px; background: #263e32; color: #fff; }
.narration-heading { display: flex; align-items: center; gap: 10px; }
.narration-heading > span { width: 35px; height: 35px; display: grid; place-items: center; border-radius: 12px; background: rgb(255 255 255 / 10%); }
.narration-heading strong { font-size: 13px; }
.narration-heading p { margin: 3px 0 0; color: rgb(255 255 255 / 58%); font-size: 8px; }
.narration-card textarea { width: 100%; min-height: 88px; margin: 14px 0 8px; padding: 12px; border: 1px solid rgb(255 255 255 / 12%); border-radius: 13px; outline: none; resize: vertical; background: rgb(255 255 255 / 7%); color: #fff; font-size: 12px; line-height: 1.7; }
.narration-card textarea::placeholder { color: rgb(255 255 255 / 40%); }
.narration-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.narration-actions button, .narration-actions label { min-height: 36px; display: flex; align-items: center; gap: 5px; padding: 0 10px; border: 1px solid rgb(255 255 255 / 12%); border-radius: 11px; background: transparent; color: rgb(255 255 255 / 75%); font-size: 9px; cursor: pointer; }
.narration-actions input { display: none; }
.narration-player { margin: 8px 0 12px; }
.narration-player span { display: flex; align-items: center; gap: 5px; margin-bottom: 6px; font-size: 9px; opacity: 0.75; }
.narration-player audio { width: 100%; height: 32px; }
.story-videos { margin: 25px 0; }
.story-video-card { display: grid; gap: 10px; justify-items: center; padding: 14px; }
.story-video-card + .story-video-card { margin-top: 12px; }
.story-video-card video { width: min(100%, 270px); max-height: 480px; aspect-ratio: 9 / 16; border-radius: 13px; background: #16251c; object-fit: contain; }
.story-video-card strong { display: flex; align-items: center; gap: 6px; width: 100%; color: var(--green); font-size: 12px; }
.story-sections { display: grid; gap: 22px; }
.story-section { overflow: hidden; border-radius: 23px; background: #fff; box-shadow: var(--shadow); }
.section-photo { position: relative; height: 230px; }
.section-photo::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg, rgb(15 29 22 / 10%), transparent 45%, rgb(15 29 22 / 20%)); }
.section-photo img { width: 100%; height: 100%; object-fit: cover; }
.section-photo > span { position: absolute; z-index: 1; left: 14px; top: 14px; padding: 5px 8px; border-radius: 8px; background: rgb(26 44 34 / 55%); color: #fff; font-size: 9px; backdrop-filter: blur(6px); }
.section-photo > button { position: absolute; z-index: 2; right: 12px; bottom: 12px; min-height: 34px; display: flex; align-items: center; gap: 5px; padding: 0 10px; border: 0; border-radius: 10px; background: rgb(255 255 255 / 90%); color: var(--ink); font-size: 10px; }
.section-editor { padding: 16px; }
.section-beat { display: inline-block; margin-bottom: 10px; color: var(--green); font-size: 10px; font-weight: 600; }
.add-section-photo { display: inline-flex; align-items: center; gap: 5px; margin-bottom: 10px; padding: 7px 9px; border: 1px solid var(--line); border-radius: 9px; background: var(--green-soft); color: var(--green); font-size: 10px; }
.section-title-row { display: flex; align-items: center; gap: 8px; }
.section-title-row > input { flex: 1; min-width: 0; border: 0; outline: none; color: var(--ink); font-size: 18px; font-weight: 700; }
.reorder-buttons { display: flex; gap: 3px; }
.reorder-buttons button { width: 30px; height: 30px; display: grid; place-items: center; border: 1px solid var(--line); border-radius: 9px; background: #fff; color: var(--muted); }
.story-textarea { width: 100%; min-height: 180px; margin-top: 10px; padding: 0; border: 0; outline: none; resize: vertical; background: transparent; color: #46564c; font-size: 14px; line-height: 2; }
.section-source { display: flex; align-items: center; gap: 5px; padding-top: 10px; border-top: 1px solid var(--line); color: #98a199; font-size: 8px; }
.story-actions { display: grid; grid-template-columns: 0.8fr 1.2fr; gap: 9px; margin-top: 24px; }
.story-note { display: flex; align-items: flex-start; justify-content: center; gap: 5px; margin: 16px 8px 0; color: var(--muted); font-size: 9px; line-height: 1.5; }
.story-note svg { flex: 0 0 auto; }
</style>
