<script setup lang="ts">
import { CheckCircle2 } from 'lucide-vue-next'
import { uiState } from '../../stores/ui'
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="uiState.toastVisible" class="toast" role="status">
        <CheckCircle2 :size="17" />
        {{ uiState.toastMessage }}
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast {
  position: fixed;
  z-index: 150;
  left: 50%;
  bottom: calc(96px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  width: max-content;
  max-width: min(88vw, 420px);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 14px;
  background: #203a2e;
  color: #fff;
  box-shadow: 0 10px 30px rgb(21 47 35 / 24%);
  font-size: 13px;
}
.toast-enter-active, .toast-leave-active { transition: all 0.2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 10px); }
</style>
