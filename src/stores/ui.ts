import { reactive } from 'vue'

interface UiState {
  moreOpen: boolean
  toastMessage: string
  toastVisible: boolean
  isOnline: boolean
}

export const uiState = reactive<UiState>({
  moreOpen: false,
  toastMessage: '',
  toastVisible: false,
  isOnline: navigator.onLine,
})

let toastTimer: number | undefined

export function showToast(message: string) {
  window.clearTimeout(toastTimer)
  uiState.toastMessage = message
  uiState.toastVisible = true
  toastTimer = window.setTimeout(() => {
    uiState.toastVisible = false
  }, 2400)
}

window.addEventListener('online', () => {
  uiState.isOnline = true
})
window.addEventListener('offline', () => {
  uiState.isOnline = false
})
