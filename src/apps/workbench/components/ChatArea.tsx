/**
 * 聊天区：顶栏（在线状态 / 群成员数）→ 群置顶条 → 会话内搜索（⌘F）→ 消息列表 → AI 推荐 → 输入区。
 * 发送走 seatSendRich（引用、@所有人）；频道要有「频道发布」权限才能发；拉黑的私聊发不出去。
 */
import { useEffect, useMemo, useState } from 'react'
import { draftsFor, type AiDraft } from '@/domain/ai'
import type { Message, Seat } from '@/domain/types'
import { seatCan, seatGroupPerm } from '@/store/policy'
import { messagesOf, type ConvRow } from '@/store/selectors'
import { useWorkbench } from '../useWorkbench'
import { AiPanel, ChatHeader, ForwardModal, MessageSearchBar, PinModal, PinnedBar } from './ChatArea.parts'
import { ChatInput } from './ChatInput'
import { MessageItem } from './MessageItem'
import { jumpToMessage } from './group/shared'

export function ChatArea({ row, seat }: { row: ConvRow; seat: Seat }) {
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
  const isDm = row.conv.kind === 'dm'
  const customer = row.customer
  const group = !isDm ? s.chatGroups.find((g) => g.id === row.conv.chatGroupId) : undefined
  const blocked = !!customer?.blockedSeatIds.includes(seat.id)
  const canPin = !!group && seatGroupPerm(s, group, seat.id, staff?.id ?? null, 'can_pin_messages')
  const canPost = group?.kind !== 'channel' || (!!group && seatGroupPerm(s, group, seat.id, staff?.id ?? null, 'can_post_messages'))

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

  // AI 推荐：私聊、客户在等、员工没关、策略允许
  const lastCustomerMsg = [...msgs].reverse().find((m) => m.senderKind === 'customer')
  const aiOn = isDm && !!customer && !!row.waitingSince && !!lastCustomerMsg && staff?.prefs?.aiSuggest !== false && seatCan(s, seat.id, 'ai.suggest')
  const drafts = aiOn && customer && lastCustomerMsg ? draftsFor({ lastCustomerText: lastCustomerMsg.text, customer, seat, knowledge: s.knowledge }) : []

  const send = (body: string, mentionAll: boolean) => {
    if (!staff) return
    s.seatSendRich({ convId: row.conv.id, seatId: seat.id, operatorId: staff.id, text: body, replyToId: replyTo?.id, mentionAll: mentionAll || undefined, aiDraftUsed: draftFrom === 'ai' || undefined })
    if (draftFrom === 'ai') s.recordAi(staff.id, row.conv.id, 'adopted')
    setText('')
    setDraftFrom(null)
    setReplyTo(undefined)
  }
  const aiSend = (d: AiDraft) => {
    if (!staff) return
    s.seatSendRich({ convId: row.conv.id, seatId: seat.id, operatorId: staff.id, text: d.text, aiDraftUsed: true })
    s.recordAi(staff.id, row.conv.id, 'adopted')
  }
  const aiEdit = (d: AiDraft) => {
    setText(d.text)
    setDraftFrom('ai')
    if (staff) s.recordAi(staff.id, row.conv.id, 'edited')
  }

  const disabledReason = blocked ? `对方已拉黑「${seat.displayName}」，私聊发不出去；群消息照常。` : !canPost ? '频道只有拥有「频道发布」权限的管理员能发布；你在本频道没有该权限，输入区已禁用。' : undefined

  return (
    <>
      <ChatHeader row={row} seat={seat} group={group} onGroupInfo={() => document.getElementById('wb-right-panel')?.scrollTo({ top: 0, behavior: 'smooth' })} />
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

      {aiOn && <AiPanel drafts={drafts} onSend={aiSend} onEdit={aiEdit} />}
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
      />

      {forwardMsg && <ForwardModal message={forwardMsg} seat={seat} onClose={() => setForwardMsg(null)} />}
      {pinMsg && group && <PinModal message={pinMsg} group={group} onClose={() => setPinMsg(null)} />}
    </>
  )
}
