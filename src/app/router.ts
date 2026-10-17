import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/home' },
    { path: '/home', name: 'home', component: () => import('../modules/home/HomePage.vue') },
    { path: '/records', name: 'records', component: () => import('../modules/records/RecordsPage.vue') },
    { path: '/route', name: 'routes', component: () => import('../modules/routes/RoutesPage.vue') },
    { path: '/inspiration', name: 'inspiration', component: () => import('../modules/inspiration/InspirationPage.vue') },
    { path: '/story', name: 'story', component: () => import('../modules/story/StoryHub.vue') },
    { path: '/story/edit', name: 'story-edit', component: () => import('../modules/story/StoryPage.vue') },
    { path: '/community', name: 'community', component: () => import('../modules/story/CommunityPage.vue') },
    { path: '/community-impact', name: 'community-impact', component: () => import('../modules/profile/CommunityImpactPage.vue') },
    { path: '/export', name: 'exports', component: () => import('../modules/exports/ExportsPage.vue') },
    { path: '/achievements', name: 'achievements', component: () => import('../modules/achievements/AchievementsPage.vue') },
    { path: '/history', name: 'history', component: () => import('../modules/history/HistoryPage.vue') },
    { path: '/gallery', name: 'gallery', component: () => import('../modules/gallery/GalleryPage.vue') },
    { path: '/profile', name: 'profile', component: () => import('../modules/profile/ProfilePage.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/home' },
  ],
})
