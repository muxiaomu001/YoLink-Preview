import { Check, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import type { ChatGroup, Conversation, Message } from '@/domain/types'
import { useStore } from '@/store/store'
import { Avatar, SeatAvatar, Tabs } from './display'
import { Modal } from './overlay'
import { Input } from './primitives'
import { seatConversationAllowed } from '@/domain/messageRules'

/** 回执由对方打开会话后的可见消息驱动，不用延时器伪造已读。 */
export function MessageReceipt({ m, staffSeatId }: { m: Message; staffSeatId?: string }) {
  const s = useStore()
  const conv = s.conversations.find((c) => c.id === m.convId)
  if (!conv || conv.kind === 'channel' || m.deletedAt || (m.delivery && m.delivery !== 'sent')) return null
  if (conv.kind !== 'dm') {
    const g = s.chatGroups.find((x) => x.id === conv.chatGroupId)
    if (!g || !staffSeatId || !seatConversationAllowed(s, conv.id, staffSeatId, s.session.workbenchStaffId ?? '')) return null
    return <GroupReceipt m={m} conv={conv} group={g} />
  }
  const readAt = m.senderKind === 'seat' ? conv.readAtByCustomer?.[conv.customerId!] : conv.readAtBySeat?.[conv.seatId!]
  const read = !!readAt && readAt >= m.at
  const Icon = read ? CheckCheck : Check
  // 单勾已送达、双勾品牌色已读，跟主流聊天软件一致，不带文字；名词口径见 docs/界面文案与名词规范.md
  return <span className={`inline-flex items-center ${read ? 'text-brand-600' : 'text-zinc-400'}`} title={read ? '已读' : '已送达，对方还没看'} aria-label={read ? '已读' : '已送达'}><Icon size={13} /></span>
}

function GroupReceipt({ m, conv, group }: { m: Message; conv: Conversation; group: ChatGroup }) {
  const s = useStore()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'read' | 'unread'>('read')
  const [q, setQ] = useState('')
  const recipients = [
    ...(m.receiptMemberCustomerIds ?? group.memberCustomerIds).filter((id) => id !== m.senderId).map((id) => ({ id, name: s.customers.find((c) => c.id === id)?.nickname ?? '已离开的成员', seat: undefined, read: (conv.readAtByCustomer?.[id] ?? '') >= m.at })),
    ...(m.receiptMemberSeatIds ?? group.memberSeatIds).filter((id) => id !== m.senderId).map((id) => ({ id, name: s.seats.find((c) => c.id === id)?.displayName ?? '未知联系人', seat: s.seats.find((c) => c.id === id), read: (conv.readAtBySeat?.[id] ?? '') >= m.at })),
  ]
  const read = recipients.filter((x) => x.read).length
  const shown = recipients.filter((x) => x.read === (tab === 'read') && x.name.toLowerCase().includes(q.toLowerCase()))
  return <>
    <button type="button" className="inline-flex items-center gap-0.5 text-brand-600 hover:underline" title="查看已读和未读名单，仅员工可见" onClick={() => { setTab('read'); setQ(''); setOpen(true) }}><CheckCheck size={13} />{read}/{recipients.length} 人已读</button>
    {open && <Modal open onClose={() => setOpen(false)} title="消息阅读情况" width={440}>
      <p className="mb-3 text-xs text-zinc-500">{m.receiptMemberSeatIds ? '按发送时的成员统计' : '这条历史消息按当前成员统计'}，不含发送者。客户看不到这份名单。</p>
      <Tabs value={tab} onChange={setTab} items={[{ key: 'read', label: '已读', count: read }, { key: 'unread', label: '未读', count: recipients.length - read }]} />
      <Input aria-label="搜索回执成员" placeholder="搜索成员" className="my-3" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-72 overflow-auto text-left">
        {!shown.length && <p className="py-6 text-center text-xs text-zinc-400">{q ? '没有匹配的成员' : tab === 'read' ? '暂时无人已读' : '所有成员已读'}</p>}
        {shown.map((x) => <div key={x.id} className="flex items-center gap-2 border-b border-zinc-100 py-2 text-xs text-zinc-800">
          {x.seat ? <SeatAvatar seat={x.seat} size={28} /> : <Avatar text={x.name} size={28} />}<span>{x.name}</span><span className="ml-auto text-zinc-400">{x.read ? '已读' : '未读'}</span>
        </div>)}
      </div>
    </Modal>}
  </>
}
