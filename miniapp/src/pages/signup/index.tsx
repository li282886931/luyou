import React, { useMemo, useState } from 'react'
import { Button, Image, Input, Picker, Switch, Text, Textarea, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import classNames from 'classnames'
import { requestMatchSubscription, submitSignup } from '@/services/api'
import type { SignupDraft, SignupRole } from '@/types/domain'
import styles from './index.module.scss'

const INTERESTS = ['露营', '摄影', '徒步', '美食', '音乐', '桌游', '宠物', '电影', '旅行', '健身']
const MODIFICATIONS = ['轮胎', '减震', '绞盘']
const GENDERS = ['男', '女', '不便透露']
const AGES = ['25-30', '31-35', '36-40', '40+']
const ZODIACS = ['请选择', '白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座']
const ROOM_TYPES = ['单间', '标间']
const DEPOSIT_QR = ''

const emptyDraft = (role: SignupRole): SignupDraft => ({
  name: '',
  phone: '',
  wechat: '',
  role,
  gender: '男',
  age: '25-30',
  zodiac: '请选择',
  work: '',
  home: '',
  pickup: '',
  vehicle: '',
  licensePlate: '',
  seats: 1,
  note: '',
  smoking: '不吸烟',
  acceptsSmoking: '不接受',
  roomType: '单间',
  modifications: [],
  interests: [],
  depositConfirmed: false
})

const SignupPage: React.FC = () => {
  const router = useRouter()
  const role: SignupRole = router.params.role === 'owner' ? 'owner' : 'rider'
  const activityId = router.params.activity || 'current'
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [draft, setDraft] = useState<SignupDraft>(() => emptyDraft(role))

  const title = role === 'owner' ? '车主报名' : '搭车报名'
  const progress = `${Math.round((step / 3) * 100)}%`
  const canContinue = useMemo(() => {
    if (step === 1) return Boolean(draft.name.trim() && draft.phone.trim() && draft.wechat.trim())
    if (step === 2) return Boolean(draft.work.trim() && draft.home.trim())
    return draft.depositConfirmed && (role === 'rider' || Boolean(draft.vehicle.trim() && draft.licensePlate.trim()))
  }, [draft, role, step])

  const update = <K extends keyof SignupDraft>(key: K, value: SignupDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const toggleList = (key: 'interests' | 'modifications', value: string, limit = 99) => {
    const current = draft[key]
    if (current.includes(value)) {
      update(key, current.filter((item) => item !== value))
      return
    }
    if (current.length >= limit) {
      Taro.showToast({ title: `最多选择 ${limit} 项`, icon: 'none' })
      return
    }
    update(key, [...current, value])
  }

  const next = () => {
    if (!canContinue) {
      Taro.showToast({ title: '请完成本页必填信息', icon: 'none' })
      return
    }
    setStep((current) => Math.min(3, current + 1))
  }

  const choosePickup = async () => {
    try {
      const location = await Taro.chooseLocation({})
      setDraft((current) => ({
        ...current,
        pickup: location.name || location.address || current.pickup,
        pickupLat: location.latitude,
        pickupLng: location.longitude
      }))
    } catch (error) {
      console.info('[Signup] location not selected:', error)
    }
  }

  const submit = async () => {
    if (!canContinue || submitting) {
      Taro.showToast({ title: '请完成必填信息并确认定金', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      try {
        await requestMatchSubscription()
      } catch (error) {
        console.info('[Signup] subscription not granted:', error)
      }
      const result = await submitSignup(activityId, draft)
      if (!result.ok) throw new Error(result.message || '提交失败')
      console.info('[Signup] submitted:', { id: result.id, role })
      Taro.showToast({ title: '报名成功', icon: 'success' })
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/profile/index' })
      }, 500)
    } catch (error) {
      console.error('[Signup] submit failed:', error)
      Taro.showToast({
        title: error instanceof Error ? error.message : '提交失败，请稍后重试',
        icon: 'none'
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className={styles.page}>
      <View className={styles.heading}>
        <View>
          <Text className={styles.kicker}>JOIN THE JOURNEY</Text>
          <Text className={styles.title}>{title}</Text>
          <Text className={styles.subtitle}>资料仅用于本次活动组织与匹配</Text>
        </View>
        <Text className={styles.step}>{step} / 3</Text>
      </View>
      <View className={styles.progress}><View style={{ width: progress }} /></View>

      {step === 1 && (
        <View className={styles.section}>
          <Text className={styles.sectionNo}>01 · 基本资料</Text>
          <Text className={styles.sectionTitle}>先认识一下你</Text>
          <Text className={styles.label}>姓名 / 昵称</Text>
          <Input className={styles.input} value={draft.name} placeholder='怎么称呼你' onInput={(event) => update('name', event.detail.value)} />
          <Text className={styles.label}>手机号</Text>
          <Input className={styles.input} value={draft.phone} type='number' maxlength={11} placeholder='用于活动联络' onInput={(event) => update('phone', event.detail.value)} />
          <Text className={styles.label}>微信号</Text>
          <Input className={styles.input} value={draft.wechat} placeholder='用于匹配后联系' onInput={(event) => update('wechat', event.detail.value)} />
          <View className={styles.twoColumns}>
            <Picker mode='selector' range={GENDERS} onChange={(event) => update('gender', GENDERS[Number(event.detail.value)])}>
              <View><Text className={styles.label}>性别</Text><View className={styles.picker}>{draft.gender}<Text>⌄</Text></View></View>
            </Picker>
            <Picker mode='selector' range={AGES} onChange={(event) => update('age', AGES[Number(event.detail.value)])}>
              <View><Text className={styles.label}>年龄段</Text><View className={styles.picker}>{draft.age}<Text>⌄</Text></View></View>
            </Picker>
          </View>
          <Picker mode='selector' range={ZODIACS} onChange={(event) => update('zodiac', ZODIACS[Number(event.detail.value)])}>
            <View><Text className={styles.label}>星座</Text><View className={styles.picker}>{draft.zodiac}<Text>⌄</Text></View></View>
          </Picker>
        </View>
      )}

      {step === 2 && (
        <View className={styles.section}>
          <Text className={styles.sectionNo}>02 · 日常坐标</Text>
          <Text className={styles.sectionTitle}>规划合理接送路线</Text>
          <Text className={styles.label}>上班地点</Text>
          <Input className={styles.input} value={draft.work} placeholder='例：海淀区中关村' onInput={(event) => update('work', event.detail.value)} />
          <Text className={styles.label}>住宿地点</Text>
          <Input className={styles.input} value={draft.home} placeholder='例：朝阳区望京附近' onInput={(event) => update('home', event.detail.value)} />
          <Text className={styles.label}>方便集合的地点</Text>
          <Input className={styles.input} value={draft.pickup} placeholder='例：地铁8号线永泰庄站' onInput={(event) => update('pickup', event.detail.value)} />
          <Button className={styles.locationButton} onClick={() => void choosePickup()}>从地图选择集合点</Button>
          <View className={styles.privacy}>具体地点仅组织者可见，匹配后只展示约定集合点。</View>
        </View>
      )}

      {step === 3 && (
        <View className={styles.section}>
          <Text className={styles.sectionNo}>03 · 同行偏好</Text>
          <Text className={styles.sectionTitle}>找到同频伙伴</Text>
          <Text className={styles.label}>兴趣标签（最多 5 项）</Text>
          <View className={styles.chips}>
            {INTERESTS.map((item) => (
              <Button
                className={classNames(styles.chip, draft.interests.includes(item) && styles.chipActive)}
                key={item}
                onClick={() => toggleList('interests', item, 5)}
              >
                {item}
              </Button>
            ))}
          </View>

          <View className={styles.optionRow}>
            <Text>你是否吸烟</Text>
            <Switch color='#E98928' checked={draft.smoking === '吸烟'} onChange={(event) => update('smoking', event.detail.value ? '吸烟' : '不吸烟')} />
          </View>
          <View className={styles.optionRow}>
            <Text>接受同行者吸烟</Text>
            <Switch color='#E98928' checked={draft.acceptsSmoking === '接受'} onChange={(event) => update('acceptsSmoking', event.detail.value ? '接受' : '不接受')} />
          </View>
          <Picker mode='selector' range={ROOM_TYPES} onChange={(event) => update('roomType', ROOM_TYPES[Number(event.detail.value)])}>
            <View><Text className={styles.label}>住宿需求</Text><View className={styles.picker}>{draft.roomType}<Text>⌄</Text></View></View>
          </Picker>

          {role === 'owner' && (
            <View className={styles.ownerFields}>
              <Text className={styles.label}>车辆与颜色</Text>
              <Input className={styles.input} value={draft.vehicle} placeholder='例：坦克300 · 黑色' onInput={(event) => update('vehicle', event.detail.value)} />
              <Text className={styles.label}>完整车牌号</Text>
              <Input className={styles.input} value={draft.licensePlate} placeholder='例：京A12345' onInput={(event) => update('licensePlate', event.detail.value)} />
              <Picker mode='selector' range={[1, 2, 3, 4]} onChange={(event) => update('seats', Number(event.detail.value) + 1)}>
                <View><Text className={styles.label}>可提供座位</Text><View className={styles.picker}>{draft.seats} 座<Text>⌄</Text></View></View>
              </Picker>
              <Text className={styles.label}>车辆改装（可多选）</Text>
              <View className={styles.chips}>
                {MODIFICATIONS.map((item) => (
                  <Button
                    className={classNames(styles.chip, draft.modifications.includes(item) && styles.chipActive)}
                    key={item}
                    onClick={() => toggleList('modifications', item)}
                  >
                    {item}
                  </Button>
                ))}
              </View>
            </View>
          )}

          <Text className={styles.label}>个人需求与备注</Text>
          <Textarea className={styles.textarea} value={draft.note} maxlength={500} placeholder='饮食、接送、作息或其他需求' onInput={(event) => update('note', event.detail.value)} />

          <View className={styles.deposit}>
            <View className={styles.depositHead}><Text>报名定金</Text><Text>¥200</Text></View>
            <Text className={styles.depositDesc}>请使用微信扫码付款，并备注“姓名＋手机号后4位”。</Text>
            {DEPOSIT_QR ? (
              <Image className={styles.qr} src={DEPOSIT_QR} mode='aspectFit' onError={(error: unknown) => console.error('[Signup] QR failed:', error)} />
            ) : (
              <View className={styles.qr}><Text>本地调试</Text></View>
            )}
            <View className={styles.refund}><Text>退款规则</Text><Text>活动开始前超过1天可申请退款；1天以内取消，定金不予退还。</Text></View>
            <View className={styles.confirmRow}>
              <Switch color='#E98928' checked={draft.depositConfirmed} onChange={(event) => update('depositConfirmed', event.detail.value)} />
              <Text>我已支付200元定金，并同意退款规则</Text>
            </View>
          </View>
        </View>
      )}

      <View className={styles.actions}>
        {step > 1 && <Button className={styles.backButton} onClick={() => setStep((current) => current - 1)}>上一步</Button>}
        {step < 3 ? (
          <Button className={styles.nextButton} onClick={next}>继续</Button>
        ) : (
          <Button className={styles.nextButton} loading={submitting} onClick={() => void submit()}>提交报名</Button>
        )}
      </View>
    </View>
  )
}

export default SignupPage
