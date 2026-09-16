/**
 * 管理后台的全量客户列表（管理员视角；工作台那个是员工视角）。
 * 筛选（含账号状态）、批量挂头衔、详情（账号管控、改主归属、注销）。
 * 状态口径与工作台资料卡共用 domain/customerStatus，不再是后台只认「正常 / 已注销」两种。
 */
import { useMemo, useState } from 'react'
import { Award } from 'lucide-react'
import type { Customer, InviteGroup, Seat, Tag, Title } from '@/domain/types'
import { fmtAgo, fmtDate } from '@/domain/time'
import { STATUS_FILTER_OPTIONS, customerStatusFlags, matchesStatusFilter, type CustomerStatusFilter } from '@/domain/customerStatus'
import { useStore } from '@/store/store'
import { holdsPrimary, primarySeatOfCustomer } from '@/store/selectors'
import { Button, Checkbox, Input, Select } from '@/ui/primitives'
import { Avatar, Card, Note, PageHeader, Pill, Table, TagChip, TitleChip, type Column } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { DemoLevelTag, DemoNote } from '@/ui/DemoNote'
import { confirm } from '@/ui/confirm'
import { CustomerDetailModal } from './CustomersAdminPage.parts'

interface Row {
  c: Customer
  primarySeat?: Seat
  group?: InviteGroup
  titles: Title[]
  tags: Tag[]
}

/** 表格里内部标签最多显示几个，其余折成 +N */
const TAG_SHOWN = 3

export function CustomersAdminPage() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [q, setQ] = useState('')
  const [groupId, setGroupId] = useState('')
  const [seatId, setSeatId] = useState('')
  const [titleId, setTitleId] = useState('')
  const [tagId, setTagId] = useState('')
  const [status, setStatus] = useState<CustomerStatusFilter>('')
  const [selected, setSelected] = useState<string[]>([])
  const [bulkTitle, setBulkTitle] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)

  const rows = useMemo<Row[]>(() => {
    const kw = q.trim().toLowerCase()
    return s.customers
      .map((c) => ({
        c,
        primarySeat: primarySeatOfCustomer(s, c.id),
        group: s.inviteGroups.find((g) => g.id === c.inviteGroupId),
        titles: c.titleIds.map((id) => s.titles.find((t) => t.id === id)).filter((t) => !!t),
        tags: c.tagIds.map((id) => s.tags.find((t) => t.id === id)).filter((t) => !!t),
      }))
      .filter((r) => !kw || r.c.nickname.toLowerCase().includes(kw) || r.c.accountId.toLowerCase().includes(kw) || (r.c.phone ?? '').includes(kw))
      .filter((r) => !groupId || r.c.inviteGroupId === groupId)
      .filter((r) => !seatId || r.primarySeat?.id === seatId)
      .filter((r) => !titleId || r.c.titleIds.includes(titleId))
      .filter((r) => !tagId || r.c.tagIds.includes(tagId))
      .filter((r) => matchesStatusFilter(r.c, status))
      .sort((a, b) => b.c.registeredAt.localeCompare(a.c.registeredAt))
  }, [s, q, groupId, seatId, titleId, tagId, status])

  const visibleIds = rows.map((r) => r.c.id)
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id))
  const toggleAll = (on: boolean) => setSelected(on ? Array.from(new Set([...selected, ...visibleIds])) : selected.filter((id) => !visibleIds.includes(id)))
  const toggleOne = (id: string, on: boolean) => setSelected(on ? [...selected, id] : selected.filter((x) => x !== id))

  const enabledTitles = s.titles.filter((t) => t.enabled)

  const bulkAssign = async () => {
    const t = s.titles.find((x) => x.id === bulkTitle)
    if (!t || !selected.length) return
    const ok = await confirm({
      title: `给 ${selected.length} 位客户挂头衔「${t.name}」？`,
      body: '已有该头衔或已满 5 个头衔的客户会自动跳过。头衔对客户可见，客户端立即刷新；每次挂头衔都记审计日志。',
      okText: '挂头衔',
    })
    if (!ok) return
    const n = s.bulkAssignTitle(selected, bulkTitle, admin)
    const skipped = selected.length - n
    toast(n ? `已给 ${n} 位客户挂上「${t.name}」${skipped ? `，${skipped} 位跳过（已有或已满 5 个）` : ''}` : '没有客户需要挂：都已有该头衔或已满 5 个', n ? 'ok' : 'warn')
    setSelected([])
    setBulkTitle('')
  }

  const columns: Column<Row>[] = [
    {
      key: 'sel',
      title: <Checkbox checked={allSelected} onChange={toggleAll} />,
      width: '36px',
      render: (r) => <Checkbox checked={selected.includes(r.c.id)} onChange={(on) => toggleOne(r.c.id, on)} />,
    },
    {
      key: 'customer',
      title: '客户',
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <Avatar text={r.c.nickname} size={30} />
          <div>
            <div className={r.c.deletedAt ? 'text-zinc-400 line-through' : 'font-medium text-zinc-900'}>{r.c.nickname}</div>
            <div className="text-[11px] tabular-nums text-zinc-500">{r.c.accountId}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'titles',
      title: '头衔',
      render: (r) => {
        const main = r.titles.find((t) => t.id === r.c.primaryTitleId) ?? r.titles[0]
        if (!main) return <span className="text-zinc-300">-</span>
        const rest = r.titles.length - 1
        return (
          <span className="inline-flex items-center gap-1">
            <TitleChip title={main} size="xs" />
            {rest > 0 && <span className="text-[11px] text-zinc-400">+{rest}</span>}
          </span>
        )
      },
    },
    {
      key: 'tags',
      title: '内部标签',
      render: (r) =>
        r.tags.length ? (
          <span className="inline-flex flex-wrap items-center gap-1">
            {r.tags.slice(0, TAG_SHOWN).map((t) => (
              <TagChip key={t.id} tag={t} />
            ))}
            {r.tags.length > TAG_SHOWN && <span className="text-[11px] text-zinc-400">+{r.tags.length - TAG_SHOWN}</span>}
          </span>
        ) : (
          <span className="text-zinc-300">-</span>
        ),
    },
    { key: 'seat', title: '主归属坐席', render: (r) => r.primarySeat?.displayName ?? <span className="text-red-600">无</span> },
    { key: 'group', title: '邀请组', render: (r) => <span className="text-zinc-600">{r.group?.name ?? '-'}</span> },
    { key: 'reg', title: '注册时间', width: '100px', render: (r) => <span className="tabular-nums text-zinc-500">{fmtDate(r.c.registeredAt)}</span> },
    { key: 'active', title: '最近活跃', width: '90px', render: (r) => <span className="text-zinc-500">{fmtAgo(r.c.lastActiveAt)}</span> },
    {
      key: 'status',
      title: '状态',
      width: '132px',
      render: (r) => {
        const flags = customerStatusFlags(r.c)
        if (!flags.length) return <Pill tone="green">正常</Pill>
        return (
          <span className="flex flex-wrap gap-1">
            {flags.map((f) => (
              <span key={f.key} title={f.title}>
                <Pill tone={f.tone}>{f.label}</Pill>
              </span>
            ))}
          </span>
        )
      },
    },
    {
      key: 'ops',
      title: '操作',
      align: 'right',
      width: '70px',
      render: (r) => (
        <Button size="sm" variant="ghost" onClick={() => setDetailId(r.c.id)}>
          详情
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="客户列表" desc="全企业客户。员工在工作台只能看到自己坐席主归属的客户。" />
      <Note>头衔是官方发给客户、所有人可见的；内部标签只有员工看得到。批量挂头衔每个客户最多 5 个，超了自动跳过。重置密码、强制下线、封禁、全群禁言、全局禁言、改主归属与注销都在「详情」里。</Note>
      <DemoNote className="mt-2">
        状态列与工作台资料卡是同一份判断：封禁、全局禁言、全群禁言、待首次改密会同时显示，一个客户可以同时占几项。改主归属与注销排在第二版<DemoLevelTag level="P1" />。
      </DemoNote>

      <Card className="mt-4" title="筛选">
        <div className="flex flex-wrap items-end gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="昵称 / 账号 ID / 手机号" className="w-48" />
          <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="w-40">
            <option value="">全部邀请组</option>
            {s.inviteGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
          <Select value={seatId} onChange={(e) => setSeatId(e.target.value)} className="w-40">
            <option value="">全部主归属坐席</option>
            {s.seats
              .filter((x) => holdsPrimary(s, x.id))
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.displayName}
                </option>
              ))}
          </Select>
          <Select value={titleId} onChange={(e) => setTitleId(e.target.value)} className="w-36">
            <option value="">全部头衔</option>
            {s.titles.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Select value={tagId} onChange={(e) => setTagId(e.target.value)} className="w-36">
            <option value="">全部内部标签</option>
            {s.tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value as CustomerStatusFilter)} className="w-32" title="正常 = 没有封禁、全局禁言、全群禁言、待改密、注销中的任何一项">
            {STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <span className="ml-auto text-xs text-zinc-500">共 {rows.length} 位</span>
        </div>
      </Card>

      {selected.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-brand-200 bg-brand-50/60 px-3 py-2 text-xs text-brand-900">
          <span className="font-medium">已选 {selected.length} 位客户</span>
          <Select value={bulkTitle} onChange={(e) => setBulkTitle(e.target.value)} className="w-40">
            <option value="">选择头衔</option>
            {enabledTitles.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Button variant="primary" size="sm" disabled={!bulkTitle} onClick={() => void bulkAssign()}>
            <Award size={12} /> 批量挂头衔
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
            取消选择
          </Button>
        </div>
      )}

      <Card className="mt-3" padded={false}>
        <Table rows={rows} rowKey={(r) => r.c.id} columns={columns} empty="没有符合条件的客户" />
      </Card>

      {detailId && <CustomerDetailModal customerId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}
