/**
 * 消息页：会话列表 + 右上角「+」菜单（项随策略出现与消失，全关时不显示「+」）。
 */
import { customerVisibleMessage } from '@/domain/messageRules'
import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useStore } from '@/store/store'
import { conversationsForCustomer, messagesOf } from '@/store/selectors'
import { customerCan, senderName } from '@/store/policy'
import { fmtRelative } from '@/domain/time'
import { SeatAvatar } from '@/ui/display'
import { GroupAvatar, TabTitle } from '../parts'
import { customerPreview } from './ChatScreen.shared'
import { SocialSheet } from './SocialSheets'
import { SOCIAL_ACTIONS, type SocialAction } from './SocialSheets.shared'

export function ChatsScreen({ customerId, onOpen }: { customerId: string; onOpen: (id: string) => void }) {
  const s = useStore()
  const rows = useMemo(() => conversationsForCustomer(s, customerId), [s, customerId])
  const [menu, setMenu] = useState(false)
  const [action, setAction] = useState<SocialAction | null>(null)
  const actions = SOCIAL_ACTIONS.filter((a) => customerCan(s, customerId, a.key))

  return (
    <div className="relative flex h-full flex-col">
      <TabTitle
        title="消息"
        right={
          actions.length > 0 && (
            <button type="button" onClick={() => setMenu((v) => !v)} className="rounded-full p-1 text-zinc-700 active:bg-zinc-100" aria-label="更多" title="按策略显示：建群、建频道、加好友、搜索、扫码入群">
              <Plus size={20} />
            </button>
          )
        }
      />
      {menu && (
        <>
          <div className="absolute inset-0 z-10" onClick={() => setMenu(false)} />
          <div className="absolute top-11 right-3 z-20 w-40 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg">
            {actions.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => {
                  setMenu(false)
                  setAction(a.key)
                }}
                className="block w-full border-b border-zinc-100 px-3 py-2 text-left text-[13px] text-zinc-800 last:border-0 active:bg-zinc-50"
              >
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="thin-scroll flex-1 overflow-y-auto">
        {rows.map((r) => {
          const last = r.last
          const mentioned = messagesOf(s, r.conv.id).some((m) => customerVisibleMessage(m) && !m.recalledAt && !m.deletedAt && m.senderId !== customerId && (m.mentionAll || m.mentionCustomerIds?.includes(customerId)) && m.at > (r.conv.readAtByCustomer?.[customerId] ?? ''))
          const prefix = !last || last.senderKind === 'system' ? '' : last.senderKind === 'customer' && last.senderId === customerId ? '我：' : r.conv.kind === 'dm' ? '' : `${senderName(s, last)}：`
          const unread = messagesOf(s, r.conv.id).filter((m) => customerVisibleMessage(m) && !m.recalledAt && !m.deletedAt && m.senderKind !== 'system' && m.senderId !== customerId && m.at > (r.conv.readAtByCustomer?.[customerId] ?? '')).length
          return (
            <button key={r.conv.id} type="button" onClick={() => onOpen(r.conv.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-zinc-50">
              {r.seat ? <SeatAvatar seat={r.seat} size={44} /> : r.group ? <GroupAvatar g={r.group} size={44} /> : null}
              <div className="min-w-0 flex-1 border-b border-zinc-100 pb-2.5">
                <div className="flex items-center justify-between">
                  <span className="truncate text-[14px] text-zinc-900">
                    {r.title}
                    {r.group?.official && <span className="ml-1 rounded bg-brand-50 px-1 text-[9px] text-brand-700">官方</span>}
                  </span>
                  <span className="text-[10px] text-zinc-400">{last ? fmtRelative(last.at) : ''}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="truncate text-xs text-zinc-500">
                    {mentioned && <span className="mr-1 text-amber-600">[有人@我]</span>}{prefix}
                    {last ? customerPreview(last) : ''}
                  </span>
                  {unread > 0 && <span className="ml-2 shrink-0 rounded-full bg-red-500 px-1.5 text-[10px] leading-4 text-white">{unread > 99 ? '99+' : unread}</span>}
                </div>
              </div>
            </button>
          )
        })}
        {actions.length === 0 && <p className="px-4 py-4 text-[10px] leading-relaxed text-zinc-400">当前策略下没有建群、建频道、加好友、搜索、扫码入群，所以右上角没有「+」。在管理后台「策略与能力开关」打开任一项，这里立刻出现。</p>}
      </div>
      {action && <SocialSheet action={action} onClose={() => setAction(null)} />}
    </div>
  )
}
