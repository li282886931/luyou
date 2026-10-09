import React from 'react'
import { Image, Text, View } from '@tarojs/components'
import classNames from 'classnames'
import type { Activity } from '@/types/domain'
import styles from './index.module.scss'

interface ActivityCardProps {
  activity: Activity
  featured?: boolean
  onClick: () => void
}

const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  featured = false,
  onClick
}) => {
  const cover = activity.nextPhotos.find((item) => item.url)?.url

  return (
    <View
      className={classNames(styles.card, featured && styles.featured)}
      hoverClass={styles.pressed}
      onClick={onClick}
    >
      {cover ? (
        <Image
          className={styles.cover}
          src={cover}
          mode='aspectFill'
          onError={(error: unknown) => console.error('[ActivityCard] cover failed:', error)}
        />
      ) : (
        <View className={styles.coverFallback}>鹿友</View>
      )}
      <View className={styles.content}>
        <Text className={styles.region}>{activity.region || '自驾路线'}</Text>
        <Text className={styles.title}>{activity.nextTitle || activity.title}</Text>
        <Text className={styles.meta}>{activity.location || activity.route}</Text>
        <Text className={styles.date}>{activity.dateText || activity.duration || '日期待定'}</Text>
        <Text className={styles.price}>{activity.priceText || '费用以活动通知为准'}</Text>
      </View>
      <View className={styles.arrow}>↗</View>
    </View>
  )
}

export default ActivityCard
