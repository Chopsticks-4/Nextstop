<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronRight, ImagePlus, Mic, Send, X } from 'lucide-vue-next'
import { imageFileToDataUrl } from '../utils/files'
import { useTripStore } from '../stores/trip'

type Message = { role: 'user' | 'assistant'; text: string; image?: string }
type SpeechResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> }
type SpeechRecognizer = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: SpeechResult) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void }
type SpeechConstructor = new () => SpeechRecognizer

const route = useRoute()
const tripStore = useTripStore()
const open = ref(false)
const collapsed = ref(false)
const sending = ref(false)
const listening = ref(false)
const draft = ref('')
const selectedImage = ref('')
const error = ref('')
const messages = ref<Message[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const scroller = ref<HTMLElement | null>(null)
const position = ref({ x: 0, y: 0 })
const dragging = ref(false)
const moved = ref(false)
let pointerStart = { x: 0, y: 0, originX: 0, originY: 0 }
let activePointerId: number | null = null
let recognizer: SpeechRecognizer | null = null

const pageNames: Record<string, string> = {
  '/home': '首页', '/route': '路线', '/records': '记录', '/inspiration': '灵感',
  '/story': '故事', '/story/edit': '我的故事', '/community': '故事社区', '/community-impact': '社区影响', '/export': '导出', '/achievements': '成就', '/history': '历史',
  '/gallery': '相册', '/profile': '我的',
}
const bubbleWidth = 78
const bubbleStyle = computed(() => ({ left: `${position.value.x}px`, top: `${position.value.y}px` }))
const canSend = computed(() => Boolean(draft.value.trim() || selectedImage.value))

function bounds() {
  const width = Math.min(window.innerWidth, 480)
  return { width, height: window.innerHeight }
}

function clampPosition(x: number, y: number) {
  const { width, height } = bounds()
  position.value = {
    x: Math.max(6, Math.min(x, width - bubbleWidth - 6)),
    y: Math.max(6, Math.min(y, height - 62)),
  }
}

function savePosition() {
  try { localStorage.setItem('nextstop-assistant-position', JSON.stringify(position.value)) } catch { /* storage optional */ }
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 || activePointerId !== null) return
  event.preventDefault()
  activePointerId = event.pointerId
  dragging.value = true
  moved.value = false
  pointerStart = { x: event.clientX, y: event.clientY, originX: position.value.x, originY: position.value.y }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value || event.pointerId !== activePointerId) return
  const dx = event.clientX - pointerStart.x
  const dy = event.clientY - pointerStart.y
  if (Math.abs(dx) + Math.abs(dy) > 6) moved.value = true
  if (moved.value) clampPosition(pointerStart.originX + dx, pointerStart.originY + dy)
}

function endPointer() {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
  activePointerId = null
  dragging.value = false
}

function onPointerUp(event: PointerEvent) {
  if (!dragging.value || event.pointerId !== activePointerId) return
  endPointer()
  if (moved.value) savePosition()
  else open.value = true
}

function onPointerCancel(event: PointerEvent) {
  if (event.pointerId === activePointerId) endPointer()
}

function toggleCollapse() {
  collapsed.value = !collapsed.value
  if (collapsed.value) open.value = false
  else clampPosition(position.value.x, position.value.y)
  try { localStorage.setItem('nextstop-assistant-collapsed', String(collapsed.value)) } catch { /* storage optional */ }
}

async function chooseImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { error.value = '请选择 JPG、PNG 或 WebP 图片'; return }
  try {
    const image = await imageFileToDataUrl(file)
    if (image.length > 6_000_000) throw new Error('图片过大，请换一张图片')
    selectedImage.value = image
    error.value = ''
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '图片读取失败' }
}

function startVoice() {
  if (listening.value) { recognizer?.stop(); return }
  const browser = window as Window & { SpeechRecognition?: SpeechConstructor; webkitSpeechRecognition?: SpeechConstructor }
  const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition
  if (!Recognition) { error.value = '当前浏览器不支持语音输入，请使用文字提问'; return }
  recognizer = new Recognition()
  recognizer.lang = 'zh-CN'
  recognizer.continuous = false
  recognizer.interimResults = false
  recognizer.onresult = (event) => {
    const spoken = Array.from(event.results).map((result) => result[0]?.transcript || '').join('')
    draft.value = [draft.value.trim(), spoken].filter(Boolean).join(' ')
  }
  recognizer.onerror = () => { listening.value = false; error.value = '语音识别失败，请重试或使用文字输入' }
  recognizer.onend = () => { listening.value = false }
  try { recognizer.start(); listening.value = true; error.value = '' }
  catch { error.value = '无法启动语音输入，请检查麦克风权限' }
}

async function send() {
  if (!canSend.value || sending.value) return
  const question = draft.value.trim()
  const image = selectedImage.value
  const history = messages.value.slice(-6).map(({ role, text }) => ({ role, text }))
  messages.value.push({ role: 'user', text: question || '请帮我看看这张图片', image })
  draft.value = ''
  selectedImage.value = ''
  sending.value = true
  error.value = ''
  await nextTick()
  scroller.value?.scrollTo({ top: scroller.value.scrollHeight })
  try {
    const trip = tripStore.state.trip
    const response = await fetch('/api/doubao/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, image, history, context: {
        page: pageNames[route.path] || '当前页面', city: trip.city, status: trip.status,
        currentStop: trip.routeStops.find((stop) => stop.status === 'current')?.name || '',
      } }),
    })
    const data = await response.json() as { answer?: string; error?: string }
    if (!response.ok || !data.answer) throw new Error(data.error || '助手暂时没有回答，请稍后重试')
    messages.value.push({ role: 'assistant', text: data.answer })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '网络连接失败，请稍后重试'
    messages.value.pop()
    draft.value = question
    selectedImage.value = image
  } finally {
    sending.value = false
    await nextTick()
    scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' })
  }
}

function askSample(question: string) { draft.value = question; void send() }

onMounted(() => {
  try {
    collapsed.value = localStorage.getItem('nextstop-assistant-collapsed') === 'true'
    const saved = JSON.parse(localStorage.getItem('nextstop-assistant-position') || 'null') as { x?: number; y?: number } | null
    if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') clampPosition(saved.x, saved.y)
    else clampPosition(bounds().width - bubbleWidth - 12, bounds().height - 160)
  } catch { clampPosition(bounds().width - bubbleWidth - 12, bounds().height - 160) }
  window.addEventListener('resize', keepInBounds)
})
function keepInBounds() { clampPosition(position.value.x, position.value.y) }
onBeforeUnmount(() => { window.removeEventListener('resize', keepInBounds); endPointer(); recognizer?.stop() })
</script>

<template>
  <div class="assistant-layer">
    <div v-if="collapsed" class="assistant-edge-slot" :style="{ top: `${position.y}px` }"><button class="assistant-edge-tab" type="button" aria-label="展开小海豚智能助手" title="展开小海豚智能助手" @click="toggleCollapse"><img src="/assets/dolphin-assistant.png" alt="" /></button></div>
    <div v-if="!open && !collapsed" class="assistant-bubble" :class="{ dragging }" :style="bubbleStyle">
      <button class="bubble-main" type="button" aria-label="打开小海豚智能助手，按住可拖动" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerCancel">
        <img src="/assets/dolphin-assistant.png" alt="" draggable="false" />
      </button>
      <button class="bubble-collapse" type="button" aria-label="收起智能助手" @click="toggleCollapse"><ChevronRight :size="17" /></button>
    </div>

    <section v-if="open" class="assistant-panel" role="dialog" aria-label="小海豚智能助手">
      <header class="assistant-header">
        <img src="/assets/dolphin-assistant.png" alt="" />
        <div><strong>小海豚智能助手</strong><span>页面使用 · 旅途答疑</span></div>
        <button type="button" aria-label="关闭助手" @click="open = false"><X :size="19" /></button>
      </header>
      <div ref="scroller" class="assistant-messages" aria-live="polite">
        <div class="assistant-message assistant-reply">你好！我可以教你使用 NextStop，也能帮你解决旅途中的问题。可以打字、说话或发图片给我。</div>
        <template v-if="!messages.length">
          <button type="button" class="sample-question" @click="askSample('这个页面怎么使用？')">这个页面怎么使用？</button>
          <button type="button" class="sample-question" @click="askSample('怎么记录我的旅途？')">怎么记录我的旅途？</button>
        </template>
        <div v-for="(message, index) in messages" :key="index" class="assistant-message" :class="message.role === 'user' ? 'assistant-user' : 'assistant-reply'">
          <img v-if="message.image" :src="message.image" alt="用户上传的图片" />
          <span>{{ message.text }}</span>
        </div>
        <div v-if="sending" class="assistant-message assistant-reply">小海豚正在思考…</div>
      </div>
      <p v-if="error" class="assistant-error" role="alert">{{ error }}</p>
      <div v-if="selectedImage" class="assistant-preview"><img :src="selectedImage" alt="待发送图片" /><button type="button" aria-label="移除图片" @click="selectedImage = ''"><X :size="14" /></button></div>
      <form class="assistant-compose" @submit.prevent="send">
        <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="chooseImage" />
        <button type="button" title="添加图片" aria-label="添加图片" @click="fileInput?.click()"><ImagePlus :size="20" /></button>
        <button type="button" :class="{ listening }" :title="listening ? '停止录音' : '语音输入'" :aria-label="listening ? '停止录音' : '语音输入'" @click="startVoice"><Mic :size="20" /></button>
        <input v-model="draft" aria-label="向小海豚提问" placeholder="问问怎么使用，或旅途中的事…" maxlength="2000" />
        <button class="assistant-send" type="submit" aria-label="发送问题" :disabled="!canSend || sending"><Send :size="18" /></button>
      </form>
    </section>
  </div>
</template>

<style scoped>
.assistant-layer { position: fixed; inset: 0; z-index: 60; width: min(100%, 480px); margin: 0 auto; pointer-events: none; }
.assistant-edge-slot { position: absolute; right: 0; width: 26px; height: 56px; overflow: hidden; pointer-events: auto; }
.assistant-edge-tab { position: absolute; left: 0; width: 56px; height: 56px; display: grid; place-items: center; padding: 2px; border: 1px solid #d5e7f5; border-radius: 50%; background: #fff; box-shadow: 0 8px 24px #125b922e; }
.assistant-edge-tab img { width: 51px; height: 51px; max-width: none; object-fit: contain; }
.assistant-bubble { position: absolute; display: flex; align-items: center; height: 56px; border: 1px solid #d5e7f5; border-radius: 30px; background: #fff; box-shadow: 0 8px 24px #125b922e; pointer-events: auto; touch-action: none; user-select: none; }
.assistant-bubble.dragging { box-shadow: 0 12px 28px #125b9247; }
.bubble-main { display: flex; align-items: center; justify-content: center; width: 56px; height: 54px; padding: 2px; border: 0; background: transparent; touch-action: none; }
.bubble-main img { width: 51px; height: 51px; object-fit: contain; pointer-events: none; }
.bubble-collapse { width: 20px; height: 36px; display: grid; place-items: center; padding: 0; border: 0; border-left: 1px solid #e5eef5; border-radius: 0 25px 25px 0; background: transparent; color: #3176a5; }
.assistant-panel { position: absolute; left: 10px; right: 10px; bottom: calc(82px + env(safe-area-inset-bottom)); height: min(570px, calc(100dvh - 110px)); display: flex; flex-direction: column; overflow: hidden; border: 1px solid #dbe8ef; border-radius: 22px; background: #fff; box-shadow: 0 18px 55px #18394d3d; pointer-events: auto; }
.assistant-header { display: flex; align-items: center; gap: 9px; min-height: 65px; padding: 8px 14px; border-bottom: 1px solid #eaf0f3; background: #f5fbff; }
.assistant-header img { width: 45px; height: 45px; }
.assistant-header div { flex: 1; display: grid; gap: 2px; }
.assistant-header strong { color: #125d91; font-size: 14px; }
.assistant-header span { color: #81929c; font-size: 10px; }
.assistant-header button, .assistant-compose button, .assistant-preview button { display: grid; place-items: center; flex: 0 0 auto; width: 34px; height: 34px; border: 0; border-radius: 10px; background: transparent; color: #577489; }
.assistant-messages { flex: 1; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; overflow-y: auto; padding: 16px 13px; background: #fbfcfd; }
.assistant-message { max-width: 88%; padding: 10px 12px; border-radius: 14px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
.assistant-message img { max-height: 130px; margin-bottom: 6px; border-radius: 9px; }
.assistant-reply { background: #eaf4fa; color: #24475f; border-bottom-left-radius: 4px; }
.assistant-user { align-self: flex-end; background: #086ba9; color: #fff; border-bottom-right-radius: 4px; }
.sample-question { min-height: 33px; padding: 6px 10px; border: 1px solid #bcddec; border-radius: 18px; background: #fff; color: #22668d; font-size: 12px; }
.assistant-error { margin: 0; padding: 8px 14px; background: #fff5ed; color: #a64a29; font-size: 11px; }
.assistant-preview { position: relative; align-self: flex-start; margin: 6px 12px 0; }
.assistant-preview img { width: 56px; height: 56px; object-fit: cover; border-radius: 8px; }
.assistant-preview button { position: absolute; top: -7px; right: -8px; width: 20px; height: 20px; background: #263b46; color: #fff; }
.assistant-compose { display: flex; align-items: center; gap: 2px; min-height: 58px; padding: 8px; border-top: 1px solid #eaf0f3; }
.assistant-compose input:not([type=file]) { width: 0; flex: 1; min-height: 38px; padding: 0 6px; border: 0; outline: 0; color: #253e4e; font-size: 12px; }
.assistant-compose button.listening { background: #fff1ec; color: #e05236; }
.assistant-compose .assistant-send { background: #086ba9; color: #fff; }
.assistant-compose .assistant-send:disabled { opacity: .4; }
@media (max-width: 370px) { .assistant-panel { left: 5px; right: 5px; } .assistant-compose { gap: 0; padding: 6px; } }
</style>
