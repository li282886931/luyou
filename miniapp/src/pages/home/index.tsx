import React, { useCallback, useEffect, useState } from 'react'
import { Button, Image, Text, View } from '@tarojs/components'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import ActivityCard from '@/components/ActivityCard'
import BrandHeader from '@/components/BrandHeader'
import { getActivities, getPublicStats } from '@/services/api'
import type { Activity, PublicStats, SignupRole } from '@/types/domain'
import styles from './index.module.scss'

const HERO_IMAGE = ''

const HomePage: React.FC = () => {
  const [activity, setActivity] = useState<Activity | null>(null)
  const [stats, setStats] = useState<PublicStats>({ signups: 0, vehicles: 0, seats: 0 })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [activities, currentStats] = await Promise.all([
        getActivities(),
        getPublicStats()
      ])
      setActivity(activities[0] || null)
      setStats(currentStats)
    } catch (error) {
      console.error('[Home] load failed:', error)
      Taro.showToast({ title: '活动加载失败', icon: 'none' })
    } finally {
      setLoading(false)
      Taro.stopPullDownRefresh()
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  usePullDownRefresh(() => {
    void load()
  })

  const openTrip = (id: string) => {
    Taro.navigateTo({ url: `/pages/trip/index?id=${encodeURIComponent(id)}` })
  }

  const openSignup = (role: SignupRole) => {
    Taro.navigateTo({ url: `/pages/signup/index?role=${role}` })
  }

  return (
    <View className={styles.page}>
      <View className={styles.hero}>
        {HERO_IMAGE ? (
          <Image
            className={styles.heroImage}
            src={HERO_IMAGE}
            mode='aspectFill'
            onError={(error: unknown) => console.error('[Home] hero failed:', error)}
          />
        ) : (
          <View className={styles.heroImage} />
        )}
        <View className={styles.heroShade} />
        <View className={styles.heroContent}>
          <BrandHeader light />
          <View className={styles.edition}>EST. 2026 · 北京</View>
          <Text className={styles.title}>因热爱出发，向旷野相逢</Text>
          <Text className={styles.slogan}>互助同行，平安回家。</Text>
          <Text className={styles.intro}>连接愿意提供车辆的车主，与认真对待每一次同行的伙伴。</Text>
          {activity && (
            <Button className={styles.heroButton} onClick={() => openTrip(activity.id)}>
              <Text>查看最新活动</Text>
              <Text>{activity.title} →</Text>
            </Button>
          )}
        </View>
      </View>

      <View className={styles.stats}>
        <View><Text className={styles.statValue}>{stats.signups}</Text><Text>已报名</Text></View>
        <View><Text className={styles.statValue}>{stats.vehicles}</Text><Text>车辆</Text></View>
        <View><Text className={styles.statValue}>{stats.seats}</Text><Text>剩余座位</Text></View>
      </View>

      <View className={styles.content}>
        <View className={styles.sectionHead}>
          <Text className={styles.eyebrow}>UPCOMING JOURNEY</Text>
          <Text className={styles.sectionTitle}>最近活动</Text>
        </View>
        {loading ? (
          <View className={styles.loading}>正在读取活动...</View>
        ) : activity ? (
          <ActivityCard activity={activity} featured onClick={() => openTrip(activity.id)} />
        ) : (
          <View className={styles.loading}>新活动正在筹备中</View>
        )}

        <View className={styles.roleSection}>
          <Text className={styles.eyebrow}>JOIN THE ROAD</Text>
          <Text className={styles.sectionTitle}>选择参与方式</Text>
          <View className={styles.roleGrid}>
            <Button className={styles.ownerButton} onClick={() => openSignup('owner')}>
              <Text className={styles.roleIcon}>车</Text>
              <View><Text className={styles.roleTitle}>我是车主</Text><Text className={styles.roleDesc}>登记车辆与空余座位</Text></View>
            </Button>
            <Button className={styles.riderButton} onClick={() => openSignup('rider')}>
              <Text className={styles.roleIcon}>搭</Text>
              <View><Text className={styles.roleTitle}>我要搭车</Text><Text className={styles.roleDesc}>等待匹配顺路车主</Text></View>
            </Button>
          </View>
        </View>

        <View className={styles.codeSection}>
          <Text className={styles.eyebrow}>CLUB CODE</Text>
          <Text className={styles.sectionTitle}>有方向，也有分寸。</Text>
          {[
            ['01', '安全第一', '拒绝酒驾、疲劳驾驶和竞速飙车。'],
            ['02', '守时守序', '准时集合，服从领航与收尾调度。'],
            ['03', '尊重边界', '文明交友，未经同意不公开个人信息。'],
            ['04', '透明互助', '费用提前说明，遇到困难共同处理。']
          ].map(([no, title, detail]) => (
            <View className={styles.codeItem} key={no}>
              <Text className={styles.codeNo}>{no}</Text>
              <View><Text className={styles.codeTitle}>{title}</Text><Text className={styles.codeDesc}>{detail}</Text></View>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

export default HomePage
