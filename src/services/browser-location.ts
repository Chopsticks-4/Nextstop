import type { GeoPoint } from '../types'

export class LocationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LocationError'
  }
}

export function getCurrentLocation(): Promise<GeoPoint> {
  if (!window.isSecureContext) {
    return Promise.reject(new LocationError('定位需要 HTTPS 或 localhost，请在安全地址打开页面'))
  }
  if (!navigator.geolocation) {
    return Promise.reject(new LocationError('此浏览器不支持定位，请手动填写地点'))
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
      }),
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? '未获得定位权限，请在浏览器设置中允许，或手动填写地点'
          : error.code === error.TIMEOUT
            ? '定位超时，请重试或手动填写地点'
            : '暂时无法获取位置，请重试或手动填写地点'
        reject(new LocationError(message))
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    )
  })
}
