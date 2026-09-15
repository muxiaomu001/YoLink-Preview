import { customerById, seatById } from '@/store/selectors'
import { Avatar, KV, Pill, SeatAvatar, TitleChip } from '@/ui/display'
import { useWorkbench } from '../useWorkbench'

export function GroupCard({ chatGroupId }: { chatGroupId: string }) {
  const { s } = useWorkbench()
  const g = s.chatGroups.find((x) => x.id === chatGroupId)
  if (!g) return null
  const owner = seatById(s, g.ownerSeatId)
  const members = g.memberCustomerIds.map((id) => customerById(s, id)!).filter(Boolean).slice(0, 30)
  return (
    <div>
      <div className="flex flex-col items-center border-b border-zinc-100 px-4 py-4 text-center">
        <Avatar text={g.name} size={56} color={g.kind === 'channel' ? '#b45309' : '#0f766e'} official={g.official} />
        <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
          {g.name}
          {g.official && <Pill tone="amber">官方</Pill>}
        </div>
        <div className="mt-1 text-[11px] text-zinc-500">{g.desc}</div>
      </div>
      <div className="border-b border-zinc-100 px-4 py-3">
        <KV
          items={[
            { k: '类型', v: g.kind === 'channel' ? '频道，客户只读' : '群' },
            { k: '群主', v: owner ? <span className="inline-flex items-center gap-1"><SeatAvatar seat={owner} size={16} />{owner.displayName}（坐席）</span> : '-' },
            { k: '成员', v: `${g.memberCustomerIds.length} 位客户 · ${g.memberSeatIds.length} 个坐席` },
            { k: '入群条件', v: g.requiredTitleId ? `头衔「${s.titles.find((t) => t.id === g.requiredTitleId)?.name}」` : '无' },
          ]}
        />
      </div>
      <div className="px-4 py-3">
        <h4 className="mb-2 text-[11px] font-semibold tracking-wide text-zinc-500">成员列表（客户端按策略不可见）</h4>
        <ul className="space-y-1">
          {g.memberSeatIds.map((id) => {
            const seat = seatById(s, id)
            return seat ? (
              <li key={id} className="flex items-center gap-2 text-xs">
                <SeatAvatar seat={seat} size={22} />
                <span className="text-zinc-900">{seat.displayName}</span>
                <span className="text-[10px] text-zinc-400">{id === g.ownerSeatId ? '群主' : '管理员'}</span>
              </li>
            ) : null
          })}
          {members.map((c) => {
            const t = c.primaryTitleId ? s.titles.find((x) => x.id === c.primaryTitleId && x.enabled) : undefined
            return (
              <li key={c.id} className="flex items-center gap-2 text-xs">
                <Avatar text={c.nickname} size={22} />
                <span className="text-zinc-800">{c.nickname}</span>
                {t && <TitleChip title={t} size="xs" />}
              </li>
            )
          })}
          {g.memberCustomerIds.length > 30 && <li className="text-[10px] text-zinc-400">还有 {g.memberCustomerIds.length - 30} 位…</li>}
        </ul>
      </div>
    </div>
  )
}
