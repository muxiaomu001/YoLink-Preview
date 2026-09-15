/**
 * 聊天页（私聊 / 群 / 频道）：所有"能不能"走 customerCan / customerCanSpeakIn，发送走 customerSendIn。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { BadgeCheck, Info } from 'lucide-react'
import type { Message } from '@/domain/types'
import { iso } from '@/domain/time'
import { useStore } from '@/store/store'
import { customerById, messagesOf, seatById } from '@/store/selectors'
import { customerCan, customerCanSpeakIn } from '@/store/policy'
import { SeatAvatar } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { GroupAvatar, ScreenHeader, groupKindLabel } from '../parts'
import { AnnouncementLayer, Bubble, InputBar, PinnedBar } from './ChatScreen.parts'
import { GroupInfoScreen } from './GroupInfoScreen'

export function ChatScreen({ convId, customerId, onBack }: { convId: string; customerId: string; onBack: () => void }) {
  const s = useStore()
  const conv = s.conversations.find((c) => c.id === convId)
  const customer = customerById(s, customerId)
  const msgs = useMemo(() => messagesOf(s, convId), [s, convId])
  const [replyTo, setReplyTo] = useState<Message | undefined>()
  const [showInfo, setShowInfo] = useState(false)
  // 本次会话看过的公告（按公告时间记，公告更新会再弹）
  const [seenAnnouncementAt, setSeenAnnouncementAt] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  // "现在"：进入会话时取一次，自己每发一条刷新一次；用于禁言到期与撤回时限判断
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight })
  }, [msgs.length])
  if (!conv || !customer) return null

  const seat = conv.kind === 'dm' ? seatById(s, conv.seatId) : undefined
  const group = conv.kind !== 'dm' ? s.chatGroups.find((g) => g.id === conv.chatGroupId) : undefined
  const gid = group?.id ?? null

  if (group && showInfo) return <GroupInfoScreen g={group} customerId={customerId} onBack={() => setShowInfo(false)} onLeft={onBack} />

  // 输入区能不能发
  const speak = group ? customerCanSpeakIn(s, group, customerId, iso(nowMs)) : customer.blacklistedAt ? { ok: false, reason: '你已被限制发送消息' } : { ok: true }
  const canMedia = group ? customerCan(s, customerId, 'group.send_media', gid) : customerCan(s, customerId, 'dm.send_media')
  const canMentionAll = !!group && group.kind !== 'channel' && customerCan(s, customerId, 'group.mention_all', gid)
  const canRecallPolicy = customerCan(s, customerId, 'dm.recall', gid)
  const recallWindowMs = s.policyNumbers.recallSeconds * 1000

  const send = (text: string) => {
    const r = s.customerSendIn(convId, customerId, text, replyTo?.id)
    if (!r.ok) {
      toast(r.reason ?? '发送失败', 'warn')
      return false
    }
    setReplyTo(undefined)
    setNowMs(Date.now())
    return true
  }
  const recall = (m: Message) => {
    if (s.customerRecall(m.id)) toast('已撤回')
    else toast(`超过撤回时限（${s.policyNumbers.recallSeconds} 秒）`, 'warn')
  }

  const pinned = group?.pinnedMessageIds[0] ? s.messages.find((m) => m.id === group.pinnedMessageIds[0]) : undefined
  const announcement = group?.announcement
  const showAnnouncement = !!announcement && seenAnnouncementAt !== announcement.at
  const memberCount = group ? group.memberCustomerIds.length + group.memberSeatIds.length + group.memberBotIds.length : 0

  return (
    <div className="relative flex h-full flex-col bg-zinc-50">
      <ScreenHeader
        onBack={onBack}
        onTitleClick={group ? () => setShowInfo(true) : undefined}
        title={
          <span className="inline-flex items-center gap-1.5">
            {seat && <SeatAvatar seat={seat} size={24} />}
            {group && <GroupAvatar g={group} size={24} />}
            {seat?.displayName ?? group?.name}
            {group?.official && <span className="rounded bg-brand-50 px-1 text-[9px] font-normal text-brand-700">官方</span>}
          </span>
        }
        sub={seat ? seat.roleDesc : group ? `${groupKindLabel(group)}${group.kind === 'channel' ? ' · 只读' : ''} · ${memberCount} 人 · 点击看群信息` : ''}
        right={seat ? <BadgeCheck size={16} className="mr-2 text-brand-600" /> : group ? <Info size={16} className="mr-2 text-zinc-400" /> : null}
      />
      {pinned && <PinnedBar m={pinned} />}
      <div ref={ref} className="thin-scroll flex-1 overflow-y-auto px-3 py-3">
        {msgs.map((m) => {
          const mine = m.senderKind === 'customer' && m.senderId === customerId
          const withinWindow = nowMs - new Date(m.at).getTime() <= recallWindowMs
          return <Bubble key={m.id} m={m} mine={mine} inGroup={!!group} canRecall={canRecallPolicy && withinWindow} onReply={() => setReplyTo(m)} onRecall={() => recall(m)} />
        })}
      </div>
      <InputBar
        placeholder={seat ? `发消息给 ${seat.displayName}` : '发消息'}
        blockedReason={speak.ok ? undefined : speak.reason}
        canMedia={canMedia}
        canMentionAll={canMentionAll}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(undefined)}
        onSend={send}
      />
      {showAnnouncement && announcement && <AnnouncementLayer title={announcement.title} content={announcement.content} onClose={() => setSeenAnnouncementAt(announcement.at)} />}
    </div>
  )
}
