/**
 * 客户手机屏共用小件：屏头、设置行、层级小标、手机内弹层、来源文案。
 */
import type { ReactNode } from 'react'
import { clsx } from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ChatGroup } from '@/domain/types'
import { Avatar } from '@/ui/display'
import { DemoNote, useDemoNotes } from '@/ui/DemoNote'

/** 屏头：返回 + 标题 + 右侧 */
export function ScreenHeader({ title, sub, onBack, right, onTitleClick }: { title: ReactNode; sub?: ReactNode; onBack?: () => void; right?: ReactNode; onTitleClick?: () => void }) {
  return (
    <header className="flex items-center gap-2 border-b border-zinc-200 bg-white px-2 py-2">
      {onBack && (
        <button type="button" onClick={onBack} className="p-1 text-zinc-600" aria-label="返回">
          <ChevronLeft size={20} />
        </button>
      )}
      <button type="button" onClick={onTitleClick} disabled={!onTitleClick} className="min-w-0 flex-1 text-left disabled:cursor-default">
        <div className="truncate text-[14px] font-medium text-zinc-900">{title}</div>
        {sub && <div className="truncate text-[10px] text-zinc-400">{sub}</div>}
      </button>
      {right}
    </header>
  )
}

/** 顶层标签页的大标题 */
export function TabTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pt-2 pb-2">
      <span className="text-lg font-semibold">{title}</span>
      {right}
    </div>
  )
}

/** P1 / P2 小标 */
/** 排期标记属于演示批注，不是产品的一部分；关掉批注后客户端就是正式产品的样子 */
export function LevelTag({ level }: { level?: 'P1' | 'P2' }) {
  const show = useDemoNotes()
  if (!level || !show) return null
  return <span className="ml-1 rounded border border-dashed border-zinc-300 px-1 text-[9px] leading-4 text-zinc-400">{level}</span>
}

/** 分组小标题 */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="bg-zinc-50 px-4 py-1 text-[10px] text-zinc-500">{children}</div>
}

/** 设置列表里的一行 */
export function Row({ label, value, level, onClick, icon, danger, hint }: { label: ReactNode; value?: ReactNode; level?: 'P1' | 'P2'; onClick?: () => void; icon?: ReactNode; danger?: boolean; hint?: string }) {
  const inner = (
    <>
      {icon && <span className="text-zinc-500">{icon}</span>}
      <span className={clsx('flex-1 text-left', danger ? 'text-red-600' : 'text-zinc-800')}>
        {label}
        <LevelTag level={level} />
        {hint && <span className="block text-[10px] text-zinc-400">{hint}</span>}
      </span>
      {value !== undefined && <span className="max-w-[45%] truncate text-right text-zinc-500">{value}</span>}
      {onClick && <ChevronRight size={14} className="text-zinc-300" />}
    </>
  )
  const cls = 'flex w-full items-center gap-2 border-b border-zinc-100 px-4 py-2.5 text-[13px] last:border-0'
  if (!onClick) return <div className={cls}>{inner}</div>
  return (
    <button type="button" onClick={onClick} className={clsx(cls, 'active:bg-zinc-50')}>
      {inner}
    </button>
  )
}

/** 手机内的底部弹层（不是产品外的 Modal，贴在手机壳里） */
export function Sheet({ title, onClose, children, footer }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end bg-zinc-900/40" onMouseDown={onClose}>
      <div className="rounded-t-2xl bg-white px-4 pt-3 pb-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[14px] font-semibold text-zinc-900">{title}</span>
          <button type="button" onClick={onClose} className="text-xs text-zinc-400">
            关闭
          </button>
        </div>
        <div className="text-[13px] text-zinc-700">{children}</div>
        {footer && <div className="mt-4 flex gap-2">{footer}</div>}
      </div>
    </div>
  )
}

/** 手机屏里的演示批注，转交给全局批注层，受同一个开关控制 */
export function DemoHint({ children }: { children: ReactNode }) {
  return <DemoNote compact>{children}</DemoNote>
}

export function GroupAvatar({ g, size = 40 }: { g: ChatGroup; size?: number }) {
  return <Avatar text={g.name} size={size} color={g.kind === 'channel' ? '#b45309' : '#0f766e'} official={g.official} />
}
