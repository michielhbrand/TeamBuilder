import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useBoardsStore } from '@/stores/boards'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('@/views/ForgotPasswordView.vue'),
  },
  {
    path: '/set-password',
    name: 'set-password',
    component: () => import('@/views/SetPasswordView.vue'),
  },
  {
    path: '/overview',
    name: 'overview',
    component: () => import('@/views/OverviewView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/boards',
    name: 'boards',
    component: () => import('@/views/BoardsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/boards/:boardId',
    name: 'board',
    component: () => import('@/views/BoardView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/account',
    name: 'account',
    component: () => import('@/views/AccountView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/dashboard',
    redirect: '/account',
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    }
  }

  const isEntryRoute = to.name === 'login' || to.name === 'forgot-password'

  if (isEntryRoute && auth.passwordSetupRequired) {
    return { name: 'set-password' }
  }

  if (isEntryRoute && auth.isAuthenticated) {
    return { name: 'overview' }
  }

  if (to.meta.requiresAuth && auth.isAuthenticated) {
    await useBoardsStore().initialize()
  }

  return true
})

export default router
