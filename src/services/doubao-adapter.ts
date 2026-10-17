import { sampleAdapter } from './sample-adapter'
import { getRecordImages } from '../utils/records'
import type { RouteStop, StorySection, Suggestion, Trip } from '../types'
import type { CtripGuideEvidence } from './ctrip'

export type AiSource = 'doubao' | 'local'

export interface AiResult<T> {
  data: T
  source: AiSource
}

export interface TripPlan {
  suggestions: Suggestion[]
  routeStops: RouteStop[]
}

export interface GeneratedStory {
  title: string
  sections: StorySection[]
  narration: string
}

function tripSnapshot(trip: Trip, includeImages: boolean): Trip {
  let remainingImages = 6
  return {
    ...trip,
    narrationAudio: undefined,
    storySections: [],
    records: trip.records.map((record) => {
      const images = includeImages ? getRecordImages(record).slice(0, remainingImages) : []
      remainingImages -= images.length
      return {
        ...record,
        image: images[0],
        images,
        audio: undefined,
        audioName: undefined,
      }
    }),
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 95_000)
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const data = await response.json() as T & { error?: string }
    if (!response.ok) throw new Error(data.error || '豆包服务请求失败')
    return data
  } finally {
    window.clearTimeout(timeout)
  }
}

function localOpenRoute(trip: Trip) {
  const current = trip.routeStops.find((stop) => stop.status === 'current')
  const upcoming = trip.routeStops.filter((stop) => stop.status === 'upcoming').reverse()
  const routeStops = structuredClone(current ? [current, ...upcoming] : upcoming)
  if (routeStops.length && !routeStops.some((stop) => stop.status === 'current')) routeStops[0].status = 'current'
  return routeStops
}

export const doubaoAdapter = {
  async createPlan(trip: Trip): Promise<AiResult<TripPlan>> {
    try {
      const data = await post<TripPlan>('/api/doubao/plan', { action: 'create', trip: tripSnapshot(trip, false) })
      return { data, source: 'doubao' }
    } catch {
      const suggestions = await sampleAdapter.getSuggestions()
      return { data: { suggestions, routeStops: structuredClone(trip.routeStops) }, source: 'local' }
    }
  },

  async getNextSuggestion(trip: Trip, currentId: string): Promise<AiResult<Suggestion>> {
    try {
      const result = await post<{ suggestions: Suggestion[] }>('/api/doubao/plan', { action: 'next', trip: tripSnapshot(trip, false) })
      if (!result.suggestions.length) throw new Error('豆包没有返回新建议')
      return { data: result.suggestions[0], source: 'doubao' }
    } catch {
      return { data: await sampleAdapter.getNextSuggestion(currentId), source: 'local' }
    }
  },

  async getStopGuide(trip: Trip, evidence?: CtripGuideEvidence): Promise<AiResult<Suggestion>> {
    const current = trip.suggestions.find((item) => item.id === trip.currentSuggestionId) ?? trip.suggestions[0]
    if (!current) throw new Error('当前站点建议不存在')
    try {
      const result = await post<{ suggestions: Suggestion[] }>('/api/doubao/plan', { action: 'guide', trip: tripSnapshot(trip, false), evidence })
      if (!result.suggestions.length) throw new Error('豆包没有返回当前站点玩法')
      return { data: result.suggestions[0], source: 'doubao' }
    } catch {
      return { data: structuredClone(current), source: 'local' }
    }
  },

  async replanRoute(trip: Trip): Promise<AiResult<TripPlan>> {
    try {
      const data = await post<TripPlan>('/api/doubao/plan', { action: 'replan', trip: tripSnapshot(trip, false) })
      return { data, source: 'doubao' }
    } catch {
      return {
        data: {
          suggestions: structuredClone(trip.suggestions),
          routeStops: localOpenRoute(trip),
        },
        source: 'local',
      }
    }
  },

  async generateStory(trip: Trip): Promise<AiResult<GeneratedStory>> {
    try {
      const data = await post<GeneratedStory>('/api/doubao/story', { trip: tripSnapshot(trip, true) })
      return { data, source: 'doubao' }
    } catch {
      return { data: await sampleAdapter.generateSampleStory(trip), source: 'local' }
    }
  },
}
