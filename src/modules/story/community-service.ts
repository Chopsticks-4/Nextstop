import type { CommunityStory } from './community-stories'
import type { Trip } from '../../types'
import { getRecordImages } from '../../utils/records'

export interface CommunityReaction { likes: number; influence: number; comments: { author: string; text: string }[] }
export interface CommunityData { posts: CommunityStory[]; reactions: Record<string, CommunityReaction> }
export interface CommunityActivity {
  kind: 'like' | 'comment' | 'follow'
  storyId: string
  storyTitle: string
  text?: string
  at: string
}
export interface CommunityImpact {
  posts: (Omit<CommunityStory, 'comments'> & { comments: number })[]
  received: CommunityActivity[]
  given: CommunityActivity[]
}

export function communityUserId() {
  const key = 'nextstop-community-user-id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

async function request<T>(path: string, payload?: object): Promise<T> {
  const response = await fetch(`/api/community${path}`, payload ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, userId: communityUserId() }),
  } : undefined)
  const data = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(data.error || '社区暂时不可用')
  return data
}

export function loadCommunity() { return request<CommunityData>('') }
export function loadCommunityImpact() { return request<CommunityImpact>('/impact', {}) }
export function recordFollow(id: string) { return request<{ reaction: CommunityReaction }>('/follow', { id }) }
export function toggleCommunityLike(id: string) { return request<{ reaction: CommunityReaction }>('/like', { id }) }
export function addCommunityComment(id: string, text: string) { return request<{ reaction: CommunityReaction }>('/comment', { id, text }) }

export function publishTrip(trip: Trip) {
  const place = trip.routeStops.find((stop) => stop.status === 'done' || stop.status === 'current')?.name
    || trip.records.find((record) => record.location)?.location
    || trip.suggestions[0]?.name || trip.city
  const body = trip.storySections.map((section) => `${section.title}\n${section.text}`).join('\n\n')
  const firstImage = trip.records.flatMap(getRecordImages)[0] || trip.storySections.find((section) => section.image)?.image || ''
  const image = firstImage.length < 4_500_000 ? firstImage : ''
  return request<{ post: CommunityStory }>('/publish', {
    tripId: trip.id, title: trip.storyTitle || trip.title, city: trip.city, place, body, image,
  })
}
