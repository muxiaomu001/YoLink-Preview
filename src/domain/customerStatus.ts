/**
 * 客户状态的唯一口径。
 *
 * 之前后台客户列表只认「正常 / 已注销」两种，工作台的资料卡却认四种（封禁、全局禁言、
 * 待首次改密、已注销）——同一个被封禁的客户，后台显示"正常"，工作台显示"封禁"，
 * 谁对谁错说不清。这里把判断收成一处，两边都从这里取。
 *
 * 状态不是互斥的单值：一个客户可以既被封禁又待改密。所以对外给的是一组标记，
 * 空数组表示正常。列表里想要一个词概括时用 primaryStatusLabel。
 */
import type { Customer } from './types'
import { WATCH_LIMIT_TEXT, isWatching } from './register'
import { fmtDateTime, fmtDuration } from './time'

/** muteCustomerAll 用这个年份表示永久禁言 */
const FOREVER_PREFIX = '9999-'

export type CustomerStatusKey = 'deleted' | 'banned' | 'shadowed' | 'muted' | 'mustChangePassword' | 'watching'

/**
 * 新号观察期是风控里的正常新客，筛「正常」时不该把客户排除掉，
 * 否则刚注册的人全部落进「不正常」，筛选就没法用了。
 */
const TRANSIENT_KEYS: CustomerStatusKey[] = ['watching']

export interface CustomerStatusFlag {
  key: CustomerStatusKey
  label: string
  tone: 'red' | 'amber' | 'purple' | 'blue' | 'zinc'
  /** 鼠标悬停的完整时间说明 */
  title?: string
}

export type CustomerLoginState = 'active' | 'banned' | 'forcedLogout' | 'signedOut'

/** 手机端只接受封禁前建立且未被强制下线的登录。 */
export function customerLoginState(c: Customer | undefined, sessionStartedAt?: string | null): CustomerLoginState {
  if (!c || c.deletedAt) return 'signedOut'
  if (c.bannedAt) return 'banned'
  if (c.sessionsRevokedAt && (!sessionStartedAt || sessionStartedAt <= c.sessionsRevokedAt)) return 'forcedLogout'
  return 'active'
}

export function isMutedNow(c: Customer, at = new Date().toISOString()): boolean {
  return !!c.mutedAllUntil && c.mutedAllUntil > at
}

export function isMutedForever(c: Customer): boolean {
  return !!c.mutedAllUntil && c.mutedAllUntil.startsWith(FOREVER_PREFIX)
}

/** 客户发送前的全局禁言提示；到期后自然返回 undefined。 */
export function globalMuteReason(c: Customer, at = new Date().toISOString()): string | undefined {
  if (!isMutedNow(c, at)) return undefined
  if (isMutedForever(c)) return '你已被全局禁言'
  const seconds = Math.ceil((new Date(c.mutedAllUntil!).getTime() - new Date(at).getTime()) / 1000)
  return `你已被全局禁言，剩余 ${fmtDuration(Math.max(1, seconds))}`
}

/**
 * 按严重程度排序的状态标记，空数组表示正常。
 * 强制下线是一次性动作，不在客户状态列展示；重新登录后不保留状态标记。
 */
export function customerStatusFlags(c: Customer): CustomerStatusFlag[] {
  const flags: CustomerStatusFlag[] = []
  if (c.deletedAt) flags.push({ key: 'deleted', label: '已注销', tone: 'red', title: `注销于 ${fmtDateTime(c.deletedAt)}` })
  if (c.bannedAt) flags.push({ key: 'banned', label: '封禁', tone: 'red', title: `封禁于 ${fmtDateTime(c.bannedAt)}，账号无法登录` })
  // 影子模式紫色单独一档：它既不是「已拦下」（红）也不是「限时限制」（黄），
  // 而是一种客户完全不知情的处理方式，后台看列表时必须一眼认出来别当成正常人
  if (c.shadowModeAt) flags.push({ key: 'shadowed', label: '影子模式', tone: 'purple', title: `开启于 ${fmtDateTime(c.shadowModeAt)}：群消息只有他自己和坐席看得见，客户端无提示${c.shadowModeReason ? `。原因：${c.shadowModeReason}` : ''}` })
  if (isMutedNow(c)) flags.push({ key: 'muted', label: isMutedForever(c) ? '全局禁言（永久）' : '全局禁言', tone: 'amber', title: isMutedForever(c) ? '永久禁言，不能向任何官方联系人、群或频道发送消息' : `禁言至 ${fmtDateTime(c.mutedAllUntil!)}，不能向任何官方联系人、群或频道发送消息` })
  if (c.mustChangePassword) flags.push({ key: 'mustChangePassword', label: '待首次改密', tone: 'zinc', title: '员工重置过密码，客户下次登录必须改' })
  if (isWatching(c, new Date().toISOString())) flags.push({ key: 'watching', label: '新号观察期', tone: 'blue', title: `观察期至 ${fmtDateTime(c.watchUntil!)}：${WATCH_LIMIT_TEXT}` })
  return flags
}

/** 列表里只显示一个词时用哪个：注销 > 封禁 > 影子 > 禁言 > 待改密；都没有就是正常 */
export function primaryStatusFlag(c: Customer): CustomerStatusFlag | null {
  return customerStatusFlags(c).find((f) => !TRANSIENT_KEYS.includes(f.key)) ?? null
}

/** 后台客户列表的状态筛选；'' 表示不筛 */
export type CustomerStatusFilter = '' | 'normal' | CustomerStatusKey

export const STATUS_FILTER_OPTIONS: { value: CustomerStatusFilter; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'normal', label: '正常' },
  { value: 'banned', label: '封禁' },
  { value: 'shadowed', label: '影子模式' },
  { value: 'muted', label: '全局禁言' },
  { value: 'mustChangePassword', label: '待首次改密' },
  { value: 'watching', label: '新号观察期' },
  { value: 'deleted', label: '已注销' },
]

export function matchesStatusFilter(c: Customer, filter: CustomerStatusFilter): boolean {
  if (!filter) return true
  const flags = customerStatusFlags(c)
  // 「正常」= 一个持续性的问题状态都没有；还在观察期不算问题
  if (filter === 'normal') return flags.every((f) => TRANSIENT_KEYS.includes(f.key))
  return flags.some((f) => f.key === filter)
}
