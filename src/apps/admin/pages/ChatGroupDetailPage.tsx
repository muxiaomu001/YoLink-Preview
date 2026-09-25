import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import type { ChatGroup } from '@/domain/types'
import { fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { seatGroupPerm, senderName, visibleText } from '@/store/policy'
import { messagesOf, staffHasCap } from '@/store/selectors'
import { Card, Empty, Note, PageHeader, Pill } from '@/ui/display'
import { GroupCard } from '@/apps/workbench/components/group/GroupCard'

export function ChatGroupDetailPage() {
  const { groupId } = useParams()
  const s = useStore()
  const admin = s.session.adminStaffId!
  const group = s.chatGroups.find((g) => g.id === groupId)
  const canManage = s.staff.some((staff) => staff.id === admin && staff.status === 'active') && staffHasCap(s, admin, 'manage_groups')

  if (!group) {
    return (
      <div>
        <BackLink />
        <Empty text="群不存在或已被删除" />
      </div>
    )
  }
  const ownerName = s.seats.find((seat) => seat.id === group.ownerSeatId)?.displayName ?? '群主坐席'
  const identityNote = canManage ? `以群主坐席「${ownerName}」的身份操作，操作记在你的名下` : '只读：需要「管理所有群」权限'
  return (
    <div>
      <BackLink />
      <PageHeader title={`群管理：${group.name}`} desc="有「管理所有群」权限的员工可管理任何群，不需要持有坐席。" />
      <Note>
        {identityNote}
      </Note>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <GroupCard key={group.id} group={group} actor={{ seatId: group.ownerSeatId, staffId: admin, source: 'admin' }} perm={(permission) => canManage && seatGroupPerm(s, group, group.ownerSeatId, admin, permission)} officialEditable={canManage} canViewAllCustomers identityNote={identityNote} />
        <div className="xl:sticky xl:top-4 xl:self-start">
          <RecentMessagesCard group={group} />
        </div>
      </div>
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/admin/groups" className="mb-3 inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">
      <ArrowLeft size={13} /> 返回全部群列表
    </Link>
  )
}

/** 最近消息：该群会话最近 20 条 */
function RecentMessagesCard({ group }: { group: ChatGroup }) {
  const s = useStore()
  const conv = s.conversations.find((c) => c.chatGroupId === group.id)
  const list = conv ? messagesOf(s, conv.id).slice(-20).reverse() : []
  return (
    <Card title="最近消息（最近 20 条）" padded={false}>
      {!list.length && <Empty text="该群还没有消息" />}
      <ul className="thin-scroll max-h-[640px] divide-y divide-zinc-100 overflow-y-auto">
        {list.map((m) => (
          <li key={m.id} id={`msg-${m.id}`} className="px-4 py-2 text-xs">
            <div className="flex items-center justify-between">
              <span className={m.senderKind === 'seat' ? 'font-medium text-brand-800' : 'font-medium text-zinc-700'}>
                {senderName(s, m)}
                {m.senderKind === 'seat' && <Pill tone="blue" className="ml-1">坐席</Pill>}
                {group.pinnedMessageIds.includes(m.id) && <Pill tone="amber" className="ml-1">置顶</Pill>}
              </span>
              <span className="tabular-nums text-zinc-400">{fmtDateTime(m.at)}</span>
            </div>
            <div className={m.deletedAt ? 'mt-0.5 text-zinc-400 italic' : m.senderKind === 'system' ? 'mt-0.5 text-zinc-400' : 'mt-0.5 text-zinc-700'}>{visibleText(m, 'staff')}</div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
