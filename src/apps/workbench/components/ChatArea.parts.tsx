/**
 * 聊天区的零件：顶栏（客户在线状态 / 群成员数 / 搜索 / 右栏开关）、群置顶条、会话内搜索栏、转发弹窗、置顶弹窗。
 */
import { useState } from 'react'
import { clsx } from 'clsx'
import { ChevronDown, ChevronUp, PanelRightClose, PanelRightOpen, Pin, Search, X } from 'lucide-react'
import type { ChatGroup, Message, Seat } from '@/domain/types'
import { messageShadow, messageVisibleFor, seatMessageSendAllowed } from '@/domain/messageRules'
import { fmtAgo } from '@/domain/time'
import { seatCan, senderName, visibleText } from '@/store/policy'
import { conversationsForSeat, type ConvRow } from '@/store/selectors'
import { FileCard, ImageThumb } from '@/ui/media'
import { PlayableMedia } from '@/ui/PlayableMedia'
import { Avatar, Pill, TitleChip } from '@/ui/display'
import { Button, Checkbox, Input } from '@/ui/primitives'
import { Modal, toast } from '@/ui/overlay'
import { useWorkbench } from '../useWorkbench'
import { jumpToMessage, memberTotal } from './group/groupRules'

const ONLINE_WINDOW_MS = 5 * 60 * 1000

function HeaderBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={title} onClick={onClick} className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-brand-700">
      {children}
    </button>
  )
}

export function ChatHeader({
  row,
  group,
  onGroupInfo,
  onSearch,
  onMedia,
  rightOpen,
  onToggleRight,
}: {
  row: ConvRow
  group?: ChatGroup
  onGroupInfo: () => void
  onSearch: () => void
  onMedia:()=>void
  rightOpen: boolean
  onToggleRight: () => void
}) {
  const { s } = useWorkbench()
  const [renderedAt] = useState(Date.now)
  const c = row.customer
  const online = c ? renderedAt - new Date(c.lastActiveAt).getTime() < ONLINE_WINDOW_MS : false
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4">
      {c ? (
        <>
          <Avatar text={c.nickname} size={30} />
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
          <Avatar text={group.name} size={30} color={group.kind === 'channel' ? '#b45309' : '#0f766e'} official={group.official} />
          <span className="text-[13px] font-semibold text-zinc-900">{group.name}</span>
          {group.official && <Pill tone="amber">官方</Pill>}
          <button type="button" onClick={onGroupInfo} className="text-[11px] text-brand-700 hover:underline" title="打开右侧群信息卡">
            {group.kind === 'channel' ? '频道 · 客户只读 · ' : ''}{memberTotal(group)} 位成员
          </button>
          {group.settings.allMuted && <Pill tone="amber">全员禁言中</Pill>}
        </>
      ) : null}
      <div className="ml-auto flex items-center gap-1">
        <button type="button" className="whitespace-nowrap rounded-md px-2 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100" onClick={onMedia}>文件与媒体</button>
        <HeaderBtn title="搜索会话内消息（⌘F）" onClick={onSearch}><Search size={16} /></HeaderBtn>
        <HeaderBtn title={rightOpen ? '收起右侧资料栏' : '展开右侧资料栏'} onClick={onToggleRight}>{rightOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}</HeaderBtn>
      </div>
    </header>
  )
}

export function PinnedBar({ group, canPin }: { group: ChatGroup; canPin: boolean }) {
  const { s, staff, seat } = useWorkbench()
  const [open, setOpen] = useState(false)
  const list = group.pinnedMessageIds.map((id) => s.messages.find((m) => m.id === id)).filter((m): m is Message => !!m && !!seat && messageVisibleFor(s,m,{kind:'seat',id:seat.id,staffId:staff?.id}))
  if (!list.length) return null
  const shown = open ? list : list.slice(0, 1)
  const jump = (id: string) => !jumpToMessage(id) && toast('该消息不在当前视图', 'info')
  const unpin = (id: string) => {
    if (!seat || !staff) return
    const result = s.unpinMessage(group.id, id, { seatId: seat.id, staffId: staff.id })
    if (result) return toast(result.reason, 'warn')
    toast('已取消置顶')
  }
  return (
    <div className="shrink-0 border-b border-amber-100 bg-amber-50/70 px-4 py-1.5 text-[12px]">
      {shown.map((m) => (
        <div key={m.id} className="flex items-center gap-2 py-0.5">
          <Pin size={12} className="shrink-0 text-amber-600" />
          <button type="button" className="min-w-0 flex-1 truncate text-left text-zinc-700 hover:underline" onClick={() => jump(m.id)}>
            <span className="text-zinc-400">{senderName(s, m)}：</span>{visibleText(m, 'staff')}
          </button>
          {canPin && <button type="button" className="text-[11px] text-zinc-400 hover:text-red-700" onClick={() => unpin(m.id)}>取消置顶</button>}
        </div>
      ))}
      {list.length > 1 && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] text-amber-700 hover:underline">
          {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />} {open ? '收起' : `共 ${list.length} 条置顶，展开`}
        </button>
      )}
    </div>
  )
}

export function MessageSearchBar({ query, onQuery, total, idx, onIdx, onClose }: { query: string; onQuery: (v: string) => void; total: number; idx: number; onIdx: (i: number) => void; onClose: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-4 py-1.5">
      <Search size={13} className="text-zinc-400" />
      <Input autoFocus value={query} onChange={(e) => onQuery(e.target.value)} placeholder="搜索当前会话内的消息…（⌘F）" className="h-7 max-w-sm text-[12px]" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter' && total) onIdx((idx + 1) % total) }} />
      <span className="text-[11px] tabular-nums text-zinc-500">{query ? (total ? `${idx + 1} / ${total}` : '无匹配') : ''}</span>
      <Button size="sm" variant="ghost" disabled={!total} onClick={() => onIdx((idx - 1 + total) % total)}><ChevronUp size={12} /> 上一条</Button>
      <Button size="sm" variant="ghost" disabled={!total} onClick={() => onIdx((idx + 1) % total)}><ChevronDown size={12} /> 下一条</Button>
      <button type="button" onClick={onClose} className="ml-auto text-zinc-400 hover:text-zinc-700" aria-label="关闭搜索"><X size={14} /></button>
    </div>
  )
}

export function ForwardModal({ message, messages, seat, onClose }: { message: Message; messages?: Message[]; seat: Seat; onClose: () => void }) {
  const { s, staff } = useWorkbench()
  const [q, setQ] = useState('')
  const [note,setNote]=useState('')
  const selected=messages??[message]
  const [target, setTarget] = useState<string | null>(null)
  const rows = conversationsForSeat(s, seat.id).filter((r) => r.conv.id !== message.convId && (!q.trim() || r.title.includes(q.trim())))
  const submit = () => {
    if (!target || !staff) return
    const actor={kind:'seat' as const,id:seat.id,staffId:staff.id}
    const current=selected.map((m)=>s.messages.find((x)=>x.id===m.id))
    if(current.some((m)=>!m||!messageVisibleFor(s,m,actor)||m.kind==='system'||m.delivery&&m.delivery!=='sent'||!seatCan(s,seat.id,s.conversations.find((c)=>c.id===m.convId)?.kind==='dm'?'dm.forward':'group.forward')))return toast('部分消息已不可转发，请重新选择','warn')
    if(!seatMessageSendAllowed(s,target,seat.id,staff.id,current.some((m)=>!!m?.media)))return toast('目标会话不允许发送','warn')
    for(const m of current){if(!m||m.kind==='system')continue;const r=s.queueChatMessage({convId:target,actor,text:m.text,kind:m.kind,media:m.media,forwardedFrom:{convId:m.convId,messageId:m.id,name:senderName(s,m)}});if(!r.ok)return toast(r.reason??'转发失败','warn')}
    if(note.trim())s.queueChatMessage({convId:target,actor,text:note.trim()})
    toast(`已将 ${current.length} 条消息加入发送，结果可在目标会话查看`)
    onClose()
  }
  return (
    <Modal open onClose={onClose} title="转发到…" width={460} footer={<><Button onClick={onClose}>取消</Button><Button variant="primary" disabled={!target} onClick={submit}>转发</Button></>}>
      <div className="mb-3 max-h-48 space-y-2 overflow-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-700">{selected.map((m)=><div key={m.id}><p className="mb-1 text-zinc-500">转发自 {senderName(s,m)}</p>{m.media?(m.kind==='image'?<ImageThumb media={m.media} maxWidth={180}/>:m.kind==='video'||m.kind==='voice'?<PlayableMedia kind={m.kind} media={m.media}/>:<FileCard media={m.media}/>):null}<p className="whitespace-pre-wrap">{m.text}</p></div>)}</div>
      <Input aria-label="转发附言" placeholder="添加附言（可选）" value={note} onChange={(e)=>setNote(e.target.value)} className="mb-3"/>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索会话" className="mb-2 h-7 text-[12px]" />
      <ul className="thin-scroll max-h-72 divide-y divide-zinc-100 overflow-y-auto rounded-md border border-zinc-200">
        {!rows.length && <li className="py-6 text-center text-[12px] text-zinc-400">没有其他会话</li>}
        {rows.map((r) => (
          <li key={r.conv.id}>
            <button type="button" disabled={!staff || !seatMessageSendAllowed(s, r.conv.id, seat.id, staff.id, selected.some((m)=>!!m.media))} title={!staff || !seatMessageSendAllowed(s, r.conv.id, seat.id, staff.id, selected.some((m)=>!!m.media)) ? '当前不能向此会话发送' : undefined} onClick={() => setTarget(r.conv.id)} className={clsx('flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] disabled:cursor-not-allowed disabled:opacity-40', target === r.conv.id ? 'bg-brand-50' : 'hover:bg-zinc-50')}>
              <Avatar text={r.title} size={22} />
              <span className="min-w-0 flex-1 truncate">{r.title}</span>
              <span className="text-[11px] text-zinc-400">{r.conv.kind === 'dm' ? '私聊' : r.conv.kind === 'channel' ? '频道' : '群'}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 text-[11px] text-zinc-400">只能转发到当前坐席「{seat.displayName}」的会话；转发出去的消息带"转发的消息"标记。</div>
    </Modal>
  )
}

export function PinModal({ message, group, onClose }: { message: Message; group: ChatGroup; onClose: () => void }) {
  const { s, staff, seat } = useWorkbench()
  const [notify, setNotify] = useState(true)
  const shadowed = !!messageShadow(s, s.messages.find((m) => m.id === message.id) ?? message).shadowedAt
  const submit = () => {
    if (!seat || !staff) return
    const result = s.pinMessage(group.id, message.id, notify && !shadowed, { seatId: seat.id, staffId: staff.id })
    if (result) return toast(result.reason, 'warn')
    toast(notify && !shadowed ? '已置顶，并向成员发出系统消息' : '已置顶')
    onClose()
  }
  return (
    <Modal open onClose={onClose} title="置顶这条消息？" width={420} footer={<><Button onClick={onClose}>取消</Button><Button variant="primary" onClick={submit}>置顶</Button></>}>
      <div className="mb-3 rounded-md bg-zinc-50 px-2.5 py-1.5 text-[12px] text-zinc-600">{senderName(s, message)}：{message.text.slice(0, 80)}</div>
      <Checkbox checked={notify && !shadowed} disabled={shadowed} onChange={setNotify} label="通知成员（群里发一条「置顶了一条消息」的系统消息）" />
      {shadowed && <p className="mt-2 text-xs text-purple-700">此消息处于影子屏蔽状态，置顶不会向群成员发送通知。</p>}
      <div className="mt-2 text-[11px] text-zinc-400">置顶数量不限；群顶部显示最新一条，展开可看全部。</div>
    </Modal>
  )
}
