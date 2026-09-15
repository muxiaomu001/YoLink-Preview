/**
 * 工作台外框：最左 56px 图标栏（头像 + 导航）→ 右侧 44px 顶栏（企业名、坐席身份切换、通知状态）+ 页面内容。
 * 演示控制（切登录员工、开手机屏 / 后台）收进右下角的 DemoBar，不进正式界面。
 * 未读汇总：标签页标题显示当前坐席未读总数；新未读到达时发桌面通知（不支持 / 未授权时退回 toast）。
 */
import { useEffect, useMemo, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Bell, BellOff, Bot, Link2, MessageSquare, Send, Settings, Users, Wallet } from 'lucide-react'
import { useStore } from '@/store/store'
import { conversationsForSeat, seatsOfStaff, staffById, staffHasCap } from '@/store/selectors'
import { toast } from '@/ui/overlay'
import { DemoBar } from './components/layout/DemoBar'
import { IconRail, type RailItem } from './components/layout/IconRail'
import { SeatSwitcher } from './components/layout/SeatSwitcher'
import { notifyPermission, sendDesktopNotification } from './components/layout/notify'

const TITLE_BASE = 'YoLink 工作台'

export function WorkbenchLayout() {
  const s = useStore()
  const nav = useNavigate()
  const staff = staffById(s, s.session.workbenchStaffId)
  const roleName = s.roles.find((r) => r.id === staff?.roleId)?.name ?? '-'
  const mySeats = seatsOfStaff(s, s.session.workbenchStaffId)
  const activeSeat = mySeats.find((x) => x.id === s.session.workbenchSeatId) ?? mySeats[0]
  const can = (cap: string) => staffHasCap(s, staff?.id ?? null, cap)
  const aiLicensed = s.license.modules.some((m) => m.key === 'ai' && m.enabled)

  // 当前坐席被交接走了，或没选：自动落到第一个持有的坐席
  useEffect(() => {
    if (activeSeat && activeSeat.id !== s.session.workbenchSeatId) s.setSession({ workbenchSeatId: activeSeat.id })
    if (!activeSeat && s.session.workbenchSeatId) s.setSession({ workbenchSeatId: null })
  }, [activeSeat, s])

  // 各坐席未读（只算 unread，不算 @ 提及）
  const unreadBySeat = useMemo(() => {
    const m: Record<string, number> = {}
    mySeats.forEach((seat) => {
      m[seat.id] = conversationsForSeat(s, seat.id).reduce((a, r) => a + r.unread, 0)
    })
    return m
  }, [s, mySeats])
  const activeRows = useMemo(() => (activeSeat ? conversationsForSeat(s, activeSeat.id) : []), [s, activeSeat])
  const unreadTotal = activeSeat ? (unreadBySeat[activeSeat.id] ?? 0) : 0

  // 导航按员工能力与模块显隐：没能力的入口不出现
  const navAll: (RailItem & { show: boolean })[] = [
    { to: '/workbench/chat', label: '会话', icon: MessageSquare, badge: unreadTotal, show: true },
    { to: '/workbench/customers', label: '客户', icon: Users, show: true },
    { to: '/workbench/broadcast', label: '群发', icon: Send, show: can('broadcast') && s.enterprise.modules.broadcast },
    { to: '/workbench/invites', label: '邀请链接', icon: Link2, show: can('create_invite') },
    { to: '/workbench/bots', label: '群活跃助手', icon: Bot, show: can('manage_bots') && aiLicensed },
    { to: '/workbench/withdrawals', label: '提现审核', icon: Wallet, show: s.enterprise.modules.wallet && can('review_withdrawal') },
    { to: '/workbench/settings', label: '设置', icon: Settings, show: true },
  ]
  const items: RailItem[] = navAll.filter((it) => it.show).map(({ to, label, icon, badge }) => ({ to, label, icon, badge }))

  // 未读汇总：浏览器标签页标题显示当前坐席未读总数
  useEffect(() => {
    document.title = unreadTotal > 0 ? `(${unreadTotal}) ${TITLE_BASE}` : TITLE_BASE
    return () => {
      document.title = TITLE_BASE
    }
  }, [unreadTotal])

  // 桌面通知：未读增加且员工偏好开启时，找出新增未读的会话，发原生通知（点击跳到该会话）；发不出去退回 toast
  const prevUnread = useRef<{ seatId: string | null; byConv: Record<string, number> }>({ seatId: null, byConv: {} })
  const notifyOn = staff?.prefs?.desktopNotify ?? true
  const seatId = activeSeat?.id ?? null
  const seatName = activeSeat?.displayName ?? ''
  useEffect(() => {
    const { seatId: prevSeat, byConv: prev } = prevUnread.current
    const next: Record<string, number> = Object.fromEntries(activeRows.map((r) => [r.conv.id, r.unread]))
    prevUnread.current = { seatId, byConv: next }
    // 切了坐席 / 首次挂载：只记基线，不提醒
    if (prevSeat !== seatId) return
    const prevTotal = Object.values(prev).reduce((a, b) => a + b, 0)
    const nextTotal = Object.values(next).reduce((a, b) => a + b, 0)
    if (nextTotal <= prevTotal || !notifyOn) return
    const grown = activeRows.filter((r) => r.unread > (prev[r.conv.id] ?? 0))
    const target = grown[0]
    const delta = nextTotal - prevTotal
    const body = grown.length === 1 && target ? `${target.title}：${target.last?.text ?? ''}`.slice(0, 80) : `${grown.length} 个会话共 ${delta} 条新消息`
    const go = () => nav(grown.length === 1 && target ? `/workbench/chat/${target.conv.id}` : '/workbench/chat')
    const sent = sendDesktopNotification(`「${seatName}」有 ${delta} 条新消息`, body, go)
    if (!sent) toast(`「${seatName}」有 ${delta} 条新消息：${body}`, 'info')
  }, [activeRows, notifyOn, seatId, seatName, nav])

  const perm = notifyPermission()
  const notifyTitle = !notifyOn ? '桌面通知已关闭（设置里开启）' : perm === 'granted' ? '桌面通知已开启' : perm === 'unsupported' ? '当前浏览器不支持桌面通知，改用页内提示' : '桌面通知未授权，改用页内提示（设置里重新开启可申请授权）'
  const NotifyIcon = notifyOn && perm === 'granted' ? Bell : BellOff

  return (
    <div className="flex h-full">
      <IconRail staff={staff} roleName={roleName} items={items} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 items-center gap-4 border-b border-zinc-200 bg-white px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-700 text-[12px] font-bold text-white">{s.enterprise.name.slice(0, 1)}</span>
            <span className="text-[13px] font-semibold text-zinc-900">{s.enterprise.name}</span>
            <span className="text-[11px] text-zinc-400">工作台</span>
          </div>
          <SeatSwitcher seats={mySeats} active={activeSeat} unreadBySeat={unreadBySeat} onPick={(id) => s.setSession({ workbenchSeatId: id })} />
          <div className="ml-auto flex items-center">
            <span className={notifyOn && perm === 'granted' ? 'text-brand-700' : 'text-zinc-400'} title={notifyTitle}>
              <NotifyIcon size={16} />
            </span>
          </div>
        </header>
        <main className="min-h-0 flex-1">
          <Outlet />
        </main>
      </div>
      <DemoBar />
    </div>
  )
}
