export interface CtripGuideEvidence {
  configured: boolean
  ticket: string
  restaurant: string
  errors: string[]
}

export interface CtripRankedPlace { name: string; rank: number; reason: string }

export async function fetchCtripRank(city: string): Promise<CtripRankedPlace[]> {
  const query = new URLSearchParams({ city })
  const response = await fetch(`/api/ctrip/rank?${query}`)
  const data = await response.json() as { places?: CtripRankedPlace[]; error?: string }
  if (!response.ok) throw new Error(data.error || '携程榜单暂不可用')
  return data.places || []
}

export interface CtripRestaurant {
  name: string
  address: string
  cuisine: string
  averagePrice?: number
  link: string
}

function asObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function ctripLink(value: unknown): string {
  if (typeof value !== 'string') return ''
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    return url.protocol === 'https:' && (host === 'ctrip.com' || host.endsWith('.ctrip.com') || host === 'trip.com' || host.endsWith('.trip.com')) ? url.toString() : ''
  } catch {
    return ''
  }
}

export function visibleCtripResults(evidence: CtripGuideEvidence | null): { ticketUrl: string; restaurants: CtripRestaurant[] } {
  if (!evidence) return { ticketUrl: '', restaurants: [] }
  let ticketUrl = ''
  let restaurants: CtripRestaurant[] = []
  try {
    ticketUrl = ctripLink(asObject(JSON.parse(evidence.ticket)).listKywdUrlH5)
  } catch { /* 携程门票接口可能没有返回可用链接 */ }
  try {
    const result = JSON.parse(evidence.restaurant) as unknown
    if (Array.isArray(result)) {
      restaurants = result.slice(0, 5).flatMap((item) => {
        const restaurant = asObject(item)
        if (typeof restaurant.name !== 'string' || !restaurant.name.trim()) return []
        const price = Number(restaurant.averagePrice)
        return [{
          name: restaurant.name.trim(),
          address: typeof restaurant.address === 'string' ? restaurant.address : '',
          cuisine: Array.isArray(restaurant.cuisineNames) ? restaurant.cuisineNames.filter((name): name is string => typeof name === 'string').join('、') : '',
          averagePrice: Number.isFinite(price) && price > 0 ? price : undefined,
          link: ctripLink(restaurant.link),
        }]
      })
    }
  } catch { /* 保留豆包介绍，隐藏无法解析的餐馆数据 */ }
  return { ticketUrl, restaurants }
}

export async function fetchCtripGuide(city: string, place: string): Promise<CtripGuideEvidence> {
  const query = new URLSearchParams({ city, place })
  const response = await fetch(`/api/ctrip/guide?${query}`)
  const data = await response.json() as CtripGuideEvidence & { error?: string }
  if (!response.ok) throw new Error(data.error || '携程 MCP 暂时不可用')
  return data
}
