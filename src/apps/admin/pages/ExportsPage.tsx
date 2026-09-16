import { useMemo, useState } from 'react'
import { Download, FileJson, FileSpreadsheet, Users } from 'lucide-react'
import { AUDIT_LABEL } from '@/domain/labels'
import { downloadCsv, downloadJson, fileStamp } from '@/domain/csv'
import { useStore } from '@/store/store'
import { primarySeatOfCustomer, staffById } from '@/store/selectors'
import { Button, Field, Input, Select } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, Table } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { convName, fmtDateTimeSec, inDateRange, messageText, operatorLabel, senderLabel } from './audit-helpers'

const CUSTOMER_HEADER = ['昵称', '账号 ID', '手机号', '邮箱', '内部标签', '头衔', '注册时间', '最近活跃', '主归属坐席']

export function ExportsPage() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [msgOpen, setMsgOpen] = useState(false)

  const recent = useMemo(() => s.audit.filter((e) => e.type === 'export').slice(0, 10), [s.audit])

  const exportCustomers = async () => {
    const ok = await confirm({
      title: '导出客户 CSV？',
      body: `将导出全部 ${s.customers.length} 位客户（含已注销），字段：${CUSTOMER_HEADER.join('、')}。此操作记入审计日志。`,
      okText: '导出',
    })
    if (!ok) return
    const rows = s.customers.map((c) => [
      c.nickname,
      c.accountId,
      c.phone ?? '',
      c.email ?? '',
      c.tagIds.map((id) => s.tags.find((t) => t.id === id)?.name).filter(Boolean).join('；'),
      c.titleIds.map((id) => s.titles.find((t) => t.id === id)?.name).filter(Boolean).join('；'),
      fmtDateTimeSec(c.registeredAt),
      fmtDateTimeSec(c.lastActiveAt),
      primarySeatOfCustomer(s, c.id)?.displayName ?? '',
    ])
    downloadCsv(`customers-${fileStamp()}.csv`, CUSTOMER_HEADER, rows)
    s.recordExport(`客户列表 CSV，${rows.length} 位客户`, admin)
    toast(`已导出 ${rows.length} 位客户，并记入审计日志`)
  }

  return (
    <div>
      <PageHeader title="导出" level="P1" desc="把客户列表与消息记录导成文件，用于合规、BI 或数据迁移。导出前需要二次确认。" />
      <Note>
        导出需要员工角色有 <b>export_data</b> 能力。消息记录支持 CSV 与 JSON 两种格式（按 Zulip 合规导出），JSON 保留发送者、坐席与实操员工的完整字段。
      </Note>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
              <Users size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-zinc-900">导出客户列表</div>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">全部 {s.customers.length} 位客户。字段：{CUSTOMER_HEADER.join('、')}。</p>
              <Button variant="primary" className="mt-3" onClick={() => void exportCustomers()}>
                <FileSpreadsheet size={14} /> 导出客户 CSV
              </Button>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700">
              <FileJson size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-zinc-900">导出消息记录</div>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">按时间范围、用户、会话筛选，导出 CSV 或 JSON。已删除的消息导出为「[已删除]」。</p>
              <Button variant="primary" className="mt-3" onClick={() => setMsgOpen(true)}>
                <Download size={14} /> 导出消息记录
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-4" title="最近导出记录（来自审计日志）" padded={false}>
        <Table
          rows={recent}
          rowKey={(e) => e.id}
          dense
          empty="还没有导出过"
          columns={[
            { key: 'at', title: '时间', width: '150px', render: (e) => <span className="tabular-nums text-zinc-500">{fmtDateTimeSec(e.at)}</span> },
            { key: 'actor', title: '操作人', width: '110px', render: (e) => staffById(s, e.actorStaffId)?.name ?? '系统' },
            { key: 'type', title: '事件', width: '100px', render: (e) => <Pill tone="blue">{AUDIT_LABEL[e.type]}</Pill> },
            { key: 'detail', title: '详情', render: (e) => <span className="text-zinc-700">{e.detail}</span> },
          ]}
        />
      </Card>

      {msgOpen && <MessageExportModal onClose={() => setMsgOpen(false)} />}
    </div>
  )
}

function MessageExportModal({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [form, setForm] = useState({ from: '', to: '', customerId: '', convId: '', format: 'csv' as 'csv' | 'json' })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const convOptions = useMemo(() => [...s.conversations].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt)).map((c) => ({ id: c.id, name: convName(s, c.id) })), [s])

  const matched = useMemo(
    () =>
      s.messages
        .filter((m) => m.kind !== 'system')
        .filter((m) => inDateRange(m.at, form.from, form.to))
        .filter((m) => {
          if (!form.customerId) return true
          const conv = s.conversations.find((c) => c.id === m.convId)
          return conv?.customerId === form.customerId || m.senderId === form.customerId
        })
        .filter((m) => !form.convId || m.convId === form.convId)
        .sort((a, b) => a.at.localeCompare(b.at)),
    [s, form.from, form.to, form.customerId, form.convId],
  )

  const scopeDesc = () => {
    const parts: string[] = []
    if (form.from || form.to) parts.push(`时间 ${form.from || '不限'} 至 ${form.to || '不限'}`)
    if (form.customerId) parts.push(`用户 ${s.customers.find((c) => c.id === form.customerId)?.nickname}`)
    if (form.convId) parts.push(`会话 ${convName(s, form.convId)}`)
    return parts.length ? parts.join('，') : '全部'
  }

  const submit = async () => {
    const ok = await confirm({
      title: `导出 ${matched.length} 条消息为 ${form.format.toUpperCase()}？`,
      body: `范围：${scopeDesc()}。此操作记入审计日志。`,
      okText: '导出',
    })
    if (!ok) return
    const name = `messages-${fileStamp()}`
    if (form.format === 'csv') {
      downloadCsv(
        `${name}.csv`,
        ['时间', '发送者', '实操员工', '会话', '消息内容', '已删除'],
        matched.map((m) => [fmtDateTimeSec(m.at), senderLabel(s, m), operatorLabel(s, m), convName(s, m.convId), messageText(m), m.deletedAt ? '是' : '否']),
      )
    } else {
      downloadJson(
        `${name}.json`,
        matched.map((m) => ({
          id: m.id,
          at: m.at,
          conversation: convName(s, m.convId),
          senderKind: m.senderKind,
          sender: senderLabel(s, m),
          seatId: m.seatId ?? null,
          operator: operatorLabel(s, m) || null,
          kind: m.kind,
          text: messageText(m),
          deletedAt: m.deletedAt ?? null,
        })),
      )
    }
    s.recordExport(`消息记录 ${form.format.toUpperCase()}，${matched.length} 条（${scopeDesc()}）`, admin)
    toast(`已导出 ${matched.length} 条消息（${form.format.toUpperCase()}），并记入审计日志`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="导出消息记录"
      width={480}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!matched.length} onClick={() => void submit()}>
            <Download size={14} /> 导出 {matched.length} 条
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="时间范围" hint="留空表示不限">
          <div className="flex items-center gap-1">
            <Input type="date" value={form.from} max={form.to || undefined} onChange={(e) => set({ from: e.target.value })} aria-label="开始日期" />
            <span className="text-xs text-zinc-400">至</span>
            <Input type="date" value={form.to} min={form.from || undefined} onChange={(e) => set({ to: e.target.value })} aria-label="结束日期" />
          </div>
        </Field>
        <Field label="用户（可选）">
          <Select value={form.customerId} onChange={(e) => set({ customerId: e.target.value })}>
            <option value="">不限</option>
            {s.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nickname}（{c.accountId}）
              </option>
            ))}
          </Select>
        </Field>
        <Field label="会话（可选）">
          <Select value={form.convId} onChange={(e) => set({ convId: e.target.value })}>
            <option value="">不限</option>
            {convOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        {/* 单选组不用 Field 包：Field 本身是 label，label 里再套 label 不合法 */}
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-600">
            格式<span className="ml-0.5 text-red-500">*</span>
          </div>
          <div className="flex gap-4">
            {(['csv', 'json'] as const).map((f) => (
              <label key={f} className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-zinc-700">
                <input type="radio" name="export-format" checked={form.format === f} onChange={() => set({ format: f })} className="accent-brand-700" />
                {f.toUpperCase()}
                <span className="text-[11px] text-zinc-400">{f === 'csv' ? 'Excel 直接打开' : '含完整字段，给程序读'}</span>
              </label>
            ))}
          </div>
        </div>
        {!matched.length && <div className="text-xs text-red-600">当前范围内没有消息</div>}
      </div>
    </Modal>
  )
}
