/**
 * 联系人页：官方、所在群与频道、底部按快照动态说明关系链 5 项策略。
 */
import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { useStore } from '@/store/store'
import { seatsOfCustomer } from '@/store/selectors'
import { customerCan } from '@/store/policy'
import { SeatAvatar } from '@/ui/display'
import { GroupAvatar, SectionLabel, TabTitle } from '../parts'
import { groupKindLabel } from '../shared'
import { SocialSheet } from './SocialSheets'

/** 关系链 5 项 */
const RELATION_KEYS = ['friend.add', 'friend.accept', 'friend.search_user', 'friend.view_profile', 'friend.block']

export function ContactsScreen({ customerId, onOpen }: { customerId: string; onOpen: (id: string) => void }) {
  const s = useStore()
  const officials = seatsOfCustomer(s, customerId)
  const groups = s.chatGroups.filter((g) => g.memberCustomerIds.includes(customerId))
  const canAdd = customerCan(s, customerId, 'friend.add')
  const [adding, setAdding] = useState(false)
  const relation = RELATION_KEYS.map((k) => ({ key: k, label: s.policyItems.find((p) => p.key === k)?.label ?? k, on: customerCan(s, customerId, k) }))

  return (
    <div className="relative flex h-full flex-col">
      <TabTitle
        title="联系人"
        right={
          canAdd && (
            <button type="button" onClick={() => setAdding(true)} className="rounded-full p-1 text-zinc-700 active:bg-zinc-100" aria-label="添加好友" title="friend.add 开">
              <UserPlus size={18} />
            </button>
          )
        }
      />
      <div className="thin-scroll flex-1 overflow-y-auto">
        <SectionLabel>官方</SectionLabel>
        {officials.map((o) => (
          <button key={o.seatId} type="button" onClick={() => o.conv && onOpen(o.conv.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-zinc-50">
            <SeatAvatar seat={o.seat} size={40} />
            <div className="min-w-0 flex-1 border-b border-zinc-100 pb-2.5">
              <div className="flex items-center gap-1 text-[14px] text-zinc-900">
                {o.seat.displayName}
                <span className="rounded bg-brand-50 px-1 text-[9px] text-brand-700">官方</span>
                {o.primary && <span className="rounded bg-zinc-100 px-1 text-[9px] text-zinc-500">主联系人</span>}
              </div>
              <div className="truncate text-xs text-zinc-500">{o.seat.roleDesc}</div>
            </div>
          </button>
        ))}
        <SectionLabel>群与频道（{groups.length}）</SectionLabel>
        {groups.length === 0 && <p className="px-4 py-3 text-xs text-zinc-400">还没有加入任何群</p>}
        {groups.map((g) => {
          const conv = s.conversations.find((c) => c.chatGroupId === g.id)
          return (
            <button key={g.id} type="button" onClick={() => conv && onOpen(conv.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-zinc-50">
              <GroupAvatar g={g} size={40} />
              <div className="min-w-0 flex-1 border-b border-zinc-100 pb-2.5">
                <div className="text-[14px] text-zinc-900">
                  {g.name}
                  {g.official && <span className="ml-1 rounded bg-brand-50 px-1 text-[9px] text-brand-700">官方</span>}
                </div>
                <div className="truncate text-xs text-zinc-500">
                  {groupKindLabel(g)} · {g.desc}
                </div>
              </div>
            </button>
          )
        })}
        <div className="px-4 py-4 text-[10px] leading-relaxed text-zinc-400">
          <div className="mb-1">当前策略（关系链）：</div>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            {relation.map((r) => (
              <span key={r.key} className={r.on ? 'text-emerald-700' : 'text-zinc-400'}>
                {r.label} {r.on ? '开' : '关'}
              </span>
            ))}
          </div>
          <div className="mt-1">{relation.every((r) => !r.on || r.key === 'friend.block') ? '只能联系上方列表中的人。' : '可以主动添加联系人。'}</div>
        </div>
      </div>
      {adding && <SocialSheet action="friend.add" onClose={() => setAdding(false)} />}
    </div>
  )
}
