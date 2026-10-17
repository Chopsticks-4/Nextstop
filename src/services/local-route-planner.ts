import type { RouteStop, Suggestion, Trip } from '../types'

function estimatedMinutes(suggestion: Suggestion): number {
  return suggestion.travelMinutes + suggestion.suggestedMinutes
}

function interestScore(suggestion: Suggestion, interests: string[]): number {
  if (suggestion.interestTags) {
    return interests.filter((interest) => suggestion.interestTags?.includes(interest)).length
  }
  // Existing browser saves predate interestTags. Keep those suggestions rankable.
  const description = `${suggestion.name} ${suggestion.category} ${suggestion.reason} ${suggestion.activities.join(' ')} ${suggestion.highlights.join(' ')} ${suggestion.foodIdea}`
  const synonyms: Record<string, RegExp> = {
    散步: /散步|漫步|沿湖|沿溪|步道/,
    拍照: /拍照|随手拍|画面|光线|倒影/,
    自然: /自然|林|溪|湖|山|树/,
    美食: /美食|吃|食|茶|饮/,
    老街: /老街|街巷|古街/,
  }
  return interests.filter((interest) => synonyms[interest]?.test(description) ?? description.includes(interest)).length
}

export function rankLocalSuggestions(suggestions: Suggestion[], interests: string[], remainingMinutes: number): Suggestion[] {
  return [...suggestions].sort((left, right) => {
    const leftFits = estimatedMinutes(left) <= remainingMinutes ? 1 : 0
    const rightFits = estimatedMinutes(right) <= remainingMinutes ? 1 : 0
    return rightFits - leftFits
      || interestScore(right, interests) - interestScore(left, interests)
      || estimatedMinutes(left) - estimatedMinutes(right)
  })
}

export function planLocalRoute(trip: Trip): RouteStop[] {
  const fixed = trip.routeStops.filter((stop) => stop.status !== 'upcoming')
  const current = fixed.find((stop) => stop.status === 'current')
  const currentSuggestion = trip.suggestions.find((item) => item.id === current?.suggestionId)
  let budget = Math.max(0, trip.remainingMinutes - (currentSuggestion ? estimatedMinutes(currentSuggestion) : 0))
  const visited = new Set(fixed.map((stop) => stop.suggestionId))
  const existing = new Map(trip.routeStops.filter((stop) => stop.status === 'upcoming').map((stop) => [stop.suggestionId, stop]))
  const upcoming: RouteStop[] = []

  for (const suggestion of rankLocalSuggestions(trip.suggestions.filter((item) => !visited.has(item.id)), trip.interests, budget)) {
    const minutes = estimatedMinutes(suggestion)
    if (minutes > budget || upcoming.length >= 3) continue
    const original = existing.get(suggestion.id)
    upcoming.push({
      id: original?.id ?? `stop-${crypto.randomUUID()}`,
      suggestionId: suggestion.id,
      name: suggestion.name,
      plannedTime: `第 ${fixed.length + upcoming.length + 1} 站`,
      status: 'upcoming',
      transport: suggestion.transport,
    })
    budget -= minutes
  }

  return [...fixed, ...upcoming]
}
