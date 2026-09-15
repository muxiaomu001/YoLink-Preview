import { useMemo } from 'react'
import type { DailyStat } from '@/domain/types'
import { useStore } from '@/store/store'
import { customersOfSeat } from '@/store/selectors'
import { Card, Empty, Note, PageHeader, Stat } from '@/ui/display'
import { BarChart, LineChart, type Point } from '@/ui/charts'

type Metric = 'registrations' | 'dau' | 'messages' | 'senders' | 'pushes'

/** 折线图数据：横轴标签用 MM-DD */
function trendOf(stats: DailyStat[], key: Metric): Point[] {
  return stats.map((d) => ({ label: d.date.slice(5), value: d[key] }))
}

/** 日环比：与前一天比的百分比，前一天为 0 时返回 null */
function dayOverDay(today: number, yesterday: number): number | null {
  if (!yesterday) return null
  return Math.round(((today - yesterday) / yesterday) * 1000) / 10
}

function DeltaText({ value }: { value: number | null }) {
  if (value === null) return <span>日环比 -</span>
  const cls = value > 0 ? 'text-emerald-600' : value < 0 ? 'text-red-600' : 'text-zinc-500'
  return (
    <span className={cls}>
      日环比 {value > 0 ? '+' : ''}
      {value}%
    </span>
  )
}

export function StatsPage() {
  const s = useStore()
  const stats = s.dailyStats
  const last: DailyStat | undefined = stats[stats.length - 1]
  const prev: DailyStat | undefined = stats[stats.length - 2]

  const regTrend = useMemo(() => trendOf(stats, 'registrations'), [stats])
  const dauTrend = useMemo(() => trendOf(stats, 'dau'), [stats])
  const msgTrend = useMemo(() => trendOf(stats, 'messages'), [stats])

  // 各坐席客户数：按主归属统计，只算分配型坐席
  const seatData = useMemo<Point[]>(
    () =>
      s.seats
        .filter((x) => x.type === 'assign')
        .map((x) => ({ label: x.displayName, value: customersOfSeat(s, x.id).length }))
        .sort((a, b) => b.value - a.value),
    [s],
  )

  if (!last) {
    return (
      <div>
        <PageHeader title="基础统计（P1）" desc="累计注册、昨日新增、DAU、消息量等每日汇总。" />
        <Empty text="还没有统计数据" />
      </div>
    )
  }

  const msgDelta = dayOverDay(last.messages, prev?.messages ?? 0)

  return (
    <div>
      <PageHeader title="基础统计（P1）" desc={`每日汇总，最近一天为 ${last.date}。累计注册按客户表实时计算，其余指标来自每日跑批。`} />
      <Note>
        数据<b>每日 10:00 更新</b>（参考腾讯云 IM）；DAU 按 24 小时内有消息的客户算。高级统计（漏斗、留存、RFM）v1 不做，需要时从导出的数据在外部 BI 里分析。
      </Note>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="累计注册" value={s.customers.length} sub="含已注销客户" />
        <Stat label="昨日新增" value={last.registrations} sub={<DeltaText value={dayOverDay(last.registrations, prev?.registrations ?? 0)} />} />
        <Stat label="DAU" value={last.dau} sub={<DeltaText value={dayOverDay(last.dau, prev?.dau ?? 0)} />} />
        <Stat label="消息量" value={last.messages} sub={<DeltaText value={msgDelta} />} tone={msgDelta !== null && msgDelta < -20 ? 'warn' : 'default'} />
        <Stat label="发消息用户数" value={last.senders} sub={<DeltaText value={dayOverDay(last.senders, prev?.senders ?? 0)} />} />
        <Stat label="离线推送量" value={last.pushes} sub={<DeltaText value={dayOverDay(last.pushes, prev?.pushes ?? 0)} />} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card title="注册趋势（最近 30 天）">
          <LineChart data={regTrend} unit=" 人" />
        </Card>
        <Card title="活跃趋势 · DAU（最近 30 天）">
          <LineChart data={dauTrend} color="#0f766e" unit=" 人" />
        </Card>
        <Card title="消息量趋势（最近 30 天）">
          <LineChart data={msgTrend} color="#b45309" unit=" 条" />
        </Card>
        <Card title="各坐席客户数（按主归属，只算分配型坐席）">
          {seatData.length ? <BarChart data={seatData} unit=" 人" /> : <Empty text="没有分配型坐席" />}
        </Card>
      </div>
    </div>
  )
}
