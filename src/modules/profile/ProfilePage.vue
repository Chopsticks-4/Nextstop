<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowDown, ArrowUp, Award, Check, ChevronRight, Clock3, Database, GripVertical, Heart, Images, Info, LockKeyhole, LogOut, Mic, Settings2, ShieldCheck, Trash2, UserRound } from 'lucide-vue-next'
import { toolbarChoices } from '../../app/module-registry'
import { useTripStore } from '../../stores/trip'
import { showToast } from '../../stores/ui'
import type { ModuleId } from '../../types'

const store = useTripStore()
const router = useRouter()
const pinnedNames = computed(() => store.state.toolbarModuleIds.map((id) => toolbarChoices.find((item) => item.id === id)?.title))

function toggleModule(moduleId: ModuleId) {
  const changed = store.toggleToolbarModule(moduleId)
  if (!changed) showToast('主栏需保留 3—5 个模块；可先移除一个再固定')
}

async function exitCurrent() {
  const saved = await store.saveAndExit()
  if (!saved) {
    const leave = window.confirm('本地保存失败。你可以取消并返回重试，或仍然退出当前编辑。是否仍然退出？')
    if (!leave) {
      store.resumeTrip()
      return
    }
  }
  await router.push('/home')
  showToast(saved ? '已保存到本机，可以从历史记录继续' : '已退出；未保存内容仍保留在当前页面内存中')
}

function clearAll() {
  if (!window.confirm('清除本机保存的旅行草稿、历史和设置？已发布的社区故事与互动不会删除。此操作无法撤销。')) return
  void store.resetAll().then(() => {
    showToast('已清除并创建新的空白旅行')
    void router.push('/home')
  })
}
</script>

<template>
  <div class="page profile-page">
    <header class="page-header">
      <div><p class="eyebrow">MY NEXTSTOP</p><h1>我的旅行空间</h1><p>旅途草稿保存在本机，发布的故事会出现在社区。</p></div>
      <span class="avatar"><UserRound :size="23" /></span>
    </header>

    <section class="local-profile-card">
      <div class="local-avatar">N</div>
      <div><strong>本地旅行者</strong><p>{{ store.state.trip.records.length }} 个时刻 · {{ store.state.historyTrips.length + (store.state.trip.status === 'idle' ? 0 : 1) }} 次旅行</p></div>
      <span><ShieldCheck :size="14" /> 仅本机</span>
    </section>

    <div class="section-heading"><h2>我的旅程</h2></div>
    <section class="settings-list card">
      <button class="setting-row link-row" type="button" @click="router.push('/gallery')"><span class="setting-icon"><Images :size="18" /></span><div><strong>旅行相册</strong><p>按每次旅行整理照片与生成的视频</p></div><ChevronRight :size="17" /></button>
      <button class="setting-row link-row" type="button" @click="router.push('/achievements')"><span class="setting-icon"><Award :size="18" /></span><div><strong>旅行成就</strong><p>查看徽章进度与成就海报</p></div><ChevronRight :size="17" /></button>
      <button class="setting-row link-row" type="button" @click="router.push('/history')"><span class="setting-icon"><Clock3 :size="18" /></span><div><strong>历史旅行</strong><p>查看每次旅行的足迹、记录和故事</p></div><ChevronRight :size="17" /></button>
      <button class="setting-row link-row" type="button" @click="router.push('/community-impact')"><span class="setting-icon"><Heart :size="18" /></span><div><strong>社区影响</strong><p>我的发布、收到和发出的点赞、评论与跟 ta 走</p></div><ChevronRight :size="17" /></button>
    </section>

    <div class="section-heading"><h2>底部工具栏</h2><span class="light-label">已固定 {{ pinnedNames.length }} / 5</span></div>
    <section class="settings-card card">
      <p class="setting-description">主栏按首页、路线、记录、故事、我的排列，也可保留 3—5 个常用入口。</p>
      <div class="module-choice-list">
        <div v-for="module in toolbarChoices" :key="module.id" class="module-choice">
          <GripVertical :size="15" />
          <span class="choice-module-icon"><component :is="module.icon" :size="17" /></span>
          <strong>{{ module.title }}</strong>
          <button class="pin-button" :class="{ pinned: store.state.toolbarModuleIds.includes(module.id) }" type="button" @click="toggleModule(module.id)"><Check v-if="store.state.toolbarModuleIds.includes(module.id)" :size="13" />{{ store.state.toolbarModuleIds.includes(module.id) ? '已固定' : '固定' }}</button>
        </div>
      </div>
      <div class="order-list">
        <div v-for="(moduleId, index) in store.state.toolbarModuleIds" :key="moduleId">
          <span>{{ index + 1 }}</span><strong>{{ toolbarChoices.find((item) => item.id === moduleId)?.title }}</strong>
          <button type="button" aria-label="上移" :disabled="index === 0" @click="store.moveToolbarModule(index, -1)"><ArrowUp :size="14" /></button>
          <button type="button" aria-label="下移" :disabled="index === store.state.toolbarModuleIds.length - 1" @click="store.moveToolbarModule(index, 1)"><ArrowDown :size="14" /></button>
        </div>
      </div>
    </section>

    <div class="section-heading"><h2>声音与隐私</h2></div>
    <section class="settings-list card">
      <div class="setting-row"><span class="setting-icon"><Mic :size="18" /></span><div><strong>本地原声播放</strong><p>只允许播放已选择的本地音频</p></div><button class="switch" :class="{ on: store.state.soundEnabled }" type="button" role="switch" :aria-checked="store.state.soundEnabled" @click="store.state.soundEnabled = !store.state.soundEnabled"><i></i></button></div>
      <div class="setting-row"><span class="setting-icon"><Database :size="18" /></span><div><strong>本地自动保存</strong><p>500ms 防抖写入 IndexedDB，不做云同步</p></div><span class="status-label">已开启</span></div>
      <div class="setting-row"><span class="setting-icon"><LockKeyhole :size="18" /></span><div><strong>媒体与位置</strong><p>故事生成会向豆包发送记录与最多 6 张照片；音频不上传，定位仍由你授权</p></div><span class="status-label">按需使用</span></div>
    </section>

    <div class="section-heading"><h2>关于与数据</h2></div>
    <section class="settings-list card">
      <button v-if="store.state.trip.status === 'active'" class="setting-row link-row" type="button" @click="exitCurrent"><span class="setting-icon"><LogOut :size="18" /></span><div><strong>保存并退出当前旅行</strong><p>保存到本机，稍后可从历史旅行继续</p></div><ChevronRight :size="17" /></button>
      <button class="setting-row link-row" type="button" @click="showToast('地点、路线和天气来自高德；故事优先由豆包生成，失败时使用本地记录')"><span class="setting-icon"><Info :size="18" /></span><div><strong>关于 NextStop</strong><p>高德地点与天气 · 豆包故事与本地降级</p></div><ChevronRight :size="17" /></button>
      <button class="setting-row link-row danger" type="button" @click="clearAll"><span class="setting-icon"><Trash2 :size="18" /></span><div><strong>清除本地旅行数据</strong><p>删除草稿、历史和设置；社区发布与互动保留</p></div><ChevronRight :size="17" /></button>
    </section>
    <p class="profile-footer"><Settings2 :size="12" /> NextStop Frontend MVP 0.1.0 · 不包含汇报制作功能</p>
  </div>
</template>

<style scoped>
.avatar { width: 47px; height: 47px; display: grid; place-items: center; border-radius: 17px; background: var(--green-soft); color: var(--green); }
.local-profile-card { display: flex; align-items: center; gap: 12px; padding: 17px; border-radius: 21px; background: #294d3b; color: #fff; }
.local-avatar { width: 46px; height: 46px; display: grid; place-items: center; border-radius: 15px; background: #dcecc8; color: #294d3b; font-size: 20px; font-weight: 700; }
.local-profile-card > div:nth-child(2) { flex: 1; }
.local-profile-card strong { font-size: 14px; }
.local-profile-card p { margin: 4px 0 0; color: #baccc0; font-size: 9px; }
.local-profile-card > span { display: flex; align-items: center; gap: 4px; color: #c8d6cc; font-size: 9px; }
.light-label { color: var(--muted); font-size: 9px; }
.settings-card { padding: 15px; }
.setting-description { margin-bottom: 12px; color: var(--muted); font-size: 10px; line-height: 1.6; }
.module-choice-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 7px; }
.module-choice { display: flex; align-items: center; gap: 6px; min-width: 0; padding: 8px; border: 1px solid var(--line); border-radius: 12px; }
.module-choice > svg { color: #b2bbb4; }
.choice-module-icon { display: grid; place-items: center; color: var(--green); }
.module-choice strong { flex: 1; font-size: 11px; }
.pin-button { min-width: 45px; min-height: 30px; display: flex; align-items: center; justify-content: center; gap: 2px; border: 0; border-radius: 8px; background: #f0f2ee; color: var(--muted); font-size: 8px; }
.pin-button.pinned { background: var(--green-soft); color: var(--green); }
.order-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 13px; padding-top: 12px; border-top: 1px solid var(--line); }
.order-list > div { display: flex; align-items: center; gap: 4px; padding: 4px 5px 4px 8px; border-radius: 9px; background: #f3f5f1; }
.order-list > div > span { color: var(--muted); font-size: 8px; }
.order-list strong { font-size: 9px; }
.order-list button { width: 26px; height: 26px; display: grid; place-items: center; border: 0; background: transparent; color: var(--green); }
.settings-list { overflow: hidden; padding: 0 15px; }
.setting-row { width: 100%; min-height: 71px; display: flex; align-items: center; gap: 11px; border: 0; border-bottom: 1px solid var(--line); background: transparent; color: var(--ink); text-align: left; }
.setting-row:last-child { border-bottom: 0; }
.setting-icon { width: 36px; height: 36px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 12px; background: var(--green-soft); color: var(--green); }
.setting-row > div { flex: 1; }
.setting-row strong { font-size: 12px; }
.setting-row p { margin: 4px 0 0; color: var(--muted); font-size: 8px; line-height: 1.5; }
.switch { position: relative; width: 42px; height: 24px; flex: 0 0 auto; border: 0; border-radius: 999px; background: #dce2dc; }
.switch i { position: absolute; left: 3px; top: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform 0.18s; box-shadow: 0 2px 4px rgb(0 0 0 / 12%); }
.switch.on { background: var(--green); }
.switch.on i { transform: translateX(18px); }
.status-label { color: var(--green); font-size: 9px; }
.link-row > svg { color: #a0aaa2; }
.danger .setting-icon { background: #f9eae4; color: #b26048; }
.danger strong { color: #9b513d; }
.profile-footer { display: flex; align-items: center; justify-content: center; gap: 5px; margin-top: 20px; color: var(--muted); font-size: 8px; }
</style>
