import Taro from '@tarojs/taro'
import {
  mockBindWechatPhone,
  mockGetActivities,
  mockGetActivity,
  mockGetMyNotifications,
  mockGetMySignups,
  mockGetPublicStats,
  mockGetSignupMatch,
  mockRequestMatchSubscription,
  mockSubmitSignup,
  seedLocalMockDb
} from '@/services/localMock'
import type {
  Activity,
  MatchResult,
  NotificationRecord,
  PublicStats,
  SignupDraft,
  SignupReceipt,
  SubscriptionGrant
} from '@/types/domain'

const CLOUD_API_BASE_URL =
  'https://luyouclub-2026-d5gium2fuf59427be-1487080718.ap-shanghai.app.tcloudbase.com'
const LOCAL_MOCK_ENABLED = true
const SESSION_STORAGE_KEY = 'luyou.wechatSession'
const MATCH_TEMPLATE_ID = ''

interface ApiError {
  message?: string
}

interface SignupResponse {
  ok: boolean
  id: string
  status?: string
  message?: string
}

interface AuthResponse {
  ok: boolean
  token: string
  user: { id: string }
}

interface ActivityResponse extends Omit<Activity, 'timeline' | 'nextPhotos'> {
  timeline: string | string[]
  nextPhotos?: Activity['nextPhotos']
  media?: Activity['nextPhotos']
}

function useLocalMock(): boolean {
  if (!LOCAL_MOCK_ENABLED) return false
  try {
    const account = Taro.getAccountInfoSync()
    const isRelease = account.miniProgram.envVersion === 'release'
    return !isRelease
  } catch {
    return true
  }
}

function storedToken(): string {
  try {
    return Taro.getStorageSync<string>(SESSION_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

async function request<T>(path: string, options: {
  method?: 'GET' | 'POST'
  data?: Record<string, unknown>
  authenticated?: boolean
  retryLogin?: boolean
} = {}): Promise<T> {
  try {
    const token = options.authenticated ? await ensureWechatSession() : ''
    const response = await Taro.request<T>({
      url: `${CLOUD_API_BASE_URL}${path}`,
      method: options.method || 'GET',
      data: options.data,
      header: {
        ...(options.method === 'POST' ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      timeout: 12000
    })
    if (response.statusCode === 401 && options.authenticated && options.retryLogin !== false) {
      Taro.removeStorageSync(SESSION_STORAGE_KEY)
      await ensureWechatSession()
      return request<T>(path, { ...options, retryLogin: false })
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      const error = response.data as ApiError
      throw new Error(error?.message || `请求失败（${response.statusCode}）`)
    }
    return response.data
  } catch (error) {
    console.error('[API] request failed:', { path, error })
    throw error
  }
}

export async function ensureWechatSession(): Promise<string> {
  if (useLocalMock()) {
    seedLocalMockDb()
    return 'local-mock-session'
  }
  const current = storedToken()
  if (current) return current
  const login = await Taro.login()
  if (!login.code) throw new Error('微信登录失败，请重试')
  const auth = await request<AuthResponse>('/api/v1/auth/wechat', {
    method: 'POST',
    data: { code: login.code },
    authenticated: false
  })
  if (!auth.ok || !auth.token) throw new Error('微信登录失败，请重试')
  Taro.setStorageSync(SESSION_STORAGE_KEY, auth.token)
  return auth.token
}

export async function getActivities(): Promise<Activity[]> {
  if (useLocalMock()) return mockGetActivities()
  const activities = await request<ActivityResponse[]>('/api/v1/activities')
  return activities.map(normalizeActivity)
}

export async function getActivity(id: string): Promise<Activity> {
  if (useLocalMock()) return mockGetActivity(id)
  return normalizeActivity(await request<ActivityResponse>(`/api/v1/activities/${encodeURIComponent(id)}`))
}

function normalizeActivity(activity: ActivityResponse): Activity {
  return {
    ...activity,
    timeline: Array.isArray(activity.timeline) ? activity.timeline.join('\n') : activity.timeline,
    nextPhotos: activity.nextPhotos || activity.media || []
  }
}

export async function getPublicStats(): Promise<PublicStats> {
  if (useLocalMock()) return mockGetPublicStats()
  return request<PublicStats>('/api/stats')
}

export async function submitSignup(activityId: string, payload: SignupDraft): Promise<SignupResponse> {
  if (useLocalMock()) return mockSubmitSignup(activityId, payload)
  return request<SignupResponse>(`/api/v1/activities/${encodeURIComponent(activityId)}/signups`, {
    method: 'POST',
    data: payload as unknown as Record<string, unknown>,
    authenticated: true
  })
}

export async function getMySignups(): Promise<SignupReceipt[]> {
  if (useLocalMock()) return mockGetMySignups()
  return request<SignupReceipt[]>('/api/v1/me/signups', { authenticated: true })
}

export async function bindWechatPhone(code: string): Promise<{ ok: boolean; boundSignups: number }> {
  if (useLocalMock()) return mockBindWechatPhone()
  return request('/api/v1/me/phone', {
    method: 'POST',
    authenticated: true,
    data: { code }
  })
}

export async function getSignupMatch(signupId: string): Promise<MatchResult> {
  if (useLocalMock()) return mockGetSignupMatch(signupId)
  return request<MatchResult>(`/api/v1/me/signups/${encodeURIComponent(signupId)}/match`, {
    authenticated: true
  })
}

export async function getMyNotifications(): Promise<NotificationRecord[]> {
  if (useLocalMock()) return mockGetMyNotifications()
  return request<NotificationRecord[]>('/api/v1/me/notifications', { authenticated: true })
}

export async function requestMatchSubscription(): Promise<SubscriptionGrant | null> {
  if (useLocalMock()) return mockRequestMatchSubscription()
  if (!MATCH_TEMPLATE_ID) return null
  const result = await Taro.requestSubscribeMessage({
    tmplIds: [MATCH_TEMPLATE_ID],
    entityIds: []
  })
  const status = result[MATCH_TEMPLATE_ID]
  return request<SubscriptionGrant>('/api/v1/me/subscriptions', {
    method: 'POST',
    authenticated: true,
    data: {
      templateId: MATCH_TEMPLATE_ID,
      templateVersion: 'match-confirmed-v1',
      status
    }
  })
}

export { CLOUD_API_BASE_URL, LOCAL_MOCK_ENABLED }
