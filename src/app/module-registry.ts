import type { Component } from 'vue'
import {
  Award,
  BookOpenText,
  Clock3,
  Compass,
  Download,
  House,
  Map,
  Plus,
  UserRound,
} from 'lucide-vue-next'
import type { ModuleId } from '../types'

export interface ModuleDefinition {
  id: ModuleId
  title: string
  icon: Component
  route: string
  showInToolbar: boolean
  defaultOrder: number
  requiresActiveTrip: boolean
}

export const moduleRegistry: ModuleDefinition[] = [
  { id: 'home', title: '首页', icon: House, route: '/home', showInToolbar: true, defaultOrder: 1, requiresActiveTrip: false },
  { id: 'routes', title: '路线', icon: Map, route: '/route', showInToolbar: true, defaultOrder: 2, requiresActiveTrip: true },
  { id: 'records', title: '记录', icon: Plus, route: '/records', showInToolbar: true, defaultOrder: 3, requiresActiveTrip: true },
  { id: 'story', title: '故事', icon: BookOpenText, route: '/story', showInToolbar: true, defaultOrder: 4, requiresActiveTrip: false },
  { id: 'profile', title: '我的', icon: UserRound, route: '/profile', showInToolbar: true, defaultOrder: 5, requiresActiveTrip: false },
  { id: 'inspiration', title: '灵感', icon: Compass, route: '/inspiration', showInToolbar: false, defaultOrder: 6, requiresActiveTrip: true },
  { id: 'exports', title: '导出', icon: Download, route: '/export', showInToolbar: false, defaultOrder: 6, requiresActiveTrip: true },
  { id: 'achievements', title: '成就', icon: Award, route: '/achievements', showInToolbar: false, defaultOrder: 7, requiresActiveTrip: false },
  { id: 'history', title: '历史', icon: Clock3, route: '/history', showInToolbar: false, defaultOrder: 8, requiresActiveTrip: false },
]

export const toolbarChoices = moduleRegistry
  .filter((module) => module.showInToolbar)
  .sort((left, right) => left.defaultOrder - right.defaultOrder)
export function getModule(moduleId: ModuleId) {
  return moduleRegistry.find((module) => module.id === moduleId) ?? moduleRegistry[0]
}
