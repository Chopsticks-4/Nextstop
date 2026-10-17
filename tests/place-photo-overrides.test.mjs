import assert from 'node:assert/strict'
import test from 'node:test'
import { localPlacePhoto } from '../src/services/place-photo-overrides.ts'

test('Shanghai Bund and Yuyuan use their distinct local photographs', () => {
  assert.equal(localPlacePhoto('上海市', '外滩'), '/assets/shanghai-bund.jpg')
  assert.equal(localPlacePhoto('上海', '外滩-观景平台'), '/assets/shanghai-bund.jpg')
  assert.equal(localPlacePhoto('上海', '豫园'), '/assets/shanghai-yuyuan.jpg')
  assert.equal(localPlacePhoto('上海市', '豫园-内园'), '/assets/shanghai-yuyuan.jpg')
})

test('unrelated places and other cities keep their own photographs', () => {
  assert.equal(localPlacePhoto('上海', '豫园(地铁站)'), '')
  assert.equal(localPlacePhoto('上海', '181外滩'), '')
  assert.equal(localPlacePhoto('天津', '外滩'), '')
})
