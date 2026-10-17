<script setup lang="ts">
import { computed, onActivated, ref } from 'vue'
import { ArrowLeft, ArrowRight, BookOpenText, Footprints, Heart, MessageCircle, RefreshCw } from 'lucide-vue-next'
import { communityStories } from '../story/community-stories'
import { loadCommunityImpact, type CommunityActivity, type CommunityImpact } from '../story/community-service'

const impact = ref<CommunityImpact>({ posts: [], received: [], given: [] })
const loading = ref(false)
const error = ref('')
const receivedLikes = computed(() => impact.value.received.filter((item) => item.kind === 'like').length)
const receivedComments = computed(() => impact.value.received.filter((item) => item.kind === 'comment').length)
const receivedFollows = computed(() => impact.value.received.filter((item) => item.kind === 'follow').length)

async function refresh() {
  loading.value = true
  error.value = ''
  try { impact.value = await loadCommunityImpact() }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '社区影响暂时无法加载' }
  finally { loading.value = false }
}

onActivated(refresh)

function titleFor(item: CommunityActivity) {
  return item.storyTitle || communityStories.find((story) => story.id === item.storyId)?.title || '旅行故事'
}

function timeFor(value: string) {
  if (!value) return '较早'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '较早' : date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function activityText(item: CommunityActivity, direction: 'received' | 'given') {
  if (direction === 'received') return item.kind === 'like' ? '有旅行者赞了你的故事' : item.kind === 'comment' ? '有旅行者评论了你的故事' : '有旅行者跟着你的故事出发'
  const author = communityStories.find((story) => story.id === item.storyId)?.author || '一位旅行者'
  return item.kind === 'like' ? `你赞了${author}的故事` : item.kind === 'comment' ? `你评论了${author}的故事` : `你跟${author}走，选了故事中的地点`
}
</script>

<template>
  <div class="page impact-page">
    <header class="impact-header"><router-link to="/profile" class="back-button" aria-label="返回我的"><ArrowLeft :size="19" /></router-link><div><p class="eyebrow">COMMUNITY IMPACT</p><h1>社区影响</h1><p>看看故事引发了哪些新的旅程。</p></div><button class="refresh-button" type="button" :disabled="loading" aria-label="刷新社区影响" @click="refresh"><RefreshCw :size="17" /></button></header>

    <p v-if="error" class="error-message" role="alert">{{ error }} <button type="button" @click="refresh">重试</button></p>
    <div class="impact-stats"><div><strong>{{ impact.posts.length }}</strong><span>我的发布</span></div><div><strong>{{ receivedLikes }}</strong><span>收到点赞</span></div><div><strong>{{ receivedComments }}</strong><span>收到评论</span></div><div><strong>{{ receivedFollows }}</strong><span>跟我走</span></div></div>

    <section class="impact-section" aria-labelledby="published-title"><div class="section-title"><h2 id="published-title">我发布的故事</h2><span>{{ impact.posts.length }} 篇</span></div>
      <div v-if="impact.posts.length" class="post-list"><router-link v-for="post in impact.posts" :key="post.id" class="post-card" :to="{ path: '/community', query: { story: post.id } }"><img v-if="post.image" :src="post.image" :alt="post.place" /><span v-else class="post-placeholder"><BookOpenText :size="22" /></span><span class="post-copy"><small>{{ post.city }} · {{ post.place }}</small><strong>{{ post.title }}</strong><span><Heart :size="12" /> {{ post.likes }} <MessageCircle :size="12" /> {{ post.comments }} <Footprints :size="12" /> {{ post.influence }} 人跟我走</span></span><ArrowRight :size="16" /></router-link></div>
      <div v-else class="empty-card"><BookOpenText :size="23" /><strong>还没有发布故事</strong><p>在故事的“导出”页点击“发布到社区”，这里就会出现你的帖子。</p></div>
    </section>

    <section class="impact-section" aria-labelledby="received-title"><div class="section-title"><h2 id="received-title">别人给我的互动</h2><span>{{ impact.received.length }} 条</span></div>
      <div v-if="impact.received.length" class="activity-list"><router-link v-for="(item, index) in impact.received" :key="`received-${index}`" class="activity-row" :to="{ path: '/community', query: { story: item.storyId } }"><span class="activity-icon"><Heart v-if="item.kind === 'like'" :size="17" /><MessageCircle v-else-if="item.kind === 'comment'" :size="17" /><Footprints v-else :size="17" /></span><span class="activity-copy"><strong>{{ activityText(item, 'received') }}</strong><small>{{ titleFor(item) }} · {{ timeFor(item.at) }}</small><em v-if="item.text">“{{ item.text }}”</em></span><ArrowRight :size="15" /></router-link></div>
      <p v-else class="empty-line">还没有收到互动。</p>
    </section>

    <section class="impact-section" aria-labelledby="given-title"><div class="section-title"><h2 id="given-title">我给别人的互动</h2><span>{{ impact.given.length }} 条</span></div>
      <div v-if="impact.given.length" class="activity-list"><router-link v-for="(item, index) in impact.given" :key="`given-${index}`" class="activity-row" :to="{ path: '/community', query: { story: item.storyId } }"><span class="activity-icon"><Heart v-if="item.kind === 'like'" :size="17" /><MessageCircle v-else-if="item.kind === 'comment'" :size="17" /><Footprints v-else :size="17" /></span><span class="activity-copy"><strong>{{ activityText(item, 'given') }}</strong><small>{{ titleFor(item) }} · {{ timeFor(item.at) }}</small><em v-if="item.text">“{{ item.text }}”</em></span><ArrowRight :size="15" /></router-link></div>
      <p v-else class="empty-line">你还没有点赞、评论或跟着别人的故事出发。</p>
    </section>
  </div>
</template>

<style scoped>
.impact-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 19px; }
.impact-header > div { flex: 1; }
.impact-header h1 { margin: 3px 0 5px; font-size: 28px; }
.impact-header p:last-child { margin: 0; color: var(--muted); font-size: 11px; }
.back-button, .refresh-button { width: 36px; height: 36px; flex: 0 0 auto; display: grid; place-items: center; border: 0; border-radius: 11px; background: #fff; color: var(--green); box-shadow: var(--shadow); }
.error-message { padding: 10px; border-radius: 10px; background: #fff0e9; color: #945b45; font-size: 11px; }
.error-message button { border: 0; background: transparent; color: inherit; text-decoration: underline; }
.impact-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-bottom: 25px; }
.impact-stats div { display: flex; flex-direction: column; align-items: center; padding: 14px 3px; border-radius: 15px; background: #fff; box-shadow: var(--shadow); }
.impact-stats strong { color: var(--green); font-size: 22px; }
.impact-stats span { margin-top: 3px; color: var(--muted); font-size: 9px; }
.impact-section { margin-top: 25px; }
.section-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.section-title h2 { margin: 0; font-size: 18px; }
.section-title span { color: var(--muted); font-size: 10px; }
.post-list, .activity-list { display: grid; gap: 10px; }
.post-card { display: flex; align-items: center; gap: 10px; padding: 9px; border-radius: 16px; background: #fff; box-shadow: var(--shadow); }
.post-card > img, .post-placeholder { width: 69px; height: 77px; flex: 0 0 69px; border-radius: 10px; object-fit: cover; }
.post-placeholder { display: grid; place-items: center; background: var(--green-soft); color: var(--green); }
.post-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 5px; }
.post-copy small { color: var(--green); font-size: 9px; }
.post-copy strong { overflow: hidden; color: var(--ink); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.post-copy > span { display: flex; align-items: center; gap: 3px; color: var(--muted); font-size: 9px; }
.post-card > svg, .activity-row > svg { flex: 0 0 auto; color: var(--muted); }
.empty-card { display: flex; flex-direction: column; align-items: center; padding: 23px; border-radius: 16px; background: #fff; color: var(--green); text-align: center; }
.empty-card strong { margin-top: 6px; color: var(--ink); font-size: 12px; }
.empty-card p, .empty-line { margin: 6px 0 0; color: var(--muted); font-size: 10px; line-height: 1.6; }
.activity-row { display: flex; align-items: center; gap: 9px; padding: 12px; border-radius: 14px; background: #fff; box-shadow: var(--shadow); }
.activity-icon { width: 31px; height: 31px; flex: 0 0 31px; display: grid; place-items: center; border-radius: 10px; background: var(--green-soft); color: var(--green); }
.activity-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4px; }
.activity-copy strong { color: var(--ink); font-size: 11px; }
.activity-copy small { overflow: hidden; color: var(--muted); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.activity-copy em { color: #53645a; font-size: 10px; font-style: normal; line-height: 1.4; }
</style>
