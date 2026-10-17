<script setup lang="ts">
import AppShell from './app/AppShell.vue'
import { useTripStore } from './stores/trip'

const store = useTripStore()
const { meta } = store
</script>

<template>
  <AppShell v-if="meta.hydrated && meta.storageLoaded" />
  <div v-else class="startup-screen" role="status" aria-live="polite">
    <span class="startup-mark">N</span>
    <strong>NextStop</strong>
    <template v-if="meta.hydrated">
      <p>本地旅行数据暂时无法读取，数据尚未被更改。</p>
      <button type="button" @click="store.hydrate()">重试加载</button>
    </template>
    <p v-else>正在载入你的旅行…</p>
  </div>
</template>

<style scoped>
.startup-screen { min-height: 100dvh; max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg); color: var(--ink); }
.startup-mark { width: 58px; height: 58px; display: grid; place-items: center; border-radius: 18px; background: var(--green); color: white; font-size: 30px; font-weight: 800; }
.startup-screen strong { margin-top: 16px; font-size: 22px; }
.startup-screen p { margin: 9px 0 0; color: var(--muted); font-size: 13px; }
.startup-screen button { margin-top: 18px; border: 0; border-radius: 999px; padding: 10px 24px; background: var(--green); color: white; }
</style>
