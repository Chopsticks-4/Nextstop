<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, Check, ChevronLeft, ChevronRight, Clipboard, Download, FileText, Images, Music2, Share2, Smartphone, Upload, Video, X } from 'lucide-vue-next'
import { useTripStore } from '../../stores/trip'
import { showToast } from '../../stores/ui'
import { copyText, downloadText, imageFileToDataUrl } from '../../utils/files'
import { getRecordImages } from '../../utils/records'
import { prepareWechatImage } from '../../utils/wechat-images'
import type { ExportFormat } from '../../types'
import { publishTrip } from '../story/community-service'

const store = useTripStore()
const route = useRoute()
const router = useRouter()
const publishingCommunity = ref(false)
const format = ref<ExportFormat>('redbook')
const formats: { id: ExportFormat; label: string }[] = [
  { id: 'moments', label: '朋友圈' },
  { id: 'redbook', label: '小红书' },
  { id: 'wechat', label: '微信图文' },
  { id: 'video', label: '旅行视频' },
]
const exportTrip = computed(() => {
  const tripId = typeof route.query.trip === 'string' ? route.query.trip : ''
  if (!tripId || tripId === store.trip.value.id) return store.trip.value
  return store.state.historyTrips.find((trip) => trip.id === tripId) ?? store.trip.value
})
const importedDemoVideo = computed(() => exportTrip.value.generatedVideos?.find((video) => video.id === `demo-${exportTrip.value.id}`))
const importingDemoVideo = ref(false)
const downloadingVideo = ref(false)
const demoVideoSrc = '/videos/demo1.mp4'

async function importDemoVideo() {
  if (importingDemoVideo.value || importedDemoVideo.value || !exportTrip.value.storySections.length) return
  importingDemoVideo.value = true
  try {
    const tripId = exportTrip.value.id
    const saved = store.saveGeneratedVideo(tripId, {
      id: `demo-${tripId}`,
      title: `${exportTrip.value.storyTitle || exportTrip.value.title} · 旅行视频`,
      src: demoVideoSrc,
      createdAt: new Date().toISOString(),
    }) && await store.saveStoryToHistory(tripId)
    showToast(saved ? '演示视频已保存到本次故事和旅行相册' : '视频保存失败，请稍后重试')
  } catch {
    showToast('视频保存失败，请稍后重试')
  } finally {
    importingDemoVideo.value = false
  }
}

async function downloadVideo() {
  if (downloadingVideo.value || !importedDemoVideo.value) return
  downloadingVideo.value = true
  try {
    const response = await fetch(importedDemoVideo.value.src)
    if (!response.ok) throw new Error('视频文件无法读取')
    const blob = await response.blob()
    if (!blob.size) throw new Error('视频文件为空')
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `NextStop-${exportTrip.value.city}-旅行视频.mp4`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    store.markExported(exportTrip.value.id)
    showToast('视频下载已开始，正在返回首页')
    await router.push('/home')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '视频下载失败，请重试')
  } finally {
    downloadingVideo.value = false
  }
}
const images = computed(() => {
  return [...new Set([
    ...exportTrip.value.records.flatMap(getRecordImages),
    ...exportTrip.value.storySections.map((section) => section.image).filter(Boolean),
  ])]
})
const redbookIndex = ref(0)
const wechatCover = ref('')
const customWechatCover = ref('')
const addedWechatPhotos = ref<string[]>([])
const addingWechatPhotos = ref(false)
const savingWechat = ref(false)
const wechatResult = ref('')
const redbookTrack = ref<HTMLDivElement | null>(null)
const wechatUsedImages = computed(() => new Set(exportTrip.value.storySections.flatMap((section) => wechatSectionImages(section))))
const wechatArticleImages = computed(() => [...new Set([...images.value, ...addedWechatPhotos.value])])
const wechatExtraImages = computed(() => wechatArticleImages.value.filter((image) => !wechatUsedImages.value.has(image)))
const wechatCoverImages = computed(() => [...new Set([...wechatArticleImages.value, customWechatCover.value].filter(Boolean))])
const storyText = computed(() => exportTrip.value.storySections.map((section) => section.text).join('\n\n'))
const exportText = computed(() => {
  const trip = exportTrip.value
  if (format.value === 'moments') return `${trip.storyTitle}\n\n${storyText.value || trip.narration}\n\n📍${trip.city} · 不赶时间的一天`
  if (format.value === 'redbook') return `${trip.storyTitle}\n\n${storyText.value}\n\n#${trip.city}旅行 #松弛感旅行 #我的旅行故事 #NextStop`
  if (format.value === 'wechat') return `${trip.storyTitle}\n\n${trip.storySections.map((section) => `【${section.title}】\n${section.text}`).join('\n\n')}`
  return trip.narration || storyText.value
})

watch(images, () => {
  redbookIndex.value = 0
  if (!wechatCoverImages.value.includes(wechatCover.value)) wechatCover.value = images.value[0] || customWechatCover.value
  wechatResult.value = ''
}, { immediate: true })

watch(() => exportTrip.value.id, () => {
  customWechatCover.value = ''
  addedWechatPhotos.value = []
  wechatCover.value = images.value[0] || ''
  wechatResult.value = ''
})

async function addWechatPhotos(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (!files.length) return
  if (wechatArticleImages.value.length + files.length > 40) {
    showToast('单篇微信图文最多可选择 40 张照片')
    input.value = ''
    return
  }
  addingWechatPhotos.value = true
  try {
    const selected = await Promise.all(files.map(imageFileToDataUrl))
    addedWechatPhotos.value = [...new Set([...addedWechatPhotos.value, ...selected])]
    if (!wechatCover.value) wechatCover.value = selected[0] || ''
  } catch {
    showToast('照片读取失败，请重新选择')
  } finally {
    addingWechatPhotos.value = false
    input.value = ''
  }
}

function removeWechatPhoto(image: string) {
  addedWechatPhotos.value = addedWechatPhotos.value.filter((item) => item !== image)
  if (wechatCover.value === image && !images.value.includes(image)) wechatCover.value = wechatCoverImages.value[0] || ''
}

async function chooseCustomCover(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    customWechatCover.value = await imageFileToDataUrl(file)
    wechatCover.value = customWechatCover.value
  } catch {
    showToast('封面图片读取失败，请换一张')
  } finally {
    input.value = ''
  }
}

function wechatSectionImages(section: (typeof exportTrip.value.storySections)[number]) {
  const recordImages = exportTrip.value.records
    .filter((record) => section.sourceRecordIds.includes(record.id))
    .flatMap(getRecordImages)
  return [...new Set(recordImages.length ? recordImages : section.image ? [section.image] : [])]
}

async function saveWechatDraft() {
  if (savingWechat.value) return
  if (!exportTrip.value.storySections.length || !wechatCover.value) {
    showToast('请先生成故事并选择封面')
    return
  }
  savingWechat.value = true
  wechatResult.value = ''
  try {
    const sourceImages = [...new Set([
      ...exportTrip.value.storySections.flatMap(wechatSectionImages),
      ...wechatExtraImages.value,
    ])]
    const prepared = new Map<string, string>()
    for (const source of sourceImages) prepared.set(source, await prepareWechatImage(source))
    const body = {
      title: exportTrip.value.storyTitle,
      city: exportTrip.value.city,
      date: exportTrip.value.date,
      sections: exportTrip.value.storySections.map((section) => ({
        title: section.title,
        text: section.text,
        images: wechatSectionImages(section).filter((source) => prepared.has(source)).map((source) => prepared.get(source)!),
      })),
      extraImages: wechatExtraImages.value.filter((source) => prepared.has(source)).map((source) => prepared.get(source)!),
      cover: await prepareWechatImage(wechatCover.value, true),
    }
    const response = await fetch('/api/wechat/draft', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const result = await response.json() as { mediaId?: string; error?: string }
    if (!response.ok || !result.mediaId) throw new Error(result.error || '微信草稿箱没有返回草稿 ID')
    store.markExported(exportTrip.value.id)
    wechatResult.value = '已存入公众号草稿箱，请登录公众平台查看并确认排版。'
    showToast('已存入微信公众号草稿箱')
  } catch (error) {
    wechatResult.value = error instanceof Error ? error.message : '保存到草稿箱失败'
    showToast(wechatResult.value)
  } finally {
    savingWechat.value = false
  }
}

function moveRedbook(direction: -1 | 1) {
  if (!images.value.length) return
  const next = (redbookIndex.value + direction + images.value.length) % images.value.length
  redbookTrack.value?.scrollTo({ left: next * redbookTrack.value.clientWidth, behavior: 'smooth' })
  redbookIndex.value = next
}

function syncRedbookIndex() {
  const track = redbookTrack.value
  if (!track?.clientWidth) return
  redbookIndex.value = Math.min(images.value.length - 1, Math.max(0, Math.round(track.scrollLeft / track.clientWidth)))
}

async function copyExport() {
  try {
    await copyText(exportText.value)
    store.markExported(exportTrip.value.id)
    showToast('文案已复制，导出记录已保存到本机')
  } catch {
    showToast('复制失败，请长按文本手动复制')
  }
}

function downloadExport() {
  downloadText(`NextStop-${formats.find((item) => item.id === format.value)?.label}.txt`, exportText.value)
  store.markExported(exportTrip.value.id)
  showToast('文本已下载到本机')
}

function downloadManifest() {
  const manifest = [
    'NextStop 视频素材清单（未生成 MP4）',
    `标题：${exportTrip.value.storyTitle}`,
    `图片：${images.value.length} 张，顺序见故事编辑器`,
    `旁白：${exportTrip.value.narrationAudio ? '已选择本地原声' : '仅文字旁白'}`,
    '',
    '旁白文本：',
    exportTrip.value.narration,
    '',
    '字幕可按故事段落切分。当前前端不合成视频，不包含 BGM 或真实转场文件。',
  ].join('\n')
  downloadText('NextStop-视频素材清单.txt', manifest)
  store.markExported(exportTrip.value.id)
  showToast('素材清单已下载；未生成视频文件')
}

async function publishToCommunity() {
  if (publishingCommunity.value) return
  if (!exportTrip.value.storySections.length) {
    showToast('请先生成故事，再发布到社区')
    return
  }
  publishingCommunity.value = true
  try {
    const { post } = await publishTrip(exportTrip.value)
    store.markExported(exportTrip.value.id)
    showToast('故事已发布到社区')
    await router.push({ path: '/community', query: { story: post.id } })
  } catch (error) {
    showToast(error instanceof Error ? error.message : '发布失败，请稍后重试')
  } finally {
    publishingCommunity.value = false
  }
}
</script>

<template>
  <div class="page exports-page">
    <header class="page-header">
      <div><p class="eyebrow">ONE STORY · FOUR FORMATS</p><h1>一键带走故事</h1><p>同一故事母版，换成你需要的表达方式。</p></div>
      <span class="round-icon"><Share2 :size="20" /></span>
    </header>

    <div class="export-tabs">
      <button v-for="item in formats" :key="item.id" :class="{ active: format === item.id }" type="button" @click="format = item.id">{{ item.label }}</button>
    </div>

    <section v-if="format === 'video'" class="demo-import card">
      <div><Video :size="18" /><span><strong>导入演示视频</strong><small>保存到当前故事，并归入这次旅行的相册</small></span></div>
      <div class="video-actions">
        <button class="primary-button" type="button" :disabled="importingDemoVideo || Boolean(importedDemoVideo) || !exportTrip.storySections.length" @click="importDemoVideo">{{ importedDemoVideo ? '已导入本次故事' : importingDemoVideo ? '正在保存…' : '导入演示视频' }}</button>
        <button class="secondary-button" type="button" :disabled="downloadingVideo || !importedDemoVideo" @click="downloadVideo"><Download :size="16" /> {{ downloadingVideo ? '准备下载…' : '下载视频' }}</button>
      </div>
      <p v-if="!exportTrip.storySections.length">请先生成故事，再导入视频。</p>
    </section>

    <section class="preview-stage">
      <div v-if="format === 'moments'" class="moments-preview platform-preview">
        <div class="moments-head"><span>N</span><strong>我</strong></div>
        <p>{{ exportText }}</p>
        <div v-if="images.length" class="moments-images"><img v-for="image in images.slice(0, 3)" :key="image" :src="image" alt="朋友圈配图" /></div>
        <div class="platform-meta">刚刚 · {{ exportTrip.city }}</div>
      </div>

      <div v-else-if="format === 'redbook'" class="redbook-preview platform-preview">
        <div v-if="images.length" class="redbook-gallery">
          <div ref="redbookTrack" class="redbook-track" @scroll.passive="syncRedbookIndex">
            <div v-for="(image, index) in images" :key="image" class="redbook-slide"><img :src="image" :alt="`小红书旅行图片 ${index + 1}`" /><span v-if="index === 0">MY TRAVEL</span></div>
          </div>
          <button v-if="images.length > 1" class="redbook-arrow previous" type="button" aria-label="上一张图片" @click="moveRedbook(-1)"><ChevronLeft :size="19" /></button>
          <button v-if="images.length > 1" class="redbook-arrow next" type="button" aria-label="下一张图片" @click="moveRedbook(1)"><ChevronRight :size="19" /></button>
          <span v-if="images.length > 1" class="redbook-count">{{ redbookIndex + 1 }} / {{ images.length }}</span>
          <div v-if="images.length > 1" class="redbook-dots"><i v-for="(_, index) in images" :key="index" :class="{ active: index === redbookIndex }"></i></div>
        </div>
        <div class="redbook-body"><h2>{{ exportTrip.storyTitle }}</h2><p>{{ storyText }}</p><div class="tags">#{{ exportTrip.city }}旅行　#松弛感旅行　#我的旅行故事</div><div class="redbook-user"><span>N</span> 我的 NextStop <HeartIcon /></div></div>
      </div>

      <div v-else-if="format === 'wechat'" class="wechat-preview platform-preview">
        <p class="eyebrow">NEXTSTOP JOURNAL</p>
        <h2>{{ exportTrip.storyTitle }}</h2>
        <div class="wechat-meta">我的旅行记录　{{ exportTrip.date }}</div>
        <article v-for="(section, sectionIndex) in exportTrip.storySections" :key="section.id" class="wechat-section">
          <div v-if="wechatSectionImages(section).length" class="wechat-images" :class="{ multiple: wechatSectionImages(section).length > 1 }">
            <img v-for="(image, imageIndex) in wechatSectionImages(section)" :key="image" :src="image" :alt="`${section.title} · 图片 ${imageIndex + 1}`" />
          </div>
          <span>{{ String(sectionIndex + 1).padStart(2, '0') }} · {{ section.beat }}</span>
          <h3>{{ section.title }}</h3>
          <p>{{ section.text }}</p>
        </article>
        <section v-if="wechatExtraImages.length" class="wechat-extra">
          <h3>更多旅途照片</h3>
          <div class="wechat-images multiple"><img v-for="(image, index) in wechatExtraImages" :key="image" :src="image" :alt="`更多旅途照片 ${index + 1}`" /></div>
        </section>
        <span class="wechat-end">— 完整故事 · 共 {{ exportTrip.storySections.length }} 段 {{ wechatArticleImages.length }} 张照片 —</span>
      </div>

      <div v-else class="video-preview-wrap">
        <video class="imported-video-preview" :src="importedDemoVideo?.src || demoVideoSrc" :poster="importedDemoVideo?.poster" controls playsinline preload="metadata" aria-label="旅行视频演示播放"></video>
        <p>{{ importedDemoVideo ? '已保存到本次故事和旅行相册' : '可先播放预览，再导入到本次故事。' }}</p>
      </div>
    </section>

    <section v-if="format === 'wechat'" class="wechat-publish card">
      <h2>保存到公众号草稿箱</h2>
      <p>下方展示本篇图文的全部照片。点选一张作为封面，其余照片仍会放进正文；也可以继续补充照片。</p>
      <div class="photo-group-heading"><strong>本篇图文照片 · {{ wechatArticleImages.length }} 张</strong><span>点按图片可设为封面</span></div>
      <div v-if="wechatCoverImages.length" class="cover-options" role="radiogroup" aria-label="本篇图文照片与封面选择">
        <div v-for="(image, index) in wechatCoverImages" :key="`${index}-${image.slice(-20)}`" class="cover-option">
          <button type="button" role="radio" :aria-checked="wechatCover === image" :class="{ selected: wechatCover === image }" :aria-label="`选择第 ${index + 1} 张照片作为封面`" @click="wechatCover = image">
            <img :src="image" :alt="`图文照片 ${index + 1}`" />
            <span class="photo-label">{{ wechatCover === image ? '封面' : image === customWechatCover && !wechatArticleImages.includes(image) ? '仅封面' : '正文照片' }}</span>
            <Check v-if="wechatCover === image" :size="15" />
          </button>
          <button v-if="addedWechatPhotos.includes(image)" class="remove-photo" type="button" :aria-label="`移除第 ${index + 1} 张补充照片`" @click="removeWechatPhoto(image)"><X :size="13" /></button>
        </div>
      </div>
      <div class="wechat-photo-actions">
        <label class="custom-cover"><Images :size="14" /> {{ addingWechatPhotos ? '正在添加照片…' : '补充图文照片' }}<input type="file" accept="image/*" multiple :disabled="addingWechatPhotos || savingWechat" @change="addWechatPhotos" /></label>
        <label class="custom-cover"><Upload :size="14" /> 上传单独封面<input type="file" accept="image/*" :disabled="savingWechat" @change="chooseCustomCover" /></label>
      </div>
      <button class="primary-button full-width" type="button" :disabled="savingWechat || addingWechatPhotos || !wechatCover || !exportTrip.storySections.length" @click="saveWechatDraft">{{ savingWechat ? '正在上传照片并保存草稿…' : '存入微信公众号草稿箱' }}</button>
      <p v-if="wechatResult" class="wechat-result" role="status">{{ wechatResult }}</p>
    </section>

    <section v-if="format === 'video'" class="asset-list card">
      <div><Images :size="17" /><span><strong>{{ images.length }} 张故事图片</strong>沿用故事编辑器顺序</span><Check :size="15" /></div>
      <div><FileText :size="17" /><span><strong>旁白与字幕文本</strong>可下载 TXT 素材清单</span><Check :size="15" /></div>
      <div><Music2 :size="17" /><span><strong>{{ exportTrip.narrationAudio ? '本地原声' : '暂无音频' }}</strong>不包含合成或音色处理</span><Check :size="15" /></div>
    </section>
    <section class="export-copy card">
      <div class="copy-heading"><span>当前文案</span><button type="button" @click="copyExport"><Clipboard :size="14" /> 复制</button></div>
      <p>{{ exportText }}</p>
    </section>

    <div class="export-actions">
      <button class="primary-button" type="button" @click="copyExport"><Clipboard :size="17" /> 复制文案</button>
      <button class="secondary-button" type="button" @click="format === 'video' ? downloadManifest() : downloadExport()"><Download :size="17" /> {{ format === 'video' ? '素材清单' : '下载文本' }}</button>
    </div>
    <section class="community-publish card"><div><Share2 :size="19" /><span><strong>发布到社区</strong><small>分享这篇旅行故事，让更多人跟着你的足迹出发</small></span></div><button class="primary-button full-width" type="button" :disabled="publishingCommunity || !exportTrip.storySections.length" @click="publishToCommunity">{{ publishingCommunity ? '正在发布…' : '发布到社区' }} <ArrowRight :size="16" /></button></section>
    <p class="export-note"><Smartphone :size="13" /> 仅在点击保存草稿后上传到微信；不会自动群发或发表。</p>
  </div>
</template>

<script lang="ts">
export default {
  components: {
    HeartIcon: {
      template: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z"/></svg>',
    },
  },
}
</script>

<style scoped>
.round-icon { width: 45px; height: 45px; display: grid; place-items: center; border-radius: 15px; background: var(--green-soft); color: var(--green); }
.export-tabs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin-bottom: 18px; padding: 4px; border-radius: 15px; background: #e8ede5; }
.export-tabs button { min-height: 39px; padding: 0 4px; border: 0; border-radius: 11px; background: transparent; color: var(--muted); font-size: 11px; }
.export-tabs button.active { background: #fff; color: var(--green); font-weight: 700; box-shadow: 0 3px 10px rgb(31 54 40 / 7%); }
.preview-stage { margin-bottom: 16px; padding: 14px; border-radius: 25px; background: #e9ede6; }
.platform-preview { overflow: hidden; border-radius: 18px; background: #fff; box-shadow: 0 8px 24px rgb(30 54 41 / 8%); }
.moments-preview { padding: 18px; }
.moments-head { display: flex; align-items: center; gap: 9px; color: #57718f; font-size: 13px; }
.moments-head > span, .redbook-user > span { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 10px; background: var(--green); color: #fff; }
.moments-preview > p { margin: 14px 0; font-size: 13px; line-height: 1.75; white-space: pre-wrap; }
.moments-images { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.moments-images img { width: 100%; aspect-ratio: 1; object-fit: cover; }
.platform-meta { margin-top: 10px; color: #9aa1a4; font-size: 9px; }
.redbook-gallery { position: relative; }
.redbook-track { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
.redbook-track::-webkit-scrollbar { display: none; }
.redbook-slide { position: relative; height: 300px; min-width: 100%; scroll-snap-align: start; }
.redbook-slide img { width: 100%; height: 100%; object-fit: cover; }
.redbook-slide span { position: absolute; left: 14px; bottom: 14px; color: #fff; font-size: 10px; font-weight: 700; letter-spacing: 2px; text-shadow: 0 2px 8px #000; }
.redbook-arrow { position: absolute; z-index: 2; top: 50%; width: 34px; height: 34px; display: grid; place-items: center; border: 0; border-radius: 50%; background: rgb(255 255 255 / 84%); color: #39483f; transform: translateY(-50%); box-shadow: 0 3px 12px rgb(0 0 0 / 14%); }
.redbook-arrow.previous { left: 9px; }
.redbook-arrow.next { right: 9px; }
.redbook-count { position: absolute; z-index: 2; top: 10px; right: 10px; padding: 4px 7px; border-radius: 999px; background: rgb(20 29 24 / 58%); color: #fff; font-size: 8px; backdrop-filter: blur(5px); }
.redbook-dots { position: absolute; z-index: 2; left: 50%; bottom: 9px; display: flex; gap: 4px; max-width: 80%; transform: translateX(-50%); }
.redbook-dots i { width: 4px; height: 4px; flex: 0 0 auto; border-radius: 50%; background: rgb(255 255 255 / 50%); }
.redbook-dots i.active { width: 12px; border-radius: 4px; background: #fff; }
.redbook-body { padding: 15px; }
.redbook-body h2 { margin-bottom: 9px; font-size: 19px; line-height: 1.4; }
.redbook-body > p { max-height: 150px; overflow-y: auto; margin-bottom: 10px; color: #4c514e; font-size: 11px; line-height: 1.7; white-space: pre-wrap; }
.tags { color: #4b7186; font-size: 9px; }
.redbook-user { display: flex; align-items: center; gap: 7px; margin-top: 13px; color: #6f7671; font-size: 10px; }
.redbook-user > span { width: 26px; height: 26px; border-radius: 50%; }
.redbook-user svg { margin-left: auto; color: #8d958f; }
.wechat-preview { padding: 20px; }
.wechat-preview > h2 { margin: 8px 0; font-size: 23px; line-height: 1.4; }
.wechat-meta { margin-bottom: 16px; color: #8b9690; font-size: 9px; }
.wechat-section { padding: 22px 0; border-top: 1px solid #eef0ec; }
.wechat-section:first-of-type { border-top: 0; }
.wechat-section > span { display: block; margin-top: 14px; color: var(--green); font-size: 8px; font-weight: 700; letter-spacing: 1px; }
.wechat-preview h3 { margin: 7px 0; font-size: 16px; }
.wechat-section > p { margin: 0; color: #515c55; font-size: 12px; line-height: 1.95; white-space: pre-wrap; }
.wechat-images { display: grid; gap: 5px; overflow: hidden; border-radius: 10px; }
.wechat-images.multiple { grid-template-columns: repeat(2, 1fr); }
.wechat-images img { width: 100%; max-height: 230px; aspect-ratio: 4 / 3; object-fit: cover; }
.wechat-images:not(.multiple) img { aspect-ratio: 16 / 10; }
.wechat-extra { padding-top: 6px; border-top: 1px solid #eef0ec; }
.wechat-extra h3 { margin-bottom: 10px; }
.wechat-end { display: block; margin-top: 22px; color: #98a19b; font-size: 9px; text-align: center; }
.wechat-publish { margin-bottom: 16px; padding: 16px; }
.wechat-publish h2 { margin: 0 0 6px; font-size: 16px; }
.wechat-publish > p { color: var(--muted); font-size: 10px; line-height: 1.6; }
.photo-group-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 12px 0 10px; }
.photo-group-heading strong { font-size: 11px; }
.photo-group-heading span { color: var(--muted); font-size: 9px; }
.cover-options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding-bottom: 14px; }
.cover-option { position: relative; min-width: 0; }
.cover-option > button:first-child { position: relative; width: 100%; aspect-ratio: 1; overflow: hidden; padding: 0; border: 3px solid transparent; border-radius: 12px; background: #edf0eb; }
.cover-option > button.selected { border-color: var(--green); }
.cover-option img { width: 100%; height: 100%; object-fit: cover; }
.cover-option .photo-label { position: absolute; left: 3px; bottom: 3px; padding: 3px 5px; border-radius: 6px; background: rgb(22 43 30 / 70%); color: #fff; font-size: 8px; }
.cover-option svg { position: absolute; right: 3px; bottom: 3px; padding: 2px; border-radius: 50%; background: var(--green); color: #fff; }
.cover-option .remove-photo { position: absolute; top: 5px; right: 5px; z-index: 1; width: 24px; height: 24px; display: grid; place-items: center; border: 0; border-radius: 50%; background: rgb(22 43 30 / 75%); color: #fff; }
.cover-option .remove-photo svg { position: static; padding: 0; background: transparent; }
.wechat-photo-actions { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-bottom: 13px; }
.custom-cover { display: inline-flex; align-items: center; gap: 5px; min-height: 34px; color: var(--green); font-size: 10px; cursor: pointer; }
.custom-cover input { display: none; }
.wechat-publish .wechat-result { margin: 10px 0 0; color: var(--green); }
.video-preview-wrap { display: grid; justify-items: center; }
.video-preview { position: relative; width: 225px; aspect-ratio: 9 / 16; overflow: hidden; border-radius: 20px; background: #1e2e26; color: #fff; box-shadow: 0 12px 30px rgb(25 45 34 / 18%); }
.video-preview > img { width: 100%; height: 100%; object-fit: cover; }
.video-shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgb(12 26 19 / 20%), rgb(12 26 19 / 72%)); }
.video-label { position: absolute; top: 13px; left: 13px; display: flex; align-items: center; gap: 4px; padding: 5px 7px; border-radius: 7px; background: rgb(0 0 0 / 25%); font-size: 8px; }
.video-copy { position: absolute; left: 17px; right: 17px; bottom: 32px; }
.video-copy small { font-size: 8px; letter-spacing: 2px; opacity: 0.75; }
.video-copy h2 { margin: 7px 0; font-size: 23px; line-height: 1.3; }
.video-copy p { margin: 0; font-size: 10px; line-height: 1.6; opacity: 0.85; }
.video-progress { position: absolute; left: 17px; right: 17px; bottom: 18px; height: 2px; background: rgb(255 255 255 / 30%); }
.video-progress i { display: block; width: 40%; height: 100%; background: #fff; }
.video-preview-wrap > p { margin: 10px 0 0; color: var(--muted); font-size: 9px; }
.imported-video-preview { display: block; width: 225px; max-height: 400px; aspect-ratio: 9 / 16; border-radius: 20px; background: #1e2e26; object-fit: contain; }
.demo-import { margin-bottom: 16px; padding: 15px; }
.demo-import > div:first-child { display: flex; align-items: center; gap: 9px; margin-bottom: 13px; color: var(--green); }
.demo-import > div:first-child span { display: flex; flex-direction: column; gap: 3px; }
.demo-import strong { color: var(--ink); font-size: 12px; }
.demo-import small { color: var(--muted); font-size: 9px; }
.demo-import > p { margin: 9px 0 0; color: var(--muted); font-size: 10px; }
.video-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.video-actions button { justify-content: center; min-width: 0; }
.asset-list { margin-bottom: 16px; padding: 6px 15px; }
.asset-list > div { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--line); color: var(--green); }
.asset-list > div:last-child { border: 0; }
.asset-list span { flex: 1; color: var(--muted); font-size: 9px; }
.asset-list strong { display: block; margin-bottom: 2px; color: var(--ink); font-size: 11px; }
.export-copy { padding: 15px; }
.copy-heading { display: flex; align-items: center; justify-content: space-between; color: var(--muted); font-size: 10px; }
.copy-heading button { min-height: 34px; display: flex; align-items: center; gap: 4px; border: 0; background: transparent; color: var(--green); font-size: 10px; }
.export-copy > p { max-height: 150px; overflow: auto; margin: 8px 0 0; color: #56635b; font-size: 11px; line-height: 1.7; white-space: pre-wrap; }
.export-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 16px; }
.community-publish { margin-top: 16px; padding: 16px; }
.community-publish > div { display: flex; align-items: center; gap: 10px; margin-bottom: 13px; color: var(--green); }
.community-publish > div span { display: flex; flex-direction: column; gap: 4px; }
.community-publish strong { color: var(--ink); font-size: 14px; }
.community-publish small { color: var(--muted); font-size: 10px; }
.export-note { display: flex; align-items: center; justify-content: center; gap: 5px; margin-top: 13px; color: var(--muted); font-size: 9px; }
</style>
