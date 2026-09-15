/**
 * 群管理页：复用工作台的群信息卡组件（perm 恒 true，以群主坐席身份、管理员实操），右侧保留"最近消息"。
 */
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Bot } from 'lucide-react'
import type { ChatGroup } from '@/domain/types'
import { fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { senderName, visibleText } from '@/store/policy'
import { messagesOf } from '@/store/selectors'
import { Card, Empty, Note, PageHeader, Pill } from '@/ui/display'
import { GroupCard } from '@/apps/workbench/components/group/GroupCard'

export function ChatGroupDetailPage() {
  const { groupId } = useParams()
  const s = useStore()
  const admin = s.session.adminStaffId!
  const group = s.chatGroups.find((g) => g.id === groupId)

  if (!group) {
    return (
      <div>
        <BackLink />
        <Empty text="群不存在或已被删除" />
      </div>
    )
  }
  return (
    <div>
      <BackLink />
      <PageHeader title={`群管理：${group.name}`} desc="与工作台右侧的群信息卡是同一套组件。管理后台不看群内角色，全部权限可用；每个动作仍记管理员日志与审计。" />
      <Note>
        工作台里坐席按群内角色（群主 / 管理员的 8 项权限）显示按钮；这里以群主坐席「{s.seats.find((x) => x.id === group.ownerSeatId)?.displayName}」身份、管理员账号实操，全部可用。
      </Note>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <GroupCard key={group.id} group={group} actor={{ seatId: group.ownerSeatId, staffId: admin }} perm={() => true} officialEditable canViewAllCustomers identityNote="管理后台：以群主坐席身份操作，全部权限" />
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
                {m.senderKind === 'bot' && <Pill tone="purple" className="ml-1"><Bot size={9} className="mr-0.5" />机器人</Pill>}
                {group.pinnedMessageIds.includes(m.id) && <Pill tone="amber" className="ml-1">置顶</Pill>}
              </span>
              <span className="tabular-nums text-zinc-400">{fmtDateTime(m.at)}</span>
            </div>
            <div className={m.deletedAt || m.recalledAt ? 'mt-0.5 text-zinc-400 italic' : m.senderKind === 'system' ? 'mt-0.5 text-zinc-400' : 'mt-0.5 text-zinc-700'}>{visibleText(m, 'staff')}</div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
