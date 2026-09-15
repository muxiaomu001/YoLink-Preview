/**
 * 群管理组件的公共部分：统一 props、8 项管理员权限的中文说明（12 文档表格）、
 * 折叠面板、跳转到消息、慢速模式档位、限制状态文案。
 * 工作台群信息卡与管理后台群管理页共用这些组件，所以这里只依赖 store，不依赖 useWorkbench。
 */
import { useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ChatGroup, GroupAdminPerm, GroupRestriction } from '@/domain/types'
import type { Actor } from '@/store/actions/groups'
import { fmtDateTime } from '@/domain/time'

/** 每个群管理面板都收这四个：群、操作者（坐席 + 实操员工）、权限判定、是否紧凑（工作台右栏） */
export interface GroupPanelProps {
  group: ChatGroup
  actor: Actor
  perm: (p: GroupAdminPerm) => boolean
  compact?: boolean
}

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

/** 慢速模式六档 + 跟随企业策略（12 文档，P2） */
export const SLOW_MODE_OPTIONS: { value: string; label: string }[] = [
  { value: 'policy', label: '跟随企业策略' },
  { value: '0', label: '关闭' },
  { value: '10', label: '10 秒' },
  { value: '30', label: '30 秒' },
  { value: '60', label: '1 分钟' },
  { value: '300', label: '5 分钟' },
  { value: '900', label: '15 分钟' },
]

/** 禁言 / 封禁时限 */
export const RESTRICT_DURATIONS: { hours: number | null; label: string }[] = [
  { hours: 1, label: '1 小时' },
  { hours: 24, label: '24 小时' },
  { hours: 168, label: '7 天' },
  { hours: null, label: '永久' },
]

/** 邀请链接过期档位（12 文档 invite_link.expiry_options） */
export const LINK_EXPIRY_OPTIONS: { days: number | null; label: string }[] = [
  { days: 1, label: '1 天' },
  { days: 7, label: '7 天' },
  { days: 30, label: '30 天' },
  { days: null, label: '永久' },
]

/** 演示用的群链接前缀 */
export const GROUP_LINK_BASE = 'https://yolink.app/j/'

/** 群成员总数（坐席 + 客户 + 机器人） */
export function memberTotal(g: ChatGroup): number {
  return g.memberSeatIds.length + g.memberCustomerIds.length + g.memberBotIds.length
}

/** "已禁言至 …" 这类状态文案 */
export function restrictionLabel(r: GroupRestriction): string {
  const kind = r.kind === 'ban' ? '已封禁' : '已禁言'
  return r.until === null ? `${kind}（永久）` : `${kind}至 ${fmtDateTime(r.until)}`
}

/** 未过期的限制 */
export function isRestrictionActive(r: GroupRestriction, nowIso: string): boolean {
  return r.until === null || r.until > nowIso
}

/** 跳到聊天区里的某条消息（消息 DOM id 为 msg-<id>）；不在当前视图时返回 false */
export function jumpToMessage(messageId: string): boolean {
  const el = document.getElementById(`msg-${messageId}`)
  if (!el) return false
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  el.classList.add('ring-2', 'ring-amber-300')
  window.setTimeout(() => el.classList.remove('ring-2', 'ring-amber-300'), 1600)
  return true
}

/** 复制到剪贴板；不支持时返回 false */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * 折叠面板：工作台里是右栏的一段，管理后台与群管理弹窗里是一张卡。
 * 没有权限的面板由调用方决定不渲染，这里不再做"上锁"状态。
 */
export function Section({
  id,
  title,
  hint,
  extra,
  defaultOpen = true,
  compact,
  children,
}: {
  id?: string
  title: string
  hint?: ReactNode
  extra?: ReactNode
  defaultOpen?: boolean
  compact?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section id={id} className={clsx(compact ? 'border-b border-zinc-100' : 'rounded-lg border border-zinc-200 bg-white')}>
      <div className={clsx('flex items-center gap-2', compact ? 'px-4 py-2.5' : 'border-b border-zinc-100 px-4 py-2.5')}>
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left" aria-expanded={open}>
          {open ? <ChevronDown size={12} className="shrink-0 text-zinc-400" /> : <ChevronRight size={12} className="shrink-0 text-zinc-400" />}
          <span className={clsx('font-semibold', compact ? 'text-[12px] text-zinc-600' : 'text-[13px] text-zinc-800')}>{title}</span>
          {hint && <span className="ml-1 truncate text-[11px] text-zinc-400">{hint}</span>}
        </button>
        {extra}
      </div>
      {open && <div className={clsx(compact ? 'px-4 pb-3' : 'p-4')}>{children}</div>}
    </section>
  )
}
