<script setup lang="ts">
import { computed } from 'vue'
import { Award, BookOpenText, Camera, Check, Download, Map, Mic, Share2, Sparkles } from 'lucide-vue-next'
import { useTripStore } from '../../stores/trip'
import { showToast } from '../../stores/ui'

const store = useTripStore()
const iconMap = { camera: Camera, sparkles: Sparkles, book: BookOpenText, share: Share2, map: Map, mic: Mic }
const earnedCount = computed(() => store.state.trip.badges.filter((badge) => badge.earned).length)
const cityCount = computed(() => new Set([store.state.trip.city, ...store.state.historyTrips.map((trip) => trip.city)]).size)

function downloadPoster() {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1440
  const context = canvas.getContext('2d')
  if (!context) return
  context.fillStyle = '#294d3b'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#dcecc8'
  context.beginPath()
  context.arc(880, 220, 230, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#ffffff'
  context.font = '700 54px sans-serif'
  context.fillText('NextStop', 84, 120)
  context.fillStyle = '#bcd0c1'
  context.font = '28px sans-serif'
  context.fillText('我的旅行成就', 84, 174)
  context.fillStyle = '#ffffff'
  context.font = '700 72px sans-serif'
  const title = store.state.trip.title
  context.fillText(title.slice(0, 12), 84, 540)
  if (title.length > 12) context.fillText(title.slice(12, 24), 84, 630)
  context.fillStyle = '#dcecc8'
  context.font = '700 160px sans-serif'
  context.fillText(String(earnedCount.value), 84, 920)
  context.fillStyle = '#ffffff'
  context.font = '36px sans-serif'
  context.fillText('枚旅行徽章', 300, 900)
  context.fillStyle = '#bcd0c1'
  context.font = '28px sans-serif'
  context.fillText(`${store.state.trip.records.length} 个记录时刻 · ${cityCount.value} 座城市`, 88, 990)
  context.fillStyle = '#ffffff'
  context.font = '32px sans-serif'
  context.fillText('走过的路，最后都成了我的故事。', 84, 1260)
  context.fillStyle = '#9fb7a7'
  context.font = '24px sans-serif'
  context.fillText('AI 带你玩 · NextStop', 84, 1320)
  const anchor = document.createElement('a')
  anchor.download = 'NextStop-旅行成就.png'
  anchor.href = canvas.toDataURL('image/png')
  anchor.click()
  showToast('成就海报已生成并下载')
}
</script>

<template>
  <div class="page achievements-page">
    <header class="page-header">
      <div><p class="eyebrow">MY BADGES · 本地规则</p><h1>走过，都有回响</h1><p>不为了打卡而赶路，只收藏真实发生的时刻。</p></div>
      <span class="round-icon"><Award :size="21" /></span>
    </header>

    <section class="achievement-hero">
      <div class="hero-orbit orbit-one"></div><div class="hero-orbit orbit-two"></div>
      <span class="hero-label">TRAVEL COLLECTION</span>
      <div class="hero-count"><strong>{{ earnedCount }}</strong><span>/ {{ store.state.trip.badges.length }} 枚徽章</span></div>
      <p>{{ store.state.trip.title }}</p>
      <div class="hero-stats"><span><strong>{{ store.state.trip.records.length }}</strong> 记录</span><i></i><span><strong>{{ cityCount }}</strong> 城市</span><i></i><span><strong>{{ store.state.historyTrips.length + 1 }}</strong> 旅行</span></div>
    </section>

    <div class="section-heading"><h2>我的徽章墙</h2><span class="light-label">按本地行为自动更新</span></div>
    <section class="badge-grid">
      <article v-for="badge in store.state.trip.badges" :key="badge.id" class="badge-card" :class="{ locked: !badge.earned }">
        <div class="badge-icon"><component :is="iconMap[badge.icon as keyof typeof iconMap] || Award" :size="25" /><span v-if="badge.earned"><Check :size="11" /></span></div>
        <h3>{{ badge.name }}</h3>
        <p>{{ badge.description }}</p>
        <div class="badge-progress"><i :style="{ width: `${Math.min(100, (badge.progress / badge.target) * 100)}%` }"></i></div>
        <span class="progress-label">{{ badge.earned ? '已获得' : `${badge.progress} / ${badge.target}` }}</span>
      </article>
    </section>

    <div class="section-heading"><h2>成就分享海报</h2><span class="light-label">纯前端生成</span></div>
    <section class="poster-card">
      <div class="poster-copy"><span>NEXTSTOP · MY JOURNEY</span><h2>我把旅行，<br />走成了自己的故事。</h2><p>{{ store.state.trip.city }} · {{ earnedCount }} 枚徽章 · {{ store.state.trip.records.length }} 个时刻</p></div>
      <button class="primary-button full-width" type="button" @click="downloadPoster"><Download :size="17" /> 下载分享海报</button>
    </section>
  </div>
</template>

<style scoped>
.round-icon { width: 46px; height: 46px; display: grid; place-items: center; border-radius: 16px; background: var(--orange-soft); color: var(--orange); }
.achievement-hero { position: relative; overflow: hidden; padding: 24px 20px; border-radius: 25px; background: #294d3b; color: #fff; }
.hero-orbit { position: absolute; border: 1px solid rgb(255 255 255 / 8%); border-radius: 50%; }
.orbit-one { width: 240px; height: 240px; right: -90px; top: -100px; }
.orbit-two { width: 160px; height: 160px; right: -45px; top: -55px; }
.hero-label { color: #b4c8b9; font-size: 9px; letter-spacing: 2px; }
.hero-count { display: flex; align-items: flex-end; gap: 10px; margin-top: 15px; }
.hero-count strong { font-size: 64px; line-height: 1; }
.hero-count span { padding-bottom: 8px; color: #c0d0c4; font-size: 12px; }
.achievement-hero > p { margin: 12px 0 18px; color: #e1e9e3; font-size: 13px; }
.hero-stats { display: flex; align-items: center; gap: 16px; color: #b8c9bc; font-size: 10px; }
.hero-stats strong { color: #fff; font-size: 14px; }
.hero-stats i { width: 1px; height: 16px; background: rgb(255 255 255 / 16%); }
.light-label { color: var(--muted); font-size: 9px; }
.badge-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 11px; }
.badge-card { padding: 17px 15px; border: 1px solid var(--line); border-radius: 20px; background: #fff; }
.badge-icon { position: relative; width: 49px; height: 49px; display: grid; place-items: center; margin-bottom: 13px; border-radius: 17px; background: var(--green-soft); color: var(--green); }
.badge-icon > span { position: absolute; right: -3px; bottom: -3px; width: 20px; height: 20px; display: grid; place-items: center; border: 2px solid #fff; border-radius: 50%; background: var(--green); color: #fff; }
.badge-card h3 { margin-bottom: 5px; font-size: 14px; }
.badge-card p { min-height: 32px; margin-bottom: 12px; color: var(--muted); font-size: 9px; line-height: 1.6; }
.badge-progress { height: 4px; overflow: hidden; border-radius: 5px; background: #edf0eb; }
.badge-progress i { display: block; height: 100%; border-radius: 5px; background: var(--green); }
.progress-label { display: block; margin-top: 6px; color: var(--green); font-size: 8px; }
.badge-card.locked { background: rgb(255 255 255 / 55%); box-shadow: none; }
.badge-card.locked .badge-icon { background: #ecefeb; color: #a0aaa2; }
.badge-card.locked h3, .badge-card.locked .progress-label { color: #8d978f; }
.badge-card.locked .badge-progress i { background: #aab4ac; }
.poster-card { padding: 15px; border-radius: 23px; background: #e7ede2; }
.poster-copy { padding: 22px 18px; border-radius: 17px; background: #2c4f3d; color: #fff; }
.poster-copy > span { color: #b8cabd; font-size: 8px; letter-spacing: 1.6px; }
.poster-copy h2 { margin: 30px 0 18px; font-size: 27px; line-height: 1.4; }
.poster-copy p { margin: 0; color: #c0d0c4; font-size: 10px; }
.poster-card > button { margin-top: 12px; }
</style>
