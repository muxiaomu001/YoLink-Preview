import type { ChatGroup, GroupAdminPerm, GroupRestriction } from '@/domain/types'
import { fmtDateTime } from '@/domain/time'

/** 12 文档「管理员权限粒度」表：P0 实现的 8 项 */
export const PERM_META: { key: GroupAdminPerm; label: string; desc: string; channelOnly?: boolean }[] = [
  { key: 'can_manage_chat', label: '管理群', desc: '访问管理员日志、查看隐藏成员' },
  { key: 'can_delete_messages', label: '删除消息', desc: '删除他人消息' },
  { key: 'can_restrict_members', label: '限制成员', desc: '禁言 / 封禁 / 解封 / 移出成员，开关全员禁言' },
  { key: 'can_promote_members', label: '任免管理员', desc: '添加 / 降级管理员，修改管理员权限' },
  { key: 'can_change_info', label: '修改群信息', desc: '修改群名称、头像、简介与公告' },
  { key: 'can_invite_users', label: '邀请用户', desc: '生成邀请链接、批量拉人、加入坐席' },
  { key: 'can_pin_messages', label: '置顶消息', desc: '置顶 / 取消置顶消息' },
  { key: 'can_post_messages', label: '频道发布', desc: '在频道发布消息（仅频道）', channelOnly: true },
]

export const PERM_LABEL: Record<GroupAdminPerm, string> = Object.fromEntries(PERM_META.map((p) => [p.key, p.label])) as Record<GroupAdminPerm, string>
export const GROUP_KIND_TEXT: Record<ChatGroup['kind'], string> = { group: '群', channel: '频道' }

export const SLOW_MODE_OPTIONS: { value: string; label: string }[] = [
  { value: 'policy', label: '跟随企业策略' },
  { value: '0', label: '关闭' },
  { value: '10', label: '10 秒' },
  { value: '30', label: '30 秒' },
  { value: '60', label: '1 分钟' },
  { value: '300', label: '5 分钟' },
  { value: '900', label: '15 分钟' },
]

export const RESTRICT_DURATIONS: { hours: number | null; label: string }[] = [
  { hours: 1, label: '1 小时' },
  { hours: 24, label: '24 小时' },
  { hours: 168, label: '7 天' },
  { hours: null, label: '永久' },
]

export const LINK_EXPIRY_OPTIONS: { days: number | null; label: string }[] = [
  { days: 1, label: '1 天' },
  { days: 7, label: '7 天' },
  { days: 30, label: '30 天' },
  { days: null, label: '永久' },
]

export const GROUP_LINK_BASE = 'https://yolink.app/j/'

export function memberTotal(g: ChatGroup): number {
  return g.memberSeatIds.length + g.memberCustomerIds.length
}

export function restrictionLabel(r: GroupRestriction): string {
  const kind = r.kind === 'ban' ? '已封禁' : '已禁言'
  return r.until === null ? `${kind}（永久）` : `${kind}至 ${fmtDateTime(r.until)}`
}

export function isRestrictionActive(r: GroupRestriction, nowIso: string): boolean {
  return r.until === null || r.until > nowIso
}

export function jumpToMessage(messageId: string): boolean {
  const el = document.getElementById(`msg-${messageId}`)
  if (!el) return false
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  el.classList.add('ring-2', 'ring-amber-300')
  window.setTimeout(() => el.classList.remove('ring-2', 'ring-amber-300'), 1600)
  return true
}

export { copyText } from '@/ui/clipboard'
