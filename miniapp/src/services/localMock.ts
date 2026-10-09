import Taro from '@tarojs/taro'
import type {
  Activity,
  MatchResult,
  NotificationRecord,
  PublicStats,
  SignupDraft,
  SignupReceipt,
  SubscriptionGrant
} from '@/types/domain'

const SIGNUPS_KEY = 'luyou.mock.signups'
const ACTIVITIES_KEY = 'luyou.mock.activities'
const DB_VERSION_KEY = 'luyou.mock.dbVersion'
const MOCK_DB_VERSION = '2026-10-09-v1'

const seedActivities: Activity[] = [
  {
    id: 'mock-zhangbei-2026',
    title: '张北草原 · 风起天路',
    nextTitle: '草原天路周末自驾招募',
    region: '河北',
    location: '张北 · 草原天路',
    duration: '2天1夜',
    priceText: 'AA 费用 · 定金 200',
    dateText: '07.17-07.20 · 2天3夜',
    route: '北京 → 野狐岭 → 中都草原 → 桦皮岭 → 北京',
    timeline: [
      '周五 19:30｜北京清河集合',
      '周五 20:00｜车队统一出发',
      '周六 08:30｜野狐岭进入草原天路',
      '周日 16:30｜返程回京'
    ].join('\n'),
    notice: '车辆出发前完成检查；服从领航与收尾调度；天气变化时以组织者最新通知为准。',
    nextText: '穿过草原公路、风车山脊和落日营地，适合第一次参加鹿友活动的新朋友。',
    highlights: ['草原日落', '轻越野路段', '车友社交', '摄影停靠点'],
    nextPhotos: [],
    publishedAt: '2026-10-09T00:00:00.000Z'
  },
  {
    id: 'mock-gubeikou-2026',
    title: '古北口长城 · 秋色慢行',
    nextTitle: '北京近郊一日自驾',
    region: '河北',
    location: '密云 · 古北口',
    duration: '1天',
    priceText: 'AA 费用',
    dateText: '10.26 · 周六',
    route: '北京 → 密云水库 → 古北口 → 北京',
    timeline: [
      '周六 08:30｜望京集合',
      '周六 10:30｜抵达古北口',
      '周六 14:00｜山谷咖啡休整',
      '周六 17:30｜返程'
    ].join('\n'),
    notice: '一日活动不安排住宿；请自备饮用水、防晒和轻便外套。',
    nextText: '低强度、短距离、适合新成员熟悉车队节奏。',
    highlights: ['近郊路线', '长城秋色', '轻量徒步', '新手友好'],
    nextPhotos: [],
    publishedAt: '2026-10-08T00:00:00.000Z'
  }
]

export function seedLocalMockDb() {
  try {
    const version = Taro.getStorageSync<string>(DB_VERSION_KEY)
    const storedActivities = Taro.getStorageSync<Activity[]>(ACTIVITIES_KEY)
    if (version === MOCK_DB_VERSION && Array.isArray(storedActivities) && storedActivities.length) return
    Taro.setStorageSync(ACTIVITIES_KEY, seedActivities)
    Taro.setStorageSync(DB_VERSION_KEY, MOCK_DB_VERSION)
    const existingSignups = Taro.getStorageSync<SignupReceipt[]>(SIGNUPS_KEY)
    if (!Array.isArray(existingSignups)) Taro.setStorageSync(SIGNUPS_KEY, [])
  } catch {
    Taro.setStorageSync(ACTIVITIES_KEY, seedActivities)
    Taro.setStorageSync(DB_VERSION_KEY, MOCK_DB_VERSION)
  }
}

function now() {
  return new Date().toISOString()
}

function loadActivities(): Activity[] {
  seedLocalMockDb()
  try {
    const rows = Taro.getStorageSync<Activity[]>(ACTIVITIES_KEY)
    return Array.isArray(rows) && rows.length ? rows : seedActivities
  } catch {
    return seedActivities
  }
}

function loadSignups(): SignupReceipt[] {
  seedLocalMockDb()
  try {
    const rows = Taro.getStorageSync<SignupReceipt[]>(SIGNUPS_KEY)
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

function saveSignups(rows: SignupReceipt[]) {
  Taro.setStorageSync(SIGNUPS_KEY, rows)
}

export function mockGetActivities(): Promise<Activity[]> {
  return Promise.resolve(loadActivities())
}

export function mockGetActivity(id: string): Promise<Activity> {
  const activities = loadActivities()
  return Promise.resolve(activities.find((item) => item.id === id) || activities[0])
}

export function mockGetPublicStats(): Promise<PublicStats> {
  const signups = loadSignups()
  const owners = signups.filter((item) => item.role === 'owner')
  return Promise.resolve({
    signups: Math.max(18, signups.length),
    vehicles: Math.max(6, owners.length),
    seats: Math.max(9, owners.reduce((sum, item) => sum + item.seats, 0))
  })
}

export function mockSubmitSignup(activityId: string, payload: SignupDraft) {
  const rows = loadSignups()
  const createdAt = now()
  const existing = rows.find((item) => item.activityId === activityId && item.name === payload.name)
  const receipt: SignupReceipt = {
    id: existing?.id || `mock-signup-${Date.now()}`,
    activityId,
    status: '待匹配',
    signupStatus: '已报名',
    createdAt: existing?.createdAt || createdAt,
    updatedAt: createdAt,
    name: payload.name,
    role: payload.role,
    gender: payload.gender,
    age: payload.age,
    zodiac: payload.zodiac === '请选择' ? '' : payload.zodiac,
    interests: payload.interests,
    work: payload.work,
    home: payload.home,
    pickup: payload.pickup,
    roomType: payload.roomType,
    vehicle: payload.vehicle,
    licensePlate: payload.licensePlate,
    seats: payload.role === 'owner' ? payload.seats : 0,
    depositStatus: payload.depositConfirmed ? '待核验' : '待支付'
  }
  saveSignups([receipt, ...rows.filter((item) => item.id !== receipt.id)])
  return Promise.resolve({ ok: true, id: receipt.id, status: receipt.status })
}

export function mockGetMySignups(): Promise<SignupReceipt[]> {
  return Promise.resolve(loadSignups())
}

export function mockBindWechatPhone(): Promise<{ ok: boolean; boundSignups: number }> {
  return Promise.resolve({ ok: true, boundSignups: loadSignups().length })
}

export function mockGetSignupMatch(signupId: string): Promise<MatchResult> {
  const signup = loadSignups().find((item) => item.id === signupId)
  if (!signup) return Promise.resolve({ status: 'pending' })
  return Promise.resolve({
    status: 'confirmed',
    confirmedAt: now(),
    score: 86,
    reasons: ['集合点相距 3.2 公里', '住宿需求一致', '兴趣标签相近'],
    group: {
      owner: signup.role === 'owner'
        ? { id: signup.id, name: signup.name, role: 'owner', vehicle: signup.vehicle, licensePlate: signup.licensePlate, pickup: signup.pickup }
        : { id: 'mock-owner-1', name: '鹿友领航员', role: 'owner', vehicle: '坦克300 · 黑色', licensePlate: '京A12345', pickup: signup.pickup || '望京站' },
      riders: signup.role === 'rider'
        ? [{ id: signup.id, name: signup.name, role: 'rider', pickup: signup.pickup }]
        : [{ id: 'mock-rider-1', name: '同行伙伴', role: 'rider', pickup: signup.pickup || '望京站' }]
    }
  })
}

export function mockGetMyNotifications(): Promise<NotificationRecord[]> {
  return Promise.resolve([
    {
      id: 'mock-notification-1',
      type: 'match_confirmed',
      channel: 'mock',
      status: 'sent',
      sentAt: now()
    }
  ])
}

export function mockRequestMatchSubscription(): Promise<SubscriptionGrant | null> {
  return Promise.resolve({
    id: 'mock-subscription-1',
    templateId: 'mock-match-template',
    status: 'accept',
    templateVersion: 'local-mock',
    grantedAt: now(),
    updatedAt: now()
  })
}
