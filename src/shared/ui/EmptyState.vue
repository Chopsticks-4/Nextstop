<script setup lang="ts">
import { NotebookPen } from 'lucide-vue-next'

defineProps<{ title: string; description: string }>()
</script>

<template>
  <div class="empty-state">
    <div class="empty-icon"><NotebookPen :size="26" /></div>
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty-state { text-align: center; padding: 44px 24px; color: var(--muted); }
.empty-icon { width: 56px; height: 56px; display: grid; place-items: center; margin: 0 auto 14px; border-radius: 20px; background: var(--green-soft); color: var(--green); }
.empty-state h3 { margin: 0 0 8px; color: var(--ink); font-size: 18px; }
.empty-state p { margin: 0 auto 18px; max-width: 280px; font-size: 13px; line-height: 1.7; }
</style>
