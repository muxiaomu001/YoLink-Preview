/**
 * 会话页：左侧三个视图 + 搜索 / 筛选 + 会话列表（右键菜单、快捷键），中间聊天区，右侧两个页签「资料」（客户资料卡 / 群信息卡）「话术」（话术库面板）。
 * 左右两栏可拖宽、右栏可收起，宽度、收起状态与右栏页签记在本机（useLocalPref）。打开会话自动标已读。
 * 话术面板的发送 / 填入通过 ChatArea 的 ref（ChatAreaHandle）作用到当前会话。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { UserRound, Zap } from 'lucide-react'
import { seatGroupPerm } from '@/store/policy'
import { applyView, conversationsForSeat, type WorkbenchView } from '@/store/selectors'
import { Empty } from '@/ui/display'
import { useWorkbench } from '../useWorkbench'
import { useLocalPref } from '../useLocalPref'
import { ChatArea, type ChatAreaHandle } from '../components/ChatArea'
import { sendBlockReason } from '../components/ChatArea.shared'
import { CustomerCard } from '../components/CustomerCard'
import { GroupCard } from '../components/group/GroupCard'
import { ResizeHandle } from '../components/layout/ResizeHandle'
import { QuickReplyPanel } from '../components/quick-replies/QuickReplyPanel'
import type { QuickReplyTarget } from '../components/quick-replies/shared'
import { ContextMenu, ConvItem, FilterBar } from './ChatPage.parts'
import { activeFilterCount, applyFilters, EMPTY_FILTERS, VIEWS, type Filters } from './ChatPage.shared'

const LEFT = { def: 320, min: 260, max: 420 }
const RIGHT = { def: 380, min: 300, max: 480 }

type RightTab = 'profile' | 'quick'
const RIGHT_TABS: { key: RightTab; label: string; icon: typeof UserRound; hint: string }[] = [
  { key: 'profile', label: '资料', icon: UserRound, hint: '客户资料卡 / 群信息' },
  { key: 'quick', label: '话术', icon: Zap, hint: '话术库：搜索、发送、填入；个人话术在这里新建' },
]

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
  const chatRef = useRef<ChatAreaHandle>(null)
  const idleDays = s.policyNumbers.idleDays

  // 本机界面偏好：左右栏宽、右栏是否收起
  const [leftW, setLeftW] = useLocalPref('chat.leftWidth', LEFT.def)
  const [rightW, setRightW] = useLocalPref('chat.rightWidth', RIGHT.def)
  const [rightOpen, setRightOpen] = useLocalPref('chat.rightOpen', true)
  const [rightTab, setRightTab] = useLocalPref<RightTab>('chat.rightTab', 'profile')

  const rows = useMemo(() => (seat ? conversationsForSeat(s, seat.id) : []), [s, seat])
  const counts = useMemo(() => Object.fromEntries(VIEWS.map((v) => [v.key, applyView(rows, v.key).length])), [rows])
  const visible = useMemo(
    () => applyFilters(applyView(rows, view), s, filters, idleDays).filter((r) => !hidden[r.conv.id] || r.conv.lastMessageAt > hidden[r.conv.id]),
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

  // 快捷键：⌘⌥↑/↓ 切会话，⌘⇧F 聚焦列表搜索，⌘⌥R 标记已读
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
  const toggleRight = useCallback(() => setRightOpen((v) => !v), [setRightOpen])
  /** 群顶栏「N 位成员」：右栏收起时先展开并切到「资料」，再滚到顶部 */
  const showGroupInfo = useCallback(() => {
    setRightOpen(true)
    setRightTab('profile')
    window.setTimeout(() => document.getElementById('wb-right-panel')?.scrollTo({ top: 0, behavior: 'smooth' }), 0)
  }, [setRightOpen, setRightTab])

  if (!seat || !staff) {
    return <Empty className="h-full" text="当前员工没有持有任何坐席。让管理员在「坐席」页把一个坐席交接给他，这里就会出现会话。" />
  }
  const currentGroup = current && current.conv.kind !== 'dm' ? s.chatGroups.find((g) => g.id === current.conv.chatGroupId) : undefined
  const noFilter = activeFilterCount(filters) === 0 && !filters.q.trim()
  // 话术面板对当前会话的发送能力：能不能发、为什么不能，以及三个动作（转交给聊天区）
  const quickTarget: QuickReplyTarget = {
    active: !!current,
    blockReason: current ? sendBlockReason(s, current, seat, staff.id) : undefined,
    customerName: current?.customer?.nickname,
    sendText: (t) => chatRef.current?.sendText(t),
    sendMedia: (k, m, t) => chatRef.current?.sendMedia(k, m, t),
    insertText: (t) => chatRef.current?.insertText(t),
  }

  return (
    <div className="flex h-full">
      {/* 左：会话列表 */}
      <aside className="flex shrink-0 flex-col border-r border-zinc-200 bg-white" style={{ width: leftW }}>
        <div className="grid grid-cols-3 border-b border-zinc-200">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              title={v.hint(idleDays)}
              onClick={() => setView(v.key)}
              className={clsx('flex items-center justify-center gap-1.5 border-b-2 py-2.5 text-[12px]', view === v.key ? 'border-brand-700 font-medium text-brand-800' : 'border-transparent text-zinc-500 hover:text-zinc-800')}
            >
              <v.icon size={14} />
              {v.label}
              <span className={clsx('rounded-full px-1.5 text-[11px] leading-4 tabular-nums', view === v.key ? 'bg-brand-100 text-brand-800' : 'bg-zinc-100 text-zinc-500')}>{counts[v.key]}</span>
            </button>
          ))}
        </div>
        <FilterBar f={filters} onChange={setFilters} searchRef={searchRef} />
        <div className="thin-scroll flex-1 overflow-y-auto">
          {visible.length === 0 && <Empty text={view === 'waiting' && noFilter ? '没有等待回复的客户' : '没有匹配的会话'} />}
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
      </aside>
      <ResizeHandle side="left" width={leftW} min={LEFT.min} max={LEFT.max} onResize={setLeftW} />

      {/* 中：聊天区 */}
      <section className="flex min-w-0 flex-1 flex-col bg-zinc-50">
        {current ? <ChatArea key={current.conv.id} ref={chatRef} row={current} seat={seat} rightOpen={rightOpen} onToggleRight={toggleRight} onGroupInfo={showGroupInfo} /> : <Empty className="h-full" text="选择一条会话" />}
      </section>

      {/* 右：资料 / 话术两个页签（可收起） */}
      {rightOpen && (
        <>
          <ResizeHandle side="right" width={rightW} min={RIGHT.min} max={RIGHT.max} onResize={setRightW} />
          <aside className="flex shrink-0 flex-col border-l border-zinc-200 bg-white" style={{ width: rightW }}>
            <div className="grid shrink-0 grid-cols-2 border-b border-zinc-200">
              {RIGHT_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  title={tab.hint}
                  onClick={() => setRightTab(tab.key)}
                  className={clsx('flex items-center justify-center gap-1.5 border-b-2 py-2.5 text-[12px]', rightTab === tab.key ? 'border-brand-700 font-medium text-brand-800' : 'border-transparent text-zinc-500 hover:text-zinc-800')}
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              ))}
            </div>
            {rightTab === 'quick' ? (
              <QuickReplyPanel target={quickTarget} />
            ) : (
              <div id="wb-right-panel" className="thin-scroll min-h-0 flex-1 overflow-y-auto">
                {!current && <Empty className="h-full" text="选择一条会话后显示资料" />}
                {current?.conv.kind === 'dm' && current.customer && <CustomerCard customerId={current.customer.id} />}
                {currentGroup && (
                  <GroupCard
                    group={currentGroup}
                    actor={{ seatId: seat.id, staffId: staff.id }}
                    perm={(p) => seatGroupPerm(s, currentGroup, seat.id, staff.id, p)}
                    compact
                    officialEditable={can('manage_groups')}
                    canViewAllCustomers={can('view_all_customers')}
                  />
                )}
              </div>
            )}
          </aside>
        </>
      )}

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
