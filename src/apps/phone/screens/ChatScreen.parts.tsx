/**
 * 聊天页零件：消息气泡（引用条、撤回占位、图片 / 文件附件、机器人不标）、置顶条、公告层、输入区。
 */
import { useState } from 'react'
import { clsx } from 'clsx'
import { AtSign, Image, Pin, Send } from 'lucide-react'
import type { Message } from '@/domain/types'
import { fmtTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { customerById, seatById } from '@/store/selectors'
import { botById, senderName, visibleText } from '@/store/policy'
import { Avatar, SeatAvatar, TitleChip } from '@/ui/display'
import { FileCard, ImageThumb } from '@/ui/media'
import { Button, Input } from '@/ui/primitives'
import { toast } from '@/ui/overlay'

/** 客户视角的一行预览：会话列表、引用条、置顶条、回复条共用；图片 / 文件消息显示占位 */
export function customerPreview(m: Message): string {
  if (m.recalledAt || m.deletedAt) return visibleText(m, 'customer')
  if (m.kind === 'image') return m.text ? `[图片] ${m.text}` : '[图片]'
  if (m.kind === 'file') return `[文件] ${m.media?.name ?? m.text}`
  return visibleText(m, 'customer')
}

/** 引用条：被引用消息的发送者与内容 */
export function QuoteBar({ m, mine }: { m: Message | undefined; mine: boolean }) {
  const s = useStore()
  if (!m) return <div className={clsx('mb-1 rounded border-l-2 px-2 py-0.5 text-[10px]', mine ? 'border-white/60 bg-white/15 text-white/80' : 'border-zinc-300 bg-zinc-100 text-zinc-500')}>原消息不存在</div>
  return (
    <div className={clsx('mb-1 truncate rounded border-l-2 px-2 py-0.5 text-[10px]', mine ? 'border-white/60 bg-white/15 text-white/80' : 'border-brand-300 bg-zinc-100 text-zinc-500')}>
      {senderName(s, m)}：{customerPreview(m)}
    </div>
  )
}

/** 图片 / 文件消息的正文：不包深色气泡，附件 + 说明文字 + 「···」打开菜单 */
function MediaBody({ m, mine, replyTo, onMenu }: { m: Message; mine: boolean; replyTo: Message | undefined; onMenu: () => void }) {
  if (!m.media) return null
  return (
    <div className={clsx('inline-flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
      {m.replyToId && <QuoteBar m={replyTo} mine={false} />}
      {m.kind === 'image' ? <ImageThumb media={m.media} maxWidth={200} className="shadow-sm" /> : <FileCard media={m.media} className="shadow-sm" />}
      {m.text && <div className={clsx('max-w-[200px] text-[12px] leading-relaxed whitespace-pre-wrap text-zinc-700', mine ? 'text-right' : 'text-left')}>{m.text}</div>}
      <button type="button" onClick={onMenu} className="px-1 text-[11px] leading-none text-zinc-400 active:text-zinc-600" aria-label="消息菜单">
        ···
      </button>
    </div>
  )
}

function SenderAvatar({ m }: { m: Message }) {
  const s = useStore()
  if (m.senderKind === 'seat') {
    const seat = seatById(s, m.seatId)
    return seat ? <SeatAvatar seat={seat} size={30} /> : <Avatar text="坐" size={30} />
  }
  if (m.senderKind === 'bot') {
    const b = botById(s, m.senderId)
    return <Avatar text={b?.nickname ?? '成'} color={b?.avatarColor} size={30} />
  }
  return <Avatar text={customerById(s, m.senderId)?.nickname ?? '?'} size={30} />
}

/** 一条消息；系统消息灰色居中；点击弹出引用 / 撤回小菜单 */
export function Bubble({ m, mine, inGroup, canRecall, onReply, onRecall }: { m: Message; mine: boolean; inGroup: boolean; canRecall: boolean; onReply: () => void; onRecall: () => void }) {
  const s = useStore()
  const [menu, setMenu] = useState(false)
  if (m.senderKind === 'system') {
    return (
      <div id={`pm-${m.id}`} className="my-2 text-center">
        <span className="rounded-full bg-zinc-200/70 px-2 py-0.5 text-[10px] text-zinc-500">{m.text}</span>
      </div>
    )
  }
  const gone = !!m.recalledAt || !!m.deletedAt
  const sCus = m.senderKind === 'customer' && !mine ? customerById(s, m.senderId) : undefined
  const title = sCus?.primaryTitleId ? s.titles.find((x) => x.id === sCus.primaryTitleId && x.enabled) : undefined
  const replyTo = m.replyToId ? s.messages.find((x) => x.id === m.replyToId) : undefined
  const isMedia = !gone && (m.kind === 'image' || m.kind === 'file') && !!m.media
  return (
    <div id={`pm-${m.id}`} className={clsx('mb-2.5 flex gap-2', mine && 'flex-row-reverse')}>
      {!mine && <SenderAvatar m={m} />}
      <div className={clsx('relative max-w-[75%]', mine && 'text-right')}>
        {inGroup && !mine && (
          <div className="mb-0.5 flex items-center gap-1 text-[10px] text-zinc-500">
            {senderName(s, m)}
            {m.senderKind === 'seat' && <span className="rounded bg-brand-50 px-1 text-[9px] text-brand-700">官方</span>}
            {title && <TitleChip title={title} size="xs" />}
          </div>
        )}
        {isMedia ? (
          <MediaBody m={m} mine={mine} replyTo={replyTo} onMenu={() => setMenu((v) => !v)} />
        ) : (
          <button
            type="button"
            onClick={() => !gone && setMenu((v) => !v)}
            className={clsx(
              'inline-block rounded-2xl px-3 py-2 text-left text-[13px] leading-relaxed whitespace-pre-wrap',
              gone ? 'bg-zinc-100 text-zinc-400 italic' : mine ? 'rounded-tr-sm bg-brand-700 text-white' : 'rounded-tl-sm bg-white text-zinc-800 shadow-sm',
            )}
          >
            {m.replyToId && !gone && <QuoteBar m={replyTo} mine={mine} />}
            {m.mentionAll && !gone && <span className="mr-1 text-brand-200">@所有人</span>}
            {customerPreview(m)}
          </button>
        )}
        <div className="mt-0.5 text-[9px] text-zinc-400">{fmtTime(m.at)}</div>
        {menu && (
          <div className={clsx('absolute z-10 flex overflow-hidden rounded-md border border-zinc-200 bg-white text-[11px] shadow-md', mine ? 'right-0' : 'left-0', '-bottom-6')}>
            <button
              type="button"
              className="px-2 py-1 text-zinc-700 active:bg-zinc-50"
              onClick={() => {
                setMenu(false)
                onReply()
              }}
            >
              引用
            </button>
            {mine && canRecall && (
              <button
                type="button"
                className="border-l border-zinc-100 px-2 py-1 text-red-600 active:bg-zinc-50"
                onClick={() => {
                  setMenu(false)
                  onRecall()
                }}
              >
                撤回
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** 群顶部置顶条：点了滚到那条消息 */
export function PinnedBar({ m }: { m: Message }) {
  const s = useStore()
  return (
    <button type="button" onClick={() => document.getElementById(`pm-${m.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="flex w-full items-center gap-2 border-b border-amber-100 bg-amber-50 px-3 py-1.5 text-left">
      <Pin size={12} className="shrink-0 text-amber-600" />
      <span className="min-w-0 flex-1 truncate text-[11px] text-amber-900">
        <span className="text-amber-600">置顶 · {senderName(s, m)}：</span>
        {customerPreview(m)}
      </span>
    </button>
  )
}

/** 新公告层：进群聊时弹一次 */
export function AnnouncementLayer({ title, content, onClose }: { title: string; content: string; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-900/40 px-6">
      <div className="w-full rounded-xl bg-white p-4 shadow-xl">
        <div className="text-[10px] text-amber-600">群公告</div>
        <div className="mt-1 text-[14px] font-semibold text-zinc-900">{title}</div>
        <p className="thin-scroll mt-2 max-h-48 overflow-y-auto text-[12px] leading-relaxed whitespace-pre-wrap text-zinc-700">{content}</p>
        <Button variant="primary" className="mt-4 h-9 w-full" onClick={onClose}>
          知道了
        </Button>
      </div>
    </div>
  )
}

interface InputBarProps {
  placeholder: string
  blockedReason?: string
  canMedia: boolean
  canMentionAll: boolean
  replyTo?: Message
  onCancelReply: () => void
  onSend: (text: string) => boolean
}

/** 输入区：不能发时显示原因；能发时按策略显示媒体 / @所有人 */
export function InputBar({ placeholder, blockedReason, canMedia, canMentionAll, replyTo, onCancelReply, onSend }: InputBarProps) {
  const s = useStore()
  const [text, setText] = useState('')
  if (blockedReason) return <div className="border-t border-zinc-200 bg-white py-3 text-center text-[11px] text-zinc-400">{blockedReason}</div>
  const send = () => {
    if (!text.trim()) return
    if (onSend(text.trim())) setText('')
  }
  return (
    <div className="border-t border-zinc-200 bg-white px-3 py-2 pb-5">
      {replyTo && (
        <div className="mb-1 flex items-center justify-between rounded bg-zinc-100 px-2 py-1 text-[10px] text-zinc-500">
          <span className="truncate">
            回复 {senderName(s, replyTo)}：{customerPreview(replyTo)}
          </span>
          <button type="button" onClick={onCancelReply} className="ml-2 shrink-0 text-zinc-400">
            取消
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        {canMedia && (
          <button type="button" onClick={() => toast('演示不上传媒体', 'info')} className="text-zinc-500" aria-label="发送图片" title="dm.send_media / group.send_media 开">
            <Image size={20} />
          </button>
        )}
        {canMentionAll && (
          <button type="button" onClick={() => setText((t) => (t.includes('@所有人') ? t : `@所有人 ${t}`))} className="text-zinc-500" aria-label="@所有人" title="group.mention_all 开">
            <AtSign size={18} />
          </button>
        )}
        <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={placeholder} className="h-9 rounded-full" />
        <button type="button" onClick={send} disabled={!text.trim()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white disabled:bg-zinc-300" aria-label="发送">
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}
