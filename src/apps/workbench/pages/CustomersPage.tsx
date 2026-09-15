/**
 * 客户列表页（04 文档）：我的客户 / 全部客户两个标签、按 PRD 的表格列与排序、筛选器、
 * 保存分群（P1）、批量打标签（P1）/ 批量拉群、导出 CSV（P1）。
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Save } from 'lucide-react'
import type { Customer } from '@/domain/types'
import { fmtAgo, fmtDate } from '@/domain/time'
import { activeCustomers, customersOfSeat, primarySeatOfCustomer, staffById } from '@/store/selectors'
import { Button, Field, Input, Select } from '@/ui/primitives'
import { Avatar, Card, Note, PageHeader, Pill, SeatAvatar, Table, Tabs, TagChip, TitleChip } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { useWorkbench } from '../useWorkbench'
import { BulkGroupModal, BulkTagModal, EMPTY_FILTER, FilterPanel, SortHeader, applyFilter, exportCustomersCsv, isFilterActive, sortCustomers, type CustomerFilter, type SortState } from './CustomersPage.parts'

interface Segment {
  id: string
  name: string
  filter: CustomerFilter
}

export function CustomersPage() {
  const { s, staff, seat, can } = useWorkbench()
  const nav = useNavigate()
  const [tab, setTab] = useState<'mine' | 'all'>('mine')
  const [filter, setFilter] = useState<CustomerFilter>(EMPTY_FILTER)
  const [sort, setSort] = useState<SortState>({ key: 'lastActiveAt', dir: 'desc' })
  const [selected, setSelected] = useState<string[]>([])
  const [bulk, setBulk] = useState<'tag' | 'group' | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [segName, setSegName] = useState<string | null>(null)

  const mine = useMemo(() => (seat ? customersOfSeat(s, seat.id).filter((c) => !c.deletedAt) : []), [s, seat])
  const base = tab === 'mine' ? mine : activeCustomers(s)
  const rows = useMemo(() => sortCustomers(applyFilter(base, filter), sort), [base, filter, sort])
  const products = useMemo(() => Array.from(new Set(base.flatMap((c) => c.purchases.map((p) => p.product)))), [base])
  const roles = useMemo(() => Array.from(new Set(base.map((c) => c.roleLabel).filter((r): r is string => !!r))), [base])
  const allChecked = rows.length > 0 && rows.every((c) => selected.includes(c.id))

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
  const saveSegment = () => {
    if (!segName?.trim()) return
    setSegments((l) => [...l, { id: `seg_${Date.now()}`, name: segName.trim(), filter }])
    toast(`已保存分群「${segName.trim()}」（演示存在页面内，正式版落库）`)
    setSegName(null)
  }

  return (
    <div className="thin-scroll h-full overflow-y-auto p-5">
      <PageHeader
        title="客户"
        desc={seat ? `「我的客户」＝ 当前坐席身份「${seat.displayName}」主归属的客户。切换顶部坐席身份，这一页跟着切。已注销的客户不再出现。` : ''}
        extra={
          <>
            {segments.length > 0 && (
              <Select className="h-8 w-40 text-xs" value="" onChange={(e) => e.target.value && setFilter(segments.find((x) => x.id === e.target.value)!.filter)}>
                <option value="">套用已保存分群…</option>
                {segments.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </Select>
            )}
            <Button size="sm" disabled={!isFilterActive(filter)} title={isFilterActive(filter) ? '把当前筛选存为分群' : '先设置筛选条件'} onClick={() => setSegName('')}>
              <Save size={13} /> 保存分群 <Pill>P1</Pill>
            </Button>
            <Button size="sm" disabled={!can('export_customers') || rows.length === 0} title={can('export_customers') ? '导出当前筛选结果' : '需员工角色能力 export_customers'} onClick={() => staff && exportCustomersCsv(s, rows, staff.id)}>
              <Download size={13} /> 导出 CSV <Pill>P1</Pill>
            </Button>
          </>
        }
      />
      <Tabs
        value={tab}
        onChange={(t) => {
          setTab(t)
          setSelected([])
        }}
        className="mb-3"
        items={[
          { key: 'mine', label: '我的客户', count: mine.length },
          { key: 'all', label: can('view_all_customers') ? '全部客户' : '全部客户（无权限）', count: can('view_all_customers') ? activeCustomers(s).length : undefined },
        ]}
      />
      {tab === 'all' && !can('view_all_customers') ? (
        <Note tone="amber">当前员工角色没有 view_all_customers 能力，只能看自己持有坐席主归属的客户。管理员在「员工角色」里改。</Note>
      ) : (
        <>
          <FilterPanel f={filter} onChange={setFilter} products={products} roles={roles} />
          {selected.length > 0 && (
            <div className="mb-2 flex items-center gap-2 rounded-md border border-brand-100 bg-brand-50/60 px-3 py-1.5 text-xs text-brand-900">
              已选 {selected.length} 人
              <Button size="sm" onClick={() => setBulk('group')}>
                批量拉群
              </Button>
              <Button size="sm" onClick={() => setBulk('tag')}>
                批量打标签 <Pill>P1</Pill>
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
                    return t ? <TitleChip title={t} size="xs" /> : <span className="text-zinc-300">-</span>
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
      <Modal
        open={segName !== null}
        onClose={() => setSegName(null)}
        title="保存分群"
        width={400}
        footer={
          <>
            <Button onClick={() => setSegName(null)}>取消</Button>
            <Button variant="primary" disabled={!segName?.trim()} onClick={saveSegment}>
              保存
            </Button>
          </>
        }
      >
        <Field label="分群名称" required>
          <Input value={segName ?? ''} maxLength={20} onChange={(e) => setSegName(e.target.value)} placeholder="如：买过年卡的活跃客户" />
        </Field>
        <div className="mt-3">
          <Note>P1：分群保存的是筛选条件，不是名单快照，每次套用都按当前数据重算。演示存在页面内，正式版落库并可在群发目标里选。</Note>
        </div>
      </Modal>
    </div>
  )
}
