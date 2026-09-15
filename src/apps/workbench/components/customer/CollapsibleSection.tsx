/**
 * 客户资料卡的可折叠分区：点标题行展开 / 收起，折叠时标题右侧显示摘要；
 * 折叠状态由 CustomerCard 用 useLocalPref 记在本机（键与默认值见 sectionPrefs.ts）。
 */
import type { ReactNode } from 'react'
import { clsx } from 'clsx'
import { ChevronDown } from 'lucide-react'
import { HelpTip } from '@/ui/help'

/** 一个分区的展开状态与切换 */
export interface SectionCtl {
  open: boolean
  toggle: () => void
}

export function CollapsibleSection({
  title,
  ctl,
  summary,
  hint,
  help,
  children,
}: {
  title: string
  ctl: SectionCtl
  /** 折叠时显示在标题右侧的摘要 */
  summary?: ReactNode
  /** 展开时显示在标题右侧的说明（例如字数） */
  hint?: ReactNode
  /** 问号悬浮说明 */
  help?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="border-b border-zinc-100">
      <div className="flex items-center gap-1.5 px-4 py-2.5">
        <button type="button" onClick={ctl.toggle} className="flex min-w-0 flex-1 items-center gap-1.5 text-left" aria-expanded={ctl.open}>
          <span className="text-[12px] font-semibold text-zinc-600">{title}</span>
        </button>
        {help && <HelpTip text={help} />}
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] text-zinc-400">
          {ctl.open ? hint : summary}
          <button type="button" onClick={ctl.toggle} aria-label={ctl.open ? '收起' : '展开'} className="text-zinc-400 hover:text-zinc-700">
            <ChevronDown size={14} className={clsx('transition-transform', ctl.open && 'rotate-180')} />
          </button>
        </span>
      </div>
      {ctl.open && <div className="px-4 pb-3">{children}</div>}
    </section>
  )
}
