import { useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import { ChevronRight, type LucideIcon } from 'lucide-react'

export interface MessageMenuAction {
  label: string
  icon: LucideIcon
  section: number
  onSelect: () => void
  hint?: string
  disabled?: boolean
  danger?: boolean
  opensPicker?: boolean
}

/** 文字菜单独立于消息滚动区，按实际高度避开窗口边缘。 */
export function MessageActionMenu({ actions, position, onClose, triggerId }: { triggerId: string; actions: MessageMenuAction[]; position: { left: number; top: number }; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const origin = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    const menu = ref.current
    if (!menu) return
    origin.current ??= document.activeElement as HTMLElement | null
    const rect = menu.getBoundingClientRect()
    menu.style.left = `${Math.max(8, Math.min(position.left, window.innerWidth - rect.width - 8))}px`
    menu.style.top = `${Math.max(8, Math.min(position.top, window.innerHeight - rect.height - 8))}px`
    menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true })
  }, [position])
  useEffect(() => {
    const outside = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node) && !document.getElementById(triggerId)?.contains(e.target as Node)) onClose() }
    const scroll = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', outside)
    window.addEventListener('resize', onClose)
    // 仅用户滚动关闭菜单，浏览器布局调整或自动滚动不应误关。
    window.addEventListener('wheel',scroll,true)
    window.addEventListener('touchmove',scroll,true)
    return () => {
      document.removeEventListener('mousedown', outside)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('wheel',scroll,true)
      window.removeEventListener('touchmove',scroll,true)
    }
  }, [onClose, triggerId])
  return createPortal(
    <div ref={ref} role="menu" aria-label="消息操作" style={position} className="fixed z-40 max-h-[calc(100dvh-16px)] w-44 max-w-[calc(100vw-16px)] overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 text-zinc-900 shadow-lg"
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation() }}
      onKeyDown={(e) => {
        const items = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
        const index = items.indexOf(document.activeElement as HTMLButtonElement)
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
          e.preventDefault()
          const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
          items[next]?.focus()
        }
        if (e.key === 'Escape' || e.key === 'Tab') {
          if (e.key === 'Escape') { e.preventDefault(); origin.current?.focus({ preventScroll: true }) }
          onClose()
        }
      }}>
      {actions.map((action, index) => <div key={action.label}>
        {index > 0 && action.section !== actions[index - 1].section && <div role="separator" className="my-1 h-px bg-zinc-100" />}
        <button type="button" role="menuitem" disabled={action.disabled} title={action.hint} onClick={() => { onClose(); action.onSelect() }} className={clsx('flex min-h-8 w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] outline-none transition-colors focus-visible:bg-brand-50', action.disabled ? 'cursor-not-allowed text-zinc-400' : action.danger ? 'text-red-600 hover:bg-red-50 focus-visible:bg-red-50' : 'text-zinc-700 hover:bg-zinc-100')}>
          <action.icon size={15} strokeWidth={1.75} className="shrink-0" />
          <span className="min-w-0 flex-1">{action.label}{action.disabled && action.hint && <span className="mt-0.5 block text-[11px]">{action.hint}</span>}</span>
          {action.opensPicker && <ChevronRight size={13} className="shrink-0 text-zinc-400" />}
        </button>
      </div>)}
    </div>, document.body,
  )
}
