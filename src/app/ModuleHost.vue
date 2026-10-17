<script setup lang="ts">
import { nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const scrollPositions = new Map<string, number>()

watch(
  () => route.fullPath,
  (next, previous) => {
    if (previous) scrollPositions.set(previous, window.scrollY)
    void nextTick(() => window.scrollTo({ top: scrollPositions.get(next) ?? 0, behavior: 'instant' }))
  },
)
</script>

<template>
  <main class="module-host">
    <router-view v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <KeepAlive>
          <component :is="Component" :key="route.name" />
        </KeepAlive>
      </Transition>
    </router-view>
  </main>
</template>
