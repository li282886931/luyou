import React from 'react'
import { Text, View } from '@tarojs/components'
import classNames from 'classnames'
import styles from './index.module.scss'

interface BrandHeaderProps {
  eyebrow?: string
  light?: boolean
}

const BrandHeader: React.FC<BrandHeaderProps> = ({
  eyebrow = 'WILD DRIVE · TRUE FRIENDS',
  light = false
}) => (
  <View className={classNames(styles.header, light && styles.light)}>
    <View className={styles.mark}>鹿</View>
    <View className={styles.copy}>
      <Text className={styles.name}>鹿友自驾俱乐部</Text>
      <Text className={styles.eyebrow}>{eyebrow}</Text>
    </View>
  </View>
)

export default BrandHeader
