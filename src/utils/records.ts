import type { TravelRecord } from '../types'

export function getRecordImages(record: Pick<TravelRecord, 'image' | 'images'>) {
  const images = record.images?.filter(Boolean) ?? []
  if (record.image && !images.includes(record.image)) images.unshift(record.image)
  return images
}

export function countRecordImages(records: TravelRecord[]) {
  return records.reduce((total, record) => total + getRecordImages(record).length, 0)
}
