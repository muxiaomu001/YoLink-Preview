/**
 * 极简 SVG 图表：折线与柱状，够基础统计页用，不引第三方库。
 */
import { useId } from 'react'

export interface Point {
  label: string
  value: number
}

const BRAND = '#1f3b73'

/** 折线图：横轴按序，纵轴自适应 */
export function LineChart({ data, height = 160, color = BRAND, unit = '' }: { data: Point[]; height?: number; color?: string; unit?: string }) {
  const id = useId()
  const w = 600
  const padL = 36
  const padR = 8
  const padT = 10
  const padB = 24
  const max = Math.max(1, ...data.map((d) => d.value))
  const innerW = w - padL - padR
  const innerH = height - padT - padB
  const x = (i: number) => padL + (data.length <= 1 ? 0 : (i / (data.length - 1)) * innerW)
  const y = (v: number) => padT + innerH - (v / max) * innerH
  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ')
  const area = `${path} L${x(data.length - 1).toFixed(1)},${(padT + innerH).toFixed(1)} L${x(0).toFixed(1)},${(padT + innerH).toFixed(1)} Z`
  const ticks = [0, 0.5, 1].map((r) => Math.round(max * r))
  const labelEvery = Math.max(1, Math.ceil(data.length / 6))
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-auto w-full" role="img">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="#e4e4e7" strokeDasharray="2 3" />
          <text x={padL - 6} y={y(t) + 3} fontSize="9" textAnchor="end" fill="#a1a1aa">
            {t}
            {unit}
          </text>
        </g>
      ))}
      {data.length > 1 && <path d={area} fill={`url(#${id})`} />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={d.label}>
          <circle cx={x(i)} cy={y(d.value)} r="2" fill={color}>
            <title>
              {d.label}：{d.value}
              {unit}
            </title>
          </circle>
          {i % labelEvery === 0 && (
            <text x={x(i)} y={height - 8} fontSize="9" textAnchor="middle" fill="#a1a1aa">
              {d.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

/** 柱状图：横向，一行一个类目 */
export function BarChart({ data, color = BRAND, unit = '' }: { data: Point[]; color?: string; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2 text-xs">
          <div className="w-24 shrink-0 truncate text-right text-zinc-600">{d.label}</div>
          <div className="h-4 flex-1 rounded bg-zinc-100">
            <div className="h-4 rounded" style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, background: color }} />
          </div>
          <div className="w-12 shrink-0 tabular-nums text-zinc-700">
            {d.value}
            {unit}
          </div>
        </div>
      ))}
    </div>
  )
}

/** 迷你趋势线，放在指标卡里 */
export function Sparkline({ values, color = BRAND, height = 28 }: { values: number[]; color?: string; height?: number }) {
  const w = 100
  const max = Math.max(1, ...values)
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${height - (v / max) * (height - 2) - 1}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-7 w-24" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}
