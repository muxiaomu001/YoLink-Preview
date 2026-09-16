/**
 * 客户状态的唯一口径。
 *
 * 之前后台客户列表只认「正常 / 已注销」两种，工作台的资料卡却认四种（已拉黑、全群禁言、
 * 待首次改密、已注销）——同一个被拉黑的客户，后台显示"正常"，工作台显示"已拉黑"，
 * 谁对谁错说不清。这里把判断收成一处，两边都从这里取。
 *
 * 状态不是互斥的单值：一个客户可以既被拉黑又待改密。所以对外给的是一组标记，
 * 空数组表示正常。列表里想要一个词概括时用 primaryStatusLabel。
 */
import type { Customer } from './types'
import { WATCH_LIMIT_TEXT, isWatching } from './register'
import { fmtAgo, fmtDateTime } from './time'

/** muteCustomerAll 用这个年份表示永久禁言 */
const FOREVER_PREFIX = '9999-'

export type CustomerStatusKey = 'deleted' | 'blacklisted' | 'shadowed' | 'muted' | 'mustChangePassword' | 'watching' | 'loggedOut'

/**
 * 不算「问题状态」的那几项：强制下线是一次性动作，新号观察期是风控里的正常新客。
 * 筛「正常」时这两项不该把客户排除掉，否则刚注册的人全部落进「不正常」，筛选就没法用了。
 */
const TRANSIENT_KEYS: CustomerStatusKey[] = ['watching', 'loggedOut']

export interface CustomerStatusFlag {
  key: CustomerStatusKey
  label: string
  tone: 'red' | 'amber' | 'purple' | 'blue' | 'zinc'
  /** 鼠标悬停的完整时间说明 */
  title?: string
}

export function isMutedNow(c: Customer): boolean {
  return !!c.mutedAllUntil && c.mutedAllUntil > new Date().toISOString()
}

export function isMutedForever(c: Customer): boolean {
  return !!c.mutedAllUntil && c.mutedAllUntil.startsWith(FOREVER_PREFIX)
}

/**
 * 按严重程度排序的状态标记，空数组表示正常。
 * 强制下线排在最后且用中性色：它是一次性动作（当时把设备踢下线了），不是持续状态，
 * 客户重新登录就没事了，和「已拉黑」不是一回事。
 */
export function customerStatusFlags(c: Customer): CustomerStatusFlag[] {
  const flags: CustomerStatusFlag[] = []
  if (c.deletedAt) flags.push({ key: 'deleted', label: '已注销', tone: 'red', title: `注销于 ${fmtDateTime(c.deletedAt)}` })
  if (c.blacklistedAt) flags.push({ key: 'blacklisted', label: '已拉黑', tone: 'red', title: `拉黑于 ${fmtDateTime(c.blacklistedAt)}，客户发不出消息` })
  // 影子模式紫色单独一档：它既不是「已拦下」（红）也不是「限时限制」（黄），
  // 而是一种客户完全不知情的处理方式，后台看列表时必须一眼认出来别当成正常人
  if (c.shadowModeAt) flags.push({ key: 'shadowed', label: '影子模式', tone: 'purple', title: `开启于 ${fmtDateTime(c.shadowModeAt)}：群消息只有他自己和坐席看得见，客户端无提示${c.shadowModeReason ? `。原因：${c.shadowModeReason}` : ''}` })
  if (isMutedNow(c)) flags.push({ key: 'muted', label: isMutedForever(c) ? '全群禁言（永久）' : '全群禁言', tone: 'amber', title: isMutedForever(c) ? '永久禁言，私聊不受影响' : `禁言至 ${fmtDateTime(c.mutedAllUntil!)}，私聊不受影响` })
  if (c.mustChangePassword) flags.push({ key: 'mustChangePassword', label: '待首次改密', tone: 'zinc', title: '员工重置过密码，客户下次登录必须改' })
  if (isWatching(c, new Date().toISOString())) flags.push({ key: 'watching', label: '新号观察期', tone: 'blue', title: `观察期至 ${fmtDateTime(c.watchUntil!)}：${WATCH_LIMIT_TEXT}` })
  if (c.sessionsRevokedAt) flags.push({ key: 'loggedOut', label: `${fmtAgo(c.sessionsRevokedAt)}强制下线`, tone: 'zinc', title: `强制下线于 ${fmtDateTime(c.sessionsRevokedAt)}；账号未停用，客户可重新登录` })
  return flags
}

/** 列表里只显示一个词时用哪个：注销 > 拉黑 > 影子 > 禁言 > 待改密；都没有就是正常 */
export function primaryStatusFlag(c: Customer): CustomerStatusFlag | null {
  return customerStatusFlags(c).find((f) => !TRANSIENT_KEYS.includes(f.key)) ?? null
}

/** 后台客户列表的状态筛选；'' 表示不筛 */
export type CustomerStatusFilter = '' | 'normal' | CustomerStatusKey

export const STATUS_FILTER_OPTIONS: { value: CustomerStatusFilter; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'normal', label: '正常' },
  { value: 'blacklisted', label: '已拉黑' },
  { value: 'shadowed', label: '影子模式' },
  { value: 'muted', label: '全群禁言' },
  { value: 'mustChangePassword', label: '待首次改密' },
  { value: 'watching', label: '新号观察期' },
  { value: 'deleted', label: '已注销' },
]

export function matchesStatusFilter(c: Customer, filter: CustomerStatusFilter): boolean {
  if (!filter) return true
  const flags = customerStatusFlags(c)
  // 「正常」= 一个持续性的问题状态都没有；强制下线过、还在观察期都不算问题
  if (filter === 'normal') return flags.every((f) => TRANSIENT_KEYS.includes(f.key))
  return flags.some((f) => f.key === filter)
}
