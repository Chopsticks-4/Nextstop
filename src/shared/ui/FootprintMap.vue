<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { footprintMapUrl } from '../../services/amap'
import { formatDistance, projectPoints, totalStraightLineDistanceMeters } from '../../utils/geo'
import type { TravelRecord } from '../../types'

const props = defineProps<{ records: TravelRecord[]; compact?: boolean }>()
const locatedRecords = computed(() => props.records.filter((record) => record.coordinate))
const points = computed(() => projectPoints(locatedRecords.value.map((record) => record.coordinate!), 400, 230))
const line = computed(() => points.value.map((point) => `${point.x},${point.y}`).join(' '))
const distance = computed(() => formatDistance(totalStraightLineDistanceMeters(locatedRecords.value.map((record) => record.coordinate!))))
const imageFailed = ref(false)
const mapUrl = computed(() => footprintMapUrl(locatedRecords.value.map((record) => record.coordinate!)))
watch(mapUrl, () => { imageFailed.value = false })
</script>

<template>
  <div class="footprint-map" :class="{ compact }" role="group" :aria-label="`旅行足迹，共 ${locatedRecords.length} 个定位点`">
    <img v-if="locatedRecords.length && !imageFailed" class="amap-footprint" :src="mapUrl" alt="高德地图上的旅行记录定位点，按记录顺序编号并以直线连接" @error="imageFailed = true" />
    <svg viewBox="0 0 400 230" preserveAspectRatio="xMidYMid meet">
      <path class="grid" d="M0 58H400 M0 115H400 M0 172H400 M100 0V230 M200 0V230 M300 0V230" />
      <polyline v-if="points.length > 1" :points="line" class="trail" />
      <g v-for="(point, index) in points" :key="locatedRecords[index].id">
        <circle :cx="point.x" :cy="point.y" r="12" class="marker" />
        <text :x="point.x" :y="point.y + 4" class="marker-number">{{ index + 1 }}</text>
      </g>
    </svg>
    <span v-if="!locatedRecords.length || imageFailed" class="north">N ↑</span>
    <div class="footprint-caption">
      <strong>{{ locatedRecords.length }} 个定位点<span v-if="locatedRecords.length > 1"> · 连线 {{ distance }}</span></strong>
      <small>{{ locatedRecords.length && !imageFailed ? `按记录顺序编号并连线${locatedRecords.length > 10 ? ' · 地图显示最近 10 个点' : ''} · 非实际行走轨迹` : '高德不可用时的示意图 · 按记录顺序直线连线，非道路地图' }}</small>
    </div>
    <button v-if="imageFailed" class="map-retry" type="button" @click="imageFailed = false">重试高德地图</button>
  </div>
  <div class="footprint-labels">
    <span v-for="(record, index) in locatedRecords" :key="record.id">{{ index + 1 }}. {{ record.location || record.recordedAt || '未命名地点' }}</span>
  </div>
</template>

<style scoped>
.footprint-map { position: relative; height: 250px; overflow: hidden; border-radius: 22px; background: #e9ede3; }
.amap-footprint { position: absolute; z-index: 2; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.map-retry { position: absolute; z-index: 4; top: 10px; left: 10px; border: 0; border-radius: 7px; padding: 5px 7px; background: rgb(255 255 255 / 88%); color: var(--green); font-size: 9px; cursor: pointer; }
.footprint-map.compact { height: 210px; }
.footprint-map svg { width: 100%; height: 100%; }
.grid { fill: none; stroke: #d8e2d6; stroke-width: 1; }
.trail { fill: none; stroke: var(--green); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 6 5; }
.marker { fill: var(--green); stroke: #fff; stroke-width: 3; }
.marker-number { fill: #fff; font-size: 10px; font-weight: 700; text-anchor: middle; }
.north { position: absolute; top: 12px; right: 14px; color: #738578; font-size: 10px; font-weight: 700; }
.footprint-caption { position: absolute; z-index: 3; right: 10px; bottom: 10px; left: 10px; display: flex; flex-direction: column; gap: 3px; padding: 7px 9px; border-radius: 9px; background: rgb(255 255 255 / 88%); color: var(--ink); }
.footprint-caption strong { font-size: 10px; }
.footprint-caption small { color: var(--muted); font-size: 9px; }
.footprint-labels { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
.footprint-labels span { padding: 5px 8px; border-radius: 8px; background: var(--green-soft); color: var(--green); font-size: 9px; }
</style>
