import React from 'react'
import { Input, Text, View } from '@tarojs/components'
import styles from './index.module.scss'

interface SearchBarProps {
  value: string
  placeholder?: string
  onChange: (value: string) => void
}

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  placeholder = '搜索目的地或路线',
  onChange
}) => (
  <View className={styles.search}>
    <View className={styles.icon} aria-hidden='true' />
    <Input
      className={styles.input}
      value={value}
      placeholder={placeholder}
      placeholderClass={styles.placeholder}
      onInput={(event) => onChange(event.detail.value)}
    />
    {value && <Text className={styles.clear} onClick={() => onChange('')}>×</Text>}
  </View>
)

export default SearchBar
