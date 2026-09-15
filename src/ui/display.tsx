import { clsx } from 'clsx'
import type { ReactNode } from 'react'
import { BadgeCheck } from 'lucide-react'
import type { Seat, Tag, Title } from '@/domain/types'
import { mediaUrl } from '@/domain/mediaUrl'
import { TitleIcon } from './titleIcons'

/** 客户头像：用昵称首字与稳定色 */
const CUSTOMER_COLORS = ['#64748b', '#0f766e', '#7c3aed', '#be123c', '#0369a1', '#b45309', '#4d7c0f', '#6d28d9']
function hashColor(s: string) {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return CUSTOMER_COLORS[h % CUSTOMER_COLORS.length]
}

export function Avatar({ text, color, size = 32, official, className, portrait }: { text: string; portrait?: boolean; color?: string; size?: number; official?: boolean; className?: string }) {
  const bg = color ?? hashColor(text)
  const fixed: Record<string, number> = { '林顾问': 0, '陈顾问': 1, '林薇': 4, '陈默': 3, '周敏': 2, '赵磊': 7, '王芳': 6, '老周说市': 9, 'Cindy 在港': 10, '阿杰': 13 }
  const photo = portrait ?? (text in fixed || (!color && text.length > 1))
  let hash = 0
  for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const tile = fixed[text] ?? ((hash % 8) * 2 + (/先生|Eric|David|Kevin|Jason|Leo|Jack|Alex|Tom|Ken/.test(text) ? 1 : 0))
  return (
    <span className={clsx('relative inline-flex shrink-0 items-center justify-center rounded-full text-white font-medium select-none', className)} style={{ width: size, height: size, background: bg, fontSize: Math.round(size * 0.42) }}>
      {photo ? <span role="img" aria-label={`${text}的头像`} className="absolute inset-0 rounded-full bg-cover" style={{ backgroundImage: `url("${mediaUrl('/media/avatars/people-grid.png')}")`, backgroundSize: '400% 400%', backgroundPosition: `${(tile % 4) * 100 / 3}% ${Math.floor(tile / 4) * 100 / 3}%` }} /> : text.slice(0, 1)}
      {official && (
        <span className="absolute -right-0.5 -bottom-0.5 flex items-center justify-center rounded-full bg-white" style={{ width: size * 0.42, height: size * 0.42 }} title="企业官方账号">
          <BadgeCheck className="text-brand-600" style={{ width: size * 0.38, height: size * 0.38 }} fill="#dbe4f7" />
        </span>
      )}
    </span>
  )
}

export function SeatAvatar({ seat, size = 32, className }: { seat: Seat; size?: number; className?: string }) {
  return <Avatar text={seat.displayName} portrait={seat.type === 'assign'} color={seat.avatarColor} size={size} official className={className} />
}

/** 头衔：对外可见，官方发的 */
export function TitleChip({ title, size = 'sm', onRemove }: { title: Title; size?: 'xs' | 'sm'; onRemove?: () => void }) {
  return (
    <span
      className={clsx('inline-flex items-center gap-1 rounded-sm font-medium text-white whitespace-nowrap', size === 'xs' ? 'px-1 text-[11px] leading-4' : 'px-1.5 text-[11px] leading-5')}
      style={{ background: title.color }}
      title={title.desc}
    >
      <TitleIcon name={title.icon} size={size === 'xs' ? 9 : 10} />
      {title.name}
      {onRemove && (
        <button type="button" onClick={onRemove} className="ml-0.5 opacity-70 hover:opacity-100" aria-label="摘掉">
          ×
        </button>
      )}
    </span>
  )
}

/** 内部标签：员工用，客户看不到 */
export function TagChip({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border px-1.5 text-[11px] leading-5 whitespace-nowrap" style={{ borderColor: tag.color, color: tag.color, background: `${tag.color}12` }}>
      {tag.name}
      {onRemove && (
        <button type="button" onClick={onRemove} className="opacity-60 hover:opacity-100" aria-label="删除">
          ×
        </button>
      )}
    </span>
  )
}

export function Pill({ children, tone = 'zinc', className }: { children: ReactNode; tone?: 'zinc' | 'green' | 'amber' | 'red' | 'blue' | 'purple'; className?: string }) {
  const tones = {
    zinc: 'bg-zinc-100 text-zinc-600',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-brand-50 text-brand-700',
    purple: 'bg-purple-50 text-purple-700',
  }
  return <span className={clsx('inline-flex items-center rounded px-1.5 text-[11px] leading-5 font-medium whitespace-nowrap', tones[tone], className)}>{children}</span>
}

export function Card({ title, extra, children, className, padded = true }: { title?: ReactNode; extra?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={clsx('rounded-lg border border-zinc-200 bg-white', className)}>
      {(title || extra) && (
        <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5">
          <h3 className="text-[13px] font-semibold text-zinc-800">{title}</h3>
          {extra}
        </header>
      )}
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </section>
  )
}

export function PageHeader({ title, desc, extra }: { title: string; desc?: ReactNode; extra?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-base font-semibold text-zinc-900">{title}</h1>
        {desc && <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-500">{desc}</p>}
      </div>
      {extra && <div className="flex shrink-0 items-center gap-2">{extra}</div>}
    </div>
  )
}

export function Empty({ text, className }: { text: string; className?: string }) {
  return <div className={clsx('flex items-center justify-center py-10 text-xs text-zinc-400', className)}>{text}</div>
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'default' | 'warn' }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className={clsx('mt-1 text-2xl font-semibold tabular-nums', tone === 'warn' ? 'text-amber-600' : 'text-zinc-900')}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-zinc-400">{sub}</div>}
    </div>
  )
}

export interface Column<T> {
  key: string
  title: ReactNode
  render: (row: T) => ReactNode
  width?: string
  align?: 'left' | 'right' | 'center'
}

export function Table<T>({ rows, columns, rowKey, empty = '暂无数据', onRowClick, dense }: { rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; empty?: string; onRowClick?: (r: T) => void; dense?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/80">
            {columns.map((c) => (
              <th key={c.key} className={clsx('px-3 py-2 text-left text-[11px] font-medium text-zinc-500 whitespace-nowrap', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center')} style={{ width: c.width }}>
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-10 text-center text-xs text-zinc-400">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={rowKey(r)} className={clsx('border-b border-zinc-100 last:border-0', onRowClick && 'cursor-pointer hover:bg-brand-50/40')} onClick={() => onRowClick?.(r)}>
              {columns.map((c) => (
                <td key={c.key} className={clsx('px-3 align-middle', dense ? 'py-1.5' : 'py-2.5', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center')}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { key: T; label: ReactNode; count?: number }[]; className?: string }) {
  return (
    <div className={clsx('flex items-center gap-1 border-b border-zinc-200', className)}>
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={() => onChange(it.key)}
          className={clsx('-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] transition-colors', value === it.key ? 'border-brand-700 font-medium text-brand-800' : 'border-transparent text-zinc-500 hover:text-zinc-800')}
        >
          {it.label}
          {typeof it.count === 'number' && <span className={clsx('rounded-full px-1.5 text-[11px] leading-4 tabular-nums', value === it.key ? 'bg-brand-100 text-brand-800' : 'bg-zinc-100 text-zinc-500')}>{it.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function KV({ items }: { items: { k: string; v: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
      {items.map((it) => (
        <div key={it.k} className="contents">
          <dt className="text-zinc-500 whitespace-nowrap">{it.k}</dt>
          <dd className="text-zinc-800 min-w-0 break-words">{it.v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** 说明条：在页面上把 PRD 里的规则讲给看 demo 的人 */
export function Note({ children, tone = 'blue' }: { children: ReactNode; tone?: 'blue' | 'amber' }) {
  return <div className={clsx('rounded-md border px-3 py-2 text-xs leading-relaxed', tone === 'blue' ? 'border-brand-100 bg-brand-50/60 text-brand-900' : 'border-amber-200 bg-amber-50 text-amber-900')}>{children}</div>
}
