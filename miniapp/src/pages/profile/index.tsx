import React, { useState } from 'react'
import { Button, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import BrandHeader from '@/components/BrandHeader'
import { bindWechatPhone, getMyNotifications, getMySignups, getSignupMatch } from '@/services/api'
import type { MatchResult, NotificationRecord, SignupReceipt } from '@/types/domain'
import styles from './index.module.scss'

const ProfilePage: React.FC = () => {
  const [signup, setSignup] = useState<SignupReceipt | null>(null)
  const [match, setMatch] = useState<MatchResult | null>(null)
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useDidShow(() => {
    const refresh = async () => {
      setLoading(true)
      setError('')
      try {
        const signups = await getMySignups()
        const latest = signups[0] || null
        setSignup(latest)
        if (latest) {
          const [matchResult, notificationList] = await Promise.all([
            getSignupMatch(latest.id),
            getMyNotifications()
          ])
          setMatch(matchResult)
          setNotifications(notificationList)
        } else {
          setMatch(null)
          setNotifications([])
        }
      } catch (requestError) {
        console.error('[Profile] load failed:', requestError)
        setError(requestError instanceof Error ? requestError.message : '加载失败，请稍后重试')
      } finally {
        setLoading(false)
      }
    }
    void refresh()
  })

  const bindPhone = async (code?: string) => {
    if (!code) {
      Taro.showToast({ title: '未获得手机号授权', icon: 'none' })
      return
    }
    try {
      const result = await bindWechatPhone(code)
      const signups = await getMySignups()
      setSignup(signups[0] || null)
      Taro.showToast({
        title: result.boundSignups ? '已同步既有报名' : '手机号已绑定',
        icon: 'success'
      })
    } catch (bindError) {
      Taro.showToast({
        title: bindError instanceof Error ? bindError.message : '手机号绑定失败',
        icon: 'none'
      })
    }
  }

  if (loading) {
    return <View className={styles.page}><BrandHeader eyebrow='MY JOURNEY' /><View className={styles.empty}><Text className={styles.emptyTitle}>正在读取云端报名</Text></View></View>
  }

  if (!signup) {
    return (
      <View className={styles.page}>
        <BrandHeader eyebrow='MY JOURNEY' />
        <View className={styles.empty}>
          <View className={styles.emptyMark}>鹿</View>
          <Text className={styles.emptyTitle}>{error || '还没有报名记录'}</Text>
          <Text className={styles.emptyDesc}>选择一场活动，登记同行方式后可在这里查看云端状态。</Text>
          <Button
            className={styles.primaryButton}
            openType='getPhoneNumber'
            onGetPhoneNumber={(event) => void bindPhone(event.detail.code)}
          >
            同步手机号报名
          </Button>
          <Button
            className={styles.secondaryButton}
            onClick={() => Taro.switchTab({ url: '/pages/activities/index' })}
          >
            浏览活动
          </Button>
        </View>
      </View>
    )
  }

  const owner = signup.role === 'owner'
  const confirmed = match?.status === 'confirmed'
  const notification = notifications.find((item) => item.type === 'match_confirmed')
  const matchStatus = confirmed ? '车组已确认' : match?.status === 'waiting' ? '等待空余座位' : '等待组织者确认'

  return (
    <View className={styles.page}>
      <BrandHeader eyebrow='MY JOURNEY' />
      <View className={styles.profileCard}>
        <View className={styles.avatar}>{signup.name.slice(0, 1)}</View>
        <View className={styles.person}>
          <Text className={styles.role}>{owner ? '车主' : '搭车伙伴'}</Text>
          <Text className={styles.name}>{signup.name}</Text>
          <Text className={styles.meta}>{signup.zodiac || '星座未填'} · {signup.interests.join(' / ') || '兴趣待补充'}</Text>
        </View>
        <Text className={styles.status}>{signup.status}</Text>
      </View>

      <View className={styles.matchPanel}>
        <View className={styles.matchHeader}>
          <Text>匹配进度</Text>
          <Text className={styles.pending}>{matchStatus}</Text>
        </View>
        <Text className={styles.matchTitle}>{confirmed ? `${match?.group?.owner?.name || '车主'}的车组` : '报名资料已进入匹配队列'}</Text>
        <Text className={styles.matchDesc}>
          {confirmed
            ? `${match?.group?.owner?.vehicle || '车辆待补充'} · ${match?.group?.owner?.pickup || '集合地点待确认'}`
            : '组织者确认真实车组后，可在这里查看集合与已授权的联系信息。'}
        </Text>
        {confirmed && match?.reasons?.length ? <Text className={styles.matchDesc}>匹配说明：{match.reasons.join('、')}</Text> : null}
        {notification ? <Text className={styles.matchDesc}>订阅通知：{notification.status === 'sent' ? '已发送' : notification.status === 'failed' ? '发送失败' : '待发送'}</Text> : null}
      </View>

      <View className={styles.detailPanel}>
        <Text className={styles.panelTitle}>报名资料</Text>
        <View className={styles.detailRow}><Text>参与身份</Text><Text>{owner ? '车主' : '搭车'}</Text></View>
        <View className={styles.detailRow}><Text>上班地点</Text><Text>{signup.work}</Text></View>
        <View className={styles.detailRow}><Text>住宿地点</Text><Text>{signup.home}</Text></View>
        <View className={styles.detailRow}><Text>集合地点</Text><Text>{signup.pickup || '待协商'}</Text></View>
        <View className={styles.detailRow}><Text>住宿需求</Text><Text>{signup.roomType}</Text></View>
        {owner && (
          <View className={styles.detailRow}><Text>车辆</Text><Text>{signup.vehicle} · {signup.seats} 座</Text></View>
        )}
      </View>

      <Button
        className={styles.secondaryButton}
        onClick={() => Taro.navigateTo({ url: `/pages/signup/index?role=${signup.role}&activity=${encodeURIComponent(signup.activityId)}` })}
      >
        重新填写报名资料
      </Button>
    </View>
  )
}

export default ProfilePage
