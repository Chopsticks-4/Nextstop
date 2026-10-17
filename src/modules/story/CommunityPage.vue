<script setup lang="ts">
import { computed, nextTick, onActivated, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight, Heart, MapPin, MessageCircle, Send } from 'lucide-vue-next'
import { searchScenicPlaces, type PlaceData } from '../../services/amap'
import { placeToSuggestion } from '../../services/place-suggestions'
import { useTripStore } from '../../stores/trip'
import { showToast } from '../../stores/ui'
import type { Suggestion } from '../../types'
import { communityStories, type CommunityStory } from './community-stories'
import { addCommunityComment, communityUserId, loadCommunity, recordFollow, toggleCommunityLike, type CommunityReaction } from './community-service'

const store = useTripStore()
const route = useRoute()
const router = useRouter()
const userId = communityUserId()
const liked = ref<string[]>(readSaved('nextstop-community-server-likes', []))
const publishedStories = ref<CommunityStory[]>([])
const reactions = ref<Record<string, CommunityReaction>>({})
const stories = computed(() => [...publishedStories.value, ...communityStories])
const drafts = reactive<Record<string, string>>({})
const openComments = ref<string[]>([])
const following = ref('')

function readSaved<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || '') as T } catch { return fallback }
}

watch(liked, (value) => { try { localStorage.setItem('nextstop-community-server-likes', JSON.stringify(value)) } catch { /* 浏览器禁用存储时保留本次操作 */ } }, { deep: true })
onActivated(async () => {
  try {
    const data = await loadCommunity()
    publishedStories.value = data.posts.map((post) => ({ ...post, comments: [], influence: 0 }))
    reactions.value = data.reactions
  } catch { showToast('社区内容暂时无法更新') }
  if (typeof route.query.story !== 'string') return
  await nextTick()
  document.getElementById(`community-${route.query.story}`)?.scrollIntoView({ block: 'start' })
})

async function toggleLike(id: string) {
  try {
    const result = await toggleCommunityLike(id)
    reactions.value = { ...reactions.value, [id]: result.reaction }
    liked.value = liked.value.includes(id) ? liked.value.filter((item) => item !== id) : [...liked.value, id]
  } catch { showToast('点赞失败，请稍后重试') }
}

function toggleComments(id: string) {
  openComments.value = openComments.value.includes(id) ? openComments.value.filter((item) => item !== id) : [...openComments.value, id]
}

async function addComment(id: string) {
  const comment = drafts[id]?.trim()
  if (!comment) return
  try {
    const result = await addCommunityComment(id, comment)
    reactions.value = { ...reactions.value, [id]: result.reaction }
    drafts[id] = ''
    if (!openComments.value.includes(id)) openComments.value = [...openComments.value, id]
  } catch { showToast('评论失败，请稍后重试') }
}

function influence(story: CommunityStory) {
  return story.influence + (reactions.value[story.id]?.influence || 0)
}

function fallbackSuggestion(story: CommunityStory): Suggestion {
  return {
    id: `community-${story.id}`, name: story.place, category: `${story.city}景点`, image: story.image,
    reason: story.excerpt, whyNow: `来自 ${story.author} 的旅行故事，去看看同一个地方。`,
    distance: '路线待规划', travelMinutes: 0, suggestedMinutes: 60, transport: '请按当前位置选择交通方式',
    activities: [`前往${story.place}`, '沿途记录自己的发现'], highlights: [story.place],
    foodIdea: '可在附近寻找喜欢的餐馆。', caution: '请按现场情况安排行程。',
  }
}

async function followStory(story: CommunityStory) {
  if (following.value) return
  following.value = story.id
  let suggestion = fallbackSuggestion(story)
  try {
    const places = await Promise.race([
      searchScenicPlaces(story.city, story.place),
      new Promise<PlaceData[]>((resolve) => window.setTimeout(() => resolve([]), 2000)),
    ])
    const matched = places.find((place) => place.name.includes(story.place) || story.place.includes(place.name))
    if (matched) suggestion = { ...placeToSuggestion(matched, story.city), name: story.place, image: story.image, reason: story.excerpt }
  } catch { /* 查询不可用时仍可选取故事中的模拟景点 */ }
  try {
    if (!store.selectCommunityStop(suggestion, story.city)) throw new Error('选点失败')
    try {
      const result = await recordFollow(story.id)
      reactions.value = { ...reactions.value, [story.id]: result.reaction }
    } catch { showToast('已选为 NextStop，影响力统计暂时未更新') }
    showToast(`已将${story.place}选为 NextStop`)
    await router.push('/route')
  } catch {
    showToast('选点失败，请稍后重试')
  } finally {
    following.value = ''
  }
}
</script>

<template>
  <div class="page community-page">
    <header class="community-header"><router-link to="/story" class="back-button" aria-label="返回故事"><ArrowLeft :size="19" /></router-link><div><p class="eyebrow">STORY COMMUNITY</p><h1>故事社区</h1><p>跟着别人的故事，发现旅行的下一站。</p></div></header>
    <div class="community-feed">
      <article v-for="story in stories" :id="`community-${story.id}`" :key="story.id" class="post-card">
        <div class="post-author"><span class="avatar" :style="{ background: story.avatarColor }">{{ story.avatar }}</span><div><strong>{{ story.author }}</strong><span><MapPin :size="12" /> {{ story.city }} · {{ story.place }}</span></div><small v-if="story.ownerId === userId">我的发布</small></div>
        <img v-if="story.image" class="post-image" :src="story.image" :alt="story.place" />
        <div v-else class="post-image post-image-empty"><MapPin :size="29" />{{ story.city }} · {{ story.place }}</div>
        <div class="post-content"><h2>{{ story.title }}</h2><p>{{ story.body }}</p></div>
        <div class="post-actions"><button type="button" :class="{ liked: liked.includes(story.id) }" :aria-pressed="liked.includes(story.id)" @click="toggleLike(story.id)"><Heart :size="17" :fill="liked.includes(story.id) ? 'currentColor' : 'none'" /> {{ story.likes + (reactions[story.id]?.likes || 0) }}</button><button type="button" :aria-expanded="openComments.includes(story.id)" @click="toggleComments(story.id)"><MessageCircle :size="17" /> {{ story.comments.length + (reactions[story.id]?.comments.length || 0) }} 条评论</button></div>
        <div class="influence"><ArrowRight :size="14" /> 影响力 · {{ influence(story) }} 人看后选择了跟 ta 走</div>
        <div v-if="openComments.includes(story.id)" class="comments"><p v-for="(comment, index) in story.comments" :key="`seed-${index}`"><strong>旅行者{{ index + 1 }}</strong> {{ comment }}</p><p v-for="(comment, index) in reactions[story.id]?.comments || []" :key="`community-${index}`"><strong>{{ comment.author }}</strong> {{ comment.text }}</p><form @submit.prevent="addComment(story.id)"><input v-model="drafts[story.id]" maxlength="200" :aria-label="`评论${story.title}`" placeholder="说说你的想法…" /><button type="submit" :disabled="!drafts[story.id]?.trim()" aria-label="发送评论"><Send :size="16" /></button></form></div>
        <button v-if="story.ownerId !== userId" class="primary-button follow-button" type="button" :disabled="Boolean(following)" @click="followStory(story)">{{ following === story.id ? '正在选择 NextStop…' : '跟 ta 走 · 选为 NextStop' }} <ArrowRight :size="16" /></button>
      </article>
    </div>
  </div>
</template>

<style scoped>
.community-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 22px; }
.community-header h1 { margin: 3px 0 5px; font-size: 30px; }
.community-header p:last-child { margin: 0; color: var(--muted); font-size: 12px; }
.back-button { width: 36px; height: 36px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 11px; background: #fff; color: var(--green); box-shadow: var(--shadow); }
.community-feed { display: grid; gap: 18px; padding-bottom: 24px; }
.post-card { overflow: hidden; padding-bottom: 16px; border-radius: 22px; background: #fff; box-shadow: var(--shadow); scroll-margin-top: 15px; }
.post-author { display: flex; align-items: center; gap: 9px; padding: 13px 15px; }
.avatar { width: 38px; height: 38px; flex: 0 0 38px; display: grid; place-items: center; border-radius: 50%; font-size: 24px; }
.post-author div { display: flex; flex-direction: column; gap: 3px; }
.post-author strong { font-size: 12px; }
.post-author div span { display: flex; align-items: center; gap: 2px; color: var(--muted); font-size: 10px; }
.post-author small { margin-left: auto; color: var(--muted); font-size: 9px; }
.post-image { width: 100%; height: 230px; object-fit: cover; }
.post-image-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; background: var(--green-soft); color: var(--green); font-size: 13px; }
.post-content { padding: 14px 16px 4px; }
.post-content h2 { margin: 0 0 8px; font-size: 18px; }
.post-content p { margin: 0; color: #46564c; font-size: 12px; line-height: 1.8; }
.post-actions { display: flex; gap: 18px; padding: 12px 16px 2px; }
.post-actions button { display: flex; align-items: center; gap: 5px; padding: 0; border: 0; background: transparent; color: var(--muted); font-size: 11px; cursor: pointer; }
.post-actions button.liked { color: #d65b6b; }
.influence { display: flex; align-items: center; gap: 5px; margin: 9px 16px 0; color: var(--green); font-size: 11px; font-weight: 600; }
.comments { margin: 10px 16px 0; padding: 11px; border-radius: 12px; background: #f5f7f2; }
.comments p { margin: 0 0 7px; color: #46564c; font-size: 11px; line-height: 1.5; }
.comments strong { margin-right: 5px; color: var(--ink); }
.comments form { display: flex; gap: 6px; margin-top: 10px; }
.comments input { min-width: 0; flex: 1; padding: 9px; border: 1px solid var(--line); border-radius: 9px; background: #fff; font-size: 11px; }
.comments form button { width: 35px; display: grid; place-items: center; border: 0; border-radius: 9px; background: var(--green); color: #fff; cursor: pointer; }
.comments form button:disabled { opacity: .45; }
.follow-button { width: calc(100% - 32px); display: flex; align-items: center; justify-content: center; gap: 7px; margin: 14px 16px 0; }
</style>
