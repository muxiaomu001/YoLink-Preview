import { useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { Download } from 'lucide-react'
import type { AuditEvent, AuditType } from '@/domain/types'
import { AUDIT_LABEL } from '@/domain/labels'
import { downloadCsv, fileStamp } from '@/domain/csv'
import { useStore } from '@/store/store'
import { staffById } from '@/store/selectors'
import { Button, Input, Select } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, Table, type Column } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { fmtDateTimeSec, inDateRange } from './audit-helpers'

/** 表格最多渲染的行数；导出不受此限制 */
const MAX_ROWS = 200

/** 操作人下拉里"系统"的取值（actorStaffId 为 null 的事件，如客户注册） */
const ACTOR_SYSTEM = '__system__'

function typeTone(t: AuditType): 'zinc' | 'green' | 'amber' | 'red' | 'blue' {
  if (t === 'seat.handover' || t === 'customer.reassign') return 'amber'
  if (t === 'customer.register') return 'green'
  if (t === 'login_failed' || t === 'message.delete' || t === 'customer.delete' || t === 'staff.force_logout') return 'red'
  if (t === 'export') return 'blue'
  return 'zinc'
}

export function AuditLogPage() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [types, setTypes] = useState<AuditType[]>([])
  const [actor, setActor] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  // 事件类型 chips 只列出日志里实际出现过的类型，几十种全铺开没法看
  const presentTypes = useMemo(() => {
    const set = new Set<AuditType>(s.audit.map((e) => e.type))
    return Array.from(set).sort((a, b) => AUDIT_LABEL[a].localeCompare(AUDIT_LABEL[b], 'zh'))
  }, [s.audit])

  const filtered = useMemo(
    () =>
      s.audit
        .filter((e) => !types.length || types.includes(e.type))
        .filter((e) => !actor || (actor === ACTOR_SYSTEM ? e.actorStaffId === null : e.actorStaffId === actor))
        .filter((e) => inDateRange(e.at, from, to)),
    [s.audit, types, actor, from, to],
  )
  const rows = filtered.slice(0, MAX_ROWS)

  const toggleType = (t: AuditType) => setTypes((list) => (list.includes(t) ? list.filter((x) => x !== t) : [...list, t]))

  const actorText = (e: AuditEvent) => {
    if (e.actorStaffId === 'customer_self') return '客户本人'
    const st = staffById(s, e.actorStaffId)
    return st ? `${st.name}（${st.username}）` : '系统'
  }

  const filterDesc = () => {
    const parts: string[] = []
    if (types.length) parts.push(`事件：${types.map((t) => AUDIT_LABEL[t]).join('/')}`)
    if (actor) parts.push(`操作人：${actor === ACTOR_SYSTEM ? '系统' : staffById(s, actor)?.name}`)
    if (from || to) parts.push(`时间：${from || '不限'} 至 ${to || '不限'}`)
    return parts.length ? parts.join('；') : '无筛选'
  }

  const exportCsv = async () => {
    const ok = await confirm({
      title: '导出审计日志 CSV？',
      body: `将导出当前筛选结果 ${filtered.length} 条（${filterDesc()}）。这次导出本身也会记入审计日志。`,
      okText: '导出',
    })
    if (!ok) return
    downloadCsv(
      `audit-log-${fileStamp()}.csv`,
      ['时间', '操作人', 'IP 地址', '事件类型', '详情'],
      filtered.map((e) => [fmtDateTimeSec(e.at), actorText(e), e.ip ?? '', AUDIT_LABEL[e.type], e.detail]),
    )
    s.recordExport(`审计日志 CSV，${filtered.length} 条（${filterDesc()}）`, admin)
    toast(`已导出 ${filtered.length} 条审计日志，并记入审计`)
  }

  const columns: Column<AuditEvent>[] = [
    { key: 'at', title: '时间', width: '150px', render: (e) => <span className="tabular-nums text-zinc-500">{fmtDateTimeSec(e.at)}</span> },
    {
      key: 'actor',
      title: '操作人',
      width: '140px',
      render: (e) => {
        if (e.actorStaffId === 'customer_self') return <span className="text-zinc-900">客户本人</span>
        const st = staffById(s, e.actorStaffId)
        if (!st) return <span className="text-zinc-400">系统</span>
        return (
          <div>
            <div className="text-zinc-900">{st.name}</div>
            <div className="text-[11px] text-zinc-500">{st.username}</div>
          </div>
        )
      },
    },
    { key: 'ip', title: 'IP 地址', width: '110px', render: (e) => <span className="font-mono text-xs text-zinc-600">{e.ip ?? '-'}</span> },
    { key: 'type', title: '事件类型', width: '130px', render: (e) => <Pill tone={typeTone(e.type)}>{AUDIT_LABEL[e.type] ?? e.type}</Pill> },
    { key: 'detail', title: '详情', render: (e) => <span className="text-zinc-700">{e.detail}</span> },
  ]

  return (
    <div>
      <PageHeader
        title="审计日志"
        desc="管理员与员工的所有管理操作。客户注册、坐席交接、补加、挂摘头衔、删消息、导出，都在这里。"
        extra={
          <Button variant="primary" onClick={() => void exportCsv()} disabled={!filtered.length}>
            <Download size={14} /> 导出 CSV
          </Button>
        }
      />
      <Note>
        审计日志<b>保留 1 年</b>，只增不删。「导出 CSV」导出的是当前筛选结果，导出动作本身也会留一条记录。
      </Note>

      <Card className="mt-4" title="筛选">
        <div className="flex flex-wrap items-end gap-2">
          <Select value={actor} onChange={(e) => setActor(e.target.value)} className="w-44">
            <option value="">全部操作人</option>
            <option value={ACTOR_SYSTEM}>系统</option>
            {s.staff.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}（{st.username}）
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-1">
            <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="w-36" aria-label="开始日期" />
            <span className="text-xs text-zinc-400">至</span>
            <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="w-36" aria-label="结束日期" />
          </div>
          <span className="ml-auto text-xs text-zinc-500">
            共 {filtered.length} 条{filtered.length > MAX_ROWS && `，显示最近 ${MAX_ROWS} 条`}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] text-zinc-500">事件类型（可多选）</span>
          {presentTypes.map((t) => {
            const on = types.includes(t)
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                aria-pressed={on}
                className={clsx('rounded-full border px-2 text-[11px] leading-5 transition-colors', on ? 'border-brand-700 bg-brand-700 text-white' : 'border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50')}
              >
                {AUDIT_LABEL[t]}
              </button>
            )
          })}
          {types.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setTypes([])}>
              清除
            </Button>
          )}
        </div>
      </Card>

      <Card className="mt-3" padded={false}>
        <Table rows={rows} rowKey={(e) => e.id} dense columns={columns} empty="没有符合条件的记录" />
      </Card>
    </div>
  )
}
