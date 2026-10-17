const SHANGHAI_PHOTOS = {
  bund: '/assets/shanghai-bund.jpg',
  yuyuan: '/assets/shanghai-yuyuan.jpg',
} as const

export function localPlacePhoto(city: string, name: string): string {
  if (city.replace(/市$/, '') !== '上海') return ''
  const place = name.replace(/^上海市?/, '').replace(/\s/g, '')
  if (/^外滩(?:[-－]观景大道|[-－]观景平台|观景台|景区|风景区)?$/.test(place)) return SHANGHAI_PHOTOS.bund
  if (/^豫园(?:[-－]内园|[-－]海上名园|景区|旅游区)?$/.test(place)) return SHANGHAI_PHOTOS.yuyuan
  return ''
}
