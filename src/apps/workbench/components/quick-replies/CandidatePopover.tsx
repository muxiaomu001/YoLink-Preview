/**
 * 输入框上方的候选浮层：`@` 成员、`/` 话术、打字自动匹配三种共用。只负责显示与点选，键盘逻辑在 ChatInput。
 * 用 onMouseDown 阻止默认，避免点选时输入框失焦把弹层关掉。
 */
import { clsx } from 'clsx'
import type { ReactNode } from 'react'

export interface CandidateBase {
  id: string
  label: string
  sub?: string
  icon?: ReactNode
}

export function CandidatePopover<T extends CandidateBase>({ title, items, idx, onPick, onHover }: { title: string; items: T[]; idx: number; onPick: (c: T) => void; onHover: (i: number) => void }) {
  return (
    <ul className="absolute bottom-full left-3 z-20 mb-1 w-80 rounded-md border border-zinc-200 bg-white py-1 shadow-lg">
      <li className="px-2.5 py-1 text-[11px] text-zinc-400">{title}</li>
      {items.map((c, i) => (
        <li key={c.id}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => onHover(i)}
            onClick={() => onPick(c)}
            className={clsx('flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px]', i === idx ? 'bg-brand-50 text-brand-900' : 'text-zinc-700 hover:bg-zinc-50')}
          >
            {c.icon}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{c.label}</span>
              {c.sub && <span className="block truncate text-[11px] text-zinc-400">{c.sub}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
