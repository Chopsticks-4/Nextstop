import localForage from 'localforage'
import type { PersistedState } from '../types'

const storage = localForage.createInstance({
  name: 'nextstop',
  storeName: 'local_frontend',
  description: 'NextStop local-only drafts and history',
})

const STATE_KEY = 'local-user:active-workspace:v1'

export async function readWorkspace(): Promise<PersistedState | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('读取本地旅行数据超时，请重试')), 10000)
  })
  let value: PersistedState | null
  try {
    value = await Promise.race([storage.getItem<PersistedState>(STATE_KEY), timeout])
  } finally {
    clearTimeout(timer)
  }
  if (!value || typeof value !== 'object' || !value.trip?.id || !Array.isArray(value.historyTrips)) {
    return null
  }
  return value
}

export async function writeWorkspace(value: PersistedState) {
  await storage.setItem(STATE_KEY, value)
}

export async function clearWorkspace() {
  await storage.clear()
}
