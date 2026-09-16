import { clsx } from 'clsx'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { DemoNote } from './DemoNote'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const variantCls: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-300',
  secondary: 'bg-white text-zinc-800 border border-zinc-300 hover:bg-zinc-50 disabled:text-zinc-400',
  ghost: 'bg-transparent text-zinc-700 hover:bg-zinc-100 disabled:text-zinc-400',
  danger: 'bg-white text-red-700 border border-red-300 hover:bg-red-50 disabled:text-red-300',
}

const sizeCls: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs rounded-md gap-1',
  md: 'h-8 px-3 text-[13px] rounded-md gap-1.5',
}

export function Button({ variant = 'secondary', size = 'md', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type="button"
      className={clsx('inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed', variantCls[variant], sizeCls[size], className)}
      {...rest}
    >
      {children}
    </button>
  )
}

const FIELD_BASE = 'h-8 rounded-md border border-zinc-300 bg-white px-2.5 text-[13px] text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 disabled:bg-zinc-50 disabled:text-zinc-400'

/**
 * 传了自己的宽度（w-40 / flex-1 / max-w-*）就不要基础的 w-full。
 * Tailwind 的同层工具类谁生效看生成顺序、不看 class 属性里的先后，w-full 会压过 w-40，
 * 于是"筛选栏几个下拉并排"会变成每个都撑满一整行。
 */
function fieldCls(className?: string): string {
  const sized = !!className && /(^|\s)(w-|min-w-|max-w-|basis-|flex-1)/.test(className)
  return sized ? FIELD_BASE : `w-full ${FIELD_BASE}`
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(fieldCls(className), className)} {...rest} />
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(fieldCls(className), 'h-auto py-2 leading-relaxed resize-none', className)} {...rest} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(fieldCls(className), 'pr-7 appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2371717a%27 stroke-width=%272%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")] bg-no-repeat bg-[right_8px_center]', className)} {...rest}>
      {children}
    </select>
  )
}

export function Switch({ checked, onChange, disabled }: { checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={clsx('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50', checked ? 'bg-brand-600' : 'bg-zinc-300')}
    >
      <span className={clsx('inline-block h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4.5' : 'translate-x-0.5')} />
    </button>
  )
}

/** hint 写产品口径；demoHint 是演示批注（「这块演示里为什么不一样」），跟着批注开关一起消失 */
export function Field({ label, hint, demoHint, children, required }: { label: ReactNode; hint?: ReactNode; demoHint?: ReactNode; children: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium text-zinc-600">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </span>
        {hint && <span className="text-[11px] text-zinc-400">{hint}</span>}
      </div>
      {children}
      {demoHint && <DemoNote compact className="mt-1">{demoHint}</DemoNote>}
    </label>
  )
}

export function Checkbox({ checked, onChange, label, disabled }: { checked: boolean; onChange?: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  return (
    <label className={clsx('inline-flex items-center gap-2 text-[13px]', disabled ? 'text-zinc-400' : 'text-zinc-700 cursor-pointer')}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} className="h-3.5 w-3.5 accent-brand-700" />
      {label}
    </label>
  )
}
