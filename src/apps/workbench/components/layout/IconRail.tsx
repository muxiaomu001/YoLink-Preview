/**
 * 最左侧 56px 竖向图标栏：顶部登录员工头像（点开显示员工名、角色、「个人设置」入口），
 * 下面竖排导航图标 + 11px 文字标签；会话图标右上角挂当前坐席未读总数角标。
 */
import { useState } from 'react'
import { clsx } from 'clsx'
import { NavLink, useNavigate } from 'react-router-dom'
import { Settings } from 'lucide-react'
import type { Staff } from '@/domain/types'
import { Avatar } from '@/ui/display'

export interface RailItem {
  to: string
  label: string
  icon: typeof Settings
  badge?: number
}

export function IconRail({ staff, roleName, items }: { staff: Staff | undefined; roleName: string; items: RailItem[] }) {
  const [profileOpen, setProfileOpen] = useState(false)
  const nav = useNavigate()
  return (
    <aside className="relative flex w-14 shrink-0 flex-col items-center border-r border-zinc-200 bg-zinc-100/80 py-2">
      {/* 登录员工头像 */}
      <div className="relative mb-2">
        <button type="button" onClick={() => setProfileOpen((v) => !v)} className="rounded-full ring-2 ring-transparent hover:ring-brand-300" title={staff?.name ?? '未登录'}>
          <Avatar text={staff?.name ?? '?'} size={32} color="#3f3f46" />
        </button>
        {profileOpen && (
          <div className="absolute top-0 left-full z-40 ml-2 w-48 rounded-md border border-zinc-200 bg-white py-1 shadow-lg" onMouseLeave={() => setProfileOpen(false)}>
            <div className="px-3 py-2">
              <div className="text-[13px] font-medium text-zinc-900">{staff?.name ?? '-'}</div>
              <div className="text-[11px] text-zinc-500">{roleName}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setProfileOpen(false)
                nav('/workbench/settings')
              }}
              className="flex w-full items-center gap-1.5 border-t border-zinc-100 px-3 py-2 text-left text-[12px] text-zinc-700 hover:bg-zinc-50"
            >
              <Settings size={13} /> 个人设置
            </button>
          </div>
        )}
      </div>

      <nav className="flex w-full flex-col items-stretch gap-0.5">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            title={it.label}
            className={({ isActive }) =>
              clsx('relative flex flex-col items-center gap-0.5 py-1.5 transition-colors', isActive ? 'text-brand-800' : 'text-zinc-500 hover:text-zinc-800')
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute inset-y-1 left-0 w-[3px] rounded-r bg-brand-700" />}
                <span className={clsx('relative flex h-8 w-8 items-center justify-center rounded-md', isActive ? 'bg-brand-100' : 'hover:bg-zinc-200/70')}>
                  <it.icon size={18} />
                  {!!it.badge && it.badge > 0 && (
                    <span className="absolute -top-1 -right-1.5 min-w-[16px] rounded-full bg-red-500 px-1 text-center text-[11px] leading-4 text-white">{it.badge > 99 ? '99+' : it.badge}</span>
                  )}
                </span>
                <span className="text-[11px] leading-none">{it.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
