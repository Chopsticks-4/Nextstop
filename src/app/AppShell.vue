<script setup lang="ts">
import { ArrowUpRight, WifiOff } from 'lucide-vue-next'
import BottomToolbar from './BottomToolbar.vue'
import ModuleHost from './ModuleHost.vue'
import SaveStatusIndicator from '../shared/ui/SaveStatusIndicator.vue'
import AppToast from '../shared/ui/AppToast.vue'
import AssistantBubble from './AssistantBubble.vue'
import { uiState } from '../stores/ui'
</script>

<template>
  <div class="app-stage">
    <div class="phone-shell">
      <header class="app-header">
        <router-link to="/home" class="brand" aria-label="NextStop 首页">
          <span class="brand-mark">N<ArrowUpRight :size="14" /></span>
          <span class="brand-name">NextStop</span>
          <span class="beta-tag">实时推荐</span>
        </router-link>
        <SaveStatusIndicator />
      </header>
      <div v-if="!uiState.isOnline" class="offline-banner">
        <WifiOff :size="14" /> 当前离线，本地记录和编辑仍可使用
      </div>
      <ModuleHost />
      <BottomToolbar />
      <AppToast />
      <AssistantBubble />
    </div>
  </div>
</template>
