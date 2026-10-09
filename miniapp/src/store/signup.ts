import Taro from '@tarojs/taro'
import type { SignupReceipt } from '@/types/domain'

const STORAGE_KEY = 'luyou.latestSignup'

export function saveSignup(receipt: SignupReceipt): void {
  Taro.setStorageSync(STORAGE_KEY, receipt)
}

export function loadSignup(): SignupReceipt | null {
  try {
    const value = Taro.getStorageSync<SignupReceipt | null>(STORAGE_KEY)
    return value || null
  } catch (error) {
    console.error('[SignupStore] load failed:', error)
    return null
  }
}
