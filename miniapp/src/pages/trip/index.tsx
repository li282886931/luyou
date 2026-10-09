import React, { useEffect, useMemo, useState } from 'react'
import { Button, Image, Text, View } from '@tarojs/components'
import Taro, { useRouter, useShareAppMessage } from '@tarojs/taro'
import { getActivity } from '@/services/api'
import type { Activity, SignupRole } from '@/types/domain'
import styles from './index.module.scss'

const DEFAULT_COVER = ''

const TripPage: React.FC = () => {
  const router = useRouter()
  const activityId = router.params.id || 'current'
  const [activity, setActivity] = useState<Activity | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const value = await getActivity(activityId)
        if (active) setActivity(value)
      } catch (error) {
        console.error('[Trip] load failed:', error)
        Taro.showToast({ title: '行程加载失败', icon: 'none' })
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [activityId])

  useShareAppMessage(() => ({
    title: activity?.nextTitle || activity?.title || '鹿友自驾活动',
    path: `/pages/trip/index?id=${encodeURIComponent(activityId)}`
  }))

  const timeline = useMemo(
    () => (activity?.timeline || '').split('\n').filter(Boolean),
    [activity?.timeline]
  )
  const routeStops = useMemo(
    () => (activity?.route || '').split('→').map((item) => item.trim()).filter(Boolean),
    [activity?.route]
  )
  const highlights = activity?.highlights || []

  const signup = (role: SignupRole) => {
    Taro.navigateTo({
      url: `/pages/signup/index?role=${role}&activity=${encodeURIComponent(activityId)}`
    })
  }

  if (loading || !activity) {
    return <View className={styles.loading}>{loading ? '正在读取行程...' : '活动不存在'}</View>
  }

  const cover = activity.nextPhotos.find((item) => item.url)?.url || DEFAULT_COVER

  return (
    <View className={styles.page}>
      <View className={styles.cover}>
        {cover ? (
          <Image
            className={styles.coverImage}
            src={cover}
            mode='aspectFill'
            onError={(error: unknown) => console.error('[Trip] cover failed:', error)}
          />
        ) : (
          <View className={styles.coverImage} />
        )}
        <View className={styles.coverShade} />
        <View className={styles.coverCopy}>
          <Text className={styles.kicker}>DEER CLUB · JOURNEY</Text>
          <Text className={styles.title}>{activity.title}</Text>
          <Text className={styles.date}>{activity.dateText}</Text>
        </View>
      </View>

      <View className={styles.body}>
        <View className={styles.routePanel}>
          <Text className={styles.label}>本次路线</Text>
          <Text className={styles.route}>{activity.route}</Text>
        </View>

        <View className={styles.lead}>
          <Text className={styles.kickerDark}>THE JOURNEY</Text>
          <Text className={styles.heading}>{activity.nextTitle || '一起开向更远的地方'}</Text>
          <Text className={styles.description}>{activity.nextText || '在风景里驾驶，也在同行中认识新的朋友。'}</Text>
        </View>

        <View className={styles.highlights}>
          {highlights.slice(0, 4).map((item, index) => (
            <View className={styles.highlight} key={item}>
              <Text className={styles.highlightNo}>0{index + 1}</Text>
              <Text className={styles.highlightText}>{item}</Text>
            </View>
          ))}
        </View>

        <View className={styles.editorialSection}>
          <View className={styles.sectionHead}>
            <View className={styles.sectionRule} />
            <View>
              <Text className={styles.sectionTitle}>路线简图</Text>
              <Text className={styles.sectionSubtitle}>行程预览 · 精选路线 · 从容驾驶</Text>
            </View>
          </View>
          <View className={styles.routeSketch}>
            {routeStops.map((stop, index) => (
              <View className={styles.routeStop} key={`${stop}-${index}`}>
                <View className={styles.routeNode} />
                <Text>{stop}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className={styles.timeline}>
          <View className={styles.sectionHead}>
            <View className={styles.sectionRule} />
            <View>
              <Text className={styles.sectionTitle}>行动时间线</Text>
              <Text className={styles.sectionSubtitle}>从集合到返程，每一步都有安排</Text>
            </View>
          </View>
          {timeline.map((line, index) => {
            const [time, detail] = line.split('｜')
            return (
              <View className={styles.timelineItem} key={`${line}-${index}`}>
                <View className={styles.dot}>{String(index + 1).padStart(2, '0')}</View>
                <View className={styles.timelineCopy}>
                  <Text className={styles.timelineTime}>{time}</Text>
                  <Text className={styles.timelineDetail}>{detail || '具体安排以组织者通知为准'}</Text>
                </View>
              </View>
            )
          })}
        </View>

        {activity.nextPhotos.length > 1 && (
          <View className={styles.gallery}>
            {activity.nextPhotos.slice(1).map((item, index) => (
              <View className={styles.galleryItem} key={item.fileId || item.url}>
                <Image
                  className={styles.galleryImage}
                  src={item.url}
                  mode='aspectFill'
                  onError={(error: unknown) => console.error('[Trip] gallery failed:', { index, error })}
                />
                <Text className={styles.galleryIndex}>SCENE {String(index + 1).padStart(2, '0')}</Text>
              </View>
            ))}
          </View>
        )}

        <View className={styles.notice}>
          <View className={styles.sectionHead}>
            <View className={styles.sectionRule} />
            <Text className={styles.sectionTitle}>行前须知</Text>
          </View>
          <Text className={styles.noticeText}>{activity.notice}</Text>
        </View>
      </View>

      <View className={styles.actions}>
        <Button className={styles.ownerButton} onClick={() => signup('owner')}>车主报名</Button>
        <Button className={styles.riderButton} onClick={() => signup('rider')}>搭车报名</Button>
      </View>
    </View>
  )
}

export default TripPage
