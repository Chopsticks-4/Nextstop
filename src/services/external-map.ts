export function amapPlaceSearchUrl(name: string, city: string): string {
  const url = new URL('https://uri.amap.com/search')
  url.searchParams.set('keyword', name)
  url.searchParams.set('city', city)
  url.searchParams.set('view', 'map')
  url.searchParams.set('src', 'nextstop')
  return url.toString()
}
