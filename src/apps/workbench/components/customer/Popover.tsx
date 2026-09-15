/**
 * 资料卡快捷动作用的小弹层：面板锚定在触发按钮下方，点外面或按 Esc 关闭。
 * 触发按钮与面板放在同一个 PopoverAnchor 里，所以点触发按钮不会先被"点外面"关掉再打开。
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { clsx } from 'clsx'

export function PopoverAnchor({ open, onClose, className, children }: { open: boolean; onClose: () => void; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const el = ref.current
      if (el && !el.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  return (
    <div ref={ref} className={clsx('relative', className)}>
      {children}
    </div>
  )
}

export function PopoverPanel({ align = 'left', width = 240, className, children }: { align?: 'left' | 'center' | 'right'; width?: number; className?: string; children: ReactNode }) {
  const pos = align === 'right' ? 'right-0' : align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0'
  return (
    <div className={clsx('absolute top-full z-30 mt-1 rounded-md border border-zinc-200 bg-white shadow-lg', pos, className)} style={{ width }}>
      {children}
    </div>
  )
}

export function MenuItem({ children, onClick, danger, disabled, title }: { children: ReactNode; onClick?: () => void; danger?: boolean; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={clsx('flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px]', disabled ? 'cursor-not-allowed text-zinc-400' : danger ? 'text-red-700 hover:bg-red-50' : 'text-zinc-700 hover:bg-zinc-50')}
    >
      {children}
    </button>
  )
}
