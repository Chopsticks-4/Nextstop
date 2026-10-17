export interface CommunityStory {
  id: string
  author: string
  avatar: string
  avatarColor: string
  place: string
  title: string
  excerpt: string
  body: string
  image: string
  likes: number
  comments: string[]
  city: string
  influence: number
  ownerId?: string
  tripId?: string
  publishedAt?: string
}

const sampleStories: Omit<CommunityStory, 'city' | 'influence'>[] = [
  { id: 'bund', author: '阿沐', avatar: '👩🏻', avatarColor: '#f5ddcf', place: '外滩', title: '把黄昏留给外滩', excerpt: '沿着江边慢慢走，等对岸的灯一盏盏亮起来。', body: '下午来到外滩时，江边的风刚好。没有急着拍照，我先沿着步道走了一小段。天色慢慢变暗，对岸的楼开始亮灯，旁边的人也不约而同停下了脚步。那一刻，上海好像把热闹和安静都留给了我。', image: '/assets/shanghai-bund.jpg', likes: 128, comments: ['晚上的外滩真的很美！', '想照着这条路线走一遍。'] },
  { id: 'yuyuan', author: '小岛同学', avatar: '🧑🏻', avatarColor: '#d8e7d9', place: '豫园', title: '在豫园，转进一条热闹的小路', excerpt: '抬头看屋檐，低头尝点心，热闹也有自己的节奏。', body: '豫园比我想象中热闹。我跟着人群慢慢走，看到屋檐的线条和灯笼，就忍不住停下来拍一张。后来找了个角落吃点心，听身边的人聊天，才觉得旅行不一定要避开喧闹。', image: '/assets/shanghai-yuyuan.jpg', likes: 96, comments: ['这张照片好有氛围。'] },
  { id: 'wukang', author: '林间风', avatar: '👩🏽', avatarColor: '#eadfd2', place: '武康路', title: '武康路的树影，值得走慢一点', excerpt: '挑一个晴天，沿街看老房子和树影，不赶下一站。', body: '从地铁出来，我把导航收起来，沿着武康路一直走。路边的梧桐把阳光切成一小块一小块，老建筑的窗也很好看。走累了就在附近坐下，给这个下午留一点空白。', image: '/assets/road.jpg', likes: 84, comments: ['很喜欢这样的慢行程。'] },
  { id: 'suzhou-creek', author: '阿杰在路上', avatar: '👨🏻', avatarColor: '#dbe6ef', place: '苏州河', title: '沿苏州河散步到天黑', excerpt: '桥、河水和城市的灯光，组成了一条不用赶路的路线。', body: '傍晚从河边出发，经过几座桥。水面上的倒影比想象中更漂亮，路上也有不少出来散步的人。我没有设终点，觉得合适就停下来看一会儿。', image: '/assets/lake.jpg', likes: 71, comments: ['周末也想去试试。'] },
  { id: 'north-bund', author: '橘子汽水', avatar: '👩🏻‍🦰', avatarColor: '#f2dfce', place: '北外滩', title: '北外滩的风，刚好吹走疲惫', excerpt: '坐在江边看船经过，给忙碌的一周画一个逗号。', body: '那天没有特别的安排，只想去江边待一会儿。到了北外滩，我坐在长椅上看船慢慢经过。城市的轮廓就在对面，风吹过来，整个人也跟着慢了下来。', image: '/assets/shanghai-bund.jpg', likes: 109, comments: ['这里看夜景也很棒。'] },
  { id: 'century-park', author: '一颗栗子', avatar: '🧑🏽‍🦱', avatarColor: '#dce8d3', place: '世纪公园', title: '在世纪公园散步的半天', excerpt: '带一杯咖啡去看树和湖，就够了。', body: '我在世纪公园走了半天，喜欢的不是某个特定景点，而是树荫、湖边和一路上缓慢的节奏。坐下来喝完咖啡，再继续走，时间过得刚刚好。', image: '/assets/forest.jpg', likes: 63, comments: ['适合带上朋友一起去。'] },
  { id: 'tianzifang', author: '慢慢小姐', avatar: '👩🏻', avatarColor: '#ecd9e4', place: '田子坊', title: '田子坊的转角，总有新发现', excerpt: '小店和窄巷连在一起，适合随意逛逛。', body: '田子坊的巷子不长，却总能让我转进新的角落。看看小店，挑一张明信片，再从另一条小路走出去。这次没做攻略，反而发现了自己喜欢的上海。', image: '/assets/road.jpg', likes: 58, comments: ['明信片那家店是哪家？'] },
  { id: 'gongqing', author: '南风', avatar: '👨🏽', avatarColor: '#dae6e0', place: '共青森林公园', title: '去共青森林公园吸一口新鲜空气', excerpt: '在树林里走一走，让周末真的像周末。', body: '一进公园，就能闻到草木的气味。沿着小路慢慢走，看见有人野餐，也有人在树下读书。我找了一块安静的地方坐着，什么都不用安排。', image: '/assets/forest.jpg', likes: 77, comments: ['秋天去应该也很好看。'] },
]

export const communityStories: CommunityStory[] = sampleStories.map((story, index) => ({
  ...story, city: '上海', influence: [42, 31, 27, 19, 36, 16, 14, 23][index] || 0,
}))
