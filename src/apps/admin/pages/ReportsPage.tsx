import { useMemo, useState } from 'react'
import { Ban, Eye, EyeOff, Trash2 } from 'lucide-react'
import type { Report } from '@/domain/types'
import { useStore } from '@/store/store'
import { customerById, staffById } from '@/store/selectors'
import { Button } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, Table, Tabs, type Column } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { MessageContextModal } from './MessageContextModal'
import { fmtDateTimeSec, messageText } from './audit-helpers'

type Tab = 'pending' | 'all'
type Resolution = NonNullable<Report['resolution']>

const RESOLUTION_LABEL: Record<Resolution, string> = { banned: '已封禁被举报人', deleted: '已删除消息', ignored: '已忽略' }

export function ReportsPage() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [tab, setTab] = useState<Tab>('pending')
  const [ctxId, setCtxId] = useState<string | null>(null)

  const pending = useMemo(() => s.reports.filter((r) => r.status === 'pending'), [s.reports])
  const rows = useMemo(() => [...(tab === 'pending' ? pending : s.reports)].sort((a, b) => b.at.localeCompare(a.at)), [tab, pending, s.reports])

  const handle = async (r: Report, resolution: Resolution) => {
    const target = customerById(s, r.targetCustomerId)
    const name = target?.nickname ?? '该客户'
    const copy: Record<Resolution, { title: string; body: string; ok: string; danger: boolean }> = {
      banned: { title: `封禁「${name}」？`, body: '封禁后该客户无法登录，所有已登录设备会退出。举报会标记为已处理。', ok: '封禁', danger: true },
      deleted: { title: '删除被举报的消息？', body: '删除后客户侧不可见，审计仍可查。举报标记为已处理，记审计日志。', ok: '删除消息', danger: true },
      ignored: { title: '忽略这条举报？', body: '不做处理，举报标记为已处理并记审计日志。', ok: '忽略', danger: false },
    }
    const c = copy[resolution]
    const ok = await confirm({ title: c.title, body: c.body, okText: c.ok, danger: c.danger })
    if (!ok) return
    s.handleReport(r.id, resolution, admin)
    toast(`举报已处理：${RESOLUTION_LABEL[resolution]}`)
  }

  const columns: Column<Report>[] = [
    { key: 'at', title: '时间', width: '150px', render: (r) => <span className="tabular-nums text-zinc-500">{fmtDateTimeSec(r.at)}</span> },
    {
      key: 'reporter',
      title: '举报人',
      render: (r) => {
        const c = customerById(s, r.reporterCustomerId)
        return (
          <div>
            <div className="text-zinc-900">{c?.nickname ?? '未知客户'}</div>
            <div className="text-[11px] tabular-nums text-zinc-500">{c?.accountId}</div>
          </div>
        )
      },
    },
    {
      key: 'target',
      title: '被举报对象',
      render: (r) => {
        const c = customerById(s, r.targetCustomerId)
        const m = r.messageId ? s.messages.find((x) => x.id === r.messageId) : undefined
        return (
          <div className="max-w-sm">
            <div className="flex items-center gap-1.5">
              <Pill tone={r.targetKind === 'message' ? 'purple' : 'zinc'}>{r.targetKind === 'message' ? '消息' : '用户'}</Pill>
              <span className="text-zinc-900">{c?.nickname ?? '未知客户'}</span>
              <span className="text-[11px] tabular-nums text-zinc-400">{c?.accountId}</span>
            </div>
            {r.targetKind === 'message' && (
              <div className={m?.deletedAt ? 'mt-0.5 text-[11px] italic text-zinc-400' : 'mt-0.5 line-clamp-2 text-[11px] text-zinc-600'}>{m ? messageText(m) : '（消息不存在）'}</div>
            )}
          </div>
        )
      },
    },
    { key: 'reason', title: '原因', render: (r) => <span className="text-zinc-700">{r.reason}</span> },
    {
      key: 'status',
      title: '状态',
      render: (r) =>
        r.status === 'pending' ? (
          <Pill tone="amber">待处理</Pill>
        ) : (
          <div>
            <Pill tone="green">已处理</Pill>
            <div className="mt-0.5 text-[11px] text-zinc-500">
              {r.resolution ? RESOLUTION_LABEL[r.resolution] : ''}
              {r.handledBy && ` · ${staffById(s, r.handledBy)?.name ?? '未知'}`}
              {r.handledAt && ` · ${fmtDateTimeSec(r.handledAt)}`}
            </div>
          </div>
        ),
    },
    {
      key: 'ops',
      title: '操作',
      align: 'right',
      render: (r) => {
        if (r.status !== 'pending') return <span className="text-xs text-zinc-400">已处理</span>
        return (
          <div className="flex flex-wrap justify-end gap-1">
            {r.targetKind === 'message' && r.messageId && (
              <Button size="sm" variant="ghost" onClick={() => setCtxId(r.messageId!)}>
                <Eye size={12} /> 查看上下文
              </Button>
            )}
            <Button size="sm" variant="danger" onClick={() => void handle(r, 'banned')}>
              <Ban size={12} /> 封禁被举报人
            </Button>
            {r.targetKind === 'message' && (
              <Button size="sm" variant="danger" onClick={() => void handle(r, 'deleted')}>
                <Trash2 size={12} /> 删除消息
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => void handle(r, 'ignored')}>
              <EyeOff size={12} /> 忽略
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader title="举报处理" level="P1" desc="客户在 App 里提交的举报会进入这里排队，按先后顺序处理。" />
      <Note>
        被举报对象是消息时可先看上下文再决定。处理动作三选一：封禁被举报人、删除消息（仅消息类）、忽略。
      </Note>

      <Tabs
        className="mt-4"
        value={tab}
        onChange={setTab}
        items={[
          { key: 'pending', label: '待处理', count: pending.length },
          { key: 'all', label: '全部', count: s.reports.length },
        ]}
      />
      <Card className="mt-3" padded={false}>
        <Table rows={rows} rowKey={(r) => r.id} dense columns={columns} empty={tab === 'pending' ? '没有待处理的举报' : '暂无举报'} />
      </Card>

      {ctxId && <MessageContextModal messageId={ctxId} onClose={() => setCtxId(null)} />}
    </div>
  )
}
