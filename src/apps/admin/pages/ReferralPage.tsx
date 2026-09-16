import { useMemo, useState } from 'react'
import type { Customer, ReferralAnomaly, ReferralRules } from '@/domain/types'
import { fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { customerById } from '@/store/selectors'
import { confirm } from '@/ui/confirm'
import { Button, Field, Input } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, Table, Tabs } from '@/ui/display'
import { toast } from '@/ui/overlay'

type TabKey = 'rules' | 'relations' | 'anomalies'

const ANOMALY_LABEL: Record<ReferralAnomaly['type'], string> = { same_device: '同设备多账号', burst_register: '短时间大量注册' }

function CustomerCell({ c }: { c?: Customer }) {
  if (!c) return <span className="text-zinc-400">未知客户</span>
  return (
    <span>
      <span className="font-medium text-zinc-900">{c.nickname}</span>
      <span className="ml-1 font-mono text-[11px] text-zinc-400">{c.accountId}</span>
    </span>
  )
}

/** 推荐奖励（P2）：奖励规则、推荐关系查询、异常检测 */
export function ReferralPage() {
  const s = useStore()
  const [tab, setTab] = useState<TabKey>('rules')
  const relations = s.customers.filter((c) => c.referrerId).length
  const openAnomalies = s.referralAnomalies.filter((a) => !a.cancelled).length
  return (
    <div>
      <PageHeader
        title="推荐奖励"
        level="P2"
        desc={`客户把邀请链接发给朋友，朋友注册后按规则给双方发${s.walletSettings.unitName}。奖励记一条「推荐奖励」钱包流水，异常账号可取消奖励。`}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: 'rules', label: '奖励规则' },
          { key: 'relations', label: '推荐关系查询', count: relations },
          { key: 'anomalies', label: '异常检测', count: openAnomalies },
        ]}
      />
      <div className="mt-4">
        {tab === 'rules' && <RulesTab />}
        {tab === 'relations' && <RelationsTab />}
        {tab === 'anomalies' && <AnomaliesTab />}
      </div>
    </div>
  )
}

function RulesTab() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const unit = s.walletSettings.unitName
  const [form, setForm] = useState<ReferralRules>(s.referralRules)
  const set = <K extends keyof ReferralRules>(k: K, v: ReferralRules[K]) => setForm((f) => ({ ...f, [k]: v }))
  const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0))
  const error = form.referrerReward <= 0 ? '推荐人奖励必须大于 0' : form.dailyMax <= 0 ? '每人每日上限至少 1 次' : form.totalMax < form.dailyMax ? '每人总上限不能小于每日上限' : ''
  const save = () => {
    if (error) return
    s.updateReferralRules(form, admin)
    toast('推荐奖励规则已保存，对之后的新注册生效')
  }
  return (
    <div className="grid grid-cols-[1fr_320px] gap-4">
      <Card title="奖励规则" extra={<Button size="sm" variant="primary" disabled={!!error} onClick={save}>保存</Button>}>
        <div className="space-y-3">
          <Field label="奖励时机" hint="首次签到后奖励能过滤掉大部分薅羊毛的空号">
            <div className="flex h-8 items-center gap-5 text-[13px] text-zinc-700">
              <label className="flex items-center gap-1.5">
                <input type="radio" className="accent-brand-700" checked={form.timing === 'register'} onChange={() => set('timing', 'register')} /> 注册即奖励
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" className="accent-brand-700" checked={form.timing === 'first_checkin'} onChange={() => set('timing', 'first_checkin')} /> 首次签到后奖励
              </label>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="推荐人奖励" required hint={unit}>
              <Input type="number" min={1} value={form.referrerReward} onChange={(e) => set('referrerReward', num(e.target.value))} />
            </Field>
            <Field label="新人奖励" hint={`${unit}；0 表示不奖励`}>
              <Input type="number" min={0} value={form.newcomerReward} onChange={(e) => set('newcomerReward', num(e.target.value))} />
            </Field>
            <Field label="每人每日上限" required hint="推荐奖励次数">
              <Input type="number" min={1} value={form.dailyMax} onChange={(e) => set('dailyMax', num(e.target.value))} />
            </Field>
            <Field label="每人总上限" required hint="推荐奖励总次数">
              <Input type="number" min={1} value={form.totalMax} onChange={(e) => set('totalMax', num(e.target.value))} />
            </Field>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </Card>
      <Note>
        当前规则：{form.timing === 'register' ? '被推荐人注册成功' : '被推荐人完成首次签到'}后，推荐人得 {form.referrerReward} {unit}
        {form.newcomerReward > 0 ? `，新人得 ${form.newcomerReward} ${unit}` : '，新人不奖励'}；每人每天最多 {form.dailyMax} 次、累计最多 {form.totalMax} 次。超出上限的推荐仍记录关系，只是不发奖。
      </Note>
    </div>
  )
}

function RelationsTab() {
  const s = useStore()
  const [query, setQuery] = useState('')
  const rows = useMemo(() => {
    const k = query.trim().toLowerCase()
    return s.customers
      .filter((c) => c.referrerId)
      .map((c) => ({ c, referrer: customerById(s, c.referrerId), rewarded: s.walletTxs.some((t) => t.customerId === c.id && t.type === 'referral_reward') }))
      .filter((r) => !k || (r.referrer && (r.referrer.nickname.toLowerCase().includes(k) || r.referrer.accountId.toLowerCase().includes(k))))
      .sort((a, b) => b.c.registeredAt.localeCompare(a.c.registeredAt))
  }, [s, query])
  return (
    <Card title={`推荐关系（${rows.length} 条）`} padded={false} extra={<Input className="w-56" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="按推荐人昵称 / 账号 ID 搜索" />}>
      <Table
        rows={rows}
        rowKey={(r) => r.c.id}
        columns={[
          { key: 'referrer', title: '推荐人', render: (r) => <CustomerCell c={r.referrer} /> },
          { key: 'referee', title: '被推荐人', render: (r) => <CustomerCell c={r.c} /> },
          { key: 'at', title: '注册时间', render: (r) => <span className="tabular-nums text-zinc-600">{fmtDateTime(r.c.registeredAt)}</span> },
          { key: 'status', title: '奖励状态', render: (r) => (r.rewarded ? <Pill tone="green">已发放</Pill> : <Pill tone="amber">未发放</Pill>) },
        ]}
      />
    </Card>
  )
}

function AnomaliesTab() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const cancel = async (a: ReferralAnomaly) => {
    const c = customerById(s, a.customerId)
    const ok = await confirm({ title: `取消「${c?.nickname}」的推荐奖励`, body: `异常类型：${ANOMALY_LABEL[a.type]}，涉及 ${a.relatedIds.length} 个相关账号。取消后该客户的推荐奖励不再发放，已发放的不追回，记审计。`, okText: '取消奖励', danger: true })
    if (!ok) return
    s.cancelReferralReward(a.id, admin)
    toast(`已取消「${c?.nickname}」的推荐奖励`)
  }
  return (
    <div className="space-y-4">
      <Note tone="amber">系统按设备指纹与注册时间窗自动检测。「同设备多账号」：同一设备指纹登录多个客户账号；「短时间大量注册」：同一推荐人 10 分钟内带来 3 个以上注册。</Note>
      <Card title="异常账号" padded={false}>
        <Table
          rows={s.referralAnomalies}
          rowKey={(a) => a.id}
          columns={[
            { key: 'user', title: '用户', render: (a) => <CustomerCell c={customerById(s, a.customerId)} /> },
            { key: 'type', title: '异常类型', render: (a) => <Pill tone={a.type === 'same_device' ? 'red' : 'amber'}>{ANOMALY_LABEL[a.type]}</Pill> },
            {
              key: 'related',
              title: '相关账号',
              render: (a) => (
                <div className="flex flex-wrap gap-1">
                  {a.relatedIds.map((id) => {
                    const c = customerById(s, id)
                    return (
                      <span key={id} className="rounded border border-zinc-200 px-1.5 text-[11px] leading-5 text-zinc-700">
                        {c ? `${c.nickname}（${c.accountId}）` : id}
                      </span>
                    )
                  })}
                </div>
              ),
            },
            {
              key: 'ops',
              title: '操作',
              align: 'right',
              render: (a) =>
                a.cancelled ? (
                  <Pill>奖励已取消</Pill>
                ) : (
                  <Button size="sm" variant="danger" onClick={() => void cancel(a)}>
                    取消奖励
                  </Button>
                ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
