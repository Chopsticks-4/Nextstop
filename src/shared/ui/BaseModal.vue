<script setup lang="ts">
import { X } from 'lucide-vue-next'

defineProps<{
  open: boolean
  title: string
  eyebrow?: string
}>()

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-overlay" @click.self="emit('close')">
        <section class="modal-sheet" role="dialog" aria-modal="true" :aria-label="title">
          <div class="sheet-handle"></div>
          <header class="sheet-header">
            <div>
              <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
              <h2>{{ title }}</h2>
            </div>
            <button class="icon-button" type="button" aria-label="关闭" @click="emit('close')">
              <X :size="20" />
            </button>
          </header>
          <div class="sheet-content">
            <slot />
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-top: 40px;
  background: rgb(19 35 28 / 42%);
  backdrop-filter: blur(4px);
}
.modal-sheet {
  width: min(100%, 480px);
  max-height: min(88dvh, 820px);
  overflow: auto;
  border-radius: 28px 28px 0 0;
  background: #fbfcf8;
  padding: 10px 20px calc(24px + env(safe-area-inset-bottom));
  box-shadow: 0 -20px 70px rgb(18 39 29 / 18%);
}
.sheet-handle { width: 42px; height: 4px; border-radius: 9px; background: #d8ded7; margin: 0 auto 14px; }
.sheet-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.sheet-header h2 { margin: 2px 0 0; font-size: 22px; letter-spacing: -0.5px; }
.sheet-content { padding-bottom: 4px; }
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-active .modal-sheet, .modal-leave-active .modal-sheet { transition: transform 0.24s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal-sheet, .modal-leave-to .modal-sheet { transform: translateY(30px); }
</style>
