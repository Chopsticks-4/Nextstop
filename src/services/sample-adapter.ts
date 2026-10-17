import { getSampleStory, sampleSuggestions } from '../fixtures/sample-trip'
import type { StorySection, Trip } from '../types'
import { getRecordImages } from '../utils/records'

const wait = (ms = 320) => new Promise((resolve) => window.setTimeout(resolve, ms))

function createStoryFromTrip(trip: Trip) {
  if (!trip.records.length) return { title: '', sections: [] as StorySection[], narration: '' }

  const sections: StorySection[] = trip.records.map((record, index) => {
    const isFirst = index === 0
    const isLast = index === trip.records.length - 1
    const beat = trip.records.length === 1 ? '完整片段' : isFirst ? '开场' : isLast ? '收束' : index === 1 ? '推进' : '核心片段'
    const context = `${record.recordedAt ? `${record.recordedAt}，` : ''}${record.location ? `在${record.location}，` : '在旅途中，'}我记下了这一刻。`
    const recordImages = getRecordImages(record)
    const content = record.text.trim() || (recordImages.length ? `我为这一刻留下了${recordImages.length}张照片。` : record.audio ? '我为这一刻留下了一段旅行原声。' : '')
    const mood = record.mood ? `当时的心情是${record.mood}。` : ''
    return {
      id: `story-${trip.id}-${record.id}`,
      beat,
      title: record.location || `第 ${index + 1} 个旅行时刻`,
      text: `${context}${content}${mood}`,
      image: recordImages[0] || '',
      sourceRecordIds: [record.id],
    }
  })
  const firstLocation = trip.records.find((record) => record.location)?.location

  return {
    title: firstLocation ? `${trip.city}，从${firstLocation}记起` : `${trip.city}，我的旅行记录`,
    sections,
    narration: sections.map((section) => section.text).join('\n\n'),
  }
}

export const sampleAdapter = {
  async getSuggestions() {
    await wait()
    return structuredClone(sampleSuggestions)
  },

  async getNextSuggestion(currentId: string) {
    await wait(240)
    const index = sampleSuggestions.findIndex((item) => item.id === currentId)
    return structuredClone(sampleSuggestions[(index + 1) % sampleSuggestions.length])
  },

  async generateSampleStory(trip?: Trip) {
    return trip ? createStoryFromTrip(trip) : getSampleStory()
  },
}
