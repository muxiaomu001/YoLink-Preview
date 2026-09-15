/**
 * 顶栏中间的当前坐席身份切换：只有一个坐席时不可点；多个时下拉选择，每项带该坐席未读数。
 */
import { useState } from 'react'
import { clsx } from 'clsx'
import { ChevronDown } from 'lucide-react'
import type { Seat } from '@/domain/types'
import { SeatAvatar } from '@/ui/display'

export function SeatSwitcher({ seats, active, unreadBySeat, onPick }: { seats: Seat[]; active: Seat | undefined; unreadBySeat: Record<string, number>; onPick: (seatId: string) => void }) {
  const [open, setOpen] = useState(false)
  const multi = seats.length > 1
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => multi && setOpen((v) => !v)}
        className={clsx('flex h-8 items-center gap-2 rounded-md border px-2', multi ? 'cursor-pointer border-brand-200 bg-brand-50/60 hover:bg-brand-50' : 'cursor-default border-zinc-200 bg-zinc-50')}
        title={multi ? '切换坐席身份' : '只有一个坐席身份'}
      >
        {active ? (
          <>
            <SeatAvatar seat={active} size={22} />
            <span className="text-[13px] font-medium text-zinc-900">{active.displayName}</span>
            <span className="text-[11px] text-zinc-500">当前身份</span>
          </>
        ) : (
          <span className="text-[12px] text-amber-700">未持有任何坐席，等待管理员交接</span>
        )}
        {multi && <ChevronDown size={14} className="text-zinc-400" />}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-1 w-64 rounded-md border border-zinc-200 bg-white py-1 shadow-lg" onMouseLeave={() => setOpen(false)}>
          {seats.map((seat) => (
            <button
              key={seat.id}
              type="button"
              className={clsx('flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50', seat.id === active?.id && 'bg-brand-50/60')}
              onClick={() => {
                onPick(seat.id)
                setOpen(false)
              }}
            >
              <SeatAvatar seat={seat} size={26} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] text-zinc-900">{seat.displayName}</span>
                <span className="block truncate text-[11px] text-zinc-500">{seat.roleDesc}</span>
              </span>
              {unreadBySeat[seat.id] > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[11px] leading-4 text-white">{unreadBySeat[seat.id]}</span>}
            </button>
          ))}
          <div className="border-t border-zinc-100 px-3 py-1.5 text-[11px] text-zinc-400">切换后会话、客户、群发身份全部跟着切</div>
        </div>
      )}
    </div>
  )
}
