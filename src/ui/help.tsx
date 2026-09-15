/**
 * 问号提示：正式界面不放大段解释文字，需要说明的地方放一个问号，悬停显示。
 * 工作台与后台共用。
 */
import { useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import { CircleHelp } from 'lucide-react'

export function HelpTip({ text, className, align = 'left' }: { text: ReactNode; className?: string; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  return (
    <span className={clsx('relative inline-flex', className)} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label="说明" className="text-zinc-400 hover:text-zinc-700" onClick={() => setOpen((v) => !v)}>
        <CircleHelp size={13} />
      </button>
      {open && (
        <span className={clsx('absolute top-full z-40 mt-1 w-64 rounded-md border border-zinc-200 bg-white px-3 py-2 text-left text-[12px] leading-relaxed font-normal text-zinc-700 shadow-lg', align === 'right' ? 'right-0' : 'left-0')}>
          {text}
        </span>
      )}
    </span>
  )
}
