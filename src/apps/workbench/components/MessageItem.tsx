/**
 * 单条消息：系统消息灰色居中；文本 URL 自动成链接；图片消息显示缩略图（点开大图）、文件消息显示文件卡，说明文字在下方；
 * 引用条可跳转；已删除的消息不进列表、不留占位；机器人、群发、转发、AI 草稿、欢迎语小标；文字菜单按权限显示（引用、删除、转发、复制、置顶）。
 */
import { useCallback, useState } from 'react'
import { clsx } from 'clsx'
import { Bot, CheckSquare, Copy, Forward, MoreHorizontal, Pencil, Pin, Reply, Trash2 } from 'lucide-react'
import type { ChatGroup, Message, Seat } from '@/domain/types'
import { channelOf, messageVisibleFor } from '@/domain/messageRules'
import { fmtDateTime, fmtTime } from '@/domain/time'
import { botById, seatCan, seatGroupPerm, senderName } from '@/store/policy'
import { customerById, seatById, staffById } from '@/store/selectors'
import { Avatar, Pill, SeatAvatar, TitleChip } from '@/ui/display'
import { PlayableMedia } from '@/ui/PlayableMedia'
import { FileCard, ImageThumb } from '@/ui/media'
import { MessageText } from '@/ui/MessageText'
import { MessageReceipt } from '@/ui/MessageReceipt'
import { Button, Textarea } from '@/ui/primitives'
import { Modal, toast } from '@/ui/overlay'
import { DeleteMessagesModal } from '@/ui/DeleteMessagesModal'
import { MessageDelivery } from '@/ui/MessageDelivery'
import { MessageActionMenu, type MessageMenuAction } from './MessageActionMenu'
import { useWorkbench } from '../useWorkbench'
import { copyText, jumpToMessage } from './group/groupRules'

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
  onSelect,
  selected,
}: {
  m: Message
  showDate: boolean
  seat: Seat
  group?: ChatGroup
  highlight?: string
  current?: boolean
  onReply: (m: Message, quoteText?:string) => void
  onForward: (m: Message) => void
  onPin: (m: Message) => void
  onSelect?: (m: Message) => void
  selected?: boolean
}) {
  const { s, staff, can } = useWorkbench()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 })
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const positionMenu = (left: number, top: number) => setMenuPosition({ left, top })
  const [editing, setEditing] = useState(false)
  const [quoteSelection,setQuoteSelection]=useState('')
  const [deleting, setDeleting] = useState(false)
  const actor = { kind: 'seat' as const, id: seat.id, staffId: staff?.id }
  const channel = channelOf(s,m)
  const isGroup = !!group
  const mine = m.senderKind === 'seat' && m.seatId === seat.id
  const otherSeat = m.senderKind === 'seat' && !mine ? seatById(s, m.seatId) : undefined
  const customer = m.senderKind === 'customer' ? customerById(s, m.senderId) : undefined
  const bot = m.senderKind === 'bot' ? botById(s, m.senderId) : undefined
  const op = m.senderKind === 'seat' ? staffById(s, m.operatorId) : undefined
  const senderTitle = customer?.primaryTitleId ? s.titles.find((t) => t.id === customer.primaryTitleId && t.enabled) : undefined
  const replyTo = m.replyToId ? s.messages.find((x) => x.id === m.replyToId && messageVisibleFor(s,x,actor)) : undefined
  const pinned = !!group?.pinnedMessageIds.includes(m.id)
  const hasMedia = (m.kind === 'image' || m.kind === 'file' || m.kind === 'video' || m.kind === 'voice') && !!m.media
  const bubbleCls = channel ? 'bg-white text-zinc-800 shadow-sm' : mine ? 'bg-brand-700 text-white' : otherSeat ? 'bg-brand-50 text-brand-900' : bot ? 'bg-purple-50 text-purple-950' : 'bg-white text-zinc-800 shadow-sm'

  // 操作权限
  const showForward = seatCan(s, seat.id, isGroup ? 'group.forward' : 'dm.forward', group?.id)
  const showPin = isGroup && !pinned && seatGroupPerm(s, group, seat.id, staff?.id ?? null, 'can_pin_messages')

  const copy = async () => toast((await copyText(m.text)) ? '已复制' : '复制失败：浏览器不允许访问剪贴板', 'info')

  const actions: MessageMenuAction[] = [
    { label: quoteSelection ? '引用所选文字' : '回复', icon: Reply, section: 0, onSelect: () => onReply(m,quoteSelection||undefined) },
    ...(mine && seatCan(s, seat.id, 'dm.edit') ? [{ label: '编辑消息', icon: Pencil, section: 0, onSelect: () => setEditing(true) }] : []),
    ...(m.text ? [{ label: '拷贝文本', icon: Copy, section: 0, onSelect: () => void copy() }] : []),
    ...(showPin ? [{ label: '置顶消息', icon: Pin, section: 1, onSelect: () => onPin(m) }] : []),
    ...(showForward ? [{ label: '转发', icon: Forward, section: 1, opensPicker: true, onSelect: () => onForward(m) }] : []),
    ...(onSelect ? [{ label: '选择多条', icon: CheckSquare, section: 1, onSelect: () => onSelect(m) }] : []),
    // 只有一个删除入口，范围（仅本方 / 为所有人）在弹窗里选，超时或无权限时那一项自动置灰
    { label: '删除', icon: Trash2, section: 2, danger: true, onSelect: () => setDeleting(true) },
  ]

  if (m.senderKind === 'system') {
    return (
      <div id={`msg-${m.id}`} data-message-id={m.id} className="my-2 rounded-md text-center">
        {showDate && <div className="mb-2 text-[11px] text-zinc-400">{fmtDateTime(m.at).slice(0, 10)}</div>}
        <span className="inline-block rounded-full bg-zinc-200/70 px-2.5 py-0.5 text-[11px] text-zinc-500">{m.text}{m.mentionAll ? ' · @所有人' : ''}</span>
      </div>
    )
  }

  return (
    <div id={`msg-${m.id}`} data-message-id={m.id} className={clsx('rounded-md transition-shadow', current && 'ring-2 ring-amber-300', selected && 'bg-brand-100/60 ring-1 ring-brand-300')}>
      {showDate && <div className="my-3 text-center text-[11px] text-zinc-400">{fmtDateTime(m.at).slice(0, 10)}</div>}
      <div onContextMenu={(e) => { e.preventDefault(); const selection=window.getSelection();const text=selection?.toString().trim()??'';setQuoteSelection(selection?.anchorNode&&e.currentTarget.contains(selection.anchorNode)&&text&&m.text.includes(text)?text.slice(0,1024):'');positionMenu(e.clientX, e.clientY); setMenuOpen(true) }} className={clsx('group relative mb-3.5 flex gap-2.5', mine && !channel && 'flex-row-reverse')}>
        {channel ? <Avatar text={channel.name} color="#b45309" size={30} official={channel.official} /> : mine ? <SeatAvatar seat={seat} size={30} /> : otherSeat ? <SeatAvatar seat={otherSeat} size={30} /> : bot ? <Avatar text={bot.nickname} size={30} color={bot.avatarColor} /> : <Avatar text={customer?.nickname ?? '?'} size={30} />}
        <div className={clsx('max-w-[70%]', mine && !channel && 'items-end text-right')}>
          {(channel || !mine && (isGroup || bot)) && (
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
              {senderName(s, replyTo)}：{(m.quoteText&&replyTo.text.includes(m.quoteText)?m.quoteText:replyTo.text).slice(0,120)}
            </button>
          )}
          {hasMedia ? (
            // 图片 / 文件消息：附件不包在气泡里，说明文字单独一个小气泡
            <div className={clsx('inline-flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
              {m.forwardedFrom && <div className="text-[11px] text-zinc-400">转发自 {m.forwardedFrom.name??'原会话'}</div>}
              {m.kind === 'video' || m.kind === 'voice' ? <PlayableMedia kind={m.kind} media={m.media!}/> : m.kind === 'image' ? <ImageThumb media={m.media!} maxWidth={240} className="shadow-sm" /> : <FileCard media={m.media!} />}
              {m.text && <div className={clsx('rounded-lg px-3 py-1.5 text-left text-[13px] leading-relaxed whitespace-pre-wrap', bubbleCls)}>{<MessageText m={m} highlight={highlight} />}</div>}
            </div>
          ) : (
            <div className={clsx('inline-block rounded-lg px-3 py-2 text-left text-[13px] leading-relaxed whitespace-pre-wrap', bubbleCls)}>
              {m.forwardedFrom && <div className={clsx('mb-0.5 text-[11px]', mine ? 'text-brand-100' : 'text-zinc-400')}>转发自 {m.forwardedFrom.name??'原会话'}</div>}
              <MessageText m={m} highlight={highlight} />
            </div>
          )}
          <div className={clsx('mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400', mine && !channel && 'justify-end')}>
            <span className="tabular-nums">{fmtTime(m.at)}</span>
            {m.editedAt && <span title={`修改于 ${fmtDateTime(m.editedAt)}`}>已编辑</span>}
            {m.channelSignature && <span>{m.channelSignature}</span>}
            {mine && <MessageDelivery message={m} actor={actor} />}
            {(!m.delivery || m.delivery === 'sent') && (mine || group) && <MessageReceipt m={m} staffSeatId={seat.id} />}
            {pinned && <span className="inline-flex items-center gap-0.5 text-amber-600"><Pin size={10} />已置顶</span>}
            {m.isWelcome && <span className="rounded bg-zinc-100 px-1">欢迎语</span>}
            {m.isBroadcast && <span className="rounded bg-amber-50 px-1 text-amber-700">群发</span>}
            {m.aiDraftUsed && <span className="rounded bg-violet-50 px-1 text-violet-600">AI 草稿</span>}
            {m.mentionAll && <span className="rounded bg-amber-50 px-1 text-amber-700">@所有人</span>}
            {m.senderKind === 'seat' && can('view_seat_operator') && op && <span title="客户看不到这个">实操：{op.name}</span>}
            {bot && m.operatorId && can('view_seat_operator') && <span title="客户看不到这个">手动：{staffById(s, m.operatorId)?.name}</span>}
          </div>
        </div>
        <button type="button" id={`menu-trigger-${m.id}`} aria-label="更多消息操作" aria-haspopup="menu" aria-expanded={menuOpen} title="更多消息操作（也可右键消息）" className={clsx('self-start rounded p-1 text-zinc-400 transition-opacity hover:bg-zinc-200 hover:text-zinc-700 focus-visible:opacity-100 group-hover:opacity-100', menuOpen ? 'opacity-100' : 'opacity-0')} onClick={(e) => { setQuoteSelection('');const rect = e.currentTarget.getBoundingClientRect(); positionMenu(rect.left, rect.bottom + 4); setMenuOpen((v) => !v) }}><MoreHorizontal size={16} /></button>
        {menuOpen && <MessageActionMenu triggerId={`menu-trigger-${m.id}`} actions={actions} position={menuPosition} onClose={closeMenu} />}
      </div>
      {deleting && <DeleteMessagesModal ids={[m.id]} actor={actor} onClose={() => setDeleting(false)} />}
      {editing && <EditMessage message={m} onClose={() => setEditing(false)} />}
    </div>
  )
}

function EditMessage({ message, onClose }: { message: Message; onClose: () => void }) {
  const { s, staff } = useWorkbench()
  const [original] = useState(message.text)
  const [text, setText] = useState(message.text)
  const [error, setError] = useState('')
  const save = () => {
    if (!staff) return
    const result = s.editMessage(message.id, text, staff.id, original)
    if (result) return setError(result)
    toast('已保存修改')
    onClose()
  }
  return <Modal open title="编辑消息" width={500} onClose={onClose} footer={<><Button onClick={onClose}>取消</Button><Button variant="primary" onClick={save} disabled={(!text.trim() && !message.media) || text.trim() === original}>保存修改</Button></>}>
    <Textarea aria-label="修改消息内容" autoFocus rows={5} maxLength={message.media ? 1024 : 4096} value={text} onChange={(e) => setText(e.target.value)} />
    <p className="mt-2 text-xs text-zinc-500">修改后双方显示新内容与“已编辑”，发送时间不变。</p>
    {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
  </Modal>
}
