import type { Badge, PersistedState, StorySection, Suggestion, Trip } from '../types'

export const sampleImages = [
  '/assets/forest.jpg',
  '/assets/lake.jpg',
  '/assets/morning.jpg',
  '/assets/mountain.jpg',
  '/assets/road.jpg',
  '/assets/valley.jpg',
]

export const sampleSuggestions: Suggestion[] = [
  {
    id: 'forest-walk',
    name: '九溪烟树',
    category: '林间漫步',
    interestTags: ['散步', '拍照', '自然'],
    image: '/assets/forest.jpg',
    reason: '你说想找个不用赶时间、适合随手拍的地方，这段林间路正好。',
    whyNow: '上午光线柔和，气温也适合慢慢走。',
    distance: '距你 2.4 km',
    travelMinutes: 18,
    suggestedMinutes: 70,
    transport: '打车约 18 分钟',
    activities: ['沿溪走一小段，不设终点', '在第二个溪湾停下来听一会儿水声', '回程前找一家茶座坐坐'],
    highlights: ['树影落在溪面上的光', '石板路和溪水的声音', '不用排队的小段风景'],
    foodIdea: '结束后可以试试附近的片儿川。',
    caution: '样例信息，出发前请确认天气与开放情况。',
  },
  {
    id: 'lake-morning',
    name: '北山街湖畔',
    category: '湖边散步',
    interestTags: ['散步', '拍照', '自然'],
    image: '/assets/lake.jpg',
    reason: '没有安排紧凑景点，只留一段湖边时间，符合你今天想要的松弛感。',
    whyNow: '现在游客相对少，适合先走一段再决定之后做什么。',
    distance: '距你 1.8 km',
    travelMinutes: 12,
    suggestedMinutes: 60,
    transport: '骑行约 12 分钟',
    activities: ['沿湖慢走二十分钟', '挑一张长椅坐一会儿', '拍下今天最喜欢的一种颜色'],
    highlights: ['湖面倒影', '沿路老树', '湖边的生活气息'],
    foodIdea: '带一杯热饮就好，不必专门找店。',
    caution: '样例信息，图片为旅行氛围示意。',
  },
  {
    id: 'hill-sunset',
    name: '宝石山日落',
    category: '轻量登高',
    interestTags: ['自然', '拍照'],
    image: '/assets/morning.jpg',
    reason: '你已经走了两段平路，如果体力还不错，可以用一场日落收尾。',
    whyNow: '按剩余时间慢慢上去，正好能避开赶路感。',
    distance: '距你 3.1 km',
    travelMinutes: 22,
    suggestedMinutes: 80,
    transport: '公交约 22 分钟',
    activities: ['只走轻松步道', '在观景台留二十分钟', '日落前决定要不要下山吃饭'],
    highlights: ['城市与湖面的交界', '傍晚光线', '沿途树影'],
    foodIdea: '下山后再找热食，不用提前预约。',
    caution: '样例信息，请按真实体力和天气决定是否前往。',
  },
  {
    id: 'tea-break',
    name: '湖畔茶座',
    category: '室内休息',
    interestTags: ['美食'],
    image: '/assets/mountain.jpg',
    reason: '你已经记录了不少画面，下一站适合坐下来，让节奏慢一点。',
    whyNow: '剩余时间不多时，休息比再赶一个景点更合适。',
    distance: '步行 8 分钟',
    travelMinutes: 8,
    suggestedMinutes: 45,
    transport: '步行约 8 分钟',
    activities: ['点一杯当季茶饮', '整理三张最喜欢的照片', '留十分钟什么都不做'],
    highlights: ['窗边光线', '茶杯与桌面细节', '旅途中的空白时间'],
    foodIdea: '茶饮和一份小点心即可。',
    caution: '店名与价格不在当前样例中，请以实际选择为准。',
  },
]

const sampleStory: StorySection[] = [
  {
    id: 'opening',
    beat: '开场',
    title: '没做攻略的上午',
    text: '这次来杭州，我没有给自己列一张必须完成的清单。早上只带了手机和一点随便走走的心情，沿着树多的路往前。风从枝叶间穿过来的时候，我忽然觉得，不知道下一站也没什么不好。',
    image: '/assets/morning.jpg',
    sourceRecordIds: ['record-1'],
  },
  {
    id: 'walking',
    beat: '推进',
    title: '路慢慢有了形状',
    text: '走到溪边以后，我反而把手机收起来了一会儿。再拿出来，是为了拍一束落在水面的光。后来回看照片，才发现那条路并不是攻略里的一条线，而是我几次停下、几次拐弯之后，慢慢走出来的。',
    image: '/assets/forest.jpg',
    sourceRecordIds: ['record-2'],
  },
  {
    id: 'pause',
    beat: '核心片段',
    title: '在湖边多坐了一会儿',
    text: '我本来只想在湖边休息十分钟，最后却坐了很久。没有发生什么特别的事，只是看着水面变亮，听旁边的人聊一些听不完整的话。那一刻我没再想去哪里，反而记住了这次旅行最放松的部分。',
    image: '/assets/lake.jpg',
    sourceRecordIds: ['record-3'],
  },
  {
    id: 'ending',
    beat: '收束',
    title: '把下一站留给下一次',
    text: '天色慢慢暗下来，我决定不再增加新的景点。今天走过的路、拍下的光和那段没有目的的停留，已经足够组成一次完整的旅行。至于没去的地方，就留给下一次的下一站。',
    image: '/assets/road.jpg',
    sourceRecordIds: ['record-3'],
  },
]

const baseBadges: Badge[] = [
  { id: 'first-record', name: '第一帧', description: '留下第一条旅行记录', icon: 'camera', earned: true, progress: 1, target: 1 },
  { id: 'three-moments', name: '拾光者', description: '一次旅行记录 3 个时刻', icon: 'sparkles', earned: true, progress: 3, target: 3 },
  { id: 'story-finisher', name: '故事完成', description: '生成并保存完整故事', icon: 'book', earned: true, progress: 1, target: 1 },
  { id: 'first-export', name: '分享出发', description: '完成第一次导出', icon: 'share', earned: false, progress: 0, target: 1 },
  { id: 'city-explorer', name: '城市漫步', description: '走完一条城市路线', icon: 'map', earned: false, progress: 2, target: 3 },
  { id: 'voice-memory', name: '声音纪念', description: '留下一段旅行原声', icon: 'mic', earned: false, progress: 0, target: 1 },
]

function nowIso() {
  return new Date().toISOString()
}

export function createSampleTrip(): Trip {
  return {
    id: 'trip-hangzhou-sample',
    title: '杭州，不赶时间的这一天',
    city: '杭州',
    date: '10月16日 · 周四',
    status: 'active',
    availableMinutes: 240,
    remainingMinutes: 150,
    interests: ['散步', '拍照', '自然'],
    weather: '多云转晴',
    temperature: '22°C',
    suggestions: structuredClone(sampleSuggestions),
    currentSuggestionId: 'forest-walk',
    routeStops: [
      { id: 'stop-1', suggestionId: 'lake-morning', name: '北山街湖畔', plannedTime: '09:30', status: 'done', transport: '骑行 12 分钟' },
      { id: 'stop-2', suggestionId: 'forest-walk', name: '九溪烟树', plannedTime: '13:40', status: 'current', transport: '打车 18 分钟' },
      { id: 'stop-3', suggestionId: 'tea-break', name: '湖畔茶座', plannedTime: '16:20', status: 'upcoming', transport: '步行 8 分钟' },
    ],
    records: [
      { id: 'record-1', type: 'text', text: '没做攻略，早上只想随便走走。风吹过来的时候，觉得不赶时间真好。', location: '北山街', mood: '松弛', weather: '多云 21°C', recordedAt: '09:42' },
      { id: 'record-2', type: 'image', text: '溪边的光落下来了。在这里停了很久，没有继续找所谓的打卡点。', image: '/assets/forest.jpg', location: '九溪烟树', mood: '治愈', weather: '晴 22°C', recordedAt: '14:18' },
      { id: 'record-3', type: 'image', text: '本来只想坐十分钟，后来不想走了。今天最喜欢的部分，可能就是这段空白。', image: '/assets/lake.jpg', location: '湖畔茶座', mood: '自在', weather: '晴 23°C', recordedAt: '16:47' },
    ],
    storyTitle: '不赶时间，也能走到很远',
    storySections: structuredClone(sampleStory),
    narration: '这次我没有做详细攻略，只是跟着感觉慢慢走。现在回头看，记住的不是去了多少地方，而是溪边的光、湖面的风，和那一段什么都不用着急的时间。',
    badges: structuredClone(baseBadges),
    updatedAt: nowIso(),
  }
}

export function createEmptyTrip(city = '杭州', minutes = 240, interests: string[] = ['散步', '拍照']): Trip {
  const trip = createSampleTrip()
  return {
    ...trip,
    id: `trip-${crypto.randomUUID()}`,
    title: `${city}，慢慢走的一天`,
    city,
    planningMode: 'single',
    date: new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }),
    weather: '',
    temperature: '',
    dataSource: 'fallback',
    status: 'active',
    availableMinutes: minutes,
    remainingMinutes: minutes,
    interests,
    suggestions: [],
    currentSuggestionId: '',
    routeStops: [],
    records: [],
    generatedVideos: [],
    storyTitle: '',
    storySections: [],
    narration: '',
    badges: baseBadges.map((badge) => ({ ...badge, earned: false, progress: 0 })),
    updatedAt: nowIso(),
  }
}

export function createIdleTrip(city = '杭州', minutes = 240, interests: string[] = ['散步', '拍照']): Trip {
  return {
    ...createEmptyTrip(city, minutes, interests),
    status: 'idle',
    suggestions: [],
    currentSuggestionId: '',
    routeStops: [],
    originLocation: undefined,
    dataSource: undefined,
  }
}

export function createInitialState(): PersistedState {
  const trip = createIdleTrip()
  return {
    trip,
    homeSelection: { city: '', province: '', manual: false },
    historyTrips: [],
    toolbarModuleIds: ['home', 'routes', 'records', 'story', 'profile'],
    soundEnabled: true,
    revision: 0,
  }
}

export function getSampleStory() {
  return {
    title: '不赶时间，也能走到很远',
    sections: structuredClone(sampleStory),
    narration: '这次我没有做详细攻略，只是跟着感觉慢慢走。现在回头看，记住的不是去了多少地方，而是溪边的光、湖面的风，和那一段什么都不用着急的时间。',
  }
}
