import { useMemo, useState } from 'react'
import { fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { customerById, operatorAt, seatById, staffById } from '@/store/selectors'
import { Input, Select } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, Table } from '@/ui/display'

export function MessageAuditPage() {
  const s = useStore()
  const [q, setQ] = useState('')
  const [seatFilter, setSeatFilter] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')

  const rows = useMemo(() => {
    return [...s.messages]
      .filter((m) => m.kind !== 'system')
      .filter((m) => !seatFilter || m.seatId === seatFilter)
      .filter((m) => {
        if (!customerFilter) return true
        const conv = s.conversations.find((c) => c.id === m.convId)
        return conv?.customerId === customerFilter || m.senderId === customerFilter
      })
      .filter((m) => !q || m.text.includes(q))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 80)
  }, [s, q, seatFilter, customerFilter])

  const convName = (convId: string) => {
    const conv = s.conversations.find((c) => c.id === convId)
    if (!conv) return ''
    if (conv.kind === 'dm') return `${customerById(s, conv.customerId)?.nickname} ↔ ${seatById(s, conv.seatId)?.displayName}`
    return s.chatGroups.find((g) => g.id === conv.chatGroupId)?.name ?? ''
  }

  return (
    <div>
      <PageHeader title="消息审计" desc="客户看到的每条消息都署名坐席。要追「这句话到底是谁说的」，看消息上记的实操员工，与交接记录互为双保险。" />
      <Note>
        发送者是坐席时，「实操员工」列按消息落库时记的 operator_id 显示；「按交接反推」列按消息时间落在哪段交接区间推算。两列一致说明数据没坏。
      </Note>
      <div className="mt-4 flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜关键词" className="w-56" />
        <Select value={seatFilter} onChange={(e) => setSeatFilter(e.target.value)} className="w-44">
          <option value="">全部坐席</option>
          {s.seats.map((x) => (
            <option key={x.id} value={x.id}>
              {x.displayName}
            </option>
          ))}
        </Select>
        <Select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className="w-44">
          <option value="">全部客户</option>
          {s.customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nickname}
            </option>
          ))}
        </Select>
      </div>
      <Card className="mt-3" padded={false}>
        <Table
          rows={rows}
          rowKey={(m) => m.id}
          dense
          columns={[
            { key: 'at', title: '时间', width: '140px', render: (m) => <span className="tabular-nums text-zinc-500">{fmtDateTime(m.at)}</span> },
            {
              key: 'sender',
              title: '发送者',
              render: (m) => (m.senderKind === 'seat' ? <span className="inline-flex items-center gap-1">{seatById(s, m.seatId)?.displayName}<Pill tone="blue">坐席</Pill></span> : <span>{customerById(s, m.senderId)?.nickname}</span>),
            },
            {
              key: 'op',
              title: '实操员工',
              render: (m) => (m.senderKind === 'seat' ? <span className="font-medium">{staffById(s, m.operatorId)?.name ?? <span className="text-red-600">未记录</span>}</span> : <span className="text-zinc-300">-</span>),
            },
            {
              key: 'op2',
              title: '按交接反推',
              render: (m) => {
                if (m.senderKind !== 'seat' || !m.seatId) return <span className="text-zinc-300">-</span>
                const st = operatorAt(s, m.seatId, m.at)
                const same = st?.id === m.operatorId
                return <span className={same ? 'text-zinc-500' : 'text-amber-600'}>{st?.name ?? '-'}{!same && ' ≠'}</span>
              },
            },
            { key: 'conv', title: '会话', render: (m) => <span className="text-zinc-600">{convName(m.convId)}</span> },
            { key: 'text', title: '内容', render: (m) => <span className="line-clamp-2 max-w-md text-zinc-800">{m.text}</span> },
          ]}
        />
      </Card>
    </div>
  )
}
