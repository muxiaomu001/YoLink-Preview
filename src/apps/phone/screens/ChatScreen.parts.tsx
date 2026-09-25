/**
 * 聊天页零件：消息气泡（回复条、图片 / 文件附件）、置顶条、公告层、输入区。
 * 消息操作统一走长按唤出的菜单，见 ChatScreen.actions.tsx；气泡旁不放常驻按钮。
 */
import { useRef, useState } from 'react'
import { clsx } from 'clsx'
import { AtSign, Image, Mic, Paperclip, Pin, Send, Video } from 'lucide-react'
import type { Message, MessageMedia } from '@/domain/types'
import { channelOf, messageVisibleFor } from '@/domain/messageRules'
import { MessageDelivery } from '@/ui/MessageDelivery'
import { fmtTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { customerById, seatById } from '@/store/selectors'
import { senderName } from '@/store/policy'
import { Avatar, SeatAvatar, TitleChip } from '@/ui/display'
import { restoreLocalFile } from '@/domain/localMedia'
import { toast } from '@/ui/overlay'
import { MediaComposer, type ChatMediaKind } from '@/ui/MediaComposer'
import { PlayableMedia } from '@/ui/PlayableMedia'
import { FileCard, ImageThumb } from '@/ui/media'
import { MessageText } from '@/ui/MessageText'
import { MessageReceipt } from '@/ui/MessageReceipt'
import { Button, Input } from '@/ui/primitives'
import { customerPreview } from './ChatScreen.shared'
import { BubbleMenu, useBubbleActions, useLongPress } from './ChatScreen.actions'

/** 回复条：被回复消息的发送者与内容 */
export function QuoteBar({ m, mine, quoteText }: { m: Message | undefined; mine: boolean; quoteText?:string }) {
  const s = useStore()
  if (!m) return <div className={clsx('mb-1 rounded border-l-2 px-2 py-0.5 text-[10px]', mine ? 'border-white/60 bg-white/15 text-white/80' : 'border-zinc-300 bg-zinc-100 text-zinc-500')}>原消息不存在</div>
  return (
    <div className={clsx('mb-1 truncate rounded border-l-2 px-2 py-0.5 text-[10px]', mine ? 'border-white/60 bg-white/15 text-white/80' : 'border-brand-300 bg-zinc-100 text-zinc-500')}>
      {senderName(s, m)}：{quoteText&&m.text.includes(quoteText)?quoteText:customerPreview(m)}
    </div>
  )
}

/** 图片 / 文件消息的正文：不包深色气泡，附件 + 说明文字 */
function MediaBody({ m, mine, replyTo }: { m: Message; mine: boolean; replyTo: Message | undefined }) {
  if (!m.media) return null
  return (
    <div className={clsx('inline-flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
      {m.replyToId && replyTo && <QuoteBar m={replyTo} quoteText={m.quoteText} mine={false} />}
      {m.kind === 'video' || m.kind === 'voice' ? <PlayableMedia kind={m.kind} media={m.media!}/> : m.kind === 'image' ? <ImageThumb media={m.media} maxWidth={200} className="shadow-sm" /> : <FileCard media={m.media} className="shadow-sm" />}
      {m.text && <div className={clsx('max-w-[200px] text-[12px] leading-relaxed whitespace-pre-wrap text-zinc-700', mine ? 'text-right' : 'text-left')}>{m.text}</div>}
    </div>
  )
}

function SenderAvatar({ m }: { m: Message }) {
  const s = useStore()
  if (m.senderKind === 'seat') {
    const seat = seatById(s, m.seatId)
    return seat ? <SeatAvatar seat={seat} size={30} /> : <Avatar text="坐" size={30} />
  }
  return <Avatar text={customerById(s, m.senderId)?.nickname ?? '?'} size={30} />
}

/** 一条消息；系统消息灰色居中；长按（或右键）气泡唤出操作菜单 */
export function Bubble({ m, mine, inGroup, canReply = true, onReply, onDelete, onEdit, onForward, customerId }: { customerId: string; m: Message; mine: boolean; inGroup: boolean; canReply?: boolean; onDelete: () => void; onEdit?: () => void; onReply: () => void; onForward: () => void }) {
  const s = useStore()
  const [menu, setMenu] = useState(false)
  // 菜单默认贴在气泡下方；靠近屏幕底部时翻到上方，避免被输入区盖住
  const [above, setAbove] = useState(false)
  const holder = useRef<HTMLDivElement>(null)
  const press = useLongPress(() => {
    const box = holder.current?.getBoundingClientRect()
    const list = document.getElementById('phone-msg-list')?.getBoundingClientRect()
    setAbove(!!box && !!list && list.bottom - box.bottom < 170)
    setMenu(true)
  })
  const actions = useBubbleActions({ m, mine, customerId, convId: m.convId, canReply, onReply, onEdit, onDelete, onForward })

  if (m.senderKind === 'system') {
    return (
      <div id={`pm-${m.id}`} data-message-id={m.id} className="my-2 text-center">
        <span className="rounded-full bg-zinc-200/70 px-2 py-0.5 text-[10px] text-zinc-500">{m.text}</span>
      </div>
    )
  }
  const channel = channelOf(s, m)
  const sCus = m.senderKind === 'customer' && !mine ? customerById(s, m.senderId) : undefined
  const title = sCus?.primaryTitleId ? s.titles.find((x) => x.id === sCus.primaryTitleId && x.enabled) : undefined
  const replyTo = m.replyToId ? s.messages.find((x) => x.id === m.replyToId && messageVisibleFor(s, x, { kind: 'customer', id: customerId })) : undefined
  const isMedia = (m.kind === 'image' || m.kind === 'file' || m.kind === 'video' || m.kind === 'voice') && !!m.media
  return (
    <div id={`pm-${m.id}`} data-message-id={m.id} className={clsx('mb-2.5 flex gap-2', mine && 'flex-row-reverse')}>
      {!mine && (channel ? <Avatar text={channel.name} color="#b45309" size={30} official={channel.official} /> : <SenderAvatar m={m} />)}
      <div ref={holder} className={clsx('relative max-w-[75%]', mine && 'text-right')}>
        {inGroup && !mine && (
          <div className="mb-0.5 flex items-center gap-1 text-[10px] text-zinc-500">
            {senderName(s, m)}
            {m.senderKind === 'seat' && <span className="rounded bg-brand-50 px-1 text-[9px] text-brand-700">官方</span>}
            {title && <TitleChip title={title} size="xs" />}
          </div>
        )}
        {m.forwardedFrom && <div className="mb-1 text-[11px] text-zinc-400">转发自 {m.forwardedFrom.name ?? '其他聊天'}</div>}
        {/* 长按整块气泡唤出菜单；单击不接管，留给图片预览和链接 */}
        <div {...press.handlers} className={clsx('inline-block select-none', menu && 'relative z-40')}>
          {isMedia ? (
            <MediaBody m={m} mine={mine} replyTo={replyTo} />
          ) : (
            <div
              className={clsx(
                'inline-block rounded-2xl px-3 py-2 text-left text-[13px] leading-relaxed whitespace-pre-wrap',
                mine ? 'rounded-tr-sm bg-brand-700 text-white' : 'rounded-tl-sm bg-white text-zinc-800 shadow-sm',
              )}
            >
              {m.replyToId && replyTo && <QuoteBar m={replyTo} quoteText={m.quoteText} mine={mine} />}
              <MessageText m={m} viewerCustomerId={customerId} />
            </div>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1 text-[11px] text-zinc-400">
          {fmtTime(m.at)}
          {m.editedAt && <span>已编辑</span>}
          {m.channelSignature && <span>{m.channelSignature}</span>}
          {mine && <MessageDelivery message={m} actor={{ kind: 'customer', id: customerId }} />}
          {mine && <MessageReceipt m={m} />}
        </div>
        {menu && <BubbleMenu actions={actions} mine={mine} above={above} onClose={() => setMenu(false)} />}
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
  draftId:string
  text:string
  setText:(v:string)=>void
  placeholder: string
  blockedReason?: string
  canMedia: boolean
  canMentionAll: boolean
  replyTo?: Message
  onCancelReply: () => void
  onSend: (text: string) => boolean
  onSendMedia:(kind:ChatMediaKind,media:MessageMedia,text:string)=>boolean
}

/** 输入区：不能发时显示原因；能发时按策略显示媒体 / @所有人 */
export function InputBar({ text,setText,draftId, placeholder, blockedReason, canMedia, canMentionAll, replyTo, onCancelReply, onSend,onSendMedia }: InputBarProps) {
  const s = useStore()
  const picker=useRef<HTMLInputElement>(null),video=useRef<HTMLInputElement>(null),filePicker=useRef<HTMLInputElement>(null)
  const [media,setMedia]=useState<{kind:ChatMediaKind;files:File[]}|null>(null)
  if (blockedReason) return <div className="border-t border-zinc-200 bg-white py-3 text-center text-[11px] text-zinc-400">{blockedReason}</div>
  const send = () => {
    if (!text.trim()) return
    if (onSend(text.trim())) setText('')
  }
  return (
    <div className="border-t border-zinc-200 bg-white px-3 py-2 pb-5">
      {media&&<MediaComposer draftId={draftId} files={media.files} kind={media.kind} onClose={()=>setMedia(null)} onSend={onSendMedia}/>}
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
      {!media&&s.mediaDrafts?.[draftId]&&<button type="button" className="mb-2 rounded bg-brand-50 px-2 py-1 text-xs text-brand-700" onClick={async()=>{const draft=s.mediaDrafts?.[draftId];if(!draft)return;try{setMedia({kind:draft.kind,files:await Promise.all(draft.items.map(restoreLocalFile))})}catch{toast('附件草稿已不可用','warn')}}}>继续编辑附件草稿（{s.mediaDrafts[draftId].items.length} 项）</button>}
      {canMedia&&<div className="mb-2 flex items-center gap-4 text-zinc-500">
        <input ref={picker} type="file" accept="image/*" multiple className="hidden" onChange={(e)=>{const files=Array.from(e.target.files??[]);e.target.value='';if(files.length)setMedia({kind:'image',files})}}/>
        <input ref={video} type="file" accept="video/*" className="hidden" onChange={(e)=>{const files=Array.from(e.target.files??[]);e.target.value='';if(files.length)setMedia({kind:'video',files})}}/>
        <input ref={filePicker} type="file" multiple className="hidden" onChange={(e)=>{const files=Array.from(e.target.files??[]);e.target.value='';if(files.length)setMedia({kind:'file',files})}}/>
        <button aria-label="发送文件" onClick={()=>filePicker.current?.click()}><Paperclip size={18}/></button><button aria-label="发送视频" onClick={()=>video.current?.click()}><Video size={18}/></button><button aria-label="录制语音" onClick={()=>setMedia({kind:'voice',files:[]})}><Mic size={18}/></button>
      </div>}
      <div className="flex items-center gap-2">
        {canMedia && (
          <button type="button" onClick={() => picker.current?.click()} className="text-zinc-500" aria-label="发送图片" title="dm.send_media / group.send_media 开">
            <Image size={20} />
          </button>
        )}
        {canMentionAll && (
          <button type="button" onClick={() => setText(text.includes('@所有人')?text:`@所有人 ${text}`)} className="text-zinc-500" aria-label="@所有人" title="group.mention_all 开">
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
