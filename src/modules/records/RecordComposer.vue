<script setup lang="ts">
import { nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { Camera, FileAudio, Image, MapPin, Mic, NotebookPen, Square, Trash2 } from 'lucide-vue-next'
import BaseModal from '../../shared/ui/BaseModal.vue'
import { getCurrentLocation } from '../../services/browser-location'
import { reverseGeocode, searchPlaceSuggestions } from '../../services/amap'
import type { PlaceSuggestion } from '../../services/amap'
import { createSpeechTranscriber, isSpeechRecognitionSupported } from '../../services/speech-recognition'
import { imageFileToDataUrl, readFileAsDataUrl } from '../../utils/files'
import { showToast } from '../../stores/ui'
import type { RecordDraft, RecordType } from '../../types'

const props = defineProps<{ open: boolean; initialType: RecordType; city?: string }>()
const emit = defineEmits<{ close: []; save: [draft: RecordDraft] }>()

const draft = reactive<RecordDraft>({ type: 'text', text: '', location: '', mood: '' })
const busy = ref(false)
const locating = ref(false)
const locationMessage = ref('')
const placeSuggestions = ref<PlaceSuggestion[]>([])
const suggestionStatus = ref<'idle' | 'loading' | 'empty' | 'error'>('idle')
const suggestionsOpen = ref(false)
let suggestionTimer: ReturnType<typeof setTimeout> | undefined
let suggestionEpoch = 0
let locationSource: 'current' | 'suggestion' | null = null
const recording = ref(false)
const cameraOpen = ref(false)
const cameraBusy = ref(false)
const cameraVideo = ref<HTMLVideoElement | null>(null)
const recognizing = ref(false)
const stoppingRecognition = ref(false)
const interimText = ref('')
const recognitionMessage = ref('')
const transcribeRecording = ref(true)
const recognitionSupported = isSpeechRecognitionSupported()
const selectedMoods = ref<string[]>([])
const customMood = ref('')
let mediaRecorder: MediaRecorder | null = null
let mediaStream: MediaStream | null = null
let cameraStream: MediaStream | null = null
let chunks: Blob[] = []
let captureEpoch = 0
let locationEpoch = 0
const transcriber = createSpeechTranscriber({
  onFinal(text) {
    const current = draft.text.trimEnd()
    draft.text = `${current}${current ? '\n' : ''}${text}`.slice(0, 500)
  },
  onInterim(text) {
    interimText.value = text
  },
  onError(message) {
    recognitionMessage.value = message
    recognizing.value = false
    stoppingRecognition.value = false
  },
  onEnd() {
    if (recording.value && !stoppingRecognition.value && !recognitionMessage.value) {
      recognitionMessage.value = '语音识别已结束，录音仍在继续；可在停止录音后手动补充文字'
    }
    recognizing.value = false
    stoppingRecognition.value = false
  },
})
const otherMood = '其它'
const moods = ['松弛', '开心', '治愈', '惊喜', '有点累', otherMood]

watch(
  () => props.open,
  (open) => {
    if (!open) {
      cancelCapture()
      return
    }
    Object.assign(draft, { type: props.initialType, text: '', image: undefined, images: [], audio: undefined, audioName: undefined, location: '', coordinate: undefined, mood: '' })
    locationMessage.value = ''
    locationSource = null
    clearSuggestions()
    recognitionMessage.value = ''
    interimText.value = ''
    transcribeRecording.value = true
    selectedMoods.value = []
    customMood.value = ''
  },
)

onBeforeUnmount(cancelCapture)

function cancelCapture() {
  captureEpoch += 1
  locationEpoch += 1
  clearSuggestions()
  locating.value = false
  transcriber.abort()
  recognizing.value = false
  stoppingRecognition.value = false
  interimText.value = ''
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.onstop = null
    mediaRecorder.ondataavailable = null
    mediaRecorder.stop()
  }
  mediaStream?.getTracks().forEach((track) => track.stop())
  mediaStream = null
  mediaRecorder = null
  recording.value = false
  busy.value = false
  stopCamera()
}

function stopCamera() {
  cameraStream?.getTracks().forEach((track) => track.stop())
  cameraStream = null
  if (cameraVideo.value) cameraVideo.value.srcObject = null
  cameraOpen.value = false
  cameraBusy.value = false
}

async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('此浏览器不支持调用摄像头，可以继续从相册选择')
    return
  }
  stopCamera()
  cameraBusy.value = true
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    })
    cameraOpen.value = true
    await nextTick()
    if (!cameraVideo.value || !cameraStream) return
    cameraVideo.value.srcObject = cameraStream
    await cameraVideo.value.play()
  } catch {
    stopCamera()
    showToast('没有获得摄像头权限，可以继续从相册选择')
  } finally {
    cameraBusy.value = false
  }
}

function takePhoto() {
  const video = cameraVideo.value
  if (!video?.videoWidth || !video.videoHeight) {
    showToast('摄像头还在准备中，请稍后再拍')
    return
  }
  const maxSide = 1400
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  const context = canvas.getContext('2d')
  if (!context) {
    showToast('拍照失败，请重试')
    return
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  const image = canvas.toDataURL('image/jpeg', 0.82)
  draft.images = [...(draft.images ?? []), image]
  draft.image = draft.images[0]
  draft.type = 'image'
  showToast(`已拍摄第 ${draft.images.length} 张照片`)
}

function clearSuggestions() {
  suggestionEpoch += 1
  if (suggestionTimer) clearTimeout(suggestionTimer)
  suggestionTimer = undefined
  placeSuggestions.value = []
  suggestionsOpen.value = false
  suggestionStatus.value = 'idle'
}

function onLocationInput() {
  locationMessage.value = ''
  if (locationSource === 'suggestion') {
    draft.coordinate = undefined
    locationSource = null
  }
  clearSuggestions()
  const keyword = draft.location.trim()
  if (keyword.length < 2) return
  const epoch = suggestionEpoch
  suggestionsOpen.value = true
  suggestionStatus.value = 'loading'
  suggestionTimer = setTimeout(async () => {
    try {
      const results = await searchPlaceSuggestions(keyword, props.city || '')
      if (epoch !== suggestionEpoch || !props.open || draft.location.trim() !== keyword) return
      placeSuggestions.value = results
      suggestionStatus.value = results.length ? 'idle' : 'empty'
    } catch {
      if (epoch !== suggestionEpoch || !props.open) return
      suggestionStatus.value = 'error'
    }
  }, 300)
}

function selectPlace(suggestion: PlaceSuggestion) {
  clearSuggestions()
  locationEpoch += 1
  locating.value = false
  draft.location = suggestion.name
  draft.coordinate = suggestion.coordinate
  locationSource = 'suggestion'
  locationMessage.value = '已选择地点；坐标会随记录显示在足迹中。'
}

async function markCurrentLocation() {
  clearSuggestions()
  const epoch = ++locationEpoch
  const originalLocation = draft.location
  locating.value = true
  locationMessage.value = ''
  try {
    const coordinate = await getCurrentLocation()
    if (epoch !== locationEpoch || !props.open) return
    draft.coordinate = coordinate
    locationSource = 'current'
    locationMessage.value = '已获取坐标，正在查询地点名称…'
    try {
      const name = await reverseGeocode(coordinate)
      if (epoch !== locationEpoch || !props.open) return
      if (draft.location === originalLocation) draft.location = name
      locationMessage.value = draft.location === name ? '已自动填写地点名称，可手动修改' : '已获取地点名称，保留了你手动填写的内容'
    } catch (error) {
      if (epoch !== locationEpoch || !props.open) return
      locationMessage.value = `坐标已标记，但地点名称查询失败：${error instanceof Error ? error.message : '请手动填写'}`
    }
  } catch (error) {
    if (epoch !== locationEpoch || !props.open) return
    locationMessage.value = error instanceof Error ? error.message : '定位失败，请手动填写地点'
  } finally {
    if (epoch === locationEpoch) locating.value = false
  }
}

function toggleRecognition() {
  if (recognizing.value) {
    if (stoppingRecognition.value) return
    stoppingRecognition.value = true
    transcriber.stop()
    return
  }
  recognitionMessage.value = ''
  recognizing.value = transcriber.start()
}

function setType(type: RecordType) {
  if (type !== 'image') stopCamera()
  draft.type = type
}

async function selectImage(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (!files.length) return
  busy.value = true
  try {
    const images = await Promise.all(files.map((file) => imageFileToDataUrl(file)))
    draft.images = [...(draft.images ?? []), ...images]
    draft.image = draft.images[0]
    draft.type = 'image'
  } catch {
    showToast('部分图片读取失败，请重新选择')
  } finally {
    busy.value = false
    input.value = ''
  }
}

function removeImage(index: number) {
  draft.images?.splice(index, 1)
  draft.image = draft.images?.[0]
}

async function selectAudio(event: Event) {
  if (recording.value || busy.value) return
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > 15 * 1024 * 1024) {
    showToast('当前本地样例仅支持 15MB 以内的音频')
    return
  }
  busy.value = true
  try {
    draft.audio = await readFileAsDataUrl(file)
    draft.audioName = file.name
    draft.type = 'audio'
  } catch {
    showToast('音频读取失败，请重试')
  } finally {
    busy.value = false
  }
}

async function toggleRecording() {
  if (recording.value) {
    mediaRecorder?.stop()
    recording.value = false
    busy.value = true
    if (recognizing.value) {
      stoppingRecognition.value = true
      transcriber.stop()
    }
    return
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    showToast('此浏览器不支持录音，可以选择本地音频')
    return
  }
  busy.value = true
  const epoch = ++captureEpoch
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    if (epoch !== captureEpoch || !props.open) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }
    mediaStream = stream
    chunks = []
    const recorder = new MediaRecorder(stream)
    mediaRecorder = recorder
    recorder.ondataavailable = (event) => chunks.push(event.data)
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
      try {
        const audio = await readFileAsDataUrl(new File([blob], `旅行原声-${Date.now()}.webm`, { type: blob.type }))
        if (epoch === captureEpoch && props.open) {
          draft.audio = audio
          draft.audioName = '我的旅行原声'
          draft.type = 'audio'
        }
      } catch {
        if (epoch === captureEpoch) showToast('录音保存失败，请重试')
      } finally {
        stream.getTracks().forEach((track) => track.stop())
        if (epoch === captureEpoch) {
          mediaStream = null
          busy.value = false
        }
      }
    }
    recorder.start()
    recording.value = true
    busy.value = false
    if (transcribeRecording.value && recognitionSupported && !recognizing.value) toggleRecognition()
  } catch {
    if (epoch !== captureEpoch) return
    mediaStream?.getTracks().forEach((track) => track.stop())
    mediaStream = null
    busy.value = false
    showToast('没有获得麦克风权限，可以选择本地音频')
  }
}

function toggleMood(mood: string) {
  const index = selectedMoods.value.indexOf(mood)
  if (index >= 0) {
    selectedMoods.value.splice(index, 1)
    if (mood === otherMood) customMood.value = ''
  } else {
    selectedMoods.value.push(mood)
  }
}

function save() {
  if (busy.value || locating.value || recording.value || recognizing.value) return
  if (selectedMoods.value.includes(otherMood) && !customMood.value.trim()) {
    showToast('请填写其它心情，或取消“其它”选项')
    return
  }
  const mood = selectedMoods.value
    .map((item) => item === otherMood ? customMood.value.trim() : item)
    .join('、')
  emit('save', { ...draft, text: draft.text.trim(), mood })
  emit('close')
}
</script>

<template>
  <BaseModal :open="open" title="记下这一刻" eyebrow="随手记录 · 仅保存到本机" @close="emit('close')">
    <div class="record-type-tabs">
      <button :class="{ active: draft.type === 'text' }" type="button" @click="setType('text')"><NotebookPen :size="16" /> 文字</button>
      <button :class="{ active: draft.type === 'image' }" type="button" @click="setType('image')"><Image :size="16" /> 图片</button>
      <button :class="{ active: draft.type === 'audio' }" type="button" @click="setType('audio')"><Mic :size="16" /> 声音</button>
    </div>
    <p class="record-optional-note">文字、图片和声音都可跳过；不选心情也可以保存这一刻。</p>

    <div v-if="draft.type === 'image' && draft.images?.length" class="image-preview-grid">
      <div v-for="(image, index) in draft.images" :key="`${image.slice(-24)}-${index}`" class="image-preview">
        <img :src="image" :alt="`待保存的第 ${index + 1} 张图片`" />
        <button type="button" :aria-label="`移除第 ${index + 1} 张图片`" @click="removeImage(index)"><Trash2 :size="15" /></button>
      </div>
      <label class="add-image-tile"><input type="file" accept="image/*" multiple @change="selectImage" /><Camera :size="22" /><span>继续添加</span></label>
      <button class="add-image-tile camera-tile" type="button" :disabled="cameraBusy" @click="openCamera"><Camera :size="22" /><span>{{ cameraBusy ? '正在开启…' : '继续拍照' }}</span></button>
    </div>
    <div v-else-if="draft.type === 'image'" class="image-source-actions">
      <label class="upload-box">
        <input type="file" accept="image/*" multiple @change="selectImage" />
        <Image :size="25" />
        <strong>{{ busy ? '正在处理图片…' : '从相册选择' }}</strong>
        <span>支持一次选择多张</span>
      </label>
      <button class="upload-box camera-box" type="button" :disabled="cameraBusy" @click="openCamera">
        <Camera :size="25" />
        <strong>{{ cameraBusy ? '正在开启…' : '使用摄像头' }}</strong>
        <span>可连续拍摄多张</span>
      </button>
    </div>

    <div v-if="draft.type === 'image' && cameraOpen" class="camera-panel">
      <video ref="cameraVideo" playsinline muted aria-label="摄像头实时预览"></video>
      <div class="camera-actions">
        <button class="secondary-button" type="button" @click="stopCamera">关闭摄像头</button>
        <button class="primary-button" type="button" @click="takePhoto"><Camera :size="16" /> 拍一张</button>
      </div>
    </div>

    <div v-if="draft.type === 'audio'" class="audio-panel">
      <button class="record-button" :class="{ recording }" type="button" :disabled="busy" @click="toggleRecording">
        <Square v-if="recording" :size="20" fill="currentColor" />
        <Mic v-else :size="22" />
        {{ recording ? '停止录音' : draft.audio ? '重新录音' : '开始录音' }}
      </button>
      <label v-if="recognitionSupported" class="transcribe-option">
        <input v-model="transcribeRecording" type="checkbox" :disabled="recording" />
        录音时同步转文字
      </label>
      <p v-else class="recognition-note">此浏览器不支持语音识别，录音仍可正常保存。</p>
      <span>或</span>
      <label class="audio-file"><FileAudio :size="17" /> 选择本地音频<input type="file" accept="audio/*" :disabled="recording || busy" @change="selectAudio" /></label>
      <p class="recognition-note">已有音频文件暂不支持转写。语音识别由浏览器提供，可能通过网络处理。</p>
      <div v-if="draft.audio" class="audio-ready">
        <strong>{{ draft.audioName }}</strong>
        <audio :src="draft.audio" controls preload="metadata"></audio>
      </div>
    </div>

    <div class="form-field">
      <label>此刻想说些什么？（可选）</label>
      <textarea v-model="draft.text" placeholder="不用完整，一句话就好……" maxlength="500"></textarea>
      <button
        v-if="recognitionSupported && !recording"
        class="dictate-button"
        type="button"
        :disabled="busy || stoppingRecognition"
        @click="toggleRecognition"
      ><Square v-if="recognizing" :size="14" /><Mic v-else :size="14" />{{ stoppingRecognition ? '正在结束识别…' : recognizing ? '停止转文字' : '口述转文字' }}</button>
      <p v-if="interimText" class="recognition-interim" aria-live="polite">正在识别：{{ interimText }}</p>
      <p v-if="recognitionMessage" class="recognition-note" role="status">{{ recognitionMessage }}</p>
      <p v-if="recognitionSupported && draft.type !== 'audio'" class="recognition-note">语音识别由浏览器提供，可能通过网络处理。</p>
    </div>
    <div class="form-field">
      <label>在哪里？</label>
      <div class="location-input"><MapPin :size="16" /><input v-model="draft.location" placeholder="例如：九溪烟树" autocomplete="off" aria-label="在哪里" :aria-expanded="suggestionsOpen" aria-controls="place-suggestions" @input="onLocationInput" @keydown.esc="clearSuggestions" /></div>
      <div v-if="suggestionsOpen" id="place-suggestions" class="place-suggestions" aria-label="相关地点推荐">
        <button v-for="suggestion in placeSuggestions" :key="suggestion.id" type="button" @click="selectPlace(suggestion)">
          <strong>{{ suggestion.name }}</strong><span>{{ [suggestion.district, suggestion.address].filter(Boolean).join(' · ') }}</span>
        </button>
        <p v-if="suggestionStatus === 'loading'">正在查找地点…</p>
        <p v-else-if="suggestionStatus === 'empty'">没有找到相关地点，可继续输入更具体的名称。</p>
        <p v-else-if="suggestionStatus === 'error'">地点查询暂不可用，可稍后重试或手动输入。</p>
      </div>
      <button class="location-button" type="button" :disabled="locating" @click="markCurrentLocation"><MapPin :size="14" />{{ locating ? '正在定位…' : draft.coordinate ? '重新标记当前位置' : '标记当前位置' }}</button>
      <p v-if="locationMessage" class="location-message" role="status">{{ locationMessage }}</p>
      <p v-if="draft.location.trim().length >= 2 && !draft.coordinate && !suggestionsOpen" class="location-message">请选择地点建议，才能把该地点加入足迹。</p>
      <p v-if="draft.coordinate" class="location-message">坐标随这条记录保存在当前浏览器中。</p>
    </div>
    <div class="form-field">
      <label>现在的心情（可选，可多选）</label>
      <div class="chip-row">
        <button
          v-for="mood in moods"
          :key="mood"
          class="chip"
          :class="{ active: selectedMoods.includes(mood) }"
          type="button"
          :aria-pressed="selectedMoods.includes(mood)"
          @click="toggleMood(mood)"
        >{{ mood === otherMood ? '其它（可填写）' : mood }}</button>
      </div>
      <input
        v-if="selectedMoods.includes(otherMood)"
        v-model="customMood"
        class="custom-mood-input"
        maxlength="20"
        placeholder="写下此刻的其它心情"
        aria-label="填写其它心情"
      />
    </div>
    <button class="primary-button full-width" type="button" :disabled="busy || locating || recording || recognizing" @click="save">保存到本机</button>
  </BaseModal>
</template>

<style scoped>
.record-type-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 18px; }
.record-optional-note { margin: -8px 0 16px; color: var(--muted); font-size: 10px; line-height: 1.5; }
.record-type-tabs button { min-height: 44px; display: flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--line); border-radius: 13px; background: #fff; color: var(--muted); font-size: 12px; }
.record-type-tabs button.active { border-color: var(--green); background: var(--green-soft); color: var(--green); font-weight: 650; }
.image-source-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-bottom: 18px; }
.upload-box { min-height: 140px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 12px; border: 1px dashed #bdcbbc; border-radius: 18px; background: #f1f5ed; color: var(--green); text-align: center; cursor: pointer; }
.camera-box { border: 1px solid #c8d8c4; font-family: inherit; }
.camera-box:disabled, .camera-tile:disabled { opacity: 0.55; cursor: wait; }
.upload-box input, .add-image-tile input, .audio-file input { display: none; }
.upload-box strong { font-size: 13px; }
.upload-box span { color: var(--muted); font-size: 9px; }
.image-preview-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 9px; margin-bottom: 18px; }
.image-preview { position: relative; aspect-ratio: 1; overflow: hidden; border-radius: 15px; }
.image-preview img { width: 100%; height: 100%; object-fit: cover; }
.image-preview button { position: absolute; top: 7px; right: 7px; width: 32px; height: 32px; display: grid; place-items: center; border: 0; border-radius: 10px; background: rgb(26 43 34 / 65%); color: #fff; }
.add-image-tile { min-height: 110px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; border: 1px dashed #bdcbbc; border-radius: 15px; background: #f1f5ed; color: var(--green); cursor: pointer; }
.add-image-tile span { font-size: 10px; }
.camera-tile { width: 100%; font-family: inherit; }
.camera-panel { margin: -2px 0 18px; overflow: hidden; padding: 8px; border-radius: 18px; background: #1d2b24; }
.camera-panel video { display: block; width: 100%; max-height: 360px; border-radius: 13px; background: #0c120f; object-fit: cover; }
.camera-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding-top: 8px; }
.camera-actions button { display: flex; align-items: center; justify-content: center; gap: 5px; }
.audio-panel { display: flex; flex-direction: column; align-items: center; gap: 12px; margin-bottom: 18px; padding: 18px; border-radius: 18px; background: #f2f4ef; color: var(--muted); font-size: 11px; }
.record-button { min-width: 160px; min-height: 46px; display: flex; align-items: center; justify-content: center; gap: 8px; border: 0; border-radius: 999px; background: var(--green); color: #fff; font-weight: 650; }
.record-button.recording { background: #b65f4a; animation: pulse 1.3s infinite; }
.record-button:disabled { opacity: 0.55; cursor: wait; }
.transcribe-option { display: flex; align-items: center; gap: 6px; color: var(--ink); font-size: 11px; }
.transcribe-option input { accent-color: var(--green); }
.audio-file { min-height: 40px; display: flex; align-items: center; gap: 6px; color: var(--green); cursor: pointer; }
.audio-file:has(input:disabled) { opacity: 0.5; pointer-events: none; }
.audio-ready { width: 100%; text-align: center; }
.audio-ready strong { display: block; margin-bottom: 7px; color: var(--ink); font-size: 11px; }
.audio-ready audio { width: 100%; height: 36px; }
.dictate-button { display: inline-flex; align-items: center; gap: 5px; min-height: 34px; margin-top: 8px; padding: 0 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--green-soft); color: var(--green); font-size: 11px; }
.recognition-note, .recognition-interim { margin: 6px 0 0; color: var(--muted); font-size: 10px; line-height: 1.5; }
.recognition-interim { color: var(--green); }
.location-input { position: relative; }
.location-input svg { position: absolute; z-index: 1; left: 13px; top: 16px; color: var(--muted); }
.location-input input { padding-left: 38px; }
.place-suggestions { position: relative; z-index: 5; margin-top: 5px; padding: 4px; border: 1px solid var(--line); border-radius: 10px; background: #fff; box-shadow: 0 8px 22px rgb(20 45 29 / 12%); }
.place-suggestions button { display: flex; flex-direction: column; gap: 3px; width: 100%; padding: 9px 10px; border: 0; border-radius: 7px; background: transparent; text-align: left; cursor: pointer; }
.place-suggestions button:hover, .place-suggestions button:focus-visible { background: var(--green-soft); }
.place-suggestions strong { color: var(--ink); font-size: 11px; }
.place-suggestions span, .place-suggestions p { margin: 0; color: var(--muted); font-size: 10px; }
.place-suggestions p { padding: 9px 10px; }
.location-button { display: inline-flex; align-items: center; gap: 5px; min-height: 34px; margin-top: 8px; padding: 0 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--green-soft); color: var(--green); font-size: 11px; }
.location-message { margin: 6px 0 0; color: var(--muted); font-size: 10px; line-height: 1.5; }
.custom-mood-input { margin-top: 10px; }
@keyframes pulse { 50% { box-shadow: 0 0 0 8px rgb(182 95 74 / 12%); } }
</style>
