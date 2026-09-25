import { useState } from 'react'
import type { Message } from '@/domain/types'
import { customerCan } from '@/store/policy'
import { useStore } from '@/store/store'
import { Modal, toast } from './overlay'
import { Avatar, SeatAvatar, TitleChip } from './display'

/** 提及仅展示公开资料；员工身份、内部标签不会带到客户视角。 */
export function MessageText({ m, highlight, viewerCustomerId }: { m: Message; highlight?: string; viewerCustomerId?: string }) {
  const s = useStore()
  const [profile, setProfile] = useState<{ kind: 'seat' | 'customer'; id: string } | null>(null)
  const members = [
    ...s.seats.filter((x) => m.mentionSeatIds?.includes(x.id)).map((x) => ({ kind: 'seat' as const, id: x.id, name: x.displayName })),
    ...s.customers.filter((x) => m.mentionCustomerIds?.includes(x.id)).map((x) => ({ kind: 'customer' as const, id: x.id, name: x.nickname })),
  ]
  const escape = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const tokens = [...members.map((x) => `@${x.name}`), ...(m.mentionAll ? ['@所有人'] : [])].sort((a, b) => b.length - a.length)
  const pattern = `(https?:\\/\\/[^\\s]+${tokens.length ? `|${tokens.map(escape).join('|')}` : ''})`
  const selectedSeat = profile?.kind === 'seat' ? s.seats.find((x) => x.id === profile.id) : undefined
  const selectedCustomer = profile?.kind === 'customer' ? s.customers.find((x) => x.id === profile.id) : undefined
  const title = s.titles.find((x) => x.id === selectedCustomer?.primaryTitleId && x.enabled)
  return <>
    {m.text.split(new RegExp(pattern, 'g')).map((part, i) => {
      if (/^https?:\/\//.test(part)) return <a key={i} href={part} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="underline break-all">{part}</a>
      const target = members.find((x) => `@${x.name}` === part)
      if (target) return <button key={i} type="button" className="rounded bg-sky-200/25 px-0.5 font-medium underline underline-offset-2" onClick={(e) => { e.stopPropagation(); const conv = s.conversations.find((c) => c.id === m.convId); if (viewerCustomerId && conv?.chatGroupId && !customerCan(s, viewerCustomerId, 'group.view_member_profile', conv.chatGroupId)) return toast('当前不能查看群成员资料', 'info'); setProfile(target) }}>{part}</button>
      if (part === '@所有人' && m.mentionAll) return <span key={i} className="rounded bg-amber-200/30 px-0.5 font-medium">{part}</span>
      if (!highlight) return <span key={i}>{part}</span>
      return <span key={i}>{part.split(new RegExp(`(${escape(highlight)})`, 'gi')).map((x, j) => x.toLowerCase() === highlight.toLowerCase() ? <mark key={j} className="rounded bg-amber-200 text-amber-950">{x}</mark> : x)}</span>
    })}
    {profile && <Modal open title="成员资料" onClose={() => setProfile(null)} width={320}>
      <div className="flex items-center gap-3 text-zinc-800">
        {selectedSeat ? <SeatAvatar seat={selectedSeat} size={48} /> : <Avatar text={selectedCustomer?.nickname ?? '已离开的成员'} size={48} />}
        <div><div className="text-sm font-medium">{selectedSeat?.displayName ?? selectedCustomer?.nickname ?? '已离开的成员'}</div>
          {selectedSeat && <div className="mt-1 text-xs text-zinc-500">官方 · {selectedSeat.roleDesc}</div>}
          {title && <TitleChip title={title} />}
        </div>
      </div>
    </Modal>}
  </>
}
