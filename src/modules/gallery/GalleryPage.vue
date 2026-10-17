<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, ChevronLeft, ChevronRight, Images, MapPin, Video, X } from 'lucide-vue-next'
import { useTripStore } from '../../stores/trip'
import { getRecordImages } from '../../utils/records'
import type { GeneratedVideo, Trip } from '../../types'

interface GalleryPhoto {
  id: string
  src: string
  location: string
  recordedAt: string
  tripId: string
  tripTitle: string
}

interface TripAlbum {
  trip: Trip
  current: boolean
  photos: GalleryPhoto[]
  videos: GeneratedVideo[]
}

const store = useTripStore()
const router = useRouter()
const activePhoto = ref<GalleryPhoto | null>(null)

function photosForTrip(trip: Trip) {
  return trip.records.flatMap((record) => getRecordImages(record).map((src, index) => ({
    id: `${trip.id}-${record.id}-${index}`,
    src,
    location: record.location,
    recordedAt: record.recordedAt,
    tripId: trip.id,
    tripTitle: trip.title,
  })))
}

const albums = computed<TripAlbum[]>(() => {
  const historical = store.state.historyTrips.filter((trip) => trip.id !== store.state.trip.id)
  return [store.state.trip, ...historical].map((trip, index) => ({
    trip,
    current: index === 0,
    photos: photosForTrip(trip),
    videos: trip.generatedVideos ?? [],
  }))
})
const totalPhotos = computed(() => albums.value.reduce((sum, album) => sum + album.photos.length, 0))
const totalVideos = computed(() => albums.value.reduce((sum, album) => sum + album.videos.length, 0))
const viewerPhotos = computed(() => albums.value.find((album) => album.trip.id === activePhoto.value?.tripId)?.photos ?? [])

function movePhoto(direction: -1 | 1) {
  if (!activePhoto.value || viewerPhotos.value.length < 2) return
  const index = viewerPhotos.value.findIndex((photo) => photo.id === activePhoto.value?.id)
  activePhoto.value = viewerPhotos.value[(index + direction + viewerPhotos.value.length) % viewerPhotos.value.length] ?? null
}

function onKeydown(event: KeyboardEvent) {
  if (!activePhoto.value) return
  if (event.key === 'Escape') activePhoto.value = null
  if (event.key === 'ArrowLeft') movePhoto(-1)
  if (event.key === 'ArrowRight') movePhoto(1)
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="page gallery-page">
    <header class="gallery-header">
      <button class="back-button" type="button" aria-label="返回我的" @click="router.push('/profile')"><ArrowLeft :size="19" /></button>
      <div><p class="eyebrow">TRAVEL ALBUM</p><h1>旅行相册</h1><p>{{ albums.length }} 次旅行 · {{ totalPhotos }} 张照片 · {{ totalVideos }} 个视频</p></div>
      <span class="gallery-mark"><Images :size="22" /></span>
    </header>

    <div class="album-list">
      <section v-for="album in albums" :key="album.trip.id" class="album-section">
        <div class="album-heading">
          <div><span>{{ album.current ? '本次旅行' : album.trip.date }}</span><h2>{{ album.trip.title }}</h2><p><MapPin :size="11" /> {{ album.trip.city }}</p></div>
          <strong>{{ album.photos.length }} 张照片 · {{ album.videos.length }} 个视频</strong>
        </div>
        <div v-if="album.photos.length" class="photo-grid">
          <button v-for="photo in album.photos" :key="photo.id" type="button" @click="activePhoto = photo">
            <img :src="photo.src" :alt="`${photo.tripTitle}${photo.location ? ` · ${photo.location}` : ''}`" />
            <span v-if="photo.location">{{ photo.location }}</span>
          </button>
        </div>
        <div v-else class="album-empty">这次旅行还没有照片</div>
        <div class="video-heading"><Video :size="15" /><h3>旅行视频</h3></div>
        <div v-if="album.videos.length" class="video-grid">
          <article v-for="video in album.videos" :key="video.id" class="video-card">
            <video :src="video.src" :poster="video.poster" controls playsinline preload="metadata" :aria-label="video.title"></video>
            <div><strong>{{ video.title }}</strong><span>{{ new Date(video.createdAt).toLocaleDateString('zh-CN') }}</span></div>
          </article>
        </div>
        <div v-else class="album-empty video-empty">这次旅行还没有生成视频</div>
      </section>
    </div>
    <button v-if="!totalPhotos && !totalVideos" class="primary-button add-photo-button" type="button" @click="router.push({ path: '/records', query: { compose: 'image' } })">去添加照片</button>

    <Teleport to="body">
      <div v-if="activePhoto" class="photo-viewer" role="dialog" aria-modal="true" aria-label="照片查看器" @click.self="activePhoto = null">
        <button class="viewer-close" type="button" aria-label="关闭照片" @click="activePhoto = null"><X :size="22" /></button>
        <button v-if="viewerPhotos.length > 1" class="viewer-nav previous" type="button" aria-label="上一张" @click="movePhoto(-1)"><ChevronLeft :size="27" /></button>
        <figure>
          <img :src="activePhoto.src" :alt="activePhoto.tripTitle" />
          <figcaption><strong>{{ activePhoto.tripTitle }}</strong><span>{{ [activePhoto.location, activePhoto.recordedAt].filter(Boolean).join(' · ') }}</span></figcaption>
        </figure>
        <button v-if="viewerPhotos.length > 1" class="viewer-nav next" type="button" aria-label="下一张" @click="movePhoto(1)"><ChevronRight :size="27" /></button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.gallery-header { display: grid; grid-template-columns: 42px 1fr 48px; align-items: start; gap: 10px; margin-bottom: 27px; }
.gallery-header h1 { margin: 3px 0 4px; font-size: 29px; }
.gallery-header > div > p:last-child { margin: 0; color: var(--muted); font-size: 10px; }
.back-button, .gallery-mark { width: 42px; height: 42px; display: grid; place-items: center; border: 0; border-radius: 14px; background: #fff; color: var(--green); box-shadow: 0 5px 16px rgb(33 63 45 / 7%); }
.gallery-mark { width: 48px; height: 48px; background: var(--green-soft); }
.album-list { display: grid; gap: 30px; }
.album-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.album-heading span { color: var(--green); font-size: 9px; font-weight: 650; letter-spacing: 0.8px; }
.album-heading h2 { margin: 4px 0; font-size: 19px; }
.album-heading p { display: flex; align-items: center; gap: 3px; margin: 0; color: var(--muted); font-size: 9px; }
.album-heading > strong { padding: 5px 8px; border-radius: 9px; background: var(--green-soft); color: var(--green); font-size: 9px; white-space: nowrap; }
.photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; overflow: hidden; border-radius: 18px; }
.photo-grid button { position: relative; aspect-ratio: 1; overflow: hidden; padding: 0; border: 0; background: #e8ece6; }
.photo-grid img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.2s; }
.photo-grid button:active img { transform: scale(0.97); }
.photo-grid span { position: absolute; left: 5px; right: 5px; bottom: 5px; overflow: hidden; padding: 3px 5px; border-radius: 6px; background: rgb(21 37 29 / 55%); color: #fff; font-size: 7px; text-overflow: ellipsis; white-space: nowrap; backdrop-filter: blur(4px); }
.album-empty { display: grid; place-items: center; min-height: 82px; border: 1px dashed var(--line); border-radius: 17px; color: var(--muted); font-size: 10px; }
.video-heading { display: flex; align-items: center; gap: 7px; margin: 20px 0 10px; color: var(--green); }
.video-heading h3 { margin: 0; font-size: 14px; }
.video-empty { min-height: 110px; padding: 14px; text-align: center; }
.video-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.video-card { overflow: hidden; border-radius: 16px; background: #fff; box-shadow: 0 5px 16px rgb(33 63 45 / 7%); }
.video-card video { display: block; width: 100%; aspect-ratio: 9 / 16; max-height: 300px; background: #16251c; object-fit: contain; }
.video-card > div { display: flex; justify-content: space-between; gap: 8px; padding: 10px; font-size: 10px; }
.video-card strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.video-card span { flex-shrink: 0; color: var(--muted); }
.add-photo-button { display: block; margin: 22px auto 0; }
.photo-viewer { position: fixed; inset: 0; z-index: 180; display: grid; place-items: center; padding: 58px 18px 32px; background: rgb(8 15 11 / 92%); }
.photo-viewer figure { width: min(100%, 900px); margin: 0; text-align: center; }
.photo-viewer figure > img { max-width: 100%; max-height: calc(100vh - 155px); border-radius: 8px; object-fit: contain; }
.photo-viewer figcaption { display: flex; flex-direction: column; gap: 4px; margin-top: 13px; color: #fff; }
.photo-viewer figcaption strong { font-size: 13px; }
.photo-viewer figcaption span { color: rgb(255 255 255 / 62%); font-size: 9px; }
.viewer-close, .viewer-nav { position: fixed; z-index: 1; display: grid; place-items: center; border: 0; border-radius: 50%; background: rgb(255 255 255 / 13%); color: #fff; backdrop-filter: blur(8px); }
.viewer-close { top: 18px; right: 18px; width: 42px; height: 42px; }
.viewer-nav { top: 50%; width: 43px; height: 43px; transform: translateY(-50%); }
.viewer-nav.previous { left: 10px; }
.viewer-nav.next { right: 10px; }
@media (min-width: 700px) { .photo-grid { grid-template-columns: repeat(4, 1fr); } .viewer-nav.previous { left: 30px; } .viewer-nav.next { right: 30px; } }
</style>
