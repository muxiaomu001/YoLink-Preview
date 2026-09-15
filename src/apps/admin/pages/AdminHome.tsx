import { fmtAgo } from '@/domain/time'
import { useStore } from '@/store/store'
import { dashboardNumbers, seatById, staffById } from '@/store/selectors'
import { Card, Note, PageHeader, Stat } from '@/ui/display'

export function AdminHome() {
  const s = useStore()
  const n = dashboardNumbers(s)
  const perStaff = s.staff
    .filter((st) => st.status === 'active' && st.roleId !== 'role_admin')
    .map((st) => {
      const today = new Date().toDateString()
      const msgs = s.messages.filter((m) => m.operatorId === st.id && m.senderKind === 'seat' && !m.isWelcome && new Date(m.at).toDateString() === today)
      const customers = new Set(msgs.map((m) => s.conversations.find((c) => c.id === m.convId)?.customerId).filter(Boolean)).size
      const ai = s.aiEvents.filter((e) => e.staffId === st.id && new Date(e.at).toDateString() === today)
      return { st, customers, ai: ai.filter((e) => e.result !== 'ignored').length, seats: s.seats.filter((x) => x.operatorStaffId === st.id).map((x) => x.displayName) }
    })
  const recent = s.audit.slice(0, 8)

  return (
    <div>
      <PageHeader title="经营首页" desc="老板看的六个数，只读。按人统计的指标按实操员工（真人）算，按归属统计的按主归属坐席算。" />
      <div className="grid grid-cols-3 gap-3">
        <Stat label="客户总数 · 本周新增" value={n.customersTotal} sub={`本周 +${n.newThisWeek}`} />
        <Stat label="7 日活跃客户" value={n.active7} sub={`占 ${n.active7Pct}%`} />
        <Stat label="最近一次群发" value={n.lastBc ? `${n.lastBc.readCount}/${n.lastBc.sentCount}` : '-'} sub={n.lastBc ? `${n.lastBc.name} · 已读/送达 · ${fmtAgo(n.lastBc.sentAt)}` : '尚未群发'} />
        <Stat label="客服接待（今日）" value={n.repliedCustomers} sub={`有回复的客户数 · 在线员工 ${n.onlineStaff} 人 · 人均 ${n.perStaff}`} />
        <Stat label="首次响应中位数（今日）" value={`${n.medianMin} 分钟`} tone={n.medianMin > 10 ? 'warn' : 'default'} sub={n.medianMin > 10 ? '超过 10 分钟，日报会提醒' : '客户消息到坐席第一条人工回复'} />
        <Stat label="AI 今日" value={`${n.aiAdopted}/${n.aiDrafts}`} sub={`采纳/起草 · 采纳率 ${n.aiPct}%`} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Card title="客服（每个实操员工一行，不按坐席）" padded={false}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-[11px] text-zinc-500">
                <th className="px-3 py-2 text-left font-medium">员工</th>
                <th className="px-3 py-2 text-left font-medium">实操的坐席</th>
                <th className="px-3 py-2 text-right font-medium">今日接待</th>
                <th className="px-3 py-2 text-right font-medium">AI 采纳</th>
              </tr>
            </thead>
            <tbody>
              {perStaff.map((r) => (
                <tr key={r.st.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-3 py-2 font-medium">{r.st.name}</td>
                  <td className="px-3 py-2 text-zinc-500">{r.seats.join('、') || '无'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.customers}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.ai}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="正在发生" padded={false}>
          <ul className="divide-y divide-zinc-100">
            {recent.map((e) => (
              <li key={e.id} className="flex gap-3 px-4 py-2 text-xs">
                <span className="w-16 shrink-0 tabular-nums text-zinc-400">{fmtAgo(e.at)}</span>
                <span className="min-w-0 text-zinc-700">
                  <span className="mr-1 text-zinc-500">{e.actorStaffId ? staffById(s, e.actorStaffId)?.name : '系统'}</span>
                  {e.detail}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4">
        <Note>
          老板日报每天早上推送这六个数到手机。产品内只给事实与对比，不换算成金额，不写建议。当前主归属分布：
          {s.seats
            .filter((x) => x.type === 'assign')
            .map((x) => `${x.displayName} ${s.customerSeats.filter((cs) => cs.seatId === x.id && cs.primary).length} 位`)
            .join('，')}
          。通知型「{seatById(s, 'seat_notice')?.displayName}」面对全部客户，不算归属。
        </Note>
      </div>
    </div>
  )
}
