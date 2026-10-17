<script setup lang="ts">
import { ref, watch } from 'vue'
import { MapPin } from 'lucide-vue-next'
import { staticMapUrl } from '../../services/amap'
import type { RouteStop } from '../../types'

const props = defineProps<{ stops: RouteStop[]; compact?: boolean; points?: string[]; live?: boolean; city?: string }>()
const imageFailed = ref(false)
watch(() => props.points?.join('|'), () => { imageFailed.value = false })

const positions = [
  { left: '18%', top: '66%' },
  { left: '46%', top: '38%' },
  { left: '72%', top: '58%' },
  { left: '79%', top: '22%' },
]
</script>

<template>
  <div class="local-map" :class="{ compact }" :aria-label="live && !imageFailed ? '高德真实路线地图' : '本地静态路线示意图'">
    <img v-if="live && points?.length && !imageFailed" class="amap-image" :src="staticMapUrl(points, city, ['当前位置', ...stops.slice(0, 4).map((stop) => stop.name)])" alt="高德地图：从当前位置出发的推荐路线" @error="imageFailed = true" />
    <div class="map-water"></div>
    <div class="map-park park-one"></div>
    <div class="map-park park-two"></div>
    <svg viewBox="0 0 400 230" preserveAspectRatio="none" aria-hidden="true">
      <path class="road minor" d="M-20 55 C80 75 105 25 190 50 S310 95 430 55" />
      <path class="road minor" d="M40 -20 C60 55 15 105 70 250" />
      <path class="road minor" d="M265 -20 C235 55 290 105 250 250" />
      <path class="road main" d="M-20 190 C80 150 115 190 170 130 S250 55 420 120" />
      <path class="route-line" d="M72 152 C110 120 145 125 184 88 S245 100 290 132 S320 70 330 50" />
    </svg>
    <div
      v-for="(stop, index) in stops.slice(0, 4)"
      :key="stop.id"
      class="map-stop"
      :class="stop.status"
      :style="positions[index]"
    >
      <span><MapPin :size="14" fill="currentColor" /></span>
      <label>{{ stop.name }}</label>
    </div>
    <button v-if="live && imageFailed" class="map-sample map-retry" type="button" @click="imageFailed = false">地图暂不可用 · 点击重试</button>
    <span v-else-if="!live" class="map-sample">静态示意 · 地图不可用时回退</span>
  </div>
</template>

<style scoped>
.local-map { position: relative; height: 250px; overflow: hidden; border-radius: 22px; background: #e9ede3; }
.amap-image { position: absolute; z-index: 4; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.local-map.compact { height: 210px; }
.local-map svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.map-water { position: absolute; right: -40px; top: -30px; width: 150px; height: 190px; border-radius: 45% 0 0 55%; background: #d5e6e4; transform: rotate(18deg); }
.map-park { position: absolute; border-radius: 50%; background: #dce7d1; }
.park-one { left: 65px; top: 25px; width: 100px; height: 70px; }
.park-two { left: 160px; bottom: -25px; width: 140px; height: 85px; }
.road { fill: none; stroke: #fff; stroke-linecap: round; }
.road.minor { stroke-width: 5; opacity: 0.75; }
.road.main { stroke-width: 9; }
.route-line { fill: none; stroke: #4f8064; stroke-width: 3; stroke-linecap: round; stroke-dasharray: 5 7; }
.map-stop { position: absolute; z-index: 2; display: flex; align-items: center; gap: 4px; transform: translate(-50%, -50%); }
.map-stop span { width: 27px; height: 27px; display: grid; place-items: center; border: 3px solid #fff; border-radius: 50% 50% 50% 8px; background: #8c9a90; color: #fff; box-shadow: 0 4px 12px rgb(31 60 44 / 18%); transform: rotate(-45deg); }
.map-stop span svg { transform: rotate(45deg); }
.map-stop.current span { background: var(--green); }
.map-stop.upcoming span { background: var(--orange); }
.map-stop.skipped { opacity: 0.45; }
.map-stop label { max-width: 76px; padding: 4px 6px; border-radius: 7px; background: rgb(255 255 255 / 88%); color: #46564c; font-size: 9px; white-space: nowrap; }
.map-sample { position: absolute; right: 10px; bottom: 9px; padding: 4px 7px; border-radius: 7px; background: rgb(255 255 255 / 75%); color: #7a877e; font-size: 8px; }
.map-retry { z-index: 5; border: 0; cursor: pointer; }
</style>
