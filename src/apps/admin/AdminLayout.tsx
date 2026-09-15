import { clsx } from 'clsx'
import { NavLink, Outlet, Link } from 'react-router-dom'
import { ExternalLink, FileSearch } from 'lucide-react'
import { useStore } from '@/store/store'
import { staffById } from '@/store/selectors'
import { Avatar } from '@/ui/display'
import { ADMIN_NAV } from './nav'

export function AdminLayout() {
  const enterprise = useStore((s) => s.enterprise)
  const admin = useStore((s) => staffById(s, s.session.adminStaffId))
  const pending = useStore((s) => s.reports.filter((r) => r.status === 'pending').length + s.withdrawals.filter((w) => w.status === 'pending').length)
  return (
    <div className="flex h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white" style={{ background: enterprise.brandColor }}>
            {enterprise.logoText}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-zinc-900">{enterprise.name}</div>
            <div className="text-[10px] text-zinc-400">管理后台 · 完整版</div>
          </div>
        </div>
        <nav className="thin-scroll flex-1 overflow-y-auto px-2 py-2">
          {ADMIN_NAV.map((g) => {
            const items = g.items.filter((it) => !it.module || enterprise.modules[it.module])
            if (!items.length) return null
            return (
              <div key={g.group} className="mb-2">
                <div className="px-2 pt-2 pb-1 text-[10px] font-medium tracking-wide text-zinc-400">{g.group}</div>
                {items.map((it) => (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    className={({ isActive }) => clsx('flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px]', isActive ? 'bg-brand-50 font-medium text-brand-800' : 'text-zinc-600 hover:bg-zinc-100')}
                  >
                    <it.icon size={14} className="shrink-0" />
                    <span className="flex-1 truncate">{it.label}</span>
                    {it.level && <span className={clsx('rounded px-1 text-[9px] leading-4', it.level === 'P1' ? 'bg-zinc-100 text-zinc-500' : 'bg-amber-50 text-amber-700')}>{it.level}</span>}
                    {it.to === '/admin/reports' && pending > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[10px] leading-4 text-white">{pending}</span>}
                  </NavLink>
                ))}
              </div>
            )
          })}
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
            企业码 <span className="font-mono text-zinc-700">{enterprise.code}</span> · 时区 {enterprise.timezone} · 侧边栏里 P1、P2 标记表示该功能在正式产品的优先级，P0 不标
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
