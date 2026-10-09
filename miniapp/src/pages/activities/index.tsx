import React, { useCallback, useEffect, useState } from 'react'
import { ScrollView, Text, View } from '@tarojs/components'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import classNames from 'classnames'
import ActivityCard from '@/components/ActivityCard'
import SearchBar from '@/components/SearchBar'
import { getActivities } from '@/services/api'
import type { Activity } from '@/types/domain'
import styles from './index.module.scss'

const REGIONS = ['全部', '河北', '福建', '云南', '四川', '贵州']

const ActivitiesPage: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [region, setRegion] = useState('全部')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setActivities(await getActivities())
    } catch (error) {
      console.error('[Activities] load failed:', error)
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

  const filtered = activities.filter((activity) => {
    const matchesRegion = region === '全部' || activity.region === region
    const text = [
      activity.title,
      activity.nextTitle,
      activity.location,
      activity.route
    ].filter(Boolean).join(' ').toLowerCase()
    return matchesRegion && text.includes(keyword.trim().toLowerCase())
  })

  return (
    <View className={styles.page}>
      <View className={styles.heading}>
        <Text className={styles.title}>目的地</Text>
        <Text className={styles.subtitle}>从一条好路线，开始一次认真同行</Text>
      </View>

      <SearchBar value={keyword} onChange={setKeyword} />

      <ScrollView className={styles.regions} scrollX enhanced showScrollbar={false}>
        <View className={styles.regionTrack}>
          {REGIONS.map((item) => (
            <View
              className={classNames(styles.region, region === item && styles.regionActive)}
              key={item}
              onClick={() => setRegion(item)}
            >
              <Text>{item}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View className={styles.sectionHeading}>
        <View className={styles.rule} />
        <Text>{region === '全部' ? '近期路线' : `${region}路线`}</Text>
        <Text className={styles.count}>{filtered.length} 条</Text>
      </View>

      <View className={styles.list}>
        {loading ? (
          <View className={styles.state}>正在读取活动...</View>
        ) : filtered.length ? (
          filtered.map((activity) => (
            <ActivityCard
              activity={activity}
              key={activity.id}
              onClick={() => Taro.navigateTo({
                url: `/pages/trip/index?id=${encodeURIComponent(activity.id)}`
              })}
            />
          ))
        ) : (
          <View className={styles.state}>暂时没有符合条件的路线</View>
        )}
      </View>
    </View>
  )
}

export default ActivitiesPage
