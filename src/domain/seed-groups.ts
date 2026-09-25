/**
 * 群与频道的管理数据（群内角色、设置、公告、限制、群邀请链接、管理员日志）。所有数据均为虚构。
 */
import type { ChatGroup, CustomerNotificationPrefs, CustomerPrefs, GroupLog, StaffPrefs, ThemeKey } from './types'
import { ago, iso } from './time'

export const DEFAULT_STAFF_PREFS: StaffPrefs = { theme: 'auto', desktopNotify: true, sound: false, language: 'zh', quickMatch: true }

export const DEFAULT_CUSTOMER_NOTIFICATION_PREFS: CustomerNotificationPrefs = { dm: true, group: true, channel: true, preview: true, mentionException: true }

export function defaultCustomerPrefs(theme: ThemeKey): CustomerPrefs {
  return { theme, darkMode: 'off', notifications: { ...DEFAULT_CUSTOMER_NOTIFICATION_PREFS } }
}

/** 新建群的默认管理字段 */
export function groupDefaults(): Pick<ChatGroup, 'customerJoinedAt' | 'admins' | 'settings' | 'announcement' | 'pinnedMessageIds' | 'restrictions' | 'inviteLinks'> {
  return {
    customerJoinedAt: {},
    admins: [],
    settings: { allMuted: false, membersVisible: false, slowModeSeconds: null, historyVisible: true },
    announcement: null,
    pinnedMessageIds: [],
    restrictions: [],
    inviteLinks: [],
  }
}

/** 三个种子群的管理字段 */
export const GROUP_EXTRAS: Record<string, Partial<ChatGroup>> = {
  cg_strategy: {
    admins: [
      // 「恒信官方通知」是只读通知频道，只有 owner 客户服务能发布；两位坐席只能置顶，不能发消息。
      // 这样默认工作台身份（林薇 / 林晓明）发群发时，这个频道就是灰的，不用切身份也演得出发布权拦截。
      { memberKind: 'seat', memberId: 'seat_lin', perms: ['can_pin_messages'], promotedBySeatId: 'seat_cs', promotedAt: ago(100) },
      { memberKind: 'seat', memberId: 'seat_chen', perms: ['can_pin_messages'], promotedBySeatId: 'seat_cs', promotedAt: ago(100) },
    ],
    settings: { allMuted: false, membersVisible: false, slowModeSeconds: null, historyVisible: true },
    inviteLinks: [{ id: 'gl_strategy_main', name: '主链接', code: 'CH-STRAT', main: true, expiresAt: null, maxUses: null, uses: 214, status: 'active', bySeatId: 'seat_cs', createdAt: ago(100) }],
  },
  cg_community: {
    admins: [
      { memberKind: 'seat', memberId: 'seat_chen', perms: ['can_manage_chat', 'can_delete_messages', 'can_restrict_members', 'can_change_info', 'can_invite_users', 'can_pin_messages'], promotedBySeatId: 'seat_lin', promotedAt: ago(100) },
      { memberKind: 'seat', memberId: 'seat_cs', perms: ['can_delete_messages', 'can_pin_messages', 'can_invite_users'], promotedBySeatId: 'seat_lin', promotedAt: ago(90) },
    ],
    settings: { allMuted: false, membersVisible: false, slowModeSeconds: null, historyVisible: true },
    announcement: {
      title: '群规与本周安排',
      content: '1. 群内只讨论资产配置与市场，不发第三方理财链接。\n2. 服务专员答疑时段：工作日 10:00 到 18:00。\n3. 本周五晚 8 点三季度复盘直播，私享会员优先提问。',
      bySeatId: 'seat_lin',
      at: ago(6),
      notified: true,
    },
    inviteLinks: [
      { id: 'gl_comm_main', name: '主链接', code: 'GP-HXWM', main: true, expiresAt: null, maxUses: null, uses: 1080, status: 'active', bySeatId: 'seat_lin', createdAt: ago(100) },
      { id: 'gl_comm_live', name: '9 月直播间', code: 'GP-LV09', main: false, expiresAt: iso(Date.now() + 12 * 86400000), maxUses: 300, uses: 87, status: 'active', bySeatId: 'seat_lin', createdAt: ago(14) },
      { id: 'gl_comm_old', name: '8 月直播间', code: 'GP-LV08', main: false, expiresAt: ago(10), maxUses: 300, uses: 300, status: 'expired', bySeatId: 'seat_lin', createdAt: ago(45) },
    ],
  },
  cg_vip: {
    admins: [{ memberKind: 'seat', memberId: 'seat_chen', perms: ['can_delete_messages', 'can_pin_messages', 'can_invite_users', 'can_restrict_members'], promotedBySeatId: 'seat_lin', promotedAt: ago(80) }],
    settings: { allMuted: false, membersVisible: true, slowModeSeconds: null, historyVisible: false },
    announcement: { title: '三季度复盘', content: '复盘报告已放到 App「我的文件」，周五晚 8 点线上讲一遍。', bySeatId: 'seat_lin', at: ago(3), notified: false },
    inviteLinks: [{ id: 'gl_vip_main', name: '主链接', code: 'GP-VIP1', main: true, expiresAt: null, maxUses: null, uses: 46, status: 'active', bySeatId: 'seat_lin', createdAt: ago(80) }],
  },
}

export function buildGroupLogs(): GroupLog[] {
  return [
    { id: 'gl_01', groupId: 'cg_community', at: ago(0, 2), actorKind: 'seat', actorId: 'seat_chen', action: 'delete_message', detail: '删除了客户「刘先生」的一条消息（第三方理财链接）' },
    { id: 'gl_02', groupId: 'cg_community', at: ago(0, 9), actorKind: 'seat', actorId: 'seat_lin', action: 'pin', detail: '置顶了「10 月 12 日策略会报名」' },
    { id: 'gl_03', groupId: 'cg_community', at: ago(0, 20), actorKind: 'seat', actorId: 'seat_cs', action: 'restrict', detail: '禁言客户「刘先生」24 小时：反复发广告' },
    { id: 'gl_04', groupId: 'cg_community', at: ago(1, 4), actorKind: 'seat', actorId: 'seat_lin', action: 'setting', detail: '关闭全员禁言' },
    { id: 'gl_05', groupId: 'cg_community', at: ago(1, 6), actorKind: 'seat', actorId: 'seat_lin', action: 'setting', detail: '开启全员禁言：直播期间只看服务专员讲解' },
    { id: 'gl_06', groupId: 'cg_vip', at: ago(1, 12), actorKind: 'seat', actorId: 'seat_lin', action: 'announcement', detail: '发布公告「三季度复盘」' },
  ]
}
