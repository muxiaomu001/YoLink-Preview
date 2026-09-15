import { useStore } from '@/store/store'
import { seatById } from '@/store/selectors'
import { Card, Note, PageHeader, Pill, SeatAvatar, Table } from '@/ui/display'

export function ChatGroupsPage() {
  const s = useStore()
  return (
    <div>
      <PageHeader title="群与频道" desc="群主和管理员都是坐席，员工以坐席身份在群里。企业默认官方群：所有新客户注册后自动加入。" />
      <Note>
        企业默认官方群与频道：{s.enterprise.defaultChatGroupIds.map((id) => s.chatGroups.find((g) => g.id === id)?.name).join('、')}。邀请组附带的群在此之上叠加。
      </Note>
      <Card className="mt-4" padded={false}>
        <Table
          rows={s.chatGroups}
          rowKey={(g) => g.id}
          columns={[
            {
              key: 'name',
              title: '名称',
              render: (g) => (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-900">{g.name}</span>
                  {g.official && <Pill tone="amber">官方</Pill>}
                  {s.enterprise.defaultChatGroupIds.includes(g.id) && <Pill tone="blue">默认加入</Pill>}
                </div>
              ),
            },
            { key: 'kind', title: '类型', render: (g) => (g.kind === 'channel' ? '频道（客户只读）' : '群') },
            { key: 'desc', title: '说明', render: (g) => <span className="text-zinc-500">{g.desc}</span> },
            {
              key: 'owner',
              title: '群主（坐席）',
              render: (g) => {
                const seat = seatById(s, g.ownerSeatId)
                return seat ? (
                  <span className="inline-flex items-center gap-1.5">
                    <SeatAvatar seat={seat} size={20} /> {seat.displayName}
                  </span>
                ) : null
              },
            },
            { key: 'members', title: '成员', align: 'right', render: (g) => <span className="tabular-nums">{g.memberCustomerIds.length + g.memberSeatIds.length}</span> },
            { key: 'req', title: '入群条件', render: (g) => (g.requiredTitleId ? `头衔：${s.titles.find((t) => t.id === g.requiredTitleId)?.name}` : <span className="text-zinc-400">无</span>) },
          ]}
        />
      </Card>
    </div>
  )
}
