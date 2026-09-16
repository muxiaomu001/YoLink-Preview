import { useMemo, useState } from 'react'
import { Building2, ExternalLink, FileKey2, KeyRound, LockKeyhole, LogOut, Plus, Search, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ProviderInstance } from '@/domain/types'
import { PROVIDER_STATUS_LABEL, providerInstanceStatus } from '@/domain/providerLicense'
import { fmtDate, fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { Button, Input, Select } from '@/ui/primitives'
import { Card, KV, PageHeader, Pill, Stat, Table } from '@/ui/display'
import { confirm } from '@/ui/confirm'
import { toast } from '@/ui/overlay'
import { DemoNote, DemoNoteToggle } from '@/ui/DemoNote'
import { BindInstanceModal, RenewInstanceModal, StopInstanceModal } from './ProviderApp.parts'
import { PROVIDER_DEMO_ACCESS_KEY } from '@/domain/demoAccess'

type Filter = 'all' | 'active' | 'expired' | 'stopped'

function StatusPill({ instance }: { instance: ProviderInstance }) {
  const status = providerInstanceStatus(instance)
  if (status === 'stopped') return <Pill tone="red">{PROVIDER_STATUS_LABEL.stopped}</Pill>
  if (status === 'expired') return <Pill tone="amber">{PROVIDER_STATUS_LABEL.expired}</Pill>
  return <Pill tone="green">{PROVIDER_STATUS_LABEL.active}</Pill>
}

const ACTION_LABEL = { bind: '绑定', renew: '续期', stop: '停用', resume: '恢复' } as const

export function ProviderApp() {
  const s = useStore()
  const [hasAccess] = useState(() => sessionStorage.getItem(PROVIDER_DEMO_ACCESS_KEY) === 'yes')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [binding, setBinding] = useState(false)
  const [renewing, setRenewing] = useState<ProviderInstance | null>(null)
  const [stopping, setStopping] = useState<ProviderInstance | null>(null)
  const normalized = query.trim().toLowerCase()
  const rows = useMemo(
    () => s.providerInstances.filter((instance) => {
      const matchFilter = filter === 'all' || providerInstanceStatus(instance) === filter
      const matchQuery = !normalized || [instance.enterpriseName, instance.enterpriseCode, instance.deviceCode, instance.instanceId].some((value) => value.toLowerCase().includes(normalized))
      return matchFilter && matchQuery
    }),
    [filter, normalized, s.providerInstances],
  )
  const counts = s.providerInstances.reduce((result, instance) => {
    result[providerInstanceStatus(instance)] += 1
    return result
  }, { active: 0, expired: 0, stopped: 0 })

  if (!hasAccess) {
    return (
      <div className="flex min-h-full items-center justify-center bg-zinc-100 p-6">
        <section className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-950 text-white"><LockKeyhole size={21} /></span>
          <h1 className="mt-5 text-lg font-semibold text-zinc-900">仅限供应方账号</h1>
          <p className="mt-2 text-xs leading-5 text-zinc-500">企业管理员和员工不能进入授权中心，请使用供应方管理员账号登录。</p>
          <DemoNote compact className="mt-4 text-left">演示时请返回首页，从「供应方授权中心」入口切换身份。</DemoNote>
          <Link to="/" className="mt-5 inline-flex h-8 items-center justify-center rounded-md bg-brand-700 px-4 text-xs font-medium text-white hover:bg-brand-800">返回演示首页</Link>
        </section>
      </div>
    )
  }

  const resume = async (instance: ProviderInstance) => {
    const ok = await confirm({ title: `恢复「${instance.enterpriseName}」`, body: '恢复人工停用状态；如果授权已经到期，仍会保持“已到期”提示。', okText: '恢复' })
    if (!ok) return
    s.resumeProviderInstance(instance.id)
    toast(`已恢复「${instance.enterpriseName}」`)
  }

  return (
    <div className="flex min-h-full bg-zinc-100">
      <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-zinc-950 text-white">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-zinc-950"><KeyRound size={18} /></span>
          <div><div className="text-sm font-semibold">YoLink</div><div className="text-[10px] text-zinc-400">供应方授权中心</div></div>
        </div>
        <nav className="p-3">
          <div className="mb-2 px-2 text-[10px] tracking-wide text-zinc-500">授权管理</div>
          <div className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-[13px] font-medium"><FileKey2 size={15} /> 企业部署实例</div>
        </nav>
        <div className="mt-auto space-y-2 border-t border-white/10 p-4 text-xs">
          <Link to="/admin/license" target="_blank" className="flex items-center gap-1.5 text-zinc-300 hover:text-white"><ExternalLink size={12} /> 查看企业许可页</Link>
          <Link to="/" onClick={() => sessionStorage.removeItem(PROVIDER_DEMO_ACCESS_KEY)} className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300"><LogOut size={12} /> 退出授权中心</Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex h-12 items-center justify-between border-b border-zinc-200 bg-white px-6">
          <div className="text-xs text-zinc-500">供应方内部使用 · 企业客户无权进入</div>
          <div className="flex items-center gap-3"><DemoNoteToggle /><span className="text-xs text-zinc-600">供应方管理员</span></div>
        </header>
        <main className="p-6">
          <DemoNote className="mb-4">这是独立于客户企业后台的供应方管理端。当前演示停用状态和操作记录，不定义停用后具体限制哪些企业功能。</DemoNote>
          <PageHeader title="企业部署实例" desc="绑定企业提交的实例设备码，查看授权状态，并由供应方执行续期、人工停用和恢复。" extra={<Button variant="primary" onClick={() => setBinding(true)}><Plus size={14} /> 绑定实例</Button>} />

          <div className="mb-4 grid grid-cols-4 gap-3">
            <Stat label="全部实例" value={s.providerInstances.length} sub="按企业部署实例统计" />
            <Stat label={PROVIDER_STATUS_LABEL.active} value={counts.active} sub="到期日尚未到达" />
            <Stat label={PROVIDER_STATUS_LABEL.expired} value={counts.expired} sub="到期不会自动停用" tone={counts.expired ? 'warn' : 'default'} />
            <Stat label={PROVIDER_STATUS_LABEL.stopped} value={counts.stopped} sub="需要供应方明确操作" />
          </div>

          <Card
            title="实例列表"
            padded={false}
            extra={
              <div className="flex items-center gap-2">
                <div className="relative"><Search size={13} className="absolute top-2 left-2.5 text-zinc-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索企业、设备码或实例标识" className="w-64 pl-8" /></div>
                <Select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className="w-36"><option value="all">全部状态</option><option value="active">{PROVIDER_STATUS_LABEL.active}</option><option value="expired">{PROVIDER_STATUS_LABEL.expired}</option><option value="stopped">{PROVIDER_STATUS_LABEL.stopped}</option></Select>
              </div>
            }
          >
            <Table
              rows={rows}
              rowKey={(instance) => instance.id}
              empty="没有符合条件的企业部署实例"
              columns={[
                { key: 'enterprise', title: '企业', render: (instance) => <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-50 text-brand-700"><Building2 size={15} /></span><div><div className="font-medium text-zinc-900">{instance.enterpriseName}</div><div className="font-mono text-[10px] text-zinc-400">{instance.enterpriseCode}</div></div></div> },
                { key: 'device', title: '绑定实例', render: (instance) => <KV items={[{ k: '设备码', v: <span className="font-mono text-[11px]">{instance.deviceCode}</span> }, { k: '实例标识', v: <span className="font-mono text-[10px] text-zinc-500">{instance.instanceId.slice(0, 13)}…</span> }]} /> },
                { key: 'version', title: '版本', render: (instance) => <span className="font-mono text-xs">{instance.version}</span> },
                { key: 'expiry', title: '本期到期日', render: (instance) => <div><div className="tabular-nums">{fmtDate(instance.expiresAt)}</div>{providerInstanceStatus(instance) === 'expired' && <div className="text-[10px] text-amber-700">{PROVIDER_STATUS_LABEL.expired}</div>}</div> },
                { key: 'status', title: '状态', render: (instance) => <div><StatusPill instance={instance} />{instance.stopReason && <div className="mt-1 max-w-36 truncate text-[10px] text-zinc-400" title={instance.stopReason}>{instance.stopReason}</div>}</div> },
                { key: 'ops', title: '操作', align: 'right', render: (instance) => <div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => setRenewing(instance)}>续期</Button>{instance.stoppedAt ? <Button size="sm" variant="secondary" onClick={() => void resume(instance)}>恢复</Button> : <Button size="sm" variant="danger" onClick={() => setStopping(instance)}>停用</Button>}</div> },
              ]}
            />
          </Card>

          <Card title="最近操作" padded={false} className="mt-4">
            <Table
              rows={s.providerLicenseActions.slice(0, 8)}
              rowKey={(item) => item.id}
              empty="还没有授权操作"
              dense
              columns={[
                { key: 'time', title: '时间', render: (item) => <span className="tabular-nums text-zinc-500">{fmtDateTime(item.at)}</span> },
                { key: 'action', title: '操作', render: (item) => <Pill tone={item.action === 'stop' ? 'red' : item.action === 'renew' ? 'blue' : 'green'}>{ACTION_LABEL[item.action]}</Pill> },
                { key: 'instance', title: '实例', render: (item) => <span className="font-mono text-[11px]">{item.instanceId.slice(0, 18)}…</span> },
                { key: 'detail', title: '结果', render: (item) => <span className="text-zinc-700">{item.detail}</span> },
                { key: 'operator', title: '操作者', render: (item) => <span className="inline-flex items-center gap-1 text-zinc-600"><ShieldCheck size={12} />{item.operatorName}</span> },
              ]}
            />
          </Card>
        </main>
      </div>

      <BindInstanceModal key={binding ? 'open' : 'closed'} open={binding} onClose={() => setBinding(false)} />
      <RenewInstanceModal key={`renew-${renewing?.id ?? 'none'}`} instance={renewing} onClose={() => setRenewing(null)} />
      <StopInstanceModal key={`stop-${stopping?.id ?? 'none'}`} instance={stopping} onClose={() => setStopping(null)} />
    </div>
  )
}
