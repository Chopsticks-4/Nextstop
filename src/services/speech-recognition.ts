interface SpeechResult {
  isFinal: boolean
  0: { transcript: string }
}

interface SpeechResultEvent {
  resultIndex: number
  results: ArrayLike<SpeechResult>
}

interface SpeechErrorEvent {
  error: string
}

interface BrowserSpeechRecognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechResultEvent) => void) | null
  onerror: ((event: SpeechErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition

export interface SpeechTranscriber {
  start(): boolean
  stop(): void
  abort(): void
}

function getRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined
  const browser = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition
}

export function isSpeechRecognitionSupported(): boolean {
  return Boolean(getRecognitionConstructor())
}

function errorMessage(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return '语音识别未获得麦克风或浏览器服务权限'
    case 'audio-capture':
      return '语音识别无法使用麦克风'
    case 'network':
      return '语音识别服务连接失败，请检查网络'
    case 'no-speech':
      return '没有识别到语音，可以再试一次'
    default:
      return '语音识别中断，可以再试一次'
  }
}

export function createSpeechTranscriber(callbacks: {
  onFinal: (text: string) => void
  onInterim: (text: string) => void
  onError: (message: string) => void
  onEnd: () => void
}): SpeechTranscriber {
  let recognition: BrowserSpeechRecognition | null = null

  return {
    start() {
      const Constructor = getRecognitionConstructor()
      if (!Constructor) {
        callbacks.onError('此浏览器不支持语音识别，请手动输入文字')
        return false
      }
      if (recognition) return true

      const instance = new Constructor()
      instance.lang = 'zh-CN'
      instance.continuous = true
      instance.interimResults = true
      instance.onresult = (event) => {
        const interim: string[] = []
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index]
          const text = result?.[0]?.transcript?.trim()
          if (!text) continue
          if (result.isFinal) callbacks.onFinal(text)
          else interim.push(text)
        }
        callbacks.onInterim(interim.join(''))
      }
      instance.onerror = (event) => callbacks.onError(errorMessage(event.error))
      instance.onend = () => {
        if (recognition === instance) recognition = null
        callbacks.onInterim('')
        callbacks.onEnd()
      }
      recognition = instance
      try {
        instance.start()
        return true
      } catch {
        recognition = null
        callbacks.onError('语音识别启动失败，可以再试一次')
        return false
      }
    },
    stop() {
      recognition?.stop()
    },
    abort() {
      const instance = recognition
      recognition = null
      if (instance) {
        instance.onresult = null
        instance.onerror = null
        instance.onend = null
        instance.abort()
      }
    },
  }
}
