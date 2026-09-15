import { useMemo, useState } from 'react'
import { ArrowLeftRight, Plus } from 'lucide-react'
import type { Seat } from '@/domain/types'
import { fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { customersOfSeat, staffById } from '@/store/selectors'
import { Button, Field, Input, Select, Switch, Textarea } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, SeatAvatar, Table, type Column } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'

export function SeatsPage() {
  const s = useStore()
  const [handover, setHandover] = useState<Seat | null>(null)
  const [editing, setEditing] = useState<Seat | null>(null)
  const [creating, setCreating] = useState(false)

  const rows = useMemo(
    () =>
      s.seats.map((seat) => ({
        seat,
        operator: staffById(s, seat.operatorStaffId),
        groups: s.inviteGroups.filter((g) => g.seatIds.includes(seat.id)),
        customers: customersOfSeat(s, seat.id).length,
      })),
    [s],
  )

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'seat',
      title: '坐席（客户看到的）',
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <SeatAvatar seat={r.seat} size={30} />
          <div>
            <div className="font-medium text-zinc-900">{r.seat.displayName}</div>
            <div className="text-[11px] text-zinc-500">{r.seat.roleDesc}</div>
          </div>
        </div>
      ),
    },
    { key: 'type', title: '类型', render: (r) => (r.seat.type === 'notice' ? <Pill tone="amber">通知型</Pill> : <Pill tone="blue">分配型</Pill>) },
    {
      key: 'operator',
      title: '当前实操员工',
      render: (r) =>
        r.operator ? (
          <span className={r.operator.status === 'disabled' ? 'text-red-600' : ''}>
            {r.operator.name}
            {r.operator.status === 'disabled' && '（已停用）'}
          </span>
        ) : (
          <span className="text-red-600">无人实操</span>
        ),
    },
    { key: 'groups', title: '所在邀请组', render: (r) => (r.groups.length ? r.groups.map((g) => g.name).join('、') : <span className="text-zinc-400">未加入任何组</span>) },
    { key: 'customers', title: '主归属客户数', align: 'right', render: (r) => <span className="tabular-nums">{r.seat.type === 'notice' ? '-' : r.customers}</span> },
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
          <Button size="sm" variant="ghost" onClick={() => setEditing(r.seat)}>
            编辑
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setHandover(r.seat)}>
            <ArrowLeftRight size={12} /> 交接
          </Button>
          {r.seat.status === 'accepting' ? (
            <Button size="sm" variant="ghost" onClick={() => s.updateSeat(r.seat.id, { status: 'paused' }, s.session.adminStaffId!)}>
              暂停接新
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => s.updateSeat(r.seat.id, { status: 'accepting' }, s.session.adminStaffId!)}>
              恢复接新
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
            { key: 'seat', title: '坐席', render: (h) => staffOrSeatName(s.seats.find((x) => x.id === h.seatId)?.displayName) },
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

function staffOrSeatName(n?: string) {
  return n ?? '-'
}

function HandoverModal({ seat, onClose }: { seat: Seat; onClose: () => void }) {
  const s = useStore()
  const from = staffById(s, seat.operatorStaffId)
  const candidates = s.staff.filter((x) => x.status === 'active' && x.id !== seat.operatorStaffId)
  const [to, setTo] = useState(candidates[0]?.id ?? '')
  const [reason, setReason] = useState('')
  const customers = customersOfSeat(s, seat.id).length
  const convs = s.conversations.filter((c) => c.kind === 'dm' && c.seatId === seat.id).length
  const submit = () => {
    if (!to || reason.trim().length < 1) return
    s.handoverSeat(seat.id, to, reason.trim(), s.session.adminStaffId!)
    toast(`「${seat.displayName}」已交接给 ${staffById(s, to)?.name}，客户侧无任何变化`)
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`坐席交接：${seat.displayName}`}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!to || !reason.trim()} onClick={submit}>
            确认交接
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-md bg-zinc-50 p-3">
          <SeatAvatar seat={seat} size={40} />
          <div className="text-xs">
            <div className="font-medium text-zinc-900">{seat.displayName}</div>
            <div className="text-zinc-500">{seat.roleDesc}</div>
            <div className="mt-1 text-zinc-500">
              主归属客户 {customers} 位 · 私聊会话 {convs} 条 · 当前实操：{from?.name ?? '无'}
            </div>
          </div>
        </div>
        <Field label="新实操员工" required>
          <Select value={to} onChange={(e) => setTo(e.target.value)}>
            {candidates.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}（{s.roles.find((r) => r.id === st.roleId)?.name}）
              </option>
            ))}
          </Select>
        </Field>
        <Field label="交接原因" required hint="1 到 128 字，进永久记录">
          <Textarea rows={2} maxLength={128} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="例如：林薇离职，客户由王芳接手" />
        </Field>
        <Note>
          交接后：<b>客户零感知</b>，显示名、头像、历史消息全不变；新人立即看到该坐席全部会话与完整历史；旧人立即失去该坐席的访问。这条记录永久保留，是「这句话到底是谁说的」的审计依据。
        </Note>
      </div>
    </Modal>
  )
}

function SeatEditModal({ seat, onClose }: { seat?: Seat; onClose: () => void }) {
  const s = useStore()
  const [form, setForm] = useState({
    displayName: seat?.displayName ?? '',
    roleDesc: seat?.roleDesc ?? '',
    type: seat?.type ?? 'assign',
    operatorStaffId: seat?.operatorStaffId ?? '',
    welcome: seat?.welcome ?? '',
    customerDeletable: seat?.customerDeletable ?? false,
  })
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))
  const submit = () => {
    if (!form.displayName.trim()) return
    if (seat) {
      s.updateSeat(seat.id, { ...form, type: form.type as Seat['type'], operatorStaffId: form.operatorStaffId || null }, s.session.adminStaffId!)
      toast('坐席已更新')
    } else {
      s.createSeat({ ...form, type: form.type as Seat['type'], operatorStaffId: form.operatorStaffId || null, status: form.operatorStaffId ? 'accepting' : 'paused' }, s.session.adminStaffId!)
      toast('坐席已创建。记得把它放进邀请组，否则新客户不会加到它')
    }
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={seat ? `编辑坐席：${seat.displayName}` : '创建坐席'}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={submit} disabled={!form.displayName.trim()}>
            {seat ? '保存' : '创建'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {seat && (
          <Note tone="amber">显示名和头像创建后可改，但客户会看到名字变了。除非确实要改，否则不要动。</Note>
        )}
        <Field label="显示名" required hint="客户看到的名字，1 到 32 字">
          <Input value={form.displayName} maxLength={32} onChange={(e) => set('displayName', e.target.value)} placeholder="如：林顾问" />
        </Field>
        <Field label="职能说明" hint="多个官方号时客户靠它判断该找谁">
          <Input value={form.roleDesc} maxLength={64} onChange={(e) => set('roleDesc', e.target.value)} placeholder="如：资深投资顾问 · 全球资产配置" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="类型">
            <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
              <option value="assign">分配型（双向沟通，一对一）</option>
              <option value="notice">通知型（全企业共用，只发不收）</option>
            </Select>
          </Field>
          <Field label="实操员工" hint="留空则暂停接新">
            <Select value={form.operatorStaffId} onChange={(e) => set('operatorStaffId', e.target.value)}>
              <option value="">无</option>
              {s.staff
                .filter((x) => x.status === 'active')
                .map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
            </Select>
          </Field>
        </div>
        <Field label="欢迎语" hint="支持 {{customer.nickname}}、{{seat.name}}；留空用企业默认">
          <Textarea rows={3} value={form.welcome} onChange={(e) => set('welcome', e.target.value)} />
        </Field>
        <div className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2">
          <div className="text-xs">
            <div className="font-medium text-zinc-800">客户可删除会话</div>
            <div className="text-zinc-500">关闭时客户删不掉与该坐席的会话（主归属、通知型建议关闭）</div>
          </div>
          <Switch checked={form.customerDeletable} onChange={(v) => set('customerDeletable', v)} />
        </div>
      </div>
    </Modal>
  )
}
