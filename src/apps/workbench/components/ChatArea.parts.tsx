/**
 * 聊天区的零件：顶栏（客户在线状态 / 群成员数）、群置顶条、会话内搜索栏、转发弹窗、置顶弹窗、AI 回复推荐面板。
 */
import { useState } from 'react'
import { clsx } from 'clsx'
import { ChevronDown, ChevronUp, Pin, Search, Sparkles, X } from 'lucide-react'
import type { AiDraft } from '@/domain/ai'
import type { ChatGroup, Message, Seat } from '@/domain/types'
import { fmtAgo } from '@/domain/time'
import { senderName, visibleText } from '@/store/policy'
import { conversationsForSeat, type ConvRow } from '@/store/selectors'
import { Avatar, Pill, SeatAvatar, TitleChip } from '@/ui/display'
import { Button, Checkbox, Input } from '@/ui/primitives'
import { Modal, toast } from '@/ui/overlay'
import { useWorkbench } from '../useWorkbench'
import { jumpToMessage, memberTotal } from './group/shared'

const ONLINE_WINDOW_MS = 5 * 60 * 1000

export function ChatHeader({ row, seat, group, onGroupInfo }: { row: ConvRow; seat: Seat; group?: ChatGroup; onGroupInfo: () => void }) {
  const { s } = useWorkbench()
  const c = row.customer
  const online = c ? Date.now() - new Date(c.lastActiveAt).getTime() < ONLINE_WINDOW_MS : false
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4">
      {c ? (
        <>
          <Avatar text={c.nickname} size={28} />
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-zinc-900">{c.nickname}</span>
            {c.titleIds.map((tid) => {
              const t = s.titles.find((x) => x.id === tid && x.enabled)
              return t ? <TitleChip key={tid} title={t} size="xs" /> : null
            })}
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
            <span className={clsx('inline-block h-2 w-2 rounded-full', online ? 'bg-emerald-500' : 'bg-zinc-300')} />
            {online ? '在线' : `${fmtAgo(c.lastActiveAt)}活跃`}
          </span>
          <span className="text-[11px] text-zinc-400">{c.accountId}</span>
        </>
      ) : group ? (
        <>
          <Avatar text={group.name} size={28} color={group.kind === 'channel' ? '#b45309' : '#0f766e'} official={group.official} />
          <span className="text-[13px] font-semibold text-zinc-900">{group.name}</span>
          {group.official && <Pill tone="amber">官方</Pill>}
          <button type="button" onClick={onGroupInfo} className="text-[11px] text-brand-700 hover:underline" title="打开右侧群信息卡">
            {group.kind === 'channel' ? '频道 · 客户只读 · ' : ''}{memberTotal(group)} 位成员
          </button>
          {group.settings.allMuted && <Pill tone="amber">全员禁言中（不影响坐席与管理员）</Pill>}
        </>
      ) : null}
      <div className="ml-auto flex items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-1 text-[11px] text-zinc-600">
        <SeatAvatar seat={seat} size={16} /> 以「{seat.displayName}」身份发言
      </div>
    </header>
  )
}

export function PinnedBar({ group, canPin }: { group: ChatGroup; canPin: boolean }) {
  const { s, staff, seat } = useWorkbench()
  const [open, setOpen] = useState(false)
  const list = group.pinnedMessageIds.map((id) => s.messages.find((m) => m.id === id)).filter((m) => !!m)
  if (!list.length) return null
  const shown = open ? list : list.slice(0, 1)
  const jump = (id: string) => !jumpToMessage(id) && toast('该消息不在当前视图', 'info')
  const unpin = (id: string) => {
    if (!seat || !staff) return
    s.unpinMessage(group.id, id, { seatId: seat.id, staffId: staff.id })
    toast('已取消置顶')
  }
  return (
    <div className="shrink-0 border-b border-amber-100 bg-amber-50/70 px-4 py-1.5 text-[11px]">
      {shown.map((m) => (
        <div key={m.id} className="flex items-center gap-2 py-0.5">
          <Pin size={11} className="shrink-0 text-amber-600" />
          <button type="button" className="min-w-0 flex-1 truncate text-left text-zinc-700 hover:underline" onClick={() => jump(m.id)}>
            <span className="text-zinc-400">{senderName(s, m)}：</span>{visibleText(m, 'staff')}
          </button>
          {canPin && <button type="button" className="text-zinc-400 hover:text-red-700" onClick={() => unpin(m.id)}>取消置顶</button>}
        </div>
      ))}
      {list.length > 1 && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-amber-700 hover:underline">
          {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />} {open ? '收起' : `共 ${list.length} 条置顶，展开`}
        </button>
      )}
    </div>
  )
}

export function MessageSearchBar({ query, onQuery, total, idx, onIdx, onClose }: { query: string; onQuery: (v: string) => void; total: number; idx: number; onIdx: (i: number) => void; onClose: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-4 py-1.5">
      <Search size={13} className="text-zinc-400" />
      <Input autoFocus value={query} onChange={(e) => onQuery(e.target.value)} placeholder="搜索当前会话内的消息…（⌘F）" className="h-7 max-w-sm text-xs" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter' && total) onIdx((idx + 1) % total) }} />
      <span className="text-[11px] tabular-nums text-zinc-500">{query ? (total ? `${idx + 1} / ${total}` : '无匹配') : ''}</span>
      <Button size="sm" variant="ghost" disabled={!total} onClick={() => onIdx((idx - 1 + total) % total)}><ChevronUp size={12} /> 上一条</Button>
      <Button size="sm" variant="ghost" disabled={!total} onClick={() => onIdx((idx + 1) % total)}><ChevronDown size={12} /> 下一条</Button>
      <button type="button" onClick={onClose} className="ml-auto text-zinc-400 hover:text-zinc-700" aria-label="关闭搜索"><X size={14} /></button>
    </div>
  )
}

export function ForwardModal({ message, seat, onClose }: { message: Message; seat: Seat; onClose: () => void }) {
  const { s, staff } = useWorkbench()
  const [q, setQ] = useState('')
  const [target, setTarget] = useState<string | null>(null)
  const rows = conversationsForSeat(s, seat.id).filter((r) => r.conv.id !== message.convId && (!q.trim() || r.title.includes(q.trim())))
  const submit = () => {
    if (!target || !staff) return
    s.forwardMessage(message.id, target, seat.id, staff.id)
    toast(`已转发到「${rows.find((r) => r.conv.id === target)?.title}」`)
    onClose()
  }
  return (
    <Modal open onClose={onClose} title="转发到…" width={460} footer={<><Button onClick={onClose}>取消</Button><Button variant="primary" disabled={!target} onClick={submit}>转发</Button></>}>
      <div className="mb-2 rounded-md bg-zinc-50 px-2.5 py-1.5 text-[11px] text-zinc-600">{senderName(s, message)}：{message.text.slice(0, 80)}</div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索会话" className="mb-2 h-7 text-xs" />
      <ul className="thin-scroll max-h-72 divide-y divide-zinc-100 overflow-y-auto rounded-md border border-zinc-200">
        {!rows.length && <li className="py-6 text-center text-xs text-zinc-400">没有其他会话</li>}
        {rows.map((r) => (
          <li key={r.conv.id}>
            <button type="button" onClick={() => setTarget(r.conv.id)} className={clsx('flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs', target === r.conv.id ? 'bg-brand-50' : 'hover:bg-zinc-50')}>
              <Avatar text={r.title} size={22} />
              <span className="min-w-0 flex-1 truncate">{r.title}</span>
              <span className="text-[10px] text-zinc-400">{r.conv.kind === 'dm' ? '私聊' : r.conv.kind === 'channel' ? '频道' : '群'}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 text-[10px] text-zinc-400">只能转发到当前坐席「{seat.displayName}」的会话；转发出去的消息带"转发的消息"标记。</div>
    </Modal>
  )
}

export function PinModal({ message, group, onClose }: { message: Message; group: ChatGroup; onClose: () => void }) {
  const { s, staff, seat } = useWorkbench()
  const [notify, setNotify] = useState(true)
  const submit = () => {
    if (!seat || !staff) return
    s.pinMessage(group.id, message.id, notify, { seatId: seat.id, staffId: staff.id })
    toast(notify ? '已置顶，并向成员发出系统消息' : '已置顶')
    onClose()
  }
  return (
    <Modal open onClose={onClose} title="置顶这条消息？" width={420} footer={<><Button onClick={onClose}>取消</Button><Button variant="primary" onClick={submit}>置顶</Button></>}>
      <div className="mb-3 rounded-md bg-zinc-50 px-2.5 py-1.5 text-[11px] text-zinc-600">{senderName(s, message)}：{message.text.slice(0, 80)}</div>
      <Checkbox checked={notify} onChange={setNotify} label="通知成员（群里发一条「置顶了一条消息」的系统消息）" />
      <div className="mt-2 text-[10px] text-zinc-400">置顶数量不限；群顶部显示最新一条，展开可看全部。</div>
    </Modal>
  )
}

export function AiPanel({ drafts, onSend, onEdit }: { drafts: AiDraft[]; onSend: (d: AiDraft) => void; onEdit: (d: AiDraft) => void }) {
  if (!drafts.length) return null
  return (
    <div className="border-t border-violet-100 bg-violet-50/60 px-4 py-2">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-violet-700">
        <Sparkles size={12} /> AI 回复推荐 · 依据客户最后一句、资料卡与知识库 · 可在「设置」里关闭
      </div>
      <div className="flex flex-col gap-1.5">
        {drafts.map((d, i) => (
          <div key={i} className="flex items-start gap-2 rounded-md border border-violet-100 bg-white px-2.5 py-1.5">
            <div className="min-w-0 flex-1">
              <div className="text-xs leading-relaxed text-zinc-800">{d.text}</div>
              <div className="mt-0.5 text-[10px] text-zinc-400">依据：{d.basis}</div>
            </div>
            <Button size="sm" variant="primary" onClick={() => onSend(d)}>一键发出</Button>
            <Button size="sm" onClick={() => onEdit(d)}>改后发</Button>
          </div>
        ))}
      </div>
    </div>
  )
}
