<script setup lang="ts">
import { computed } from 'vue'
import { Check, CloudOff, LoaderCircle, RotateCw } from 'lucide-vue-next'
import { useTripStore } from '../../stores/trip'
import { formatSavedTime } from '../../utils/files'
import { showToast } from '../../stores/ui'

const store = useTripStore()
const label = computed(() => {
  if (store.meta.saveStatus === 'saving') return '保存中'
  if (store.meta.saveStatus === 'error') return '保存失败'
  if (store.meta.saveStatus === 'saved') return `已保存 ${formatSavedTime(store.meta.lastSaved)}`
  return '本地保存'
})

async function retry() {
  if (store.meta.saveStatus !== 'error') return
  await store.flushSave()
  if (store.meta.saveStatus === 'error') showToast('仍然无法保存，请检查浏览器存储权限')
  else showToast('草稿已保存到本机')
}
</script>

<template>
  <button class="save-status" :class="`is-${store.meta.saveStatus}`" type="button" @click="retry">
    <LoaderCircle v-if="store.meta.saveStatus === 'saving'" :size="13" class="spin" />
    <CloudOff v-else-if="store.meta.saveStatus === 'error'" :size="13" />
    <Check v-else :size="13" />
    <span>{{ label }}</span>
    <RotateCw v-if="store.meta.saveStatus === 'error'" :size="12" />
  </button>
</template>

<style scoped>
.save-status {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 0;
  border-radius: 999px;
  padding: 6px 9px;
  background: #edf1e9;
  color: #5f6f65;
  font-size: 10px;
  white-space: nowrap;
}
.save-status.is-error { background: #fff0e9; color: #a34d32; }
.save-status.is-saving { color: #426855; }
.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
