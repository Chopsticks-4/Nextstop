<script setup lang="ts">
import { computed, onActivated, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowRight, BookOpenText, ChevronLeft, ChevronRight, MapPin } from 'lucide-vue-next'
import { useTripStore } from '../../stores/trip'
import { getRecordImages } from '../../utils/records'
import type { Trip } from '../../types'
import { communityStories } from './community-stories'
import { loadCommunity } from './community-service'

const store = useTripStore()
const route = useRoute()
const storyRail = ref<HTMLElement | null>(null)
const impact = ref<Record<string, number>>({})
const myStories = computed(() => store.state.historyTrips
  .filter((trip) => trip.storySections.length > 0)
  .slice()
  .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)))

onActivated(async () => {
  try {
    const data = await loadCommunity()
    impact.value = Object.fromEntries(Object.entries(data.reactions).map(([id, reaction]) => [id, reaction.influence]))
  } catch { /* 未连接社区服务时仍显示模拟故事 */ }
})

function storyCover(trip: Trip) {
  return trip.records.flatMap(getRecordImages)[0] || trip.storySections.find((section) => section.image)?.image || ''
}

function scrollStories(direction: -1 | 1) {
  const rail = storyRail.value
  if (!rail) return
  rail.scrollBy({ left: direction * ((rail.querySelector('.community-card')?.clientWidth || 300) + 13), behavior: 'smooth' })
}

function scrollStoriesByWheel(event: WheelEvent) {
  const rail = storyRail.value
  if (!rail || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
  const delta = event.deltaY
  const atStart = rail.scrollLeft <= 0 && delta < 0
  const atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1 && delta > 0
  if (atStart || atEnd) return
  event.preventDefault()
  rail.scrollLeft += delta
}
</script>

<template>
  <div class="page story-hub">
    <header class="page-header"><div><p class="eyebrow">TRAVEL STORIES</p><h1>故事</h1><p>看看别人的旅途，也翻翻自己走过的路。</p></div></header>

    <section class="story-group" aria-labelledby="community-title">
      <div class="group-heading"><div><p class="eyebrow"><MapPin :size="12" /> 上海</p><h2 id="community-title">看看他人的故事</h2></div></div>
      <p class="group-description">左右滑动，看看上海的旅行灵感</p>
      <div class="rail-controls"><button type="button" aria-label="上一条故事" @click="scrollStories(-1)"><ChevronLeft :size="17" /></button><button type="button" aria-label="下一条故事" @click="scrollStories(1)"><ChevronRight :size="17" /></button></div>
      <div ref="storyRail" class="community-rail" aria-label="上海故事，横向滚动" @wheel="scrollStoriesByWheel">
        <router-link v-for="story in communityStories.slice(0, 5)" :key="story.id" class="community-card" :to="{ path: '/community', query: { story: story.id } }">
          <img :src="story.image" :alt="story.place" />
          <span class="card-content"><small><span class="avatar" :style="{ background: story.avatarColor }">{{ story.avatar }}</span>{{ story.author }} · {{ story.place }}</small><strong>{{ story.title }}</strong><span>{{ story.excerpt }}</span><span class="card-impact">影响力 · {{ story.influence + (impact[story.id] || 0) }} 人跟 ta 走</span><em>阅读故事 <ArrowRight :size="13" /></em></span>
        </router-link>
        <router-link class="more-card" to="/community"><BookOpenText :size="29" /><strong>看更多</strong><span>进入故事社区</span><ArrowRight :size="20" /></router-link>
      </div>
    </section>

    <section class="story-group my-group" aria-labelledby="mine-title">
      <div class="group-heading"><div><p class="eyebrow">MY STORIES</p><h2 id="mine-title">我的历史故事</h2></div><span class="count">{{ myStories.length }} 篇</span></div>
      <p class="group-description">最近完成的故事排在最上面</p>
      <div v-if="myStories.length" class="mine-list">
        <router-link v-for="trip in myStories" :key="trip.id" class="mine-card" :class="{ latest: route.query.latest === trip.id }" :to="{ path: '/story/edit', query: { trip: trip.id } }">
          <img v-if="storyCover(trip)" :src="storyCover(trip)" :alt="trip.city + '旅行故事封面'" />
          <span v-else class="mine-placeholder"><BookOpenText :size="24" /></span>
          <span class="mine-copy"><small>{{ trip.city }} · {{ trip.date }}</small><strong>{{ trip.storyTitle || trip.title }}</strong><span>{{ trip.storySections[0]?.text || trip.narration }}</span><em>{{ route.query.latest === trip.id ? '刚刚完成 · ' : '' }}查看我的故事 <ArrowRight :size="13" /></em></span>
        </router-link>
      </div>
      <div v-else class="mine-empty"><BookOpenText :size="27" /><strong>还没有历史故事</strong><p>结束一次旅行后，你的故事会自动保存在这里。</p></div>
    </section>
  </div>
</template>

<style scoped>
.story-group { margin-top: 24px; }
.group-heading { display: flex; align-items: end; justify-content: space-between; gap: 12px; }
.group-heading h2 { margin: 3px 0 0; color: var(--ink); font-size: 22px; line-height: 1.35; }
.group-heading .eyebrow { display: flex; align-items: center; gap: 4px; }
.count { display: inline-flex; align-items: center; gap: 4px; flex: 0 0 auto; padding: 5px 8px; border-radius: 99px; background: var(--green-soft); color: var(--green); font-size: 10px; }
.group-description { margin: 7px 0 14px; color: var(--muted); font-size: 11px; }
.rail-controls { display: flex; justify-content: flex-end; gap: 6px; margin: -37px 0 10px; }
.rail-controls button { width: 30px; height: 30px; display: grid; place-items: center; border: 1px solid var(--line); border-radius: 50%; background: #fff; color: var(--green); }
.community-rail { display: grid; grid-auto-flow: column; grid-auto-columns: min(76vw, 300px); gap: 13px; overflow-x: auto; overflow-y: hidden; margin: 0 -18px; padding: 4px 18px 24px; scroll-snap-type: x mandatory; overscroll-behavior-x: contain; scrollbar-width: thin; }
.community-card, .more-card { min-width: 0; overflow: hidden; border-radius: 23px; background: #fff; box-shadow: var(--shadow); scroll-snap-align: center; color: inherit; text-decoration: none; }
.community-card > img { width: 100%; height: 165px; object-fit: cover; }
.card-content { display: flex; flex-direction: column; align-items: flex-start; padding: 13px 15px 17px; }
.card-content small { display: flex; align-items: center; gap: 6px; color: var(--green); font-size: 10px; }
.avatar { width: 23px; height: 23px; display: grid; place-items: center; border-radius: 50%; font-size: 15px; }
.card-content strong { margin-top: 9px; color: var(--ink); font-size: 17px; }
.card-content > span:not(.avatar) { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; min-height: 32px; margin-top: 6px; color: var(--muted); font-size: 11px; line-height: 1.5; }
.card-content .card-impact { display: block; min-height: 0; margin-top: 8px; color: var(--green); font-weight: 600; }
.card-content em, .mine-copy em { display: flex; align-items: center; gap: 3px; margin-top: 11px; color: var(--green); font-size: 10px; font-style: normal; font-weight: 600; }
.more-card { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; background: var(--green-soft); color: var(--green); }
.more-card strong { font-size: 20px; }
.more-card span { font-size: 12px; }
.my-group { margin-top: 22px; padding-bottom: 20px; }
.mine-list { display: grid; gap: 12px; }
.mine-card { width: 100%; display: flex; gap: 13px; padding: 10px; border: 1px solid var(--line); border-radius: 19px; background: #fff; box-shadow: var(--shadow); color: inherit; text-decoration: none; }
.mine-card > img, .mine-placeholder { width: 96px; height: 116px; flex: 0 0 96px; border-radius: 13px; object-fit: cover; }
.mine-placeholder { display: grid; place-items: center; background: var(--green-soft); color: var(--green); }
.mine-copy { min-width: 0; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; }
.mine-copy small { color: var(--green); font-size: 9px; }
.mine-copy strong { margin-top: 6px; color: var(--ink); font-size: 14px; line-height: 1.4; }
.mine-copy > span { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; margin-top: 5px; color: var(--muted); font-size: 10px; line-height: 1.5; }
.mine-card.latest { border-color: var(--green); }
.mine-empty { display: flex; flex-direction: column; align-items: center; padding: 35px 16px; border: 1px dashed var(--line); border-radius: 19px; background: #fff; color: var(--green); text-align: center; }
.mine-empty strong { margin-top: 10px; color: var(--ink); font-size: 14px; }
.mine-empty p { margin: 6px 0 0; color: var(--muted); font-size: 11px; }
</style>
