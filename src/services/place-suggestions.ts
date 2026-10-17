import type { PlaceData } from './amap'
import type { Suggestion } from '../types'
import { localPlacePhoto } from './place-photo-overrides'

function distanceLabel(meters: number, routed: boolean): string {
  if (!meters) return '距离未知'
  const value = meters < 1000 ? `${Math.round(meters)} 米` : `${(meters / 1000).toFixed(1)} 公里`
  return `${routed ? '步行' : '直线约'} ${value}`
}

export function placeToSuggestion(place: PlaceData, city: string): Suggestion {
  const address = place.address || city
  return {
    id: `amap-${place.id}`,
    amapLocation: place.location,
    address,
    routeAvailable: place.routeAvailable,
    name: place.name,
    category: place.category,
    interestTags: [],
    image: localPlacePhoto(city, place.name) || place.image,
    reason: `高德收录的${place.category}，地址：${address}。`,
    whyNow: `这是${city}的真实地点；可根据当前位置、天气和开放情况决定是否前往。`,
    distance: distanceLabel(place.distanceMeters, place.routeAvailable),
    travelMinutes: place.durationMinutes,
    suggestedMinutes: 45,
    transport: place.routeAvailable ? `步行约 ${place.durationMinutes} 分钟` : '步行路线暂不可用',
    activities: [`前往${place.name}`, `到达后看看${place.category}及周边`, '按现场情况决定停留时间'],
    highlights: [place.name, address],
    foodIdea: '餐饮信息请在高德地图查看周边商家。',
    caution: '地点、营业时间和交通状况以现场及高德地图最新信息为准。',
  }
}
