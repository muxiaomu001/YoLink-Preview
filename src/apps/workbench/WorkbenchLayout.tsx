import { clsx } from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { ChevronDown, ExternalLink, Link2, MessageSquare, Send, Settings, Users } from 'lucide-react'
import { useStore } from '@/store/store'
import { conversationsForSeat, seatsOfStaff, staffById } from '@/store/selectors'
import { Avatar, SeatAvatar } from '@/ui/display'
import { toast } from '@/ui/overlay'

const NAV = [
  { to: '/workbench/chat', label: '会话', icon: MessageSquare },
  { to: '/workbench/customers', label: '客户', icon: Users },
  { to: '/workbench/invites', label: '邀请链接', icon: Link2 },
  { to: '/workbench/broadcast', label: '群发', icon: Send },
  { to: '/workbench/settings', label: '设置', icon: Settings },
]

export function WorkbenchLayout() {
  const s = useStore()
  const staff = staffById(s, s.session.workbenchStaffId)
  const mySeats = seatsOfStaff(s, s.session.workbenchStaffId)
  const activeSeat = mySeats.find((x) => x.id === s.session.workbenchSeatId) ?? mySeats[0]
  const [open, setOpen] = useState(false)
  const [staffOpen, setStaffOpen] = useState(false)

  // 当前坐席被交接走了，或没选：自动落到第一个持有的坐席
  useEffect(() => {
    if (activeSeat && activeSeat.id !== s.session.workbenchSeatId) s.setSession({ workbenchSeatId: activeSeat.id })
    if (!activeSeat && s.session.workbenchSeatId) s.setSession({ workbenchSeatId: null })
  }, [activeSeat, s])

  const unreadBySeat = useMemo(() => {
    const m: Record<string, number> = {}
    mySeats.forEach((seat) => {
      m[seat.id] = conversationsForSeat(s, seat.id).reduce((a, r) => a + r.unread + (r.mentioned ? 1 : 0), 0)
    })
    return m
  }, [s, mySeats])

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-zinc-200 bg-white px-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-700 text-xs font-bold text-white">恒</span>
          <span className="text-[13px] font-semibold text-zinc-900">{s.enterprise.name}</span>
          <span className="text-[10px] text-zinc-400">工作台</span>
        </div>

        {/* 当前坐席身份 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => mySeats.length > 1 && setOpen((v) => !v)}
            className={clsx('flex items-center gap-2 rounded-md border px-2 py-1', mySeats.length > 1 ? 'cursor-pointer border-brand-200 bg-brand-50/60 hover:bg-brand-50' : 'cursor-default border-zinc-200 bg-zinc-50')}
            title={mySeats.length > 1 ? '切换坐席身份' : '只有一个坐席身份'}
          >
            {activeSeat ? (
              <>
                <SeatAvatar seat={activeSeat} size={22} />
                <span className="text-[13px] font-medium text-zinc-900">{activeSeat.displayName}</span>
                <span className="text-[11px] text-zinc-500">当前身份</span>
              </>
            ) : (
              <span className="text-xs text-amber-700">未持有任何坐席，等待管理员交接</span>
            )}
            {mySeats.length > 1 && <ChevronDown size={14} className="text-zinc-400" />}
          </button>
          {open && (
            <div className="absolute top-full left-0 z-30 mt-1 w-64 rounded-md border border-zinc-200 bg-white py-1 shadow-lg" onMouseLeave={() => setOpen(false)}>
              {mySeats.map((seat) => (
                <button
                  key={seat.id}
                  type="button"
                  className={clsx('flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50', seat.id === activeSeat?.id && 'bg-brand-50/60')}
                  onClick={() => {
                    s.setSession({ workbenchSeatId: seat.id })
                    setOpen(false)
                  }}
                >
                  <SeatAvatar seat={seat} size={26} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] text-zinc-900">{seat.displayName}</span>
                    <span className="block truncate text-[11px] text-zinc-500">{seat.roleDesc}</span>
                  </span>
                  {unreadBySeat[seat.id] > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[10px] leading-4 text-white">{unreadBySeat[seat.id]}</span>}
                </button>
              ))}
              <div className="border-t border-zinc-100 px-3 py-1.5 text-[10px] text-zinc-400">切换后会话、客户、群发身份全部跟着切</div>
            </div>
          )}
        </div>

        <nav className="ml-2 flex items-center gap-1">
          {NAV.map((it) => (
            <NavLink key={it.to} to={it.to} className={({ isActive }) => clsx('flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px]', isActive ? 'bg-zinc-100 font-medium text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50')}>
              <it.icon size={14} /> {it.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Link to="/phone" target="_blank" className="flex items-center gap-1 text-xs text-brand-700 hover:underline">
            <ExternalLink size={11} /> 客户手机屏
          </Link>
          <Link to="/admin" target="_blank" className="flex items-center gap-1 text-xs text-brand-700 hover:underline">
            <ExternalLink size={11} /> 管理后台
          </Link>
          {/* 演示控制：切换登录员工 */}
          <div className="relative">
            <button type="button" onClick={() => setStaffOpen((v) => !v)} className="flex items-center gap-2 rounded-md border border-dashed border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50" title="演示控制：切换登录员工">
              <Avatar text={staff?.name ?? '?'} size={20} color="#52525b" />
              登录员工：<b className="text-zinc-900">{staff?.name}</b>
              <ChevronDown size={12} />
            </button>
            {staffOpen && (
              <div className="absolute top-full right-0 z-30 mt-1 w-56 rounded-md border border-zinc-200 bg-white py-1 shadow-lg" onMouseLeave={() => setStaffOpen(false)}>
                <div className="px-3 py-1 text-[10px] text-zinc-400">演示用：模拟以谁的账号登录</div>
                {s.staff
                  .filter((x) => x.status === 'active' && x.roleId !== 'role_admin')
                  .map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      className={clsx('flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] hover:bg-zinc-50', st.id === staff?.id && 'bg-zinc-50 font-medium')}
                      onClick={() => {
                        const seats = seatsOfStaff(s, st.id)
                        s.setSession({ workbenchStaffId: st.id, workbenchSeatId: seats[0]?.id ?? null })
                        s.logAudit('login', '登录工作台', st.id)
                        setStaffOpen(false)
                        toast(seats.length ? `已以 ${st.name} 登录，当前身份「${seats[0].displayName}」` : `已以 ${st.name} 登录，他还没有坐席`, 'info')
                      }}
                    >
                      <span>{st.name}</span>
                      <span className="text-[11px] text-zinc-400">{seatsOfStaff(s, st.id).map((x) => x.displayName).join('、') || '无坐席'}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
