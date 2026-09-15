/**
 * 客户列表页（04 文档）：我的客户 / 全部客户两个标签、搜索、可折叠的高级筛选、
 * 按 PRD 的表格列与排序、批量打标签 / 批量拉群、一键群发入口、导出 CSV。
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Search, Send, SlidersHorizontal } from 'lucide-react'
import type { Customer } from '@/domain/types'
import { fmtAgo, fmtDate } from '@/domain/time'
import { activeCustomers, customersOfSeat, primarySeatOfCustomer, staffById } from '@/store/selectors'
import { Button, Input } from '@/ui/primitives'
import { Avatar, Card, Note, Pill, SeatAvatar, Table, Tabs, TagChip, TitleChip } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { useWorkbench } from '../useWorkbench'
import { BulkGroupModal, BulkTagModal, EMPTY_FILTER, FilterPanel, SortHeader, advancedFilterCount, applyFilter, exportCustomersCsv, isFilterActive, sortCustomers, type CustomerFilter, type SortState } from './CustomersPage.parts'

export function CustomersPage() {
  const { s, staff, seat, can } = useWorkbench()
  const nav = useNavigate()
  const [tab, setTab] = useState<'mine' | 'all'>('mine')
  const [filter, setFilter] = useState<CustomerFilter>(EMPTY_FILTER)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [sort, setSort] = useState<SortState>({ key: 'lastActiveAt', dir: 'desc' })
  const [selected, setSelected] = useState<string[]>([])
  const [bulk, setBulk] = useState<'tag' | 'group' | null>(null)

  const mine = useMemo(() => (seat ? customersOfSeat(s, seat.id).filter((c) => !c.deletedAt) : []), [s, seat])
  const base = tab === 'mine' ? mine : activeCustomers(s)
  const rows = useMemo(() => sortCustomers(applyFilter(base, filter), sort), [base, filter, sort])
  const products = useMemo(() => Array.from(new Set(base.flatMap((c) => c.purchases.map((p) => p.product)))), [base])
  const roles = useMemo(() => Array.from(new Set(base.map((c) => c.roleLabel).filter((r): r is string => !!r))), [base])
  const allChecked = rows.length > 0 && rows.every((c) => selected.includes(c.id))
  const advancedCount = advancedFilterCount(filter)
  const canBroadcast = can('broadcast') && s.enterprise.modules.broadcast

  /** 聊天：优先本坐席与该客户的私聊；不是本坐席的客户则切到主归属坐席（须本人持有） */
  const openChat = (c: Customer) => {
    const own = seat && s.conversations.find((x) => x.kind === 'dm' && x.customerId === c.id && x.seatId === seat.id)
    if (own) return nav(`/workbench/chat/${own.id}`)
    const ps = primarySeatOfCustomer(s, c.id)
    if (!ps) return toast('该客户没有主归属坐席', 'warn')
    if (ps.operatorStaffId !== staff?.id) return toast(`该客户主归属「${ps.displayName}」，不是你持有的坐席，只能查看资料`, 'warn')
    const conv = s.conversations.find((x) => x.kind === 'dm' && x.customerId === c.id && x.seatId === ps.id)
    if (!conv) return toast('找不到该客户与主归属坐席的会话', 'warn')
    s.setSession({ workbenchSeatId: ps.id })
    toast(`已切换到坐席身份「${ps.displayName}」`, 'info')
    nav(`/workbench/chat/${conv.id}`)
  }
  const toggleBlack = async (c: Customer) => {
    const on = !c.blacklistedAt
    const ok = await confirm({ title: on ? `拉黑「${c.nickname}」？` : `解除「${c.nickname}」的拉黑？`, body: on ? '拉黑后客户无法发消息，群发自动跳过。' : '解除后客户可以重新发消息。', okText: on ? '拉黑' : '解除', danger: on })
    if (!ok || !staff) return
    s.setCustomerBlacklist(c.id, on, staff.id)
    toast(on ? '已拉黑' : '已解除拉黑')
  }

  return (
    <div className="thin-scroll h-full overflow-y-auto p-5">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-zinc-200">
        <Tabs
          className="-mb-px"
          value={tab}
          onChange={(t) => {
            setTab(t)
            setSelected([])
          }}
          items={[
            { key: 'mine', label: '我的客户', count: mine.length },
            { key: 'all', label: can('view_all_customers') ? '全部客户' : '全部客户（无权限）', count: can('view_all_customers') ? activeCustomers(s).length : undefined },
          ]}
        />
        <div className="flex items-center gap-2 pb-1.5">
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute top-2.5 left-2.5 text-zinc-400" />
            <Input value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} placeholder="搜昵称、账号 ID" className="w-52 pl-7" />
          </div>
          <Button size="sm" className={advancedCount > 0 ? 'border-brand-300 text-brand-700' : ''} title="展开 / 收起高级筛选" onClick={() => setAdvancedOpen((v) => !v)}>
            <SlidersHorizontal size={13} /> 高级筛选
            {advancedCount > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[11px] leading-4 text-white tabular-nums">{advancedCount}</span>}
          </Button>
          {canBroadcast && (
            <Button size="sm" variant="primary" title={`给「${seat?.displayName ?? ''}」的全部好友发一条私聊`} onClick={() => nav('/workbench/broadcast?target=friends')}>
              <Send size={13} /> 一键群发
            </Button>
          )}
          <Button size="sm" disabled={!can('export_customers') || rows.length === 0} title={can('export_customers') ? '导出当前筛选结果' : '需员工角色能力 export_customers'} onClick={() => staff && exportCustomersCsv(s, rows, staff.id)}>
            <Download size={13} /> 导出 CSV
          </Button>
        </div>
      </div>
      {tab === 'all' && !can('view_all_customers') ? (
        <Note tone="amber">当前员工角色没有 view_all_customers 能力，只能看自己持有坐席主归属的客户。管理员在「员工角色」里改。</Note>
      ) : (
        <>
          {advancedOpen && <FilterPanel f={filter} onChange={setFilter} products={products} roles={roles} />}
          {selected.length > 0 && (
            <div className="mb-2 flex items-center gap-2 rounded-md border border-brand-100 bg-brand-50/60 px-3 py-1.5 text-[12px] text-brand-900">
              已选 {selected.length} 人
              <Button size="sm" onClick={() => setBulk('group')}>
                批量拉群
              </Button>
              <Button size="sm" onClick={() => setBulk('tag')}>
                批量打标签
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                取消选择
              </Button>
            </div>
          )}
          <Card padded={false} title={`${rows.length} 位客户`} extra={isFilterActive(filter) ? <span className="text-[11px] text-zinc-400">已按筛选条件过滤</span> : undefined}>
            <Table
              rows={rows}
              rowKey={(c) => c.id}
              empty="没有符合条件的客户"
              columns={[
                {
                  key: 'sel',
                  title: <input type="checkbox" className="accent-brand-700" checked={allChecked} onChange={(e) => setSelected(e.target.checked ? rows.map((c) => c.id) : [])} />,
                  width: '32px',
                  render: (c) => <input type="checkbox" className="accent-brand-700" checked={selected.includes(c.id)} onChange={(e) => setSelected((l) => (e.target.checked ? [...l, c.id] : l.filter((x) => x !== c.id)))} />,
                },
                { key: 'avatar', title: '头像', width: '44px', render: (c) => <Avatar text={c.nickname} size={26} /> },
                {
                  key: 'nickname',
                  title: <SortHeader label="昵称" k="nickname" sort={sort} onChange={setSort} />,
                  render: (c) => (
                    <span className="inline-flex items-center gap-1 text-zinc-900">
                      {c.nickname}
                      {c.blacklistedAt && <Pill tone="red">已拉黑</Pill>}
                    </span>
                  ),
                },
                { key: 'account', title: '账号 ID', render: (c) => <span className="font-mono text-[12px] text-zinc-500">{c.accountId}</span> },
                {
                  key: 'tags',
                  title: '标签',
                  render: (c) => (
                    <div className="flex flex-wrap gap-1">
                      {c.tagIds.map((tid) => {
                        const t = s.tags.find((x) => x.id === tid)
                        return t ? <TagChip key={tid} tag={t} /> : null
                      })}
                    </div>
                  ),
                },
                {
                  key: 'title',
                  title: '主头衔',
                  render: (c) => {
                    const t = c.primaryTitleId ? s.titles.find((x) => x.id === c.primaryTitleId && x.enabled) : undefined
                    return t ? <TitleChip title={t} /> : <span className="text-zinc-300">-</span>
                  },
                },
                { key: 'reg', title: <SortHeader label="注册时间" k="registeredAt" sort={sort} onChange={setSort} />, render: (c) => <span className="tabular-nums text-zinc-500">{fmtDate(c.registeredAt)}</span> },
                { key: 'active', title: <SortHeader label="最近活跃" k="lastActiveAt" sort={sort} onChange={setSort} />, render: (c) => <span className="text-zinc-500">{fmtAgo(c.lastActiveAt)}</span> },
                {
                  key: 'seat',
                  title: '主归属坐席',
                  render: (c) => {
                    const ps = primarySeatOfCustomer(s, c.id)
                    const op = staffById(s, ps?.operatorStaffId)
                    return ps ? (
                      <span className="inline-flex items-center gap-1.5" title={can('view_seat_operator') ? `当前实操：${op?.name ?? '无'}` : '需 view_seat_operator 才能看实操员工'}>
                        <SeatAvatar seat={ps} size={18} /> {ps.displayName}
                      </span>
                    ) : (
                      '-'
                    )
                  },
                },
                {
                  key: 'ops',
                  title: '操作',
                  align: 'right',
                  render: (c) => (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openChat(c)}>
                        聊天
                      </Button>
                      <Button size="sm" variant="ghost" className={c.blacklistedAt ? '' : 'text-red-700'} onClick={() => void toggleBlack(c)}>
                        {c.blacklistedAt ? '解除拉黑' : '拉黑'}
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}

      {bulk === 'tag' && <BulkTagModal ids={selected} onClose={() => setBulk(null)} />}
      {bulk === 'group' && <BulkGroupModal ids={selected} onClose={() => setBulk(null)} />}
    </div>
  )
}
