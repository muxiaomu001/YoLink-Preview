import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ChatGroup, ChatGroupKind } from '@/domain/types'
import { fmtDate } from '@/domain/time'
import { useStore } from '@/store/store'
import { seatById } from '@/store/selectors'
import { Button, Select } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, SeatAvatar, Table, type Column } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'

export const GROUP_KIND_LABEL: Record<ChatGroupKind, string> = { group: '普通群', supergroup: '大群', channel: '频道' }

type KindFilter = 'all' | ChatGroupKind

export function ChatGroupsPage() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const navigate = useNavigate()
  const [kind, setKind] = useState<KindFilter>('all')

  const rows = useMemo(() => s.chatGroups.filter((g) => kind === 'all' || g.kind === kind), [s.chatGroups, kind])

  const toggleOfficial = async (g: ChatGroup) => {
    const next = !g.official
    const ok = await confirm({
      title: next ? `标记「${g.name}」为官方群？` : `取消「${g.name}」的官方标记？`,
      body: next
        ? '标记后该群的 group.leave 策略对客户关闭：客户不可退出，群名旁显示橙色「官方」标识。'
        : '取消后客户可以自行退出该群，「官方」标识消失。',
      okText: next ? '标记为官方群' : '取消标记',
      danger: !next,
    })
    if (!ok) return
    s.setGroupOfficial(g.id, next, admin)
    toast(next ? `「${g.name}」已标记为官方群，客户不可退出` : `已取消「${g.name}」的官方标记`)
  }

  const columns: Column<ChatGroup>[] = [
    {
      key: 'name',
      title: '群名称',
      render: (g) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-900">{g.name}</span>
          {g.official && <Pill tone="amber">官方</Pill>}
          {s.enterprise.defaultChatGroupIds.includes(g.id) && <Pill tone="blue">默认加入</Pill>}
        </div>
      ),
    },
    { key: 'kind', title: '类型', render: (g) => <span>{GROUP_KIND_LABEL[g.kind]}{g.kind === 'channel' && <span className="ml-1 text-[11px] text-zinc-400">客户只读</span>}</span> },
    { key: 'members', title: '成员数', align: 'right', render: (g) => <span className="tabular-nums">{g.memberCustomerIds.length + g.memberSeatIds.length}</span> },
    {
      key: 'owner',
      title: '创建者（群主坐席）',
      render: (g) => {
        const seat = seatById(s, g.ownerSeatId)
        return seat ? (
          <span className="inline-flex items-center gap-1.5">
            <SeatAvatar seat={seat} size={20} /> {seat.displayName}
          </span>
        ) : (
          <span className="text-zinc-400">-</span>
        )
      },
    },
    { key: 'createdAt', title: '创建时间', render: (g) => <span className="tabular-nums text-zinc-600">{fmtDate(g.createdAt)}</span> },
    { key: 'official', title: '官方群', render: (g) => (g.official ? <span className="text-amber-700">是</span> : <span className="text-zinc-500">否</span>) },
    {
      key: 'ops',
      title: '操作',
      align: 'right',
      render: (g) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/groups/${g.id}`)}>
            进入管理
          </Button>
          <Button size="sm" variant={g.official ? 'ghost' : 'primary'} onClick={() => void toggleOfficial(g)}>
            {g.official ? '取消标记' : '标记为官方群'}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="全部群列表"
        desc="群主和管理员都是坐席，员工以坐席身份在群里。企业默认官方群：所有新客户注册后自动加入，邀请组附带的群在此之上叠加。"
        extra={
          <Select value={kind} onChange={(e) => setKind(e.target.value as KindFilter)} className="w-32">
            <option value="all">全部类型</option>
            <option value="group">普通群</option>
            <option value="supergroup">大群</option>
            <option value="channel">频道</option>
          </Select>
        }
      />
      <Note>
        标记为官方群后，该群的 <code>group.leave</code> 策略对客户关闭，客户不可退出，群名旁显示橙色「官方」。当前企业默认加入：
        {s.enterprise.defaultChatGroupIds.map((id) => s.chatGroups.find((g) => g.id === id)?.name).filter(Boolean).join('、') || '无'}。
      </Note>
      <Card className="mt-4" padded={false}>
        <Table rows={rows} columns={columns} rowKey={(g) => g.id} empty="该类型下没有群" />
      </Card>
    </div>
  )
}
