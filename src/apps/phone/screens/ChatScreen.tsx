/**
 * 聊天页（私聊 / 群 / 频道）：所有"能不能"走 customerCan / customerCanSpeakIn，发送走 customerSendIn。
 */
import { useMemo, useRef, useState } from 'react'
import { ArrowDown, MoreHorizontal } from 'lucide-react'
import type { Message } from '@/domain/types'
import { actorKey, draftKey, messageVisibleInChat } from '@/domain/messageRules'
import { useMessageTimeline } from '@/ui/useMessageTimeline'
import { ChatTyping } from '@/ui/ChatTyping'
import { ChatMediaLibrary } from '@/ui/ChatMediaLibrary'
import { DeleteMessagesModal } from '@/ui/DeleteMessagesModal'
import { confirm } from '@/ui/confirm'
import { useMessageRead } from '@/ui/useMessageRead'
import { iso } from '@/domain/time'
import { useStore } from '@/store/store'
import { customerById, messagesOf, seatById } from '@/store/selectors'
import { customerCan, customerCanSpeakIn } from '@/store/policy'
import { SeatAvatar } from '@/ui/display'
import { Button, Textarea } from '@/ui/primitives'
import { Modal, toast } from '@/ui/overlay'
import { GroupAvatar, ScreenHeader } from '../parts'
import { groupKindLabel } from '../shared'
import { AnnouncementLayer, Bubble, InputBar, PinnedBar } from './ChatScreen.parts'
import { GroupInfoScreen } from './GroupInfoScreen'

export function ChatScreen({ convId, customerId, onBack }: { convId: string; customerId: string; onBack: () => void }) {
  const s = useStore()
  const conv = s.conversations.find((c) => c.id === convId)
  const customer = customerById(s, customerId)
  const actor=useMemo(()=>({kind:'customer' as const,id:customerId}),[customerId])
  const msgs = useMemo(() => messagesOf(s, convId).filter((m)=>messageVisibleInChat(s,m,actor)), [s, convId,actor])
  const key=draftKey(actor,convId),draft=s.chatDrafts?.[key]??{text:''}
  const setText=(text:string)=>s.saveChatDraft(convId,actor,{...(useStore.getState().chatDrafts?.[key]??{text:''}),text})
  const setReplyTo=(m?:Message)=>s.saveChatDraft(convId,actor,{...(useStore.getState().chatDrafts?.[key]??{text:''}),replyToId:m?.id})
  const replyTo=msgs.find((m)=>m.id===draft.replyToId)
  const [deleting,setDeleting]=useState<string[]|null>(null)
  const [libraryOpen,setLibraryOpen]=useState(false)
  const [toolsOpen,setToolsOpen]=useState(false)
  const timeline=useMessageTimeline('phone-msg-list',actorKey(actor)+':'+convId,msgs.map((m)=>m.id).join(','))
  const [editing, setEditing] = useState<Message | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  // 本次会话看过的公告（按公告时间记，公告更新会再弹）
  const [seenAnnouncementAt, setSeenAnnouncementAt] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  // "现在"：进入会话时取一次，自己每发一条刷新一次；用于禁言到期与撤回时限判断
  const [nowMs, setNowMs] = useState(() => Date.now())
  const group = conv?.kind !== 'dm' ? s.chatGroups.find((g) => g.id === conv?.chatGroupId) : undefined
  const announcement = group?.announcement
  const showAnnouncement = !!announcement && seenAnnouncementAt !== announcement.at
  useMessageRead(convId, customerId, 'customer', msgs.map((m) => m.id).join(','), 'phone-msg-list', !showInfo && !showAnnouncement)
  if (!conv || !customer) return <div className="p-6 text-sm">会话不存在或已不可用<button className="ml-2 text-brand-700" onClick={onBack}>返回</button></div>
  if (conv.kind === 'dm' ? conv.customerId !== customerId : !s.chatGroups.some((g) => g.id === conv.chatGroupId && g.memberCustomerIds.includes(customerId))) return <div className="p-6 text-sm">当前客户不能查看此会话<button className="ml-2 text-brand-700" onClick={onBack}>返回</button></div>

  const seat = conv.kind === 'dm' ? seatById(s, conv.seatId) : undefined
  const gid = group?.id ?? null

  if (group && showInfo) return <GroupInfoScreen g={group} customerId={customerId} onBack={() => setShowInfo(false)} onLeft={onBack} />

  // 输入区能不能发
  const speak = group ? customerCanSpeakIn(s, group, customerId, iso(nowMs)) : customer.blacklistedAt ? { ok: false, reason: '你已被限制发送消息' } : { ok: true }
  const canMedia = group ? customerCan(s, customerId, 'group.send_media', gid) : customerCan(s, customerId, 'dm.send_media')
  const canMentionAll = !!group && group.kind !== 'channel' && customerCan(s, customerId, 'group.mention_all', gid)
  const send = (text: string) => {
    const r=s.queueChatMessage({convId,actor,text,replyToId:replyTo?.id})
    if(!r.ok){toast(r.reason??'发送失败','warn');return false}
    s.saveChatDraft(convId,actor,{text:''});setNowMs(Date.now());timeline.jumpLatest();return true
  }
  const clear=async()=>{const ok=await confirm({title:'清空聊天？',body:'仅清空你的可见历史，其他参与者不受影响；联系人和群成员关系保留。',okText:'清空',danger:true});if(ok){s.clearChatFor(convId,actor);setToolsOpen(false)}}

  const pinned = group?.pinnedMessageIds[0] ? msgs.find((m)=>m.id===group.pinnedMessageIds[0]) : undefined
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
        right={<button type="button" aria-label="会话操作" onClick={()=>setToolsOpen(true)}><MoreHorizontal size={20}/></button>}
      />
      {seat&&<div className="px-3"><ChatTyping convId={convId} actor={actor}/></div>}
      {pinned && <PinnedBar m={pinned} />}
      <div id="phone-msg-list" ref={ref} className="thin-scroll flex-1 overflow-y-auto px-3 py-3">
        <div>
        {msgs.map((m) => {
          const mine = m.senderKind === 'customer' && m.senderId === customerId
          return <Bubble customerId={customerId} key={m.id} m={m} mine={mine} inGroup={!!group} canRecall={false} canReply={group?.kind!=='channel'} onReply={() => setReplyTo(m)} onRecall={()=>setDeleting([m.id])} onDelete={()=>setDeleting([m.id])} onEdit={mine && !m.recalledAt && !m.deletedAt && customerCan(s, customerId, 'dm.edit', gid) ? () => setEditing(m) : undefined} />
        })}
        {!msgs.length&&<p className="py-12 text-center text-sm text-zinc-400">暂无可见消息</p>}
        </div>
      </div>
      {!timeline.atBottom&&<button className="self-end rounded-full bg-white px-3 py-2 text-xs text-brand-700" onClick={timeline.jumpLatest}><ArrowDown size={14}/>{timeline.newCount?`${timeline.newCount} 条新消息`:'回到最新'}</button>}
      {group?.kind!=='channel'&&<InputBar
        draftId={key} text={draft.text} setText={setText}
        placeholder={seat ? `发消息给 ${seat.displayName}` : '发消息'}
        blockedReason={speak.ok ? undefined : speak.reason}
        canMedia={canMedia}
        canMentionAll={canMentionAll}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(undefined)}
        onSend={send}
        onSendMedia={(kind,media,text)=>{const r=s.queueChatMessage({convId,actor,kind,media,text,replyToId:replyTo?.id});if(!r.ok){toast(r.reason??'发送失败','warn');return false}setReplyTo(undefined);timeline.jumpLatest();return true}}
      />}
      {group?.kind==='channel'&&<div className="border-t border-zinc-200 bg-white py-3 text-center text-xs text-zinc-500">频道 · 仅管理员发布</div>}
      {deleting&&<DeleteMessagesModal ids={deleting} actor={actor} onClose={()=>setDeleting(null)}/>}
      {libraryOpen&&<ChatMediaLibrary convId={convId} actor={actor} onClose={()=>setLibraryOpen(false)} onLocate={(id)=>timeline.jump(`pm-${id}`)}/>}
      {toolsOpen&&<Modal open title="会话操作" onClose={()=>setToolsOpen(false)} width={340}><div className="flex flex-col gap-2">{group&&<Button onClick={()=>{setToolsOpen(false);setShowInfo(true)}}>群与频道信息</Button>}<Button onClick={()=>{setToolsOpen(false);setLibraryOpen(true)}}>文件与媒体</Button><Button onClick={()=>void clear()}>清空聊天</Button><Button onClick={()=>{s.hideChatFor(convId,actor);onBack()}}>从会话列表移除</Button><p className="text-xs text-zinc-500">移除会话不会退出群或删除联系人。</p></div></Modal>}
      {editing && <CustomerEditMessage message={editing} customerId={customerId} onClose={() => setEditing(null)} />}
      {showAnnouncement && announcement && <AnnouncementLayer title={announcement.title} content={announcement.content} onClose={() => setSeenAnnouncementAt(announcement.at)} />}
    </div>
  )
}


function CustomerEditMessage({ message, customerId, onClose }: { message: Message; customerId: string; onClose: () => void }) {
  const s = useStore()
  const [original] = useState(message.text)
  const [text, setText] = useState(message.text)
  const [error, setError] = useState('')
  const save = () => {
    const result = s.customerEditMessage(message.id, text, customerId, original)
    if (result) return setError(result)
    onClose()
  }
  return <Modal open onClose={onClose} title="编辑消息" width={420} footer={<><Button onClick={onClose}>取消</Button><Button variant="primary" onClick={save} disabled={(!text.trim() && !message.media) || text.trim() === original}>保存修改</Button></>}>
    <Textarea aria-label="修改消息内容" autoFocus rows={4} maxLength={message.media ? 1024 : 4096} value={text} onChange={(e) => setText(e.target.value)} />
    {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
  </Modal>
}
