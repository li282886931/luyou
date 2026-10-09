export type SignupRole = 'owner' | 'rider'

export interface MediaAsset {
  fileId?: string
  url: string
  name?: string
  type?: string
}

export interface Activity {
  id: string
  title: string
  nextTitle?: string
  region?: string
  location?: string
  duration?: string
  priceText?: string
  dateText: string
  route: string
  timeline: string
  notice: string
  nextText?: string
  highlights?: string[]
  nextPhotos: MediaAsset[]
  publishedAt?: string
}

export interface PublicStats {
  signups: number
  vehicles: number
  seats: number
}

export interface SignupDraft {
  name: string
  phone: string
  wechat: string
  role: SignupRole
  gender: string
  age: string
  zodiac: string
  work: string
  home: string
  pickup: string
  homeLat?: number
  homeLng?: number
  pickupLat?: number
  pickupLng?: number
  vehicle: string
  licensePlate: string
  seats: number
  note: string
  smoking: string
  acceptsSmoking: string
  roomType: string
  modifications: string[]
  interests: string[]
  depositConfirmed: boolean
}

export interface SignupReceipt {
  id: string
  activityId: string
  status: string
  signupStatus: string
  createdAt: string
  updatedAt: string
  name: string
  role: SignupRole
  gender: string
  age: string
  zodiac: string
  interests: string[]
  work: string
  home: string
  pickup: string
  roomType: string
  vehicle: string
  licensePlate: string
  seats: number
  depositStatus: string
}

export interface MatchParticipant {
  id: string
  name: string
  role: SignupRole
  vehicle?: string
  licensePlate?: string
  pickup?: string
  phone?: string
  wechat?: string
}

export interface MatchResult {
  status: 'pending' | 'waiting' | 'confirmed'
  confirmedAt?: string
  score?: number
  reasons?: string[]
  group?: {
    owner: MatchParticipant | null
    riders: MatchParticipant[]
  }
}

export interface SubscriptionGrant {
  id: string
  templateId: string
  status: 'accept' | 'reject' | 'ban'
  templateVersion: string
  grantedAt?: string
  updatedAt: string
}

export interface NotificationRecord {
  id: string
  type: string
  channel: string
  status: string
  sentAt?: string
  lastError?: string
}
