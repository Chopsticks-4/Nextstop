<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getModule } from './module-registry'
import { useTripStore } from '../stores/trip'

const route = useRoute()
const router = useRouter()
const store = useTripStore()
const visibleModules = computed(() => store.state.toolbarModuleIds.map((id) => getModule(id)))

function navigate(path: string) {
  if (route.path !== path) void router.push(path)
}

function isActive(path: string) {
  return route.path === path
    || (path === '/story' && (route.path.startsWith('/story/') || route.path === '/community'))
    || (path === '/profile' && route.path === '/community-impact')
}
</script>

<template>
    <nav class="bottom-toolbar" aria-label="主要导航">
      <button
        v-for="module in visibleModules"
        :key="module.id"
        class="toolbar-item"
        :class="{ active: isActive(module.route) }"
        type="button"
        @click="navigate(module.route)"
      >
        <component :is="module.icon" :size="21" :stroke-width="isActive(module.route) ? 2.4 : 1.8" />
        <span>{{ module.title }}</span>
      </button>
    </nav>
</template>

<style scoped>
.bottom-toolbar {
  position: fixed;
  z-index: 40;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: min(100%, 480px);
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  padding: 8px 8px calc(8px + env(safe-area-inset-bottom));
  border-top: 1px solid rgb(36 66 50 / 8%);
  background: rgb(252 253 249 / 94%);
  backdrop-filter: blur(20px);
  box-shadow: 0 -10px 35px rgb(28 54 40 / 6%);
}
.toolbar-item {
  position: relative;
  min-height: 54px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 0;
  background: transparent;
  color: #8a948d;
  font-size: 10px;
  border-radius: 16px;
}
.toolbar-item.active { color: var(--green); font-weight: 700; }
.toolbar-item.active::before { content: ''; position: absolute; top: 1px; width: 18px; height: 3px; border-radius: 4px; background: var(--green); }
</style>
