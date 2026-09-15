import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { AtSign, Clock, Inbox, MoonStar } from 'lucide-react'
import { fmtRelative, fmtWait } from '@/domain/time'
import { applyView, conversationsForSeat, type ConvRow, type WorkbenchView } from '@/store/selectors'
import { Avatar, Empty, TitleChip } from '@/ui/display'
import { useWorkbench } from '../useWorkbench'
import { ChatArea } from '../components/ChatArea'
import { CustomerCard } from '../components/CustomerCard'
import { GroupCard } from '../components/GroupCard'

const VIEWS: { key: WorkbenchView; label: string; icon: typeof Inbox; hint: string }[] = [
  { key: 'waiting', label: '待我回复', icon: Inbox, hint: '客户最后发言、坐席尚未回复，按等待时长排' },
  { key: 'all', label: '全部会话', icon: Clock, hint: '当前坐席身份下的全部会话' },
  { key: 'mentions', label: '@我', icon: AtSign, hint: '群里被提及' },
  { key: 'idle', label: '长期未跟进', icon: MoonStar, hint: '超过 14 天没有往来' },
]

export function ChatPage() {
  const { s, seat } = useWorkbench()
  const { convId } = useParams()
  const nav = useNavigate()
  const [view, setView] = useState<WorkbenchView>('waiting')

  const rows = useMemo(() => (seat ? conversationsForSeat(s, seat.id) : []), [s, seat])
  const counts = useMemo(() => Object.fromEntries(VIEWS.map((v) => [v.key, applyView(rows, v.key).length])), [rows])
  const visible = applyView(rows, view)
  const current = rows.find((r) => r.conv.id === convId)

  // 没选会话时默认打开当前视图第一条
  useEffect(() => {
    if (!convId && visible[0]) nav(`/workbench/chat/${visible[0].conv.id}`, { replace: true })
  }, [convId, visible, nav])

  if (!seat) {
    return <Empty className="h-full" text="当前员工没有持有任何坐席。让管理员在「坐席」页把一个坐席交接给他，这里就会出现会话。" />
  }

  return (
    <div className="flex h-full">
      {/* 左：会话列表 */}
      <aside className="flex w-80 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="grid grid-cols-4 border-b border-zinc-200">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              title={v.hint}
              onClick={() => setView(v.key)}
              className={clsx('flex flex-col items-center gap-0.5 border-b-2 py-2 text-[11px]', view === v.key ? 'border-brand-700 font-medium text-brand-800' : 'border-transparent text-zinc-500 hover:text-zinc-800')}
            >
              <span className="flex items-center gap-1">
                <v.icon size={12} />
                {v.label}
              </span>
              <span className={clsx('rounded-full px-1.5 text-[10px] leading-4 tabular-nums', view === v.key ? 'bg-brand-100 text-brand-800' : 'bg-zinc-100 text-zinc-500')}>{counts[v.key]}</span>
            </button>
          ))}
        </div>
        <div className="thin-scroll flex-1 overflow-y-auto">
          {visible.length === 0 && <Empty text={view === 'waiting' ? '没有等待回复的客户' : '没有会话'} />}
          {visible.map((r) => (
            <ConvItem key={r.conv.id} row={r} active={r.conv.id === convId} view={view} onClick={() => nav(`/workbench/chat/${r.conv.id}`)} />
          ))}
        </div>
        <div className="border-t border-zinc-100 px-3 py-1.5 text-[10px] text-zinc-400">
          以「{seat.displayName}」身份 · 只看得到本坐席的会话
        </div>
      </aside>

      {/* 中：聊天区 */}
      <section className="flex min-w-0 flex-1 flex-col bg-zinc-50">{current ? <ChatArea row={current} seat={seat} /> : <Empty className="h-full" text="选择一条会话" />}</section>

      {/* 右：资料卡 */}
      <aside className="thin-scroll w-80 shrink-0 overflow-y-auto border-l border-zinc-200 bg-white">
        {current?.conv.kind === 'dm' && current.customer && <CustomerCard customerId={current.customer.id} />}
        {current && current.conv.kind !== 'dm' && <GroupCard chatGroupId={current.conv.chatGroupId!} />}
      </aside>
    </div>
  )
}

function ConvItem({ row, active, view, onClick }: { row: ConvRow; active: boolean; view: WorkbenchView; onClick: () => void }) {
  const { s } = useWorkbench()
  const isDm = row.conv.kind === 'dm'
  const primaryTitle = row.customer?.primaryTitleId ? s.titles.find((t) => t.id === row.customer!.primaryTitleId && t.enabled) : undefined
  const group = !isDm ? s.chatGroups.find((g) => g.id === row.conv.chatGroupId) : undefined
  return (
    <button type="button" onClick={onClick} className={clsx('flex w-full items-start gap-2.5 border-b border-zinc-100 px-3 py-2.5 text-left hover:bg-zinc-50', active && 'bg-brand-50/70 hover:bg-brand-50/70')}>
      {isDm ? <Avatar text={row.title} size={36} /> : <Avatar text={row.title} size={36} color={group?.kind === 'channel' ? '#b45309' : '#0f766e'} official={group?.official} />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-zinc-900">{row.title}</span>
          {primaryTitle && <TitleChip title={primaryTitle} size="xs" />}
          {!isDm && <span className="text-[10px] text-zinc-400">{group?.kind === 'channel' ? '频道' : `群 · ${(group?.memberCustomerIds.length ?? 0) + (group?.memberSeatIds.length ?? 0)}`}</span>}
          <span className="ml-auto shrink-0 text-[10px] tabular-nums text-zinc-400">{fmtRelative(row.conv.lastMessageAt)}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-xs text-zinc-500">{row.subtitle}</span>
          {row.unread > 0 && <span className="shrink-0 rounded-full bg-red-500 px-1.5 text-[10px] leading-4 text-white">{row.unread}</span>}
          {row.mentioned && <span className="shrink-0 rounded-full bg-amber-500 px-1.5 text-[10px] leading-4 text-white">@</span>}
        </div>
        {view === 'waiting' && row.waitingSince && <div className="mt-0.5 text-[10px] text-amber-600">已等待 {fmtWait(row.waitingSince)}</div>}
        {view === 'idle' && <div className="mt-0.5 text-[10px] text-zinc-400">{row.idleDays} 天没有往来</div>}
      </div>
    </button>
  )
}
