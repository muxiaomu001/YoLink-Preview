/**
 * 会话列表的零件：视图定义、搜索行 + 筛选弹层（类型 / 标签多选 / 长期未跟进）、会话项、右键菜单、纯函数筛选。
 */
import { useEffect, useState, type RefObject } from 'react'
import { clsx } from 'clsx'
import { BellOff, Pin, Search, SlidersHorizontal, X } from 'lucide-react'
import type { Seat } from '@/domain/types'
import { fmtRelative, fmtWait } from '@/domain/time'
import { senderName } from '@/store/policy'
import { type ConvRow, type WorkbenchView } from '@/store/selectors'
import { Avatar, TitleChip } from '@/ui/display'
import { Checkbox, Input } from '@/ui/primitives'
import { toast } from '@/ui/overlay'
import { useWorkbench } from '../useWorkbench'
import { activeFilterCount, EMPTY_FILTERS, previewOf, type Filters, type TypeFilter } from './ChatPage.shared'

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'dm', label: '私聊' },
  { value: 'group', label: '群聊' },
  { value: 'channel', label: '频道' },
]

/** 搜索框占满 + 右侧「筛选」图标按钮；searchRef 指向搜索框包裹层（Input 组件不透传 ref），⌘⇧F 从里面找 input 聚焦 */
export function FilterBar({ f, onChange, searchRef }: { f: Filters; onChange: (next: Filters) => void; searchRef: RefObject<HTMLDivElement | null> }) {
  const { s } = useWorkbench()
  const [open, setOpen] = useState(false)
  const count = activeFilterCount(f)
  const idleDays = s.policyNumbers.idleDays
  const toggleTag = (id: string) => onChange({ ...f, tagIds: f.tagIds.includes(id) ? f.tagIds.filter((x) => x !== id) : [...f.tagIds, id] })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="flex items-center gap-1.5 border-b border-zinc-200 px-2 py-2">
      <div className="relative min-w-0 flex-1" ref={searchRef}>
        <Search size={13} className="absolute top-1/2 left-2 -translate-y-1/2 text-zinc-400" />
        <Input value={f.q} onChange={(e) => onChange({ ...f, q: e.target.value })} placeholder="搜昵称 / 会话名 / 消息内容" className="h-8 pl-7 text-[12px]" />
      </div>
      <div className="relative shrink-0">
        <button
          type="button"
          title="筛选"
          onClick={() => setOpen((v) => !v)}
          className={clsx('relative flex h-8 w-8 items-center justify-center rounded-md border', count ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-zinc-300 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800')}
        >
          <SlidersHorizontal size={14} />
          {count > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[16px] rounded-full bg-brand-700 px-1 text-center text-[11px] leading-4 text-white">{count}</span>}
        </button>
        {open && (
          <div className="absolute top-full right-0 z-30 mt-1 w-60 rounded-md border border-zinc-200 bg-white p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-medium text-zinc-800">筛选</span>
              <button type="button" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-700" aria-label="关闭"><X size={13} /></button>
            </div>
            <div className="mb-1 text-[11px] text-zinc-500">类型</div>
            <div className="mb-3 flex flex-wrap gap-1">
              {TYPE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onChange({ ...f, type: o.value })}
                  className={clsx('rounded-md border px-2 py-0.5 text-[12px]', f.type === o.value ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50')}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="mb-1 text-[11px] text-zinc-500">内部标签（多选，只对私聊生效）</div>
            <div className="mb-3 flex flex-col gap-1">
              {s.tags.map((t) => <Checkbox key={t.id} checked={f.tagIds.includes(t.id)} onChange={() => toggleTag(t.id)} label={<span style={{ color: t.color }}>{t.name}</span>} />)}
              {s.tags.length === 0 && <span className="text-[12px] text-zinc-400">没有标签</span>}
            </div>
            <Checkbox checked={f.idle} onChange={(v) => onChange({ ...f, idle: v })} label={`长期未跟进（超过 ${idleDays} 天）`} />
            <div className="mt-3 flex justify-end border-t border-zinc-100 pt-2">
              <button type="button" disabled={!count} onClick={() => onChange({ ...EMPTY_FILTERS, q: f.q })} className="text-[12px] text-zinc-500 hover:text-brand-700 disabled:text-zinc-300">
                清除筛选
              </button>
            </div>
          </div>
        )}
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
      {isDm ? <Avatar text={row.title} size={38} /> : <Avatar text={row.title} size={38} color={group?.kind === 'channel' ? '#b45309' : '#0f766e'} official={group?.official} />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-zinc-900">{row.title}</span>
          {primaryTitle && <TitleChip title={primaryTitle} size="xs" />}
          {!isDm && <span className="shrink-0 text-[11px] text-zinc-400">{group?.kind === 'channel' ? '频道' : `群 · ${(group?.memberCustomerIds.length ?? 0) + (group?.memberSeatIds.length ?? 0)}`}</span>}
          <span className="ml-auto shrink-0 text-[11px] tabular-nums text-zinc-400">{fmtRelative(row.conv.lastMessageAt)}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-[12px] text-zinc-500">{preview}</span>
          {row.pinned && <Pin size={11} className="shrink-0 text-zinc-400" />}
          {row.muted && <BellOff size={11} className="shrink-0 text-zinc-400" />}
          {row.unread > 0 && <span className={clsx('shrink-0 rounded-full px-1.5 text-[11px] leading-4 text-white', row.muted ? 'bg-zinc-400' : 'bg-red-500')}>{row.unread}</span>}
          {row.mentioned && <span className="shrink-0 rounded-full bg-amber-500 px-1.5 text-[11px] leading-4 text-white">@</span>}
        </div>
        {view === 'waiting' && row.waitingSince && <div className="mt-0.5 text-[11px] text-amber-600">已等待 {fmtWait(row.waitingSince)}</div>}
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
    <button type="button" onMouseDown={(e) => e.stopPropagation()} onClick={() => run(fn, msg)} className={clsx('block w-full px-3 py-1.5 text-left text-[12px] hover:bg-zinc-50', danger ? 'text-red-700' : 'text-zinc-700')}>
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
