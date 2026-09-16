/**
 * 注册资料规则与注册风控的唯一口径。
 *
 * 后台设置页、客户端注册页、store.registerCustomer 三处都从这里取。
 * 分开写过一次就会出现「后台把昵称改成了选填，客户端仍然按必填拦住」这种前后不一，
 * 而这种不一致恰恰是演示时最容易被当场点出来的。
 */
import type { Customer } from './types'

/** 注册时昵称怎么问 */
export type NicknamePolicy = 'required' | 'optional' | 'skip'

export const NICKNAME_MIN = 1
export const NICKNAME_MAX = 32

export const NICKNAME_POLICY_OPTIONS: { value: NicknamePolicy; label: string; desc: string }[] = [
  { value: 'required', label: '必填', desc: '注册时必须自己起名。资料最全，但多一道坎，投放来的量在这一步掉得最多。' },
  { value: 'optional', label: '选填', desc: '给输入框但不拦。不填就发默认昵称，客户自己决定要不要多花十秒。' },
  { value: 'skip', label: '不问', desc: '注册页不出现昵称，直接发默认昵称。最快的一档，进去后随时能改。' },
]

export function nicknamePolicyLabel(p: NicknamePolicy): string {
  return NICKNAME_POLICY_OPTIONS.find((o) => o.value === p)?.label ?? p
}

/** 默认昵称模板里的占位符，换成账号 ID 的后四位 */
export const NICKNAME_TOKEN = '{n}'

export const DEFAULT_NICKNAME_TEMPLATE = `客户${NICKNAME_TOKEN}`

export function renderDefaultNickname(template: string, accountId: string): string {
  const t = template.trim() || DEFAULT_NICKNAME_TEMPLATE
  return t.replaceAll(NICKNAME_TOKEN, accountId.slice(-4)).slice(0, NICKNAME_MAX)
}

export type NicknameResolution = { ok: true; nickname: string; auto: boolean } | { ok: false; error: string }

/**
 * 把客户提交的昵称按三档规则归一。
 * auto = true 表示这个名字是系统给的，客户端注册成功页与软引导要据此提示改名。
 */
export function resolveRegisterNickname(policy: NicknamePolicy, template: string, raw: string, accountId: string): NicknameResolution {
  const v = raw.trim()
  // 「不问」档下界面根本没有昵称框，来什么都按默认走
  if (policy === 'skip' || !v) {
    if (policy === 'required') return { ok: false, error: '请填写昵称' }
    return { ok: true, nickname: renderDefaultNickname(template, accountId), auto: true }
  }
  if (v.length > NICKNAME_MAX) return { ok: false, error: `昵称最多 ${NICKNAME_MAX} 字` }
  return { ok: true, nickname: v, auto: false }
}

// ---------- 注册风控 ----------

/** 同设备注册风控的统计窗口：一天 */
export const DEVICE_WINDOW_HOURS = 24

export function hoursBefore(nowIso: string, hours: number): string {
  return new Date(new Date(nowIso).getTime() - hours * 3600000).toISOString()
}

/** 这台设备在最近 DEVICE_WINDOW_HOURS 小时里注册了几个账号（含已注销的：注销了再注册照样算） */
export function deviceRegisterCount(customers: Customer[], deviceId: string, nowIso: string): number {
  const since = hoursBefore(nowIso, DEVICE_WINDOW_HOURS)
  return customers.filter((c) => c.deviceId === deviceId && c.registeredAt >= since).length
}

/** 新号观察期的到期时间；hours <= 0 表示这家企业不设观察期 */
export function watchUntilOf(registeredAt: string, hours: number): string | undefined {
  if (hours <= 0) return undefined
  return new Date(new Date(registeredAt).getTime() + hours * 3600000).toISOString()
}

export function isWatching(c: Customer, nowIso: string): boolean {
  return !!c.watchUntil && c.watchUntil > nowIso
}

/**
 * 观察期里客户被限制成什么样，后台说明、客户端提示、群内发言拦截共用这一句。
 * 只关群内发言：私聊官方联系人必须留着，不然新号连问客服的路都没有，风控就变成了拒客。
 */
export const WATCH_LIMIT_TEXT = '只能和官方联系人私聊，不能在群里发言'
