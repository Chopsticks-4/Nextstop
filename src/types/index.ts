export type ModuleId =
  | 'home'
  | 'records'
  | 'routes'
  | 'inspiration'
  | 'story'
  | 'exports'
  | 'achievements'
  | 'history'
  | 'profile'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
export type TripStatus = 'idle' | 'active' | 'completed' | 'exited'
export type RecordType = 'text' | 'image' | 'audio'
export type ExportFormat = 'moments' | 'redbook' | 'wechat' | 'video'

export interface GeoPoint {
  latitude: number
  longitude: number
  accuracy?: number
  coordinateSystem?: 'wgs84' | 'gcj02'
}

export interface Suggestion {
  id: string
  amapLocation?: string
  address?: string
  routeAvailable?: boolean
  rankPosition?: number
  name: string
  category: string
  interestTags?: string[]
  image: string
  reason: string
  whyNow: string
  distance: string
  travelMinutes: number
  suggestedMinutes: number
  transport: string
  activities: string[]
  highlights: string[]
  foodIdea: string
  caution: string
}

export interface RouteStop {
  id: string
  suggestionId: string
  name: string
  plannedTime: string
  status: 'done' | 'current' | 'upcoming' | 'skipped'
  transport: string
  route?: {
    mode: 'walking' | 'transit' | 'driving'
    modeLabel: string
    distanceMeters: number
    durationMinutes: number
    instructions: string[]
    polyline: string
    navigationUrl: string
  }
}

export interface TravelRecord {
  id: string
  type: RecordType
  text: string
  image?: string
  images?: string[]
  audio?: string
  audioName?: string
  location: string
  coordinate?: GeoPoint
  mood: string
  weather: string
  recordedAt: string
}

export interface GeneratedVideo {
  id: string
  title: string
  src: string
  poster?: string
  createdAt: string
}

export interface StorySection {
  id: string
  beat: string
  title: string
  text: string
  image: string
  sourceRecordIds: string[]
}

export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  earned: boolean
  progress: number
  target: number
}

export interface Trip {
  id: string
  title: string
  city: string
  planningMode?: 'single' | 'full'
  originLabel?: string
  originLocation?: string
  dataSource?: 'amap' | 'fallback'
  date: string
  status: TripStatus
  availableMinutes: number
  remainingMinutes: number
  interests: string[]
  weather: string
  temperature: string
  suggestions: Suggestion[]
  currentSuggestionId: string
  routeStops: RouteStop[]
  records: TravelRecord[]
  generatedVideos?: GeneratedVideo[]
  storyTitle: string
  storySections: StorySection[]
  narration: string
  narrationAudio?: string
  badges: Badge[]
  updatedAt: string
}

export interface PersistedState {
  trip: Trip
  homeSelection?: { city: string; province: string; manual: boolean }
  historyTrips: Trip[]
  toolbarModuleIds: ModuleId[]
  soundEnabled: boolean
  revision: number
}

export interface RecordDraft {
  type: RecordType
  text: string
  image?: string
  images?: string[]
  audio?: string
  audioName?: string
  location: string
  coordinate?: GeoPoint
  mood: string
}
