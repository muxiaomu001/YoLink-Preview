/**
 * 聊天区：顶栏（在线状态 / 群成员数 / 会话内搜索 / 右栏收起）→ 群置顶条 → 会话内搜索（⌘F）→ 消息列表 → AI 推荐 → 输入区。
 * 发送走 seatSendRich（引用、@所有人、图片 / 文件）；频道要有「频道发布」权限才能发；拉黑的私聊发不出去。
 * AI 推荐两种触发：员工偏好「自动弹出」开着时客户来消息自动弹；或点输入栏的「AI 推荐」按钮手动生成。
 * 通过 ref 暴露 ChatAreaHandle（填入输入框 / 发文字 / 发附件），给右栏话术面板用。
 */
import { useEffect, useImperativeHandle, useMemo, useState, type Ref } from 'react'
import { draftsFor, type AiDraft } from '@/domain/ai'
import type { Message, MessageMedia, Seat } from '@/domain/types'
import { seatCan, seatGroupPerm } from '@/store/policy'
import { customerById, messagesOf, type ConvRow } from '@/store/selectors'
import { toast } from '@/ui/overlay'
import { useWorkbench } from '../useWorkbench'
import { AiPanel, ChatHeader, ForwardModal, MessageSearchBar, PinModal, PinnedBar, sendBlockReason } from './ChatArea.parts'
import { ChatInput } from './ChatInput'
import { MessageItem } from './MessageItem'
import { jumpToMessage } from './group/shared'

/** 右栏话术面板等外部入口能对当前会话做的三件事 */
export interface ChatAreaHandle {
  /** 填进输入框并聚焦；输入框已有内容时另起一行追加 */
  insertText: (text: string) => void
  sendText: (text: string) => void
  sendMedia: (kind: 'image' | 'file', media: MessageMedia, text: string) => void
}

export function ChatArea({ ref, row, seat, rightOpen, onToggleRight, onGroupInfo }: { ref?: Ref<ChatAreaHandle>; row: ConvRow; seat: Seat; rightOpen: boolean; onToggleRight: () => void; onGroupInfo: () => void }) {
  const { s, staff } = useWorkbench()
  const msgs = useMemo(() => messagesOf(s, row.conv.id), [s, row.conv.id])
  const [text, setText] = useState('')
  const [draftFrom, setDraftFrom] = useState<'ai' | null>(null)
  const [replyTo, setReplyTo] = useState<Message | undefined>()
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hitIdx, setHitIdx] = useState(0)
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null)
  const [pinMsg, setPinMsg] = useState<Message | null>(null)
  // 手动生成的 AI 草稿；自动弹出被关掉时记住是针对哪条客户消息关的，下一条再弹
  const [manualDrafts, setManualDrafts] = useState<{ items: AiDraft[]; context: string } | null>(null)
  const [dismissedFor, setDismissedFor] = useState<string | null>(null)
  const isDm = row.conv.kind === 'dm'
  const customer = row.customer
  const group = !isDm ? s.chatGroups.find((g) => g.id === row.conv.chatGroupId) : undefined
  const canPin = !!group && seatGroupPerm(s, group, seat.id, staff?.id ?? null, 'can_pin_messages')
  const disabledReason = sendBlockReason(s, row, seat, staff?.id ?? null)

  // 切会话时由父级 key 重挂载（输入、引用、搜索自然清空）；新消息滚到底
  useEffect(() => {
    const el = document.getElementById('wb-msg-list')
    if (el && !query) el.scrollTo({ top: el.scrollHeight })
  }, [msgs.length, row.conv.id, query])

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
    return q ? msgs.filter((m) => !m.recalledAt && !m.deletedAt && m.senderKind !== 'system' && m.text.toLowerCase().includes(q)).map((m) => m.id) : []
  }, [msgs, query])
  const onQuery = (v: string) => {
    setQuery(v)
    setHitIdx(0)
  }
  useEffect(() => {
    if (hits[hitIdx]) jumpToMessage(hits[hitIdx])
  }, [hits, hitIdx])

  // AI 推荐：策略允许才有入口；自动弹出要求私聊、客户在等、员工偏好开着
  const canAi = seatCan(s, seat.id, 'ai.suggest') && s.license.modules.some((m) => m.key === 'ai' && m.enabled)
  const lastCustomerMsg = [...msgs].reverse().find((m) => m.senderKind === 'customer')
  const aiAuto = canAi && isDm && !!customer && !!row.waitingSince && !!lastCustomerMsg && !!staff?.prefs?.aiSuggest && dismissedFor !== lastCustomerMsg.id
  const autoDrafts = aiAuto && customer && lastCustomerMsg ? draftsFor({ lastCustomerText: lastCustomerMsg.text, customer, seat, knowledge: s.knowledge }) : []
  const aiContext = JSON.stringify([msgs.at(-1)?.id, s.knowledge])
  const drafts = canAi && !disabledReason ? (manualDrafts?.context === aiContext ? manualDrafts.items : autoDrafts) : []

  const aiSuggest = () => {
    if (!lastCustomerMsg) return toast('还没有客户消息可参考', 'info')
    const from = isDm ? customer : customerById(s, lastCustomerMsg.senderId)
    if (!from) return toast('还没有客户消息可参考', 'info')
    const items = draftsFor({ lastCustomerText: lastCustomerMsg.text, customer: from, seat, knowledge: s.knowledge })
    setManualDrafts({ items, context: aiContext })
    if (!items.length) toast('未找到已发布的相关知识，请人工核对后回复', 'info')
  }
  const closeAi = () => {
    setManualDrafts(null)
    if (lastCustomerMsg) setDismissedFor(lastCustomerMsg.id)
  }

  const send = (body: string, mentionAll: boolean) => {
    if (!staff || disabledReason) return
    s.seatSendRich({ convId: row.conv.id, seatId: seat.id, operatorId: staff.id, text: body, replyToId: replyTo?.id, mentionAll: mentionAll || undefined, aiDraftUsed: draftFrom === 'ai' || undefined })
    if (draftFrom === 'ai') s.recordAi(staff.id, row.conv.id, 'edited')
    setText('')
    setDraftFrom(null)
    setReplyTo(undefined)
    setManualDrafts(null)
  }
  /** 图片 / 文件消息：工具栏选本机文件、话术里的附件都走这里 */
  const sendMedia = (kind: 'image' | 'file', media: MessageMedia, body: string) => {
    if (!staff || disabledReason) return
    s.seatSendRich({ convId: row.conv.id, seatId: seat.id, operatorId: staff.id, kind, media, text: body, replyToId: replyTo?.id })
    setReplyTo(undefined)
    closeAi()
  }
  /** 右栏面板「填入」：追加到输入框并聚焦 */
  const insertText = (body: string) => {
    setText((prev) => (prev.trim() ? `${prev.replace(/\s+$/, '')}\n${body}` : body))
    setDraftFrom(null)
    window.setTimeout(() => document.querySelector<HTMLTextAreaElement>('#wb-chat-input textarea')?.focus(), 0)
  }
  useImperativeHandle(ref, () => ({
    insertText,
    sendText: (body) => {
      if (!staff || disabledReason) return
      s.seatSendRich({ convId: row.conv.id, seatId: seat.id, operatorId: staff.id, text: body, replyToId: replyTo?.id })
      setReplyTo(undefined)
      closeAi()
    },
    sendMedia,
  }))
  const aiSend = (d: AiDraft) => {
    if (!staff || disabledReason) return
    s.seatSendRich({ convId: row.conv.id, seatId: seat.id, operatorId: staff.id, text: d.text, aiDraftUsed: true })
    s.recordAi(staff.id, row.conv.id, 'adopted')
    setManualDrafts(null)
  }
  const aiEdit = (d: AiDraft) => {
    setText(d.text)
    setDraftFrom('ai')
  }

  return (
    <>
      <ChatHeader row={row} group={group} onGroupInfo={onGroupInfo} onSearch={() => setSearchOpen(true)} rightOpen={rightOpen} onToggleRight={onToggleRight} />
      {group && <PinnedBar group={group} canPin={canPin} />}
      {searchOpen && <MessageSearchBar query={query} onQuery={onQuery} total={hits.length} idx={hitIdx} onIdx={setHitIdx} onClose={() => { setSearchOpen(false); onQuery('') }} />}

      <div id="wb-msg-list" className="thin-scroll flex-1 overflow-y-auto px-5 py-4">
        {msgs.map((m, i) => (
          <MessageItem
            key={m.id}
            m={m}
            showDate={i === 0 || new Date(m.at).toDateString() !== new Date(msgs[i - 1].at).toDateString()}
            seat={seat}
            group={group}
            highlight={query.trim() || undefined}
            current={hits[hitIdx] === m.id}
            onReply={(x) => { setReplyTo(x); setDraftFrom(null) }}
            onForward={setForwardMsg}
            onPin={setPinMsg}
          />
        ))}
      </div>

      {drafts.length > 0 && <AiPanel drafts={drafts} onSend={aiSend} onEdit={aiEdit} onClose={closeAi} />}
      <ChatInput
        seat={seat}
        group={group}
        customer={customer}
        text={text}
        setText={(v) => { setText(v); if (draftFrom && !v) setDraftFrom(null) }}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(undefined)}
        disabledReason={disabledReason}
        onSend={send}
        onSendMedia={sendMedia}
        onAiSuggest={canAi ? aiSuggest : undefined}
      />

      {forwardMsg && <ForwardModal message={forwardMsg} seat={seat} onClose={() => setForwardMsg(null)} />}
      {pinMsg && group && <PinModal message={pinMsg} group={group} onClose={() => setPinMsg(null)} />}
    </>
  )
}
