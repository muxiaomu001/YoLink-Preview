import { useMemo, useState } from 'react'
import type { CheckinRules } from '@/domain/types'
import { fmtDate, fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { customerById } from '@/store/selectors'
import { Button, Field, Input } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, Stat, Table } from '@/ui/display'
import { toast } from '@/ui/overlay'

const DAY_LABELS = ['第 1 天', '第 2 天', '第 3 天', '第 4 天', '第 5 天', '第 6 天', '第 7 天']

/** 把 date 输入框的值转成 ISO；结束日取当天末尾 */
function dateToIso(d: string, end = false): string {
  return new Date(`${d}T${end ? '23:59:59' : '00:00:00'}`).toISOString()
}

/** 签到（P2）：规则卡 + 统计四卡 + 最近签到记录 */
export function CheckinPage() {
  const s = useStore()
  const unit = s.walletSettings.unitName
  const stats = useMemo(() => {
    const today = new Date().toDateString()
    const todayCount = new Set(s.checkinRecords.filter((r) => new Date(r.at).toDateString() === today).map((r) => r.customerId)).size
    const totalPeople = new Set(s.checkinRecords.map((r) => r.customerId)).size
    const issued = s.checkinRecords.reduce((sum, r) => sum + r.reward, 0)
    return { todayCount, totalPeople, issued, remaining: s.checkinRules.budget - issued }
  }, [s.checkinRecords, s.checkinRules.budget])
  const recent = useMemo(() => [...s.checkinRecords].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30), [s.checkinRecords])

  return (
    <div>
      <PageHeader
        title="签到"
        desc={
          <>
            <Pill tone="amber" className="mr-1.5">
              P2，模块启用时显示
            </Pill>
            客户每天在 App 里签到领{unit}，7 天一个周期循环；断签从第 1 天重来。奖励直接进钱包流水（checkin_reward）。
          </>
        }
      />
      <div className="grid grid-cols-4 gap-3">
        <Stat label="今日签到人数" value={stats.todayCount} sub="去重客户数" />
        <Stat label="累计签到人数" value={stats.totalPeople} sub="活动期内至少签到一次" />
        <Stat label={`累计发放${unit}`} value={stats.issued.toLocaleString('zh-CN')} sub={`${s.checkinRecords.length} 次签到`} />
        <Stat label="剩余预算" value={stats.remaining.toLocaleString('zh-CN')} sub={`总预算 ${s.checkinRules.budget.toLocaleString('zh-CN')}，用完自动停止发放`} tone={stats.remaining < s.checkinRules.budget * 0.1 ? 'warn' : 'default'} />
      </div>
      <div className="mt-4 grid grid-cols-[380px_1fr] gap-4">
        <RulesCard />
        <Card title="最近签到记录" padded={false}>
          <Table
            rows={recent}
            rowKey={(r) => r.id}
            dense
            columns={[
              { key: 'at', title: '时间', render: (r) => <span className="tabular-nums text-zinc-600">{fmtDateTime(r.at)}</span> },
              {
                key: 'customer',
                title: '客户',
                render: (r) => {
                  const c = customerById(s, r.customerId)
                  return c ? (
                    <span>
                      <span className="font-medium text-zinc-900">{c.nickname}</span>
                      <span className="ml-1 font-mono text-[11px] text-zinc-400">{c.accountId}</span>
                    </span>
                  ) : (
                    '-'
                  )
                },
              },
              { key: 'day', title: '第几天', align: 'center', render: (r) => <Pill tone={r.day === 7 ? 'purple' : 'blue'}>第 {r.day} 天</Pill> },
              { key: 'reward', title: '奖励', align: 'right', render: (r) => <span className="tabular-nums font-medium text-emerald-700">+{r.reward}</span> },
            ]}
          />
        </Card>
      </div>
    </div>
  )
}

function RulesCard() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const unit = s.walletSettings.unitName
  const rules = s.checkinRules
  const [cycle, setCycle] = useState<number[]>(rules.cycle)
  const [start, setStart] = useState(fmtDate(rules.startAt))
  const [end, setEnd] = useState(fmtDate(rules.endAt))
  const [budget, setBudget] = useState(rules.budget)
  const [perMax, setPerMax] = useState(rules.perCustomerMax)
  const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0))
  const setDay = (i: number, v: string) => setCycle((c) => c.map((x, j) => (j === i ? num(v) : x)))

  const error = cycle.some((x) => x <= 0) ? '每天奖励必须大于 0' : !start || !end ? '请填写活动起止日期' : start > end ? '结束日期不能早于开始日期' : budget <= 0 ? '总预算必须大于 0' : ''
  const save = () => {
    if (error) return
    const patch: Partial<CheckinRules> = { cycle, startAt: dateToIso(start), endAt: dateToIso(end, true), budget, perCustomerMax: perMax }
    s.updateCheckinRules(patch, admin)
    toast('签到规则已保存，客户端下次签到按新周期表发放')
  }
  const cycleTotal = cycle.reduce((a, b) => a + b, 0)

  return (
    <Card title="签到规则" extra={<Button size="sm" variant="primary" disabled={!!error} onClick={save}>保存</Button>}>
      <div className="space-y-3">
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xs font-medium text-zinc-600">周期表（7 天）</span>
            <span className="text-[11px] text-zinc-400">一轮合计 {cycleTotal} {unit}</span>
          </div>
          <div className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
            {cycle.map((v, i) => (
              <div key={DAY_LABELS[i]} className="flex items-center gap-3 px-3 py-1.5">
                <span className="w-16 text-xs text-zinc-600">{DAY_LABELS[i]}</span>
                <Input type="number" min={1} className="h-7 flex-1" value={v} onChange={(e) => setDay(i, e.target.value)} />
                <span className="w-8 text-[11px] text-zinc-400">{unit}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="活动开始" required>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="活动结束" required>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
          <Field label="总预算" required hint={`${unit}总额`}>
            <Input type="number" min={1} value={budget} onChange={(e) => setBudget(num(e.target.value))} />
          </Field>
          <Field label="单客户上限" hint="0 表示不限">
            <Input type="number" min={0} value={perMax} onChange={(e) => setPerMax(num(e.target.value))} />
          </Field>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <Note>预算用完或超出活动期，客户端签到按钮置灰并提示「活动已结束」。单客户上限按客户累计领取的签到奖励计算。</Note>
      </div>
    </Card>
  )
}
