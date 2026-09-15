import { clsx } from 'clsx'
import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { useToast } from './toastState'

export function Modal({ open, onClose, title, children, footer, width = 520 }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  useEffect(() => {
    window.dispatchEvent(new Event('yolink:dialog-change'))
    return () => { window.dispatchEvent(new Event('yolink:dialog-change')) }
  }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} className="flex max-h-[90vh] w-full flex-col rounded-lg bg-white shadow-xl" style={{ maxWidth: width }} onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="关闭">
            <X size={16} />
          </button>
        </header>
        <div className="thin-scroll flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 border-t border-zinc-100 px-4 py-3">{footer}</footer>}
      </div>
    </div>
  )
}

export function Toaster() {
  const items = useToast((s) => s.items)
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex flex-col gap-2">
      {items.map((it) => (
        <div key={it.id} className={clsx('pointer-events-auto max-w-sm rounded-md px-3 py-2 text-xs text-white shadow-lg', it.tone === 'ok' ? 'bg-zinc-900' : it.tone === 'warn' ? 'bg-amber-600' : 'bg-brand-700')}>
          {it.text}
        </div>
      ))}
    </div>
  )
}
