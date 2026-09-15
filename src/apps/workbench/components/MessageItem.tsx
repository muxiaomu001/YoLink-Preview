/**
 * 单条消息：系统消息灰色居中；文本 URL 自动成链接；引用条可跳转；撤回 / 删除用占位；
 * 机器人、群发、转发、AI 草稿、欢迎语小标；悬停操作按权限显示（引用、撤回、删除、转发、复制、置顶）。
 */
import { clsx } from 'clsx'
import { Bot, Copy, Forward, Pin, Reply, Trash2, Undo2 } from 'lucide-react'
import type { ChatGroup, Message, Seat } from '@/domain/types'
import { fmtDateTime, fmtTime } from '@/domain/time'
import { botById, seatCan, seatGroupPerm, senderName, visibleText } from '@/store/policy'
import { customerById, seatById, staffById } from '@/store/selectors'
import { Avatar, Pill, SeatAvatar, TitleChip } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { useWorkbench } from '../useWorkbench'
import { copyText, jumpToMessage } from './group/shared'

const URL_RE = /(https?:\/\/[^\s]+)/g

/** 文本渲染：URL 变链接，搜索命中高亮 */
function renderText(text: string, highlight?: string) {
  const parts = text.split(URL_RE)
  return parts.map((p, i) => {
    if (URL_RE.test(p)) {
      URL_RE.lastIndex = 0
      return <a key={i} href={p} target="_blank" rel="noreferrer" className="underline underline-offset-2 break-all opacity-90 hover:opacity-100">{p}</a>
    }
    URL_RE.lastIndex = 0
    if (!highlight) return <span key={i}>{p}</span>
    const segs = p.split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return <span key={i}>{segs.map((sg, j) => (sg.toLowerCase() === highlight.toLowerCase() ? <mark key={j} className="rounded-sm bg-amber-200 text-amber-950">{sg}</mark> : sg))}</span>
  })
}

export function MessageItem({
  m,
  showDate,
  seat,
  group,
  highlight,
  current,
  onReply,
  onForward,
  onPin,
}: {
  m: Message
  showDate: boolean
  seat: Seat
  group?: ChatGroup
  highlight?: string
  current?: boolean
  onReply: (m: Message) => void
  onForward: (m: Message) => void
  onPin: (m: Message) => void
}) {
  const { s, staff, can } = useWorkbench()
  const isGroup = !!group
  const mine = m.senderKind === 'seat' && m.seatId === seat.id
  const gone = !!m.recalledAt || !!m.deletedAt
  const otherSeat = m.senderKind === 'seat' && !mine ? seatById(s, m.seatId) : undefined
  const customer = m.senderKind === 'customer' ? customerById(s, m.senderId) : undefined
  const bot = m.senderKind === 'bot' ? botById(s, m.senderId) : undefined
  const op = m.senderKind === 'seat' ? staffById(s, m.operatorId) : undefined
  const senderTitle = customer?.primaryTitleId ? s.titles.find((t) => t.id === customer.primaryTitleId && t.enabled) : undefined
  const replyTo = m.replyToId ? s.messages.find((x) => x.id === m.replyToId) : undefined
  const pinned = !!group?.pinnedMessageIds.includes(m.id)

  // 操作权限
  const recallLimit = s.policyNumbers.recallSeconds
  const recallExpired = Date.now() - new Date(m.at).getTime() > recallLimit * 1000
  const showRecall = mine && !gone
  const showDelete = !gone && (isGroup ? !mine && seatGroupPerm(s, group, seat.id, staff?.id ?? null, 'can_delete_messages') : m.senderKind === 'customer' && (can('view_audit') || can('manage_groups')))
  const showForward = !gone && seatCan(s, seat.id, isGroup ? 'group.forward' : 'dm.forward', group?.id)
  const showPin = isGroup && !gone && !pinned && seatGroupPerm(s, group, seat.id, staff?.id ?? null, 'can_pin_messages')

  const recall = async () => {
    if (!staff) return
    if (recallExpired) return toast(`超过 ${recallLimit} 秒，不能撤回`, 'warn')
    const ok = await confirm({ title: '撤回这条消息？', body: `撤回后客户端显示「消息已撤回」，审计仍可查原文。时限 ${recallLimit} 秒。`, okText: '撤回' })
    if (!ok) return
    toast(s.recallMessage(m.id, staff.id) ? '已撤回' : `超过 ${recallLimit} 秒，撤回失败`, 'info')
  }
  const del = async () => {
    if (!staff) return
    const ok = await confirm({ title: '删除这条消息？', body: '客户端显示「消息已被管理员删除」，工作台仍能看到原文，审计可查。', okText: '删除', danger: true })
    if (!ok) return
    s.seatDeleteMessage(m.id, seat.id, staff.id)
    toast('已删除，记入管理员日志与审计', 'warn')
  }
  const copy = async () => toast((await copyText(m.text)) ? '已复制' : '复制失败：浏览器不允许访问剪贴板', 'info')

  if (m.senderKind === 'system') {
    return (
      <div id={`msg-${m.id}`} className="my-2 rounded-md text-center">
        {showDate && <div className="mb-2 text-[11px] text-zinc-400">{fmtDateTime(m.at).slice(0, 10)}</div>}
        <span className="inline-block rounded-full bg-zinc-200/70 px-2.5 py-0.5 text-[11px] text-zinc-500">{m.text}{m.mentionAll ? ' · @所有人' : ''}</span>
      </div>
    )
  }

  return (
    <div id={`msg-${m.id}`} className={clsx('rounded-md transition-shadow', current && 'ring-2 ring-amber-300')}>
      {showDate && <div className="my-3 text-center text-[11px] text-zinc-400">{fmtDateTime(m.at).slice(0, 10)}</div>}
      <div className={clsx('group relative mb-3.5 flex gap-2.5', mine && 'flex-row-reverse')}>
        {mine ? <SeatAvatar seat={seat} size={30} /> : otherSeat ? <SeatAvatar seat={otherSeat} size={30} /> : bot ? <Avatar text={bot.nickname} size={30} color={bot.avatarColor} /> : <Avatar text={customer?.nickname ?? '?'} size={30} />}
        <div className={clsx('max-w-[70%]', mine && 'items-end text-right')}>
          {!mine && (isGroup || bot) && (
            <div className="mb-0.5 flex items-center gap-1 text-[11px] text-zinc-500">
              {senderName(s, m)}
              {senderTitle && <TitleChip title={senderTitle} size="xs" />}
              {otherSeat && <Pill tone="blue">官方</Pill>}
              {bot && <Pill tone="purple"><Bot size={10} className="mr-0.5" />机器人</Pill>}
            </div>
          )}
          {replyTo && (
            <button
              type="button"
              onClick={() => !jumpToMessage(replyTo.id) && toast('原消息不在当前视图', 'info')}
              className={clsx('mb-0.5 block max-w-full truncate rounded border-l-2 border-brand-400 bg-zinc-100 px-2 py-0.5 text-left text-[11px] text-zinc-500 hover:bg-zinc-200', mine && 'ml-auto')}
              title="点击跳到原消息"
            >
              {senderName(s, replyTo)}：{visibleText(replyTo, 'staff').slice(0, 40)}
            </button>
          )}
          <div className={clsx('inline-block rounded-lg px-3 py-2 text-left text-[13px] leading-relaxed whitespace-pre-wrap', gone ? 'bg-zinc-100 text-zinc-400 italic' : mine ? 'bg-brand-700 text-white' : otherSeat ? 'bg-brand-50 text-brand-900' : bot ? 'bg-purple-50 text-purple-950' : 'bg-white text-zinc-800 shadow-sm')}>
            {m.forwardedFrom && <div className={clsx('mb-0.5 text-[11px]', mine ? 'text-brand-100' : 'text-zinc-400')}>转发的消息</div>}
            {gone ? visibleText(m, 'staff') : m.kind === 'image' ? `[图片] ${m.text}` : renderText(m.text, highlight)}
          </div>
          <div className={clsx('mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400', mine && 'justify-end')}>
            <span className="tabular-nums">{fmtTime(m.at)}</span>
            {pinned && <span className="inline-flex items-center gap-0.5 text-amber-600"><Pin size={10} />已置顶</span>}
            {m.isWelcome && <span className="rounded bg-zinc-100 px-1">欢迎语</span>}
            {m.isBroadcast && <span className="rounded bg-amber-50 px-1 text-amber-700">群发</span>}
            {m.aiDraftUsed && <span className="rounded bg-violet-50 px-1 text-violet-600">AI 草稿</span>}
            {m.mentionAll && <span className="rounded bg-amber-50 px-1 text-amber-700">@所有人</span>}
            {m.senderKind === 'seat' && can('view_seat_operator') && op && <span title="客户看不到这个">实操：{op.name}</span>}
            {bot && m.operatorId && can('view_seat_operator') && <span title="客户看不到这个">手动：{staffById(s, m.operatorId)?.name}</span>}
          </div>
        </div>
        {/* 悬停操作 */}
        <div className={clsx('absolute -top-3 hidden items-center gap-0.5 rounded-md border border-zinc-200 bg-white px-1 py-0.5 shadow-sm group-hover:flex', mine ? 'right-10' : 'left-10')}>
          {!gone && <Act icon={Reply} label="引用回复" onClick={() => onReply(m)} />}
          {showRecall && <Act icon={Undo2} label={recallExpired ? `超过 ${recallLimit} 秒，不能撤回` : `撤回（${recallLimit} 秒内）`} disabled={recallExpired} onClick={() => void recall()} />}
          {showDelete && <Act icon={Trash2} label={isGroup ? '删除他人消息（群内权限）' : '删除客户消息（员工能力）'} danger onClick={() => void del()} />}
          {showForward && <Act icon={Forward} label="转发到其他会话" onClick={() => onForward(m)} />}
          {!gone && <Act icon={Copy} label="复制文本" onClick={() => void copy()} />}
          {showPin && <Act icon={Pin} label="置顶（群内权限）" onClick={() => onPin(m)} />}
        </div>
      </div>
    </div>
  )
}

function Act({ icon: Icon, label, onClick, danger, disabled }: { icon: typeof Reply; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button type="button" title={label} disabled={disabled} onClick={onClick} className={clsx('rounded p-1 text-zinc-500 hover:bg-zinc-100', disabled ? 'cursor-not-allowed text-zinc-300' : danger ? 'hover:text-red-700' : 'hover:text-brand-700')}>
      <Icon size={14} />
    </button>
  )
}
