/**
 * 演示批注层 —— 不属于产品的一部分。
 *
 * 这里承载的是「这个演示为什么和真产品不一样」「这块排在第几版」之类的旁白。
 * 产品界面上的文字一律走正常的 PageHeader / Note / Field hint，写成对外口吻；
 * 凡是需要对看演示的人解释、对技术团队交代的话，只能放进这一层。
 *
 * 规矩见 docs/界面文案与名词规范.md 第五节。
 * 交给技术团队时：删掉本文件，再删掉所有 DemoNote / DemoLevelTag / DemoNoteToggle /
 * demoToast 的引用即可，剩下的界面就是正式产品应有的样子。
 */
import { useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { clsx } from 'clsx'
import { Info } from 'lucide-react'
import { toast } from './toastState'

const KEY = 'yolink-demo-notes'
const listeners = new Set<() => void>()

function read() {
  return localStorage.getItem(KEY) !== 'off'
}
function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** 演示批注是否显示；关掉后界面只剩正式产品该有的文案 */
export function useDemoNotes() {
  return useSyncExternalStore(subscribe, read, () => true)
}

export function setDemoNotes(on: boolean) {
  localStorage.setItem(KEY, on ? 'on' : 'off')
  listeners.forEach((fn) => fn())
}

/** 一条演示批注：灰色虚线 + 明确标签，和产品自身的提示条视觉上区分开 */
export function DemoNote({ children, className, compact }: { children: ReactNode; className?: string; compact?: boolean }) {
  if (!useDemoNotes()) return null
  return (
    <div
      className={clsx(
        'rounded-md border border-dashed border-zinc-300 bg-zinc-50/70 leading-relaxed text-zinc-500',
        compact ? 'px-2.5 py-1.5 text-[10px]' : 'px-3 py-2 text-xs',
        className,
      )}
    >
      <span className={clsx('mr-1.5 inline-flex items-center gap-1 rounded bg-zinc-200/70 px-1.5 align-[1px] font-medium tracking-wide text-zinc-600', compact ? 'py-0 text-[9px]' : 'py-0.5 text-[10px]')}>
        <Info size={compact ? 9 : 10} /> 演示说明
      </span>
      {children}
    </div>
  )
}

export type DemoLevel = 'P0' | 'P1' | 'P2'

/**
 * 排期徽章：告诉看演示的人这块排在第几版。
 * 排期标记只能走这里，不许写进标题、标签、字段名的字符串里。
 */
export function DemoLevelTag({ level, className }: { level?: DemoLevel; className?: string }) {
  const on = useDemoNotes()
  if (!level || !on) return null
  return (
    <span
      title={level === 'P0' ? '第一版交付范围' : level === 'P1' ? '第二版排期' : '后续版本排期'}
      className={clsx('ml-1.5 shrink-0 rounded border border-dashed border-zinc-300 px-1 align-middle text-[9px] leading-4 font-normal text-zinc-400', className)}
    >
      {level}
    </span>
  )
}

/** 演示环境做不了的操作：统一口径，别各处自己编 */
export function demoToast(what: string) {
  toast(`${what}在演示里不做实际改动`, 'info')
}

/** 开关，放在演示入口和演示控制条里 */
export function DemoNoteToggle({ className }: { className?: string }) {
  const on = useDemoNotes()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      title={on ? '关掉后界面只剩正式产品应有的文案' : '打开后显示演示说明与排期标记'}
      onClick={() => setDemoNotes(!on)}
      className={clsx('inline-flex shrink-0 items-center gap-2 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs whitespace-nowrap text-zinc-600 hover:bg-zinc-50', className)}
    >
      <span className={clsx('relative h-3.5 w-6 rounded-full transition-colors', on ? 'bg-brand-600' : 'bg-zinc-300')}>
        <span className={clsx('absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all', on ? 'left-3' : 'left-0.5')} />
      </span>
      演示批注
    </button>
  )
}
