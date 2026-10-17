import { createApp } from 'vue'
import App from './App.vue'
import { router } from './app/router'
import { useTripStore } from './stores/trip'
import { showToast } from './stores/ui'
import './styles/main.css'

const app = createApp(App)
app.config.errorHandler = (error) => {
  console.error(error)
  showToast(`操作失败：${error instanceof Error ? error.message : '请重试'}`)
}
app.use(router).mount('#app')

void useTripStore().hydrate()
