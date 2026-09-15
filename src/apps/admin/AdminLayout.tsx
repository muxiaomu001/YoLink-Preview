import { clsx } from 'clsx'
import { NavLink, Outlet, Link } from 'react-router-dom'
import { BadgeCheck, Building2, ClipboardList, ExternalLink, FileSearch, Gauge, KeyRound, Link2, MessageSquareText, ShieldCheck, Tags, UserCog, Users, UsersRound } from 'lucide-react'
import { useStore } from '@/store/store'
import { staffById } from '@/store/selectors'
import { Avatar } from '@/ui/display'

const NAV = [
  { group: '经营', items: [{ to: '/admin/home', label: '经营首页', icon: Gauge }] },
  {
    group: '坐席、员工与角色',
    items: [
      { to: '/admin/seats', label: '坐席', icon: BadgeCheck },
      { to: '/admin/staff', label: '员工账号', icon: UserCog },
      { to: '/admin/roles', label: '员工角色', icon: ShieldCheck },
    ],
  },
  {
    group: '邀请与分配',
    items: [
      { to: '/admin/invite-groups', label: '邀请组', icon: UsersRound },
      { to: '/admin/invite-links', label: '邀请链接总览', icon: Link2 },
    ],
  },
  {
    group: '内部标签与头衔',
    items: [
      { to: '/admin/titles', label: '头衔库', icon: Tags },
      { to: '/admin/tags', label: '内部标签库', icon: Tags },
    ],
  },
  {
    group: '策略与群',
    items: [
      { to: '/admin/policies', label: '策略预设与能力', icon: KeyRound },
      { to: '/admin/groups', label: '群与频道', icon: Users },
    ],
  },
  {
    group: '内容与审计',
    items: [
      { to: '/admin/message-audit', label: '消息审计', icon: MessageSquareText },
      { to: '/admin/audit-log', label: '审计日志', icon: ClipboardList },
    ],
  },
  { group: '企业', items: [{ to: '/admin/settings', label: '企业设置', icon: Building2 }] },
]

export function AdminLayout() {
  const enterprise = useStore((s) => s.enterprise)
  const admin = useStore((s) => staffById(s, s.session.adminStaffId))
  return (
    <div className="flex h-full">
      <aside className="flex w-52 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-700 text-xs font-bold text-white">恒</span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-zinc-900">{enterprise.name}</div>
            <div className="text-[10px] text-zinc-400">管理后台</div>
          </div>
        </div>
        <nav className="thin-scroll flex-1 overflow-y-auto px-2 py-2">
          {NAV.map((g) => (
            <div key={g.group} className="mb-2">
              <div className="px-2 pt-2 pb-1 text-[10px] font-medium tracking-wide text-zinc-400">{g.group}</div>
              {g.items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  className={({ isActive }) => clsx('flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px]', isActive ? 'bg-brand-50 font-medium text-brand-800' : 'text-zinc-600 hover:bg-zinc-100')}
                >
                  <it.icon size={14} className="shrink-0" />
                  {it.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-zinc-100 px-3 py-2">
          <div className="mb-1 text-[10px] text-zinc-400">其他入口</div>
          <div className="flex flex-col gap-1">
            <Link to="/workbench" target="_blank" className="flex items-center gap-1 text-xs text-brand-700 hover:underline">
              <ExternalLink size={11} /> 客服工作台
            </Link>
            <Link to="/phone" target="_blank" className="flex items-center gap-1 text-xs text-brand-700 hover:underline">
              <ExternalLink size={11} /> 客户手机屏
            </Link>
            <Link to="/" className="flex items-center gap-1 text-xs text-zinc-500 hover:underline">
              <FileSearch size={11} /> 演示首页
            </Link>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-5">
          <div className="text-xs text-zinc-500">
            企业码 <span className="font-mono text-zinc-700">{enterprise.code}</span> · 时区 {enterprise.timezone}
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <Avatar text={admin?.name ?? '管'} size={22} color="#52525b" />
            {admin?.name} · 管理员
          </div>
        </header>
        <main className="thin-scroll flex-1 overflow-y-auto p-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
