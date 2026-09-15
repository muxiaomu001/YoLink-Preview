/**
 * 群管理组件的公共部分：统一 props、8 项管理员权限的中文说明（12 文档表格）、
 * 折叠面板、跳转到消息、慢速模式档位、限制状态文案。
 * 工作台群信息卡与管理后台群管理页共用这些组件，所以这里只依赖 store，不依赖 useWorkbench。
 */
import { useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ChatGroup, GroupAdminPerm } from '@/domain/types'
import type { Actor } from '@/store/actions/groups'

/** 每个群管理面板都收这四个：群、操作者（坐席 + 实操员工）、权限判定、是否紧凑（工作台右栏） */
export interface GroupPanelProps {
  group: ChatGroup
  actor: Actor
  perm: (p: GroupAdminPerm) => boolean
  compact?: boolean
}

/**
 * 折叠面板：工作台里是右栏的一段，管理后台与群管理弹窗里是一张卡。
 * 没有权限的面板由调用方决定不渲染，这里不再做"上锁"状态。
 */
export function Section({
  id,
  title,
  hint,
  extra,
  defaultOpen = true,
  compact,
  children,
}: {
  id?: string
  title: string
  hint?: ReactNode
  extra?: ReactNode
  defaultOpen?: boolean
  compact?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section id={id} className={clsx(compact ? 'border-b border-zinc-100' : 'rounded-lg border border-zinc-200 bg-white')}>
      <div className={clsx('flex items-center gap-2', compact ? 'px-4 py-2.5' : 'border-b border-zinc-100 px-4 py-2.5')}>
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left" aria-expanded={open}>
          {open ? <ChevronDown size={12} className="shrink-0 text-zinc-400" /> : <ChevronRight size={12} className="shrink-0 text-zinc-400" />}
          <span className={clsx('font-semibold', compact ? 'text-[12px] text-zinc-600' : 'text-[13px] text-zinc-800')}>{title}</span>
          {hint && <span className="ml-1 truncate text-[11px] text-zinc-400">{hint}</span>}
        </button>
        {extra}
      </div>
      {open && <div className={clsx(compact ? 'px-4 pb-3' : 'p-4')}>{children}</div>}
    </section>
  )
}
