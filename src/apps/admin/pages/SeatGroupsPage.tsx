/**
 * 坐席组（P1，轮询分摊）：邀请组里的一个位置指向坐席组，注册时从组里挑一个坐席。
 */
import { useState } from 'react'
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react'
import type { DemoState, Seat, SeatGroup, SeatGroupStrategy } from '@/domain/types'
import { useStore } from '@/store/store'
import { customersOfSeat, staffById } from '@/store/selectors'
import { Button, Field, Input } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, SeatAvatar, Table } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { DemoLevelTag, DemoNote } from '@/ui/DemoNote'
import { confirm } from '@/ui/confirm'

const STRATEGY_LABEL: Record<SeatGroupStrategy, { name: string; desc: string }> = {
  round_robin: { name: '轮询', desc: '按顺序轮着接，每人一个' },
  least: { name: '最少客户优先', desc: '谁的主归属客户最少给谁' },
  random: { name: '随机', desc: '组内随机挑一个' },
}

/** 组内能接新的坐席：接新中且未达上限 */
function acceptingSeats(s: DemoState, g: SeatGroup): Seat[] {
  return g.seatIds
    .map((id) => s.seats.find((x) => x.id === id))
    .filter((x): x is Seat => !!x && x.status === 'accepting' && (x.maxCustomers == null || customersOfSeat(s, x.id).length < x.maxCustomers))
}

export function SeatGroupsPage() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<SeatGroup | null>(null)

  const remove = async (g: SeatGroup) => {
    const ok = await confirm({ title: `删除坐席组「${g.name}」？`, body: '组内坐席不会被删除，只是不再属于该组；引用该组的邀请组位置需要重新指定。', okText: '删除', danger: true })
    if (!ok) return
    s.deleteSeatGroup(g.id, admin)
    toast(`已删除坐席组「${g.name}」`)
  }

  const rows = s.seatGroups.map((g) => ({ g, members: g.seatIds.map((id) => s.seats.find((x) => x.id === id)).filter((x): x is Seat => !!x), open: acceptingSeats(s, g).length }))

  return (
    <div>
      <PageHeader
        title="坐席组"
        level="P1"
        desc="邀请组里的一个位置指向坐席组而不是具体坐席，注册时按轮询、最少客户优先或随机从组里挑一个。按职能分组，投资顾问和客户服务不放同一个队列。"
        extra={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={14} /> 创建坐席组
          </Button>
        }
      />
      <Note>
        一个码进来的客户多到一个顾问接不过来时才需要坐席组；<b>分配的对象仍是坐席不是员工</b>。可接新数为 0 时该位置会被跳过，并提醒管理员。
      </Note>
      <DemoNote className="mt-2">
        第一版只做邀请组「放几个加几个」，不分摊；轮询分摊排在第二版<DemoLevelTag level="P1" />。
      </DemoNote>
      <Card className="mt-4" padded={false}>
        <Table
          rows={rows}
          rowKey={(r) => r.g.id}
          columns={[
            { key: 'name', title: '组名称', render: (r) => <span className="font-medium text-zinc-900">{r.g.name}</span> },
            {
              key: 'members',
              title: '成员',
              render: (r) => (
                <div className="flex flex-wrap gap-1.5">
                  {r.members.map((seat) => (
                    <span key={seat.id} className="inline-flex items-center gap-1 rounded-full border border-zinc-200 py-0.5 pr-2 pl-0.5 text-xs">
                      <SeatAvatar seat={seat} size={18} /> {seat.displayName}
                      {seat.status !== 'accepting' && <span className="text-[10px] text-amber-600">{seat.status === 'paused' ? '暂停' : '停用'}</span>}
                    </span>
                  ))}
                  {!r.members.length && <span className="text-zinc-400">空组</span>}
                </div>
              ),
            },
            { key: 'count', title: '成员数', align: 'right', render: (r) => <span className="tabular-nums">{r.members.length}</span> },
            { key: 'strategy', title: '分配方式', render: (r) => <span title={STRATEGY_LABEL[r.g.strategy].desc}>{STRATEGY_LABEL[r.g.strategy].name}</span> },
            {
              key: 'open',
              title: '可接新数',
              align: 'right',
              render: (r) => (r.open === 0 ? <Pill tone="red">0 · 该位置会被跳过</Pill> : <span className="tabular-nums">{r.open}</span>),
            },
            {
              key: 'ops',
              title: '操作',
              align: 'right',
              render: (r) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(r.g)}>
                    编辑
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => void remove(r.g)}>
                    删除
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      {creating && <SeatGroupEditor onClose={() => setCreating(false)} />}
      {editing && <SeatGroupEditor group={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

/** 穿梭框里的一行：点击即移到另一侧 */
function SeatRow({ s, seat, onMove, dir, groupId }: { s: DemoState; seat: Seat; onMove: () => void; dir: 'in' | 'out'; groupId?: string }) {
  return (
    <button type="button" onClick={onMove} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-brand-50/60">
      {dir === 'out' && <ArrowLeft size={12} className="text-zinc-400" />}
      <SeatAvatar seat={seat} size={22} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-zinc-900">
          {seat.displayName}
          {seat.seatGroupId && seat.seatGroupId !== groupId && <span className="ml-1 text-[10px] text-amber-600">已在其他组</span>}
        </span>
        <span className="block truncate text-[11px] text-zinc-500">
          {staffById(s, seat.operatorStaffId)?.name ?? '无人实操'} · {customersOfSeat(s, seat.id).length} 位客户{seat.maxCustomers != null ? ` / 上限 ${seat.maxCustomers}` : ''}
        </span>
      </span>
      {dir === 'in' && <ArrowRight size={12} className="text-zinc-400" />}
    </button>
  )
}

function SeatGroupEditor({ group, onClose }: { group?: SeatGroup; onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [name, setName] = useState(group?.name ?? '')
  const [seatIds, setSeatIds] = useState<string[]>(group?.seatIds ?? [])
  const [strategy, setStrategy] = useState<SeatGroupStrategy>(group?.strategy ?? 'round_robin')
  // 只有分配型坐席能进坐席组；通知型全企业共用一个，不参与分摊
  const pool = s.seats.filter((x) => x.type === 'assign' && x.status !== 'disabled')
  const chosen = seatIds.map((id) => pool.find((x) => x.id === id)).filter((x): x is Seat => !!x)
  const available = pool.filter((x) => !seatIds.includes(x.id))
  const nameOk = name.trim().length >= 1 && name.trim().length <= 32
  const error = !nameOk ? '组名称 1 到 32 字' : seatIds.length === 0 ? '至少选一个坐席' : null

  const submit = () => {
    if (error) return
    if (group) {
      s.updateSeatGroup(group.id, { name: name.trim(), seatIds, strategy }, admin)
      toast(`已保存坐席组「${name.trim()}」`)
    } else {
      s.createSeatGroup({ name: name.trim(), seatIds, strategy }, admin)
      toast(`已创建坐席组「${name.trim()}」，${seatIds.length} 个坐席。把它放进邀请组的位置才会生效`)
    }
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={group ? `编辑坐席组：${group.name}` : '创建坐席组'}
      width={640}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!!error} onClick={submit}>
            {group ? '保存' : '创建'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="组名称" required hint="1 到 32 字">
          <Input value={name} maxLength={32} onChange={(e) => setName(e.target.value)} placeholder="如：投资顾问组" />
        </Field>
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-600">成员（点击左右移动；只列分配型坐席）</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-zinc-200">
              <div className="border-b border-zinc-100 bg-zinc-50/80 px-2.5 py-1 text-[11px] text-zinc-500">可选坐席 · {available.length}</div>
              <div className="thin-scroll max-h-56 divide-y divide-zinc-100 overflow-y-auto">
                {available.map((seat) => (
                  <SeatRow key={seat.id} s={s} seat={seat} dir="in" groupId={group?.id} onMove={() => setSeatIds((l) => [...l, seat.id])} />
                ))}
                {!available.length && <div className="px-2.5 py-4 text-center text-[11px] text-zinc-400">没有更多坐席</div>}
              </div>
            </div>
            <div className="rounded-md border border-brand-200">
              <div className="border-b border-brand-100 bg-brand-50/60 px-2.5 py-1 text-[11px] text-brand-800">组内成员 · {chosen.length}</div>
              <div className="thin-scroll max-h-56 divide-y divide-zinc-100 overflow-y-auto">
                {chosen.map((seat) => (
                  <SeatRow key={seat.id} s={s} seat={seat} dir="out" groupId={group?.id} onMove={() => setSeatIds((l) => l.filter((x) => x !== seat.id))} />
                ))}
                {!chosen.length && <div className="px-2.5 py-4 text-center text-[11px] text-zinc-400">从左侧点选加入</div>}
              </div>
            </div>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">一个坐席只能在一个坐席组里；从其他组选过来会自动从原组移出。</p>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-600">分配方式</div>
          <div className="flex flex-col gap-1.5">
            {(Object.keys(STRATEGY_LABEL) as SeatGroupStrategy[]).map((k) => (
              <label key={k} className="flex cursor-pointer items-center gap-2 text-[13px] text-zinc-700">
                <input type="radio" name="strategy" className="accent-brand-700" checked={strategy === k} onChange={() => setStrategy(k)} />
                <span className="font-medium">{STRATEGY_LABEL[k].name}</span>
                <span className="text-[11px] text-zinc-500">{STRATEGY_LABEL[k].desc}</span>
              </label>
            ))}
          </div>
        </div>
        {(name.length > 0 || seatIds.length > 0) && error && <p className="text-[11px] text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}
