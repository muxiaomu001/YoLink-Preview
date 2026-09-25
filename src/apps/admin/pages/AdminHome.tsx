import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fmtAgo } from '@/domain/time'
import { useStore } from '@/store/store'
import { dashboardNumbers, holdsPrimary, staffById } from '@/store/selectors'
import { Card, Note, PageHeader, Stat } from '@/ui/display'

/** 需要管理员动手的事，从各模块汇总到首页 */
function useTodos() {
  const s = useStore()
  const [now] = useState(Date.now)
  const licenseDays = Math.ceil((new Date(s.license.expiresAt).getTime() - now) / 86400000)
  const items = [
    { n: s.reports.filter((r) => r.status === 'pending').length, label: '待处理举报', to: '/admin/reports' },
    { n: s.withdrawals.filter((w) => w.status === 'pending' || w.status === 'approved').length, label: '待审核 / 待打款提现', to: '/admin/wallet' },
    { n: s.seats.filter((x) => x.status !== 'disabled' && !x.operatorStaffId).length, label: '无人实操的坐席', to: '/admin/seats' },
    { n: s.seats.filter((x) => x.status === 'paused').length, label: '暂停接新的坐席', to: '/admin/seats' },
    { n: s.webhookLogs.filter((l) => l.httpStatus >= 400 && now - new Date(l.at).getTime() < 86400000).length, label: '24 小时内 Webhook 失败', to: '/admin/webhooks' },
    { n: licenseDays <= 30 ? 1 : 0, label: `许可 ${licenseDays} 天后到期`, to: '/admin/license' },
    { n: s.broadcasts.filter((b) => b.status === 'scheduled').length, label: '待发送的定时群发', to: '/admin/broadcasts' },
  ]
  return items.filter((it) => it.n > 0)
}

export function AdminHome() {
  const s = useStore()
  const n = dashboardNumbers(s)
  const todos = useTodos()
  const perStaff = s.staff
    .filter((st) => st.status === 'active' && st.roleId !== 'role_admin')
    .map((st) => {
      const today = new Date().toDateString()
      const msgs = s.messages.filter((m) => m.operatorId === st.id && m.senderKind === 'seat' && !m.isWelcome && new Date(m.at).toDateString() === today)
      const customers = new Set(msgs.map((m) => s.conversations.find((c) => c.id === m.convId)?.customerId).filter(Boolean)).size
      return { st, customers, seats: s.seats.filter((x) => x.operatorStaffId === st.id).map((x) => x.displayName) }
    })
  const recent = s.audit.slice(0, 8)

  return (
    <div>
      <PageHeader title="经营首页" desc="今日经营概览，与每日推送的经营日报口径一致。" />
      {todos.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span className="font-medium">待处理</span>
          {todos.map((t) => (
            <Link key={t.label} to={t.to} className="rounded bg-white px-2 py-0.5 text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100">
              {t.label} <b className="tabular-nums">{t.n}</b>
            </Link>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        <Stat label="客户总数 · 本周新增" value={n.customersTotal} sub={`本周 +${n.newThisWeek}`} />
        <Stat label="7 日活跃客户" value={n.active7} sub={`占 ${n.active7Pct}%`} />
        <Stat label="最近一次群发" value={n.lastBc ? `${n.lastBc.readCount}/${n.lastBc.sentCount}` : '-'} sub={n.lastBc ? `${n.lastBc.name} · 已读/送达 · ${fmtAgo(n.lastBc.sentAt)}` : '尚未群发'} />
        <Stat label="客服接待（今日）" value={n.repliedCustomers} sub={`有回复的客户数 · 在线员工 ${n.onlineStaff} 人 · 人均 ${n.perStaff}`} />
        <Stat label="首次响应中位数（今日）" value={`${n.medianMin} 分钟`} tone={n.medianMin > 10 ? 'warn' : 'default'} sub={n.medianMin > 10 ? '超过 10 分钟，日报会提醒' : '客户消息到坐席第一条人工回复'} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Card title="客服接待 · 今日" padded={false}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-[11px] text-zinc-500">
                <th className="px-3 py-2 text-left font-medium">员工</th>
                <th className="px-3 py-2 text-left font-medium">实操的坐席</th>
                <th className="px-3 py-2 text-right font-medium">今日接待</th>
              </tr>
            </thead>
            <tbody>
              {perStaff.map((r) => (
                <tr key={r.st.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-3 py-2 font-medium">{r.st.name}</td>
                  <td className="px-3 py-2 text-zinc-500">{r.seats.join('、') || '无'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.customers}</td>
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
          经营日报每天早上把这几项数据推送到管理员手机。当前客户主归属分布：
          {s.seats
            .filter((x) => holdsPrimary(s, x.id))
            .map((x) => `${x.displayName} ${s.customerSeats.filter((cs) => cs.seatId === x.id && cs.primary).length} 位`)
            .join('，')}
          。只做固定坐席的号人人都加，但不占归属。
        </Note>
      </div>
    </div>
  )
}
