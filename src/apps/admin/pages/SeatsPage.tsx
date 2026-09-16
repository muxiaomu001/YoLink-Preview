import { useMemo, useState, type ReactNode } from 'react'
import { ArrowLeftRight, Plus } from 'lucide-react'
import type { Seat } from '@/domain/types'
import { seatIdsOf } from '@/domain/allocation'
import { fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { customersOfSeat, staffById } from '@/store/selectors'
import { Button } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, SeatAvatar, Table, type Column } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { HandoverModal, SeatEditModal } from './SeatsPage.parts'

export function SeatsPage() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [handover, setHandover] = useState<Seat | null>(null)
  const [editing, setEditing] = useState<Seat | null>(null)
  const [creating, setCreating] = useState(false)

  const rows = useMemo(
    () =>
      s.seats.map((seat) => {
        const customers = customersOfSeat(s, seat.id).length
        return {
          seat,
          operator: staffById(s, seat.operatorStaffId),
          groups: s.inviteGroups
            .filter((g) => seatIdsOf(g).includes(seat.id))
            .map((g) => ({ name: g.name, rotating: g.rotatingSeatIds.includes(seat.id) })),
          customers,
          off: seat.status === 'disabled',
        }
      }),
    [s],
  )
  type Row = (typeof rows)[number]
  /** 停用的坐席整行灰显 */
  const dim = (r: Row, node: ReactNode) => <span className={r.off ? 'opacity-40' : ''}>{node}</span>

  const pause = (seat: Seat) => {
    s.updateSeat(seat.id, { status: 'paused' }, admin)
    toast(`「${seat.displayName}」已暂停接新：不再分新客户，已有客户的会话仍归它`)
  }
  const resume = (seat: Seat) => {
    s.updateSeat(seat.id, { status: 'accepting' }, admin)
    toast(`「${seat.displayName}」已恢复接新`)
  }
  const disable = async (seat: Seat) => {
    const ok = await confirm({
      title: `停用坐席「${seat.displayName}」？`,
      body: '停用后不再分新客户，也不能再交接；客户侧会话保留但不再有人回复。离职或轮岗请用「交接」，不要停用。',
      okText: '停用',
      danger: true,
    })
    if (!ok) return
    s.updateSeat(seat.id, { status: 'disabled' }, admin)
    toast(`「${seat.displayName}」已停用`)
  }

  const columns: Column<Row>[] = [
    { key: 'avatar', title: '头像', width: '48px', render: (r) => dim(r, <SeatAvatar seat={r.seat} size={30} />) },
    { key: 'name', title: '显示名', render: (r) => dim(r, <span className="font-medium text-zinc-900">{r.seat.displayName}</span>) },
    { key: 'roleDesc', title: '职能说明', render: (r) => dim(r, <span className="text-zinc-600">{r.seat.roleDesc || '-'}</span>) },
    {
      key: 'operator',
      title: '当前实操员工',
      render: (r) =>
        dim(
          r,
          r.operator ? (
            <span className={r.operator.status === 'disabled' ? 'text-red-600' : ''}>
              {r.operator.name}
              {r.operator.status === 'disabled' && '（已停用）'}
            </span>
          ) : (
            <Pill tone="red">无人实操</Pill>
          ),
        ),
    },
    {
      key: 'groups',
      title: '所在邀请组',
      render: (r) =>
        dim(
          r,
          r.groups.length ? (
            <div className="flex flex-wrap gap-1">
              {r.groups.map((g) => (
                <span key={g.name} className="inline-flex items-center gap-1 rounded border border-zinc-200 px-1.5 py-0.5 text-[11px] text-zinc-600">
                  {g.name}
                  <span className={g.rotating ? 'text-brand-700' : 'text-zinc-400'}>{g.rotating ? '轮询' : '固定'}</span>
                </span>
              ))}
            </div>
          ) : (
            <span className="text-zinc-400">未加入任何组</span>
          ),
        ),
    },
    {
      key: 'customers',
      title: '客户数',
      align: 'right',
      render: (r) => dim(r, <span className="tabular-nums">{r.customers}</span>),
    },
    {
      key: 'status',
      title: '状态',
      render: (r) => (r.seat.status === 'accepting' ? <Pill tone="green">接新中</Pill> : r.seat.status === 'paused' ? <Pill tone="amber">暂停接新</Pill> : <Pill tone="red">停用</Pill>),
    },
    {
      key: 'ops',
      title: '操作',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" disabled={r.off} onClick={() => setEditing(r.seat)}>
            编辑
          </Button>
          <Button size="sm" variant="secondary" disabled={r.off} onClick={() => setHandover(r.seat)}>
            <ArrowLeftRight size={12} /> 交接
          </Button>
          {r.seat.status === 'accepting' && (
            <Button size="sm" variant="ghost" onClick={() => pause(r.seat)}>
              暂停接新
            </Button>
          )}
          {r.seat.status === 'paused' && (
            <Button size="sm" variant="ghost" onClick={() => resume(r.seat)}>
              恢复接新
            </Button>
          )}
          {!r.off && (
            <Button size="sm" variant="danger" onClick={() => void disable(r.seat)}>
              停用
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="坐席"
        desc="坐席是客户看到的官方身份：头像、显示名、职能说明。它不能登录，由员工实操。换人走「交接」，显示名与头像不变，客户零感知。"
        extra={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={14} /> 创建坐席
          </Button>
        }
      />
      <Note>
        坐席与员工账号是两样东西。<b>客户绑的是坐席</b>，员工离职不需要「转移客户」，把坐席交接给新人即可。一个员工可以同时持有多个坐席（陈默同时是「陈顾问」和「客户服务」）。
        <b>人员变更：离职、轮岗、休假走坐席交接，不是转移客户；短期休假用暂停接新。</b>
      </Note>
      <Card className="mt-4" padded={false}>
        <Table rows={rows} columns={columns} rowKey={(r) => r.seat.id} />
      </Card>

      <Card className="mt-4" title="坐席交接记录（永久保留，不可删改）" padded={false}>
        <Table
          rows={[...s.handovers].sort((a, b) => b.at.localeCompare(a.at))}
          rowKey={(h) => h.id}
          dense
          columns={[
            { key: 'at', title: '时间', render: (h) => <span className="tabular-nums text-zinc-600">{fmtDateTime(h.at)}</span> },
            { key: 'seat', title: '坐席', render: (h) => s.seats.find((x) => x.id === h.seatId)?.displayName ?? '-' },
            { key: 'from', title: '前任', render: (h) => staffById(s, h.fromStaffId)?.name ?? '无' },
            { key: 'to', title: '新任', render: (h) => <span className="font-medium">{staffById(s, h.toStaffId)?.name}</span> },
            { key: 'by', title: '操作人', render: (h) => staffById(s, h.byStaffId)?.name },
            { key: 'reason', title: '原因', render: (h) => <span className="text-zinc-600">{h.reason}</span> },
          ]}
        />
      </Card>

      {handover && <HandoverModal seat={handover} onClose={() => setHandover(null)} />}
      {editing && <SeatEditModal seat={editing} onClose={() => setEditing(null)} />}
      {creating && <SeatEditModal onClose={() => setCreating(false)} />}
    </div>
  )
}
