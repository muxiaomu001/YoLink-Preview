import { useMemo, useState } from 'react'
import { Eye, Trash2 } from 'lucide-react'
import type { Message } from '@/domain/types'
import { useStore } from '@/store/store'
import { customerById, operatorAt, seatById, staffById } from '@/store/selectors'
import { botById } from '@/store/policy'
import { Button, Input, Select } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, Table, type Column } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { MessageContextModal } from './MessageContextModal'
import { convName, fmtDateTimeSec, inDateRange, messageText } from './audit-helpers'

/** 结果列表最多显示的条数，避免一次渲染上千行 */
const MAX_ROWS = 100

export function MessageAuditPage() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [q, setQ] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [convFilter, setConvFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [ctxId, setCtxId] = useState<string | null>(null)
  /** 发送者类型：全部 / 只看坐席 / 只看客户 / 只看活跃角色（14 文档：消息审计可按活跃角色消息筛选） */
  const [senderKind, setSenderKind] = useState<'' | 'seat' | 'customer' | 'bot'>('')

  // 会话下拉：私聊显示「客户 ↔ 坐席」，群显示群名，按最近活跃排
  const convOptions = useMemo(
    () => [...s.conversations].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt)).map((c) => ({ id: c.id, name: convName(s, c.id) })),
    [s],
  )

  const filtered = useMemo(() => {
    const kw = q.trim()
    return s.messages
      .filter((m) => m.kind !== 'system')
      .filter((m) => {
        if (!customerFilter) return true
        const conv = s.conversations.find((c) => c.id === m.convId)
        return conv?.customerId === customerFilter || m.senderId === customerFilter
      })
      .filter((m) => !convFilter || m.convId === convFilter)
      .filter((m) => !senderKind || m.senderKind === senderKind)
      .filter((m) => inDateRange(m.at, from, to))
      .filter((m) => !kw || m.text.includes(kw) || !!m.media?.name.includes(kw) || !!m.editHistory?.some((v) => v.text.includes(kw)))
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [s, q, customerFilter, convFilter, senderKind, from, to])
  const rows = filtered.slice(0, MAX_ROWS)

  const reset = () => {
    setQ('')
    setCustomerFilter('')
    setConvFilter('')
    setFrom('')
    setTo('')
  }

  const onDelete = async (m: Message) => {
    const ok = await confirm({
      title: '删除这条消息？',
      body: `「${m.text.slice(0, 40)}${m.text.length > 40 ? '…' : ''}」删除后客户侧不可见，审计里仍可查到，并记入审计日志。`,
      okText: '删除',
      danger: true,
    })
    if (!ok) return
    s.deleteMessage(m.id, admin)
    toast('消息已删除：客户侧不可见，审计仍可查')
  }

  const columns: Column<Message>[] = [
    { key: 'at', title: '时间', width: '150px', render: (m) => <span className="tabular-nums text-zinc-500">{fmtDateTimeSec(m.at)}</span> },
    {
      key: 'sender',
      title: '发送者',
      render: (m) => {
        if (m.senderKind === 'seat') {
          const seat = seatById(s, m.seatId)
          const op = staffById(s, m.operatorId)
          return (
            <div>
              <div className="flex items-center gap-1">
                <span className="font-medium text-zinc-900">{seat?.displayName ?? '未知坐席'}</span>
                <Pill tone="blue">坐席</Pill>
              </div>
              <div className="text-[11px] text-zinc-500">实操：{op?.name ?? '未记录'}</div>
            </div>
          )
        }
        if (m.senderKind === 'bot') {
          const b = botById(s, m.senderId)
          return (
            <div>
              <div className="flex items-center gap-1">
                <span className="font-medium text-zinc-900">{b?.nickname ?? '未知活跃角色'}</span>
                <Pill tone="purple">活跃角色</Pill>
              </div>
              <div className="text-[11px] text-zinc-500">{m.botRuleId ? '规则触发' : `手动：${staffById(s, m.operatorId)?.name ?? '未记录'}`}</div>
            </div>
          )
        }
        const c = customerById(s, m.senderId)
        return (
          <div>
            <div className="text-zinc-900">{c?.nickname ?? '未知客户'}</div>
            <div className="text-[11px] tabular-nums text-zinc-500">{c?.accountId}</div>
          </div>
        )
      },
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
        return (
          <span className={same ? 'text-zinc-500' : 'text-amber-600'}>
            {st?.name ?? '-'}
            {!same && ' ≠'}
          </span>
        )
      },
    },
    { key: 'conv', title: '会话', render: (m) => <span className="text-zinc-600">{convName(s, m.convId)}</span> },
    {
      key: 'text',
      title: '消息内容',
      render: (m) => (m.deletedAt ? <span className="italic text-zinc-400">{m.deletedByManager ? '[管理删除] ' : '[已删除] '}{m.text}</span> : <span className="line-clamp-2 max-w-md text-zinc-800">{messageText(m)}</span>),
    },
    {
      key: 'ops',
      title: '操作',
      align: 'right',
      render: (m) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setCtxId(m.id)}>
            <Eye size={12} /> 查看上下文
          </Button>
          <Button size="sm" variant="danger" disabled={!!m.deletedAt} onClick={() => void onDelete(m)}>
            <Trash2 size={12} /> 删除消息
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="消息审计" desc="客户看到的每条消息都署名坐席。消息同时记录实操员工，可与交接记录相互印证。" />
      <Note>
        发送者是坐席时，「实操员工」列按消息落库时记的 operator_id 显示；「按交接反推」列按消息时间落在哪段交接区间推算。两列一致说明数据没坏。删除消息只是对客户隐藏，审计里永远查得到。
      </Note>

      <Card className="mt-4" title="搜索">
        <div className="flex flex-wrap items-end gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜关键词" className="w-48" />
          <Select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className="w-44">
            <option value="">全部用户</option>
            {s.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nickname}（{c.accountId}）
              </option>
            ))}
          </Select>
          <Select value={senderKind} onChange={(e) => setSenderKind(e.target.value as typeof senderKind)} className="w-32" aria-label="发送者类型">
            <option value="">全部发送者</option>
            <option value="seat">只看坐席</option>
            <option value="customer">只看客户</option>
            <option value="bot">只看活跃角色</option>
          </Select>
          <Select value={convFilter} onChange={(e) => setConvFilter(e.target.value)} className="w-56">
            <option value="">全部会话</option>
            {convOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-1">
            <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="w-36" aria-label="开始日期" />
            <span className="text-xs text-zinc-400">至</span>
            <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="w-36" aria-label="结束日期" />
          </div>
          <Button variant="ghost" onClick={reset}>
            重置
          </Button>
          <span className="ml-auto text-xs text-zinc-500">
            共 {filtered.length} 条{filtered.length > MAX_ROWS && `，显示最近 ${MAX_ROWS} 条`}
          </span>
        </div>
      </Card>

      <Card className="mt-3" padded={false}>
        <Table rows={rows} rowKey={(m) => m.id} dense columns={columns} empty="没有符合条件的消息" />
      </Card>

      {ctxId && <MessageContextModal messageId={ctxId} onClose={() => setCtxId(null)} />}
    </div>
  )
}
