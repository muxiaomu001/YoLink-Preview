import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmtAgo, fmtDate } from '@/domain/time'
import { customersOfSeat, primarySeatOfCustomer, staffById } from '@/store/selectors'
import { Button, Input, Select } from '@/ui/primitives'
import { Avatar, Card, Note, PageHeader, SeatAvatar, Table, Tabs, TagChip, TitleChip } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { useWorkbench } from '../useWorkbench'

export function CustomersPage() {
  const { s, seat, can } = useWorkbench()
  const nav = useNavigate()
  const [tab, setTab] = useState<'mine' | 'all'>('mine')
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const [title, setTitle] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  const rows = useMemo(() => {
    const base = tab === 'mine' && seat ? customersOfSeat(s, seat.id) : s.customers
    return base
      .filter((c) => !q || c.nickname.includes(q) || c.accountId.includes(q))
      .filter((c) => !tag || c.tagIds.includes(tag))
      .filter((c) => !title || c.titleIds.includes(title))
      .sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))
  }, [s, tab, seat, q, tag, title])

  return (
    <div className="thin-scroll h-full overflow-y-auto p-5">
      <PageHeader
        title="客户"
        desc={seat ? `「我的客户」＝ 当前坐席身份「${seat.displayName}」主归属的客户。切换顶部坐席身份，这一页跟着切。` : ''}
        extra={
          selected.length > 0 ? (
            <>
              <span className="text-xs text-zinc-500">已选 {selected.length} 人</span>
              <Button size="sm" onClick={() => toast(`演示：把 ${selected.length} 人拉进指定群`)}>
                批量拉群
              </Button>
              <Button size="sm" onClick={() => toast(`演示：给 ${selected.length} 人批量打内部标签（P1）`)}>
                批量打标签
              </Button>
            </>
          ) : undefined
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        className="mb-3"
        items={[
          { key: 'mine', label: '我的客户', count: seat ? customersOfSeat(s, seat.id).length : 0 },
          { key: 'all', label: can('view_all_customers') ? '全部客户' : '全部客户（无权限）', count: can('view_all_customers') ? s.customers.length : undefined },
        ]}
      />
      {tab === 'all' && !can('view_all_customers') ? (
        <Note tone="amber">当前员工角色没有 view_all_customers 能力，只能看自己持有坐席主归属的客户。管理员在「员工角色」里改。</Note>
      ) : (
        <>
          <div className="mb-3 flex gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜昵称、账号 ID" className="w-48" />
            <Select value={tag} onChange={(e) => setTag(e.target.value)} className="w-40">
              <option value="">按内部标签</option>
              {s.tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Select value={title} onChange={(e) => setTitle(e.target.value)} className="w-40">
              <option value="">按头衔</option>
              {s.titles.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <Card padded={false}>
            <Table
              rows={rows}
              rowKey={(c) => c.id}
              columns={[
                {
                  key: 'sel',
                  title: '',
                  width: '32px',
                  render: (c) => <input type="checkbox" className="accent-brand-700" checked={selected.includes(c.id)} onChange={(e) => setSelected((l) => (e.target.checked ? [...l, c.id] : l.filter((x) => x !== c.id)))} onClick={(e) => e.stopPropagation()} />,
                },
                {
                  key: 'name',
                  title: '客户',
                  render: (c) => (
                    <div className="flex items-center gap-2">
                      <Avatar text={c.nickname} size={26} />
                      <div>
                        <div className="text-zinc-900">{c.nickname}</div>
                        <div className="text-[10px] text-zinc-400">{c.accountId}</div>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'title',
                  title: '头衔',
                  render: (c) => {
                    const t = c.primaryTitleId ? s.titles.find((x) => x.id === c.primaryTitleId && x.enabled) : undefined
                    return t ? <TitleChip title={t} size="xs" /> : <span className="text-zinc-300">-</span>
                  },
                },
                {
                  key: 'tags',
                  title: '内部标签',
                  render: (c) => (
                    <div className="flex flex-wrap gap-1">
                      {c.tagIds.map((tid) => {
                        const t = s.tags.find((x) => x.id === tid)
                        return t ? <TagChip key={tid} tag={t} /> : null
                      })}
                    </div>
                  ),
                },
                { key: 'reg', title: '注册时间', render: (c) => <span className="tabular-nums text-zinc-500">{fmtDate(c.registeredAt)}</span> },
                { key: 'active', title: '最近活跃', render: (c) => <span className="text-zinc-500">{fmtAgo(c.lastActiveAt)}</span> },
                {
                  key: 'seat',
                  title: '主归属坐席',
                  render: (c) => {
                    const ps = primarySeatOfCustomer(s, c.id)
                    const op = staffById(s, ps?.operatorStaffId)
                    return ps ? (
                      <span className="inline-flex items-center gap-1.5" title={can('view_seat_operator') ? `当前实操：${op?.name ?? '无'}` : undefined}>
                        <SeatAvatar seat={ps} size={18} /> {ps.displayName}
                      </span>
                    ) : (
                      '-'
                    )
                  },
                },
                {
                  key: 'ops',
                  title: '',
                  align: 'right',
                  render: (c) => {
                    const conv = seat && s.conversations.find((x) => x.kind === 'dm' && x.customerId === c.id && x.seatId === seat.id)
                    return conv ? (
                      <Button size="sm" variant="ghost" onClick={() => nav(`/workbench/chat/${conv.id}`)}>
                        聊天
                      </Button>
                    ) : (
                      <span className="text-[10px] text-zinc-400">不在本坐席</span>
                    )
                  },
                },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  )
}
