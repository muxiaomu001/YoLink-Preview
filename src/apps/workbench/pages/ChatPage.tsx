/**
 * 会话页：左侧四个视图 + 筛选行 + 会话列表（右键菜单、快捷键），中间聊天区，右侧客户资料卡 / 群信息卡。
 * 打开会话自动标已读；「长期未跟进」阈值取企业策略 idleDays。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { seatGroupPerm } from '@/store/policy'
import { applyView, conversationsForSeat, type WorkbenchView } from '@/store/selectors'
import { Empty, Note, Pill } from '@/ui/display'
import { useWorkbench } from '../useWorkbench'
import { ChatArea } from '../components/ChatArea'
import { CustomerCard } from '../components/CustomerCard'
import { GroupCard } from '../components/group/GroupCard'
import { applyFilters, ContextMenu, ConvItem, EMPTY_FILTERS, FilterBar, VIEWS, type Filters } from './ChatPage.parts'

export function ChatPage() {
  const { s, staff, seat, can } = useWorkbench()
  const { convId } = useParams()
  const nav = useNavigate()
  const [view, setView] = useState<WorkbenchView>('waiting')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  // 本地删除的会话：只藏起来，不删服务端消息；有新消息时再出现
  const [hidden, setHidden] = useState<Record<string, string>>({})
  const [menu, setMenu] = useState<{ x: number; y: number; convId: string } | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const idleDays = s.policyNumbers.idleDays

  const rows = useMemo(() => (seat ? conversationsForSeat(s, seat.id) : []), [s, seat])
  const counts = useMemo(() => Object.fromEntries(VIEWS.map((v) => [v.key, applyView(rows, v.key, idleDays).length])), [rows, idleDays])
  const visible = useMemo(
    () => applyFilters(applyView(rows, view, idleDays), s, filters).filter((r) => !hidden[r.conv.id] || r.conv.lastMessageAt > hidden[r.conv.id]),
    [rows, view, idleDays, s, filters, hidden],
  )
  const current = rows.find((r) => r.conv.id === convId)
  const menuRow = menu ? rows.find((r) => r.conv.id === menu.convId) : undefined

  // 没选会话时默认打开当前视图第一条
  useEffect(() => {
    if (!convId && visible[0]) nav(`/workbench/chat/${visible[0].conv.id}`, { replace: true })
  }, [convId, visible, nav])

  // 打开会话即标已读
  useEffect(() => {
    if (convId && seat) s.markRead(convId, seat.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId, seat?.id])

  // 快捷键（P1）：⌘⌥↑/↓ 切会话，⌘⇧F 聚焦列表搜索，⌘⌥R 标记已读
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        const i = visible.findIndex((r) => r.conv.id === convId)
        const next = visible[e.key === 'ArrowUp' ? Math.max(0, i - 1) : Math.min(visible.length - 1, i + 1)]
        if (next) nav(`/workbench/chat/${next.conv.id}`)
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        searchRef.current?.querySelector('input')?.focus()
      }
      if (mod && e.altKey && e.key.toLowerCase() === 'r' && convId && seat) {
        e.preventDefault()
        s.markRead(convId, seat.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, convId, nav, s, seat])

  const closeMenu = useCallback(() => setMenu(null), [])

  if (!seat || !staff) {
    return <Empty className="h-full" text="当前员工没有持有任何坐席。让管理员在「坐席」页把一个坐席交接给他，这里就会出现会话。" />
  }
  const currentGroup = current && current.conv.kind !== 'dm' ? s.chatGroups.find((g) => g.id === current.conv.chatGroupId) : undefined

  return (
    <div className="flex h-full">
      {/* 左：会话列表 */}
      <aside className="flex w-80 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="grid grid-cols-4 border-b border-zinc-200">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              title={v.hint(idleDays)}
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
        <FilterBar f={filters} onChange={setFilters} searchRef={searchRef} />
        <div className="thin-scroll flex-1 overflow-y-auto">
          {visible.length === 0 && <Empty text={view === 'waiting' && filters === EMPTY_FILTERS ? '没有等待回复的客户' : '没有匹配的会话'} />}
          {visible.map((r) => (
            <ConvItem
              key={r.conv.id}
              row={r}
              active={r.conv.id === convId}
              view={view}
              onClick={() => nav(`/workbench/chat/${r.conv.id}`)}
              onContextMenu={(e) => {
                e.preventDefault()
                setMenu({ x: e.clientX, y: e.clientY, convId: r.conv.id })
              }}
            />
          ))}
        </div>
        <div className="border-t border-zinc-100 px-3 py-1.5 text-[10px] text-zinc-400">
          以「{seat.displayName}」身份 · 只看得到本坐席的会话 · 右键会话有操作 · <Pill>P1</Pill> ⌘⌥↑↓ 切会话，⌘⇧F 搜列表，⌘F 搜会话内
        </div>
      </aside>

      {/* 中：聊天区 */}
      <section className="flex min-w-0 flex-1 flex-col bg-zinc-50">{current ? <ChatArea key={current.conv.id} row={current} seat={seat} /> :<Empty className="h-full" text="选择一条会话" />}</section>

      {/* 右：资料卡 */}
      <aside id="wb-right-panel" className="thin-scroll w-80 shrink-0 overflow-y-auto border-l border-zinc-200 bg-white">
        {current?.conv.kind === 'dm' && current.customer && <CustomerCard customerId={current.customer.id} />}
        {currentGroup && (
          <>
            <GroupCard
              group={currentGroup}
              actor={{ seatId: seat.id, staffId: staff.id }}
              perm={(p) => seatGroupPerm(s, currentGroup, seat.id, staff.id, p)}
              compact
              officialEditable={can('manage_groups')}
              canViewAllCustomers={can('view_all_customers')}
            />
            <div className="px-4 py-3">
              <Note>按钮按 12 文档的 8 项管理员权限显示：群主全有；管理员按任命时勾选的项；员工角色有「管理所有群」的不看群内角色。没权限的面板折叠并写明缺哪项。</Note>
            </div>
          </>
        )}
      </aside>

      {menu && menuRow && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          row={menuRow}
          seat={seat}
          onClose={closeMenu}
          onDeleteLocal={() => {
            setHidden((h) => ({ ...h, [menuRow.conv.id]: menuRow.conv.lastMessageAt }))
            if (menuRow.conv.id === convId) nav('/workbench/chat', { replace: true })
          }}
        />
      )}
    </div>
  )
}
