import type { ComponentProps } from 'react'
import { Info, type LucideIcon } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { useDemoNotes } from './DemoNote'

export function DemoPendingModule({ icon: Icon, title, lines }: { icon: LucideIcon; title: string; lines: string[] }) {
  return (
    <div className="mx-auto mt-16 max-w-xl rounded-lg border border-dashed border-zinc-300 bg-zinc-50/60 px-8 py-10 text-center">
      <span className="mr-1.5 inline-flex items-center gap-1 rounded bg-zinc-200/70 px-1.5 align-[1px] font-medium tracking-wide text-zinc-600 py-0.5 text-[10px]">
        <Info size={10} /> 演示说明
      </span>
      <Icon size={28} className="mt-5 mx-auto text-zinc-400" />
      <h1 className="mt-3 text-base font-semibold text-zinc-800">{title}</h1>
      <div className="mt-3 space-y-2 text-[13px] leading-relaxed text-zinc-600">
        {lines.map((line) => <p key={line}>{line}</p>)}
      </div>
      <p className="mt-6 text-[11px] text-zinc-400">2026-09-25 定：第一版不做，技术不据此排期</p>
    </div>
  )
}

export function DemoPendingRoute({ home, ...props }: ComponentProps<typeof DemoPendingModule> & { home: string }) {
  return useDemoNotes() ? <DemoPendingModule {...props} /> : <Navigate to={home} replace />
}
