/**
 * 会话列表的零件：视图定义、筛选行（状态 / 类型 / 标签多选 / 搜索）、会话项、右键菜单、纯函数筛选。
 */
import { useEffect, useState, type RefObject } from 'react'
import { clsx } from 'clsx'
import { AtSign, BellOff, Clock, Inbox, MoonStar, Pin, Search } from 'lucide-react'
import type { DemoState, Message, Seat } from '@/domain/types'
import { fmtRelative, fmtWait } from '@/domain/time'
import { senderName } from '@/store/policy'
import type { ConvRow, WorkbenchView } from '@/store/selectors'
import { Avatar, TitleChip } from '@/ui/display'
import { Checkbox, Input, Select } from '@/ui/primitives'
import { toast } from '@/ui/overlay'
import { useWorkbench } from '../useWorkbench'

export const VIEWS: { key: WorkbenchView; label: string; icon: typeof Inbox; hint: (idleDays: number) => string }[] = [
  { key: 'waiting', label: '待我回复', icon: Inbox, hint: () => '客户最后发言、坐席尚未回复，按等待时长排' },
  { key: 'all', label: '全部会话', icon: Clock, hint: () => '当前坐席身份下的全部会话' },
  { key: 'mentions', label: '@我', icon: AtSign, hint: () => '群里被提及' },
  { key: 'idle', label: '长期未跟进', icon: MoonStar, hint: (n) => `超过 ${n} 天没有往来（企业策略 idleDays）` },
]

export type StatusFilter = 'all' | 'unread' | 'read'
export type TypeFilter = 'all' | 'dm' | 'group' | 'channel'
export interface Filters {
  status: StatusFilter
  type: TypeFilter
  tagIds: string[]
  q: string
}
export const EMPTY_FILTERS: Filters = { status: 'all', type: 'all', tagIds: [], q: '' }

/** 最后消息预览：撤回 / 删除占位，媒体显示 [图片] */
export function previewOf(m: Message | undefined): string {
  if (!m) return ''
  if (m.recalledAt) return '[已撤回]'
  if (m.deletedAt) return '[已删除]'
  if (m.kind === 'image') return '[图片]'
  return m.text
}

/** 状态 / 类型 / 标签 / 搜索（昵称、会话名、消息全文） */
export function applyFilters(rows: ConvRow[], s: DemoState, f: Filters): ConvRow[] {
  const q = f.q.trim().toLowerCase()
  return rows.filter((r) => {
    if (f.status === 'unread' && r.unread === 0) return false
    if (f.status === 'read' && r.unread > 0) return false
    if (f.type !== 'all' && r.conv.kind !== f.type) return false
    if (f.tagIds.length && !f.tagIds.every((t) => r.customer?.tagIds.includes(t))) return false
    if (q) {
      const inTitle = r.title.toLowerCase().includes(q) || !!r.customer?.nickname.toLowerCase().includes(q)
      const inMsgs = inTitle || s.messages.some((m) => m.convId === r.conv.id && !m.recalledAt && !m.deletedAt && m.text.toLowerCase().includes(q))
      if (!inMsgs) return false
    }
    return true
  })
}

/** searchRef 指向搜索框的包裹层（Input 组件不透传 ref），⌘⇧F 时从里面找 input 聚焦 */
export function FilterBar({ f, onChange, searchRef }: { f: Filters; onChange: (next: Filters) => void; searchRef: RefObject<HTMLDivElement | null> }) {
  const { s } = useWorkbench()
  const [tagOpen, setTagOpen] = useState(false)
  const toggleTag = (id: string) => onChange({ ...f, tagIds: f.tagIds.includes(id) ? f.tagIds.filter((x) => x !== id) : [...f.tagIds, id] })
  return (
    <div className="space-y-1.5 border-b border-zinc-200 px-2 py-2">
      <div className="relative" ref={searchRef}>
        <Search size={12} className="absolute top-1/2 left-2 -translate-y-1/2 text-zinc-400" />
        <Input value={f.q} onChange={(e) => onChange({ ...f, q: e.target.value })} placeholder="搜昵称 / 会话名 / 消息内容（⌘⇧F）" className="h-7 pl-6 text-xs" />
      </div>
      <div className="flex items-center gap-1">
        <Select className="h-6 flex-1 px-1.5 text-[11px]" value={f.status} onChange={(e) => onChange({ ...f, status: e.target.value as StatusFilter })}>
          <option value="all">全部状态</option>
          <option value="unread">未读</option>
          <option value="read">已读</option>
        </Select>
        <Select className="h-6 flex-1 px-1.5 text-[11px]" value={f.type} onChange={(e) => onChange({ ...f, type: e.target.value as TypeFilter })}>
          <option value="all">全部类型</option>
          <option value="dm">私聊</option>
          <option value="group">群聊</option>
          <option value="channel">频道</option>
        </Select>
        <div className="relative flex-1">
          <button type="button" onClick={() => setTagOpen((v) => !v)} className={clsx('h-6 w-full rounded-md border px-1.5 text-left text-[11px]', f.tagIds.length ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-zinc-300 bg-white text-zinc-600')}>
            标签{f.tagIds.length ? ` · ${f.tagIds.length}` : ''}
          </button>
          {tagOpen && (
            <div className="absolute top-full right-0 z-30 mt-1 w-48 rounded-md border border-zinc-200 bg-white p-2 shadow-lg" onMouseLeave={() => setTagOpen(false)}>
              <div className="mb-1 text-[10px] text-zinc-400">内部标签，多选（只对私聊生效）</div>
              <div className="flex flex-col gap-1">
                {s.tags.map((t) => <Checkbox key={t.id} checked={f.tagIds.includes(t.id)} onChange={() => toggleTag(t.id)} label={<span style={{ color: t.color }}>{t.name}</span>} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ConvItem({ row, active, view, onClick, onContextMenu }: { row: ConvRow; active: boolean; view: WorkbenchView; onClick: () => void; onContextMenu: (e: React.MouseEvent) => void }) {
  const { s } = useWorkbench()
  const isDm = row.conv.kind === 'dm'
  const primaryTitle = row.customer?.primaryTitleId ? s.titles.find((t) => t.id === row.customer!.primaryTitleId && t.enabled) : undefined
  const group = !isDm ? s.chatGroups.find((g) => g.id === row.conv.chatGroupId) : undefined
  const preview = isDm ? previewOf(row.last) : row.last ? `${senderName(s, row.last)}：${previewOf(row.last)}` : ''
  return (
    <button type="button" onClick={onClick} onContextMenu={onContextMenu} className={clsx('flex w-full items-start gap-2.5 border-b border-zinc-100 px-3 py-2.5 text-left hover:bg-zinc-50', active && 'bg-brand-50/70 hover:bg-brand-50/70', row.pinned && !active && 'bg-zinc-50/80')}>
      {isDm ? <Avatar text={row.title} size={36} /> : <Avatar text={row.title} size={36} color={group?.kind === 'channel' ? '#b45309' : '#0f766e'} official={group?.official} />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-zinc-900">{row.title}</span>
          {primaryTitle && <TitleChip title={primaryTitle} size="xs" />}
          {!isDm && <span className="shrink-0 text-[10px] text-zinc-400">{group?.kind === 'channel' ? '频道' : `群 · ${(group?.memberCustomerIds.length ?? 0) + (group?.memberSeatIds.length ?? 0)}`}</span>}
          <span className="ml-auto shrink-0 text-[10px] tabular-nums text-zinc-400">{fmtRelative(row.conv.lastMessageAt)}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-xs text-zinc-500">{preview}</span>
          {row.pinned && <Pin size={10} className="shrink-0 text-zinc-400" />}
          {row.muted && <BellOff size={10} className="shrink-0 text-zinc-400" />}
          {row.unread > 0 && <span className={clsx('shrink-0 rounded-full px-1.5 text-[10px] leading-4 text-white', row.muted ? 'bg-zinc-400' : 'bg-red-500')}>{row.unread}</span>}
          {row.mentioned && <span className="shrink-0 rounded-full bg-amber-500 px-1.5 text-[10px] leading-4 text-white">@</span>}
        </div>
        {view === 'waiting' && row.waitingSince && <div className="mt-0.5 text-[10px] text-amber-600">已等待 {fmtWait(row.waitingSince)}</div>}
        {view === 'idle' && <div className="mt-0.5 text-[10px] text-zinc-400">{row.idleDays} 天没有往来</div>}
      </div>
    </button>
  )
}

/** 右键菜单：标记已读 / 未读、置顶、静音、本地删除 */
export function ContextMenu({ x, y, row, seat, onClose, onDeleteLocal }: { x: number; y: number; row: ConvRow; seat: Seat; onClose: () => void; onDeleteLocal: () => void }) {
  const { s } = useWorkbench()
  useEffect(() => {
    const close = () => onClose()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])
  const run = (fn: () => void, msg: string) => {
    fn()
    toast(msg)
    onClose()
  }
  const item = (label: string, fn: () => void, msg: string, danger?: boolean) => (
    <button type="button" onMouseDown={(e) => e.stopPropagation()} onClick={() => run(fn, msg)} className={clsx('block w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-50', danger ? 'text-red-700' : 'text-zinc-700')}>
      {label}
    </button>
  )
  return (
    <div className="fixed z-40 w-44 rounded-md border border-zinc-200 bg-white py-1 shadow-lg" style={{ left: x, top: y }} onMouseDown={(e) => e.stopPropagation()}>
      {row.unread > 0 ? item('标记已读', () => s.markRead(row.conv.id, seat.id), '已标记为已读') : item('标记未读', () => s.markUnread(row.conv.id, seat.id), '已标记为未读')}
      {item(row.pinned ? '取消置顶' : '置顶会话', () => s.togglePinConversation(row.conv.id, seat.id), row.pinned ? '已取消置顶' : '已置顶，排在列表最前')}
      {item(row.muted ? '取消静音' : '静音', () => s.toggleMuteConversation(row.conv.id, seat.id), row.muted ? '已取消静音' : '已静音：不推送，未读角标变灰')}
      <div className="my-1 border-t border-zinc-100" />
      {item('删除会话（本地）', onDeleteLocal, '已从本地列表移除；服务端消息不删，有新消息会再出现', true)}
    </div>
  )
}
