/**
 * 聊天区：顶栏（在线状态 / 群成员数 / 会话内搜索 / 右栏收起）→ 群置顶条 → 会话内搜索（⌘F）→ 消息列表 → 输入区。
 * 发送走 seatSendRich（回复、@所有人、图片 / 文件）；频道要有「频道发布」权限才能发；拉黑的私聊发不出去。
 * 通过 ref 暴露 ChatAreaHandle（填入输入框 / 发文字 / 发附件），给右栏话术面板用。
 */
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import { clsx } from 'clsx'
import { ArrowDown, CornerUpLeft, X } from 'lucide-react'
import { actorKey, draftKey, messageVisibleFor } from '@/domain/messageRules'
import { useStore } from '@/store/store'
import { useMessageTimeline } from '@/ui/useMessageTimeline'
import type { ChatMediaKind } from '@/ui/MediaComposer'
import { ChatTyping } from '@/ui/ChatTyping'
import { ChatMediaLibrary } from '@/ui/ChatMediaLibrary'
import { DeleteMessagesModal } from '@/ui/DeleteMessagesModal'
import { Button, Checkbox } from '@/ui/primitives'
import type { Message, MessageMedia, Seat } from '@/domain/types'
import { seatGroupPerm, senderName } from '@/store/policy'
import { messagesOf, type ConvRow } from '@/store/selectors'
import { toast } from '@/ui/overlay'
import { useWorkbench } from '../useWorkbench'
import { ChatHeader, ForwardModal, MessageSearchBar, PinModal, PinnedBar } from './ChatArea.parts'
import { sendBlockReason } from './ChatArea.shared'
import { ChatInput } from './ChatInput'
import { useMessageRead } from '@/ui/useMessageRead'
import { MessageItem } from './MessageItem'

/** 右栏话术面板等外部入口能对当前会话做的三件事 */
export interface ChatAreaHandle {
  /** 填进输入框并聚焦；输入框已有内容时另起一行追加 */
  insertText: (text: string) => void
  sendText: (text: string) => void
  sendMedia: (kind: ChatMediaKind, media: MessageMedia, text: string) => void
}

export function ChatArea({ ref, row, seat, rightOpen, onToggleRight, onGroupInfo }: { ref?: Ref<ChatAreaHandle>; row: ConvRow; seat: Seat; rightOpen: boolean; onToggleRight: () => void; onGroupInfo: () => void }) {
  const { s, staff } = useWorkbench()
  const actor = useMemo(() => ({ kind: 'seat' as const, id: seat.id, staffId: staff?.id }), [seat.id, staff?.id])
  const msgs = useMemo(() => messagesOf(s,row.conv.id).filter((m)=>messageVisibleFor(s,m,actor)), [s,row.conv.id,actor])
  const key=draftKey(actor,row.conv.id)
  const draft=s.chatDrafts?.[key]??{text:''}
  // 输入框文字放在本地 state：全局 store 挂了 persist，逐键写入会把每次按键变成一次全量 localStorage 落盘。
  // 草稿仍然保留，只是按 400ms 防抖写；切会话前输入框会先失焦，失焦时立即落盘。
  const [text,setTextLocal]=useState(()=>useStore.getState().chatDrafts?.[key]?.text??'')
  const [loadedKey,setLoadedKey]=useState(key)
  if(loadedKey!==key){setLoadedKey(key);setTextLocal(useStore.getState().chatDrafts?.[key]?.text??'')}
  const pending=useRef({convId:row.conv.id,text})
  useEffect(()=>{pending.current={convId:row.conv.id,text}})
  const flushDraft=useCallback(()=>{
    const {convId,text:latest}=pending.current
    const state=useStore.getState(),d=state.chatDrafts?.[draftKey(actor,convId)]??{text:''}
    if(d.text!==latest)state.saveChatDraft(convId,actor,{...d,text:latest})
  },[actor])
  const setText=useCallback((value:string|((prev:string)=>string))=>setTextLocal(value),[])
  useEffect(()=>{const timer=window.setTimeout(flushDraft,400);return()=>window.clearTimeout(timer)},[text,flushDraft])
  useEffect(()=>()=>flushDraft(),[flushDraft])
  const setReplyTo=(m?:Message,quoteText?:string)=>{const state=useStore.getState();state.saveChatDraft(row.conv.id,actor,{...(state.chatDrafts?.[key]??{text:''}),replyToId:m?.id,quoteText:m?quoteText:undefined})}
  const replyTo=msgs.find((m)=>m.id===draft.replyToId)
  const [selected,setSelected]=useState<string[]>([])
  const selecting=!!selected.length
  const toggleSelected=useCallback((id:string)=>setSelected((ids)=>ids.includes(id)?ids.filter((x)=>x!==id):[...ids,id]),[])
  const [forwardBatch,setForwardBatch]=useState<Message[]|null>(null)
  const [deleteSelected,setDeleteSelected]=useState(false)
  const [libraryOpen,setLibraryOpen]=useState(false)
  const [signature,setSignature]=useState(false)
  const [firstUnreadId]=useState(()=>msgs.find((m)=>m.senderId!==actor.id&&m.at>(row.conv.readAtBySeat?.[seat.id]??'')&&(!m.delivery||m.delivery==='sent'))?.id)
  const timeline=useMessageTimeline('wb-msg-list',actorKey(actor)+':'+row.conv.id,msgs.map((m)=>m.id).join(','),firstUnreadId)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hitIdx, setHitIdx] = useState(0)
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null)
  const [pinMsg, setPinMsg] = useState<Message | null>(null)
  const isDm = row.conv.kind === 'dm'
  const customer = row.customer
  const group = !isDm ? s.chatGroups.find((g) => g.id === row.conv.chatGroupId) : undefined
  const canPin = !!group && seatGroupPerm(s, group, seat.id, staff?.id ?? null, 'can_pin_messages')
  const disabledReason = sendBlockReason(s, row, seat, staff?.id ?? null)

  useMessageRead(row.conv.id, seat.id, 'seat', msgs.map((m) => m.id).join(','), 'wb-msg-list')

  // ⌘F：会话内搜索
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? msgs.filter((m) => m.senderKind !== 'system' && m.text.toLowerCase().includes(q)).map((m) => m.id) : []
  }, [msgs, query])
  const onQuery = (v: string) => {
    setQuery(v)
    setHitIdx(0)
  }
  const jumpToResult=timeline.jump
  useEffect(() => {
    if (hits[hitIdx]) jumpToResult(`msg-${hits[hitIdx]}`)
  }, [hits, hitIdx, jumpToResult])

  const send = (body: string, _mentionAll: boolean, selected: { mentionSeatIds: string[]; mentionCustomerIds: string[] }) => {
    if (!staff || disabledReason) return
    const result=s.queueChatMessage({ convId: row.conv.id, actor, signature, text: body, selectedMentions: selected, replyToId: replyTo?.id, quoteText: draft.quoteText })
    if(!result.ok)return toast(result.reason??'发送失败','warn')
    timeline.jumpLatest()
    setText('')
    setReplyTo(undefined)
  }
  /** 图片 / 文件消息：工具栏选本机文件、话术里的附件都走这里 */
  const sendMedia = (kind: ChatMediaKind, media: MessageMedia, body: string) => {
    if (!staff || disabledReason) return false
    const result=s.queueChatMessage({ convId: row.conv.id, actor, signature, kind, media, text: body, replyToId: replyTo?.id })
    if(!result.ok){toast(result.reason??'发送失败','warn');return false}
    timeline.jumpLatest()
    setReplyTo(undefined)
    return true
  }
  /** 右栏面板「填入」：追加到输入框并聚焦 */
  const insertText = (body: string) => {
    setText((prev) => (prev.trim() ? `${prev.replace(/\s+$/, '')}\n${body}` : body))
    window.setTimeout(() => document.querySelector<HTMLTextAreaElement>('#wb-chat-input textarea')?.focus(), 0)
  }
  useImperativeHandle(ref, () => ({
    insertText,
    sendText: (body) => {
      if (!staff || disabledReason) return
      const result=s.queueChatMessage({ convId: row.conv.id, actor, signature, text: body, replyToId: replyTo?.id })
      if(!result.ok)return toast(result.reason??'发送失败','warn')
      timeline.jumpLatest()
      setReplyTo(undefined)
    },
    sendMedia,
  }))
  return (
    <>
      <ChatHeader row={row} group={group} onGroupInfo={onGroupInfo} onSearch={() => setSearchOpen(true)} onMedia={()=>setLibraryOpen(true)} rightOpen={rightOpen} onToggleRight={onToggleRight} />
      {isDm&&<div className="px-4 text-xs"><ChatTyping convId={row.conv.id} actor={actor}/></div>}
      {group && <PinnedBar group={group} canPin={canPin} />}
      {searchOpen && <MessageSearchBar query={query} onQuery={onQuery} total={hits.length} idx={hitIdx} onIdx={setHitIdx} onClose={() => { setSearchOpen(false); onQuery('') }} />}

      {!!selected.length && <div className="flex items-center gap-2 border-b border-brand-100 bg-brand-50 px-4 py-2 text-sm"><span>已选择 {selected.length} 条</span><Button size="sm" onClick={()=>{if(selected.some((id)=>!msgs.some((m)=>m.id===id)))return toast('部分所选消息已不可用，请重新选择','warn');setForwardBatch(msgs.filter((m)=>selected.includes(m.id)))}}>转发所选</Button><Button size="sm" onClick={()=>setDeleteSelected(true)}>删除所选</Button><button className="ml-auto" aria-label="取消选择" onClick={()=>setSelected([])}><X size={16}/></button></div>}
      <div id="wb-msg-list" className="thin-scroll flex-1 overflow-y-auto px-5 py-4">
        <div>
        {msgs.map((m, i) => (
          <div key={m.id}>
          {m.id===firstUnreadId&&<div className="my-3 text-center text-xs text-brand-600">以下是未读消息</div>}
          {/* 多选模式下整行可点 */}
          {(() => { const pickable = selecting; return (
          <div
            className={selecting?clsx('flex items-start gap-2.5 rounded-md py-0.5 pl-1',pickable&&'cursor-pointer hover:bg-zinc-50'):undefined}
            role={pickable?'checkbox':undefined}
            aria-checked={pickable?selected.includes(m.id):undefined}
            aria-label={pickable?`选择 ${senderName(s,m)} 的消息`:undefined}
            tabIndex={pickable?0:undefined}
            onClick={pickable?()=>toggleSelected(m.id):undefined}
            onKeyDown={pickable?(e)=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();toggleSelected(m.id)}}:undefined}
          >
          {selecting&&<input type="checkbox" tabIndex={-1} readOnly disabled={!pickable} checked={selected.includes(m.id)} className="pointer-events-none mt-2.5 h-4 w-4 shrink-0 accent-brand-600"/>}
          <div className={selecting?'pointer-events-none min-w-0 flex-1':undefined}>
          <MessageItem
            key={m.id}
            m={m}
            showDate={i === 0 || new Date(m.at).toDateString() !== new Date(msgs[i - 1].at).toDateString()}
            seat={seat}
            group={group}
            highlight={query.trim() || undefined}
            current={hits[hitIdx] === m.id}
            onReply={setReplyTo}
            onForward={setForwardMsg}
            onPin={setPinMsg}
            selected={selected.includes(m.id)}
            onSelect={(m)=>setSelected((ids)=>ids.includes(m.id)?ids:[...ids,m.id])}
          />
          </div>
          </div>
          ) })()}
          </div>
        ))}
        {!msgs.length&&<p className="py-12 text-center text-sm text-zinc-400">暂无可见消息</p>}
        </div>
      </div>
      {(!timeline.atBottom||timeline.hasReturn)&&<div className="flex justify-end gap-2 px-4 py-1"><button className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-brand-700" onClick={timeline.jumpLatest}><ArrowDown size={14}/>{timeline.newCount?`${timeline.newCount} 条新消息`:'回到最新'}</button>{timeline.hasReturn&&<button className="text-xs text-brand-700" onClick={timeline.goBack}><CornerUpLeft size={14}/>返回阅读位置</button>}</div>}

      {group?.kind==='channel'&&<div className="flex items-center justify-between border-t border-zinc-200 bg-white px-4 py-2 text-xs text-zinc-600"><span>发布为「{group.name}」</span><Checkbox label={`署名：${seat.displayName}`} checked={signature} onChange={setSignature}/></div>}
      <ChatInput
        draftId={key}
        seat={seat}
        group={group}
        customer={customer}
        text={text}
        setText={setText}
        replyTo={replyTo}
        quoteText={draft.quoteText}
        onClearReply={() => setReplyTo(undefined)}
        disabledReason={disabledReason}
        onSend={send}
        onSendMedia={sendMedia}
        onBlurText={flushDraft}
      />

      {libraryOpen&&<ChatMediaLibrary convId={row.conv.id} actor={actor} onClose={()=>setLibraryOpen(false)} onLocate={(id)=>timeline.jump(`msg-${id}`)}/>}
      {forwardBatch?.length&&<ForwardModal message={forwardBatch[0]} messages={forwardBatch} seat={seat} onClose={()=>{setForwardBatch(null);setSelected([])}}/>}
      {deleteSelected&&<DeleteMessagesModal ids={selected} actor={actor} onClose={()=>setDeleteSelected(false)} onDeleted={()=>setSelected([])}/>}
      {forwardMsg && <ForwardModal message={forwardMsg} seat={seat} onClose={() => setForwardMsg(null)} />}
      {pinMsg && group && <PinModal message={pinMsg} group={group} onClose={() => setPinMsg(null)} />}
    </>
  )
}
