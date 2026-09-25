/**
 * 邀请组：客户注册完成那一刻，坐席已经在通讯录里了。
 *
 * 组里的坐席分两类——固定坐席人人都加，轮询坐席按队列轮流分一个。
 * 分到的那位轮询坐席就是主归属，决定业绩归属与群发的默认发送身份。
 */
import { useState } from 'react'
import { Copy, Plus, RefreshCw, Star } from 'lucide-react'
import type { InviteGroup, Seat } from '@/domain/types'
import { useStore } from '@/store/store'
import { INVITE_CODE_HINT, INVITE_CODE_MAX, inviteCodeError, normalizeInviteCode } from '@/domain/inviteCode'
import { Button, Checkbox, Field, Input } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, SeatAvatar, Table } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'

export function InviteGroupsPage() {
  const s = useStore()
  const [editing, setEditing] = useState<InviteGroup | null>(null)
  const [creating, setCreating] = useState(false)
  const admin = s.session.adminStaffId!
  const seatOf = (id: string) => s.seats.find((x) => x.id === id)

  const rows = s.inviteGroups.map((g) => ({
    g,
    rotating: g.rotatingSeatIds.map(seatOf).filter((x): x is Seat => !!x),
    fixed: g.fixedSeatIds.map(seatOf).filter((x): x is Seat => !!x),
    customers: s.customers.filter((c) => c.inviteGroupId === g.id).length,
    links: s.inviteLinks.filter((l) => l.inviteGroupId === g.id).length,
  }))

  return (
    <div>
      <PageHeader
        title="邀请组"
        desc="用这个组的邀请码注册的客户，进来就自动加上组里的坐席：固定坐席人人都加，轮询坐席按队列轮流分一个。"
        extra={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={14} /> 创建邀请组
          </Button>
        }
      />
      <Note>
        没带邀请码的注册走「默认组」。改组<b>默认不追溯老客户</b>：新加的坐席旁有「补加到已有客户」按钮，管理员点了才补；移走的坐席，老客户的会话保留。
      </Note>
      <Card className="mt-4" padded={false}>
        <Table
          rows={rows}
          rowKey={(r) => r.g.id}
          columns={[
            {
              key: 'name',
              title: '组名称',
              render: (r) => (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-900">{r.g.name}</span>
                  {r.g.isDefault && <Pill tone="blue">默认</Pill>}
                  {!r.g.enabled && <Pill tone="red">停用</Pill>}
                </div>
              ),
            },
            {
              key: 'code',
              title: '邀请码',
              render: (r) => (
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-zinc-100 px-1.5 font-mono text-[13px] tracking-wider text-zinc-800">{r.g.code}</span>
                  <button
                    type="button"
                    className="text-zinc-400 hover:text-zinc-700"
                    title="复制"
                    onClick={() => {
                      void navigator.clipboard?.writeText(r.g.code)
                      toast(`已复制邀请码 ${r.g.code}`)
                    }}
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    type="button"
                    className="text-zinc-400 hover:text-zinc-700"
                    title="随机换一个（旧码立即失效，已注册客户不受影响）"
                    onClick={() => {
                      s.resetInviteCode(r.g.id, admin)
                      toast('邀请码已重置，旧码立即失效')
                    }}
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
              ),
            },
            {
              key: 'rotating',
              title: '轮询坐席（轮流分，一人一个）',
              render: (r) =>
                r.rotating.length ? (
                  <div className="flex flex-wrap items-center gap-1">
                    {r.rotating.map((seat, i) => (
                      <span key={seat.id} className="inline-flex items-center gap-1">
                        {i > 0 && <span className="text-[11px] text-zinc-300">→</span>}
                        <SeatChip seat={seat} next={i === r.g.rotationIndex % r.rotating.length} />
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[11px] text-zinc-400">不轮询</span>
                ),
            },
            {
              key: 'fixed',
              title: '固定坐席（人人都加）',
              render: (r) =>
                r.fixed.length ? (
                  <div className="flex flex-wrap gap-1">
                    {r.fixed.map((seat) => (
                      <SeatChip key={seat.id} seat={seat} />
                    ))}
                  </div>
                ) : (
                  <span className="text-[11px] text-zinc-400">无</span>
                ),
            },
            { key: 'customers', title: '注册客户', align: 'right', render: (r) => <span className="tabular-nums">{r.customers}</span> },
            { key: 'links', title: '组下链接', align: 'right', render: (r) => <span className="tabular-nums">{r.links}</span> },
            {
              key: 'ops',
              title: '操作',
              align: 'right',
              render: (r) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(r.g)}>
                    编辑
                  </Button>
                  {!r.g.isDefault && (
                    <Button size="sm" variant="ghost" onClick={() => s.setDefaultInviteGroup(r.g.id)}>
                      设为默认
                    </Button>
                  )}
                  {!r.g.isDefault && (
                    <Button size="sm" variant="ghost" onClick={() => s.updateInviteGroup(r.g.id, { enabled: !r.g.enabled }, admin)}>
                      {r.g.enabled ? '停用' : '启用'}
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>
      <p className="mt-2 text-[11px] text-zinc-400">
        <Star size={10} className="mr-0.5 inline fill-gold-500 align-[1px] text-gold-500" />
        下一个进来的客户分给谁。轮到暂停接新的坐席会顺延到下一位，跳过的那一轮不补。
      </p>

      {editing && <GroupEditor group={editing} onClose={() => setEditing(null)} />}
      {creating && <GroupEditor onClose={() => setCreating(false)} />}
    </div>
  )
}

function SeatChip({ seat, next }: { seat: Seat; next?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 py-0.5 pr-2 pl-0.5 text-xs">
      <SeatAvatar seat={seat} size={18} />
      {seat.displayName}
      {next && <Star size={11} className="fill-gold-500 text-gold-500" />}
      {seat.status !== 'accepting' && <span className="text-[10px] text-amber-600">暂停接新</span>}
    </span>
  )
}

type Slot = 'none' | 'fixed' | 'rotating'

function GroupEditor({ group, onClose }: { group?: InviteGroup; onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [name, setName] = useState(group?.name ?? '')
  const [code, setCode] = useState(group?.code ?? '')
  const [fixedSeatIds, setFixed] = useState<string[]>(group?.fixedSeatIds ?? [])
  const [rotatingSeatIds, setRotating] = useState<string[]>(group?.rotatingSeatIds ?? [])
  const [chatGroupIds, setChatGroupIds] = useState<string[]>(group?.chatGroupIds ?? [])
  const availableSeats = s.seats

  const slotOf = (id: string): Slot => (rotatingSeatIds.includes(id) ? 'rotating' : fixedSeatIds.includes(id) ? 'fixed' : 'none')
  // 一个坐席只能占一个槽位：换槽位时先从另一边摘掉
  const setSlot = (id: string, slot: Slot) => {
    setFixed((l) => (slot === 'fixed' ? [...l.filter((x) => x !== id), id] : l.filter((x) => x !== id)))
    setRotating((l) => (slot === 'rotating' ? [...l.filter((x) => x !== id), id] : l.filter((x) => x !== id)))
  }
  const move = (id: string, dir: -1 | 1) => {
    const inRotating = rotatingSeatIds.includes(id)
    const apply = (list: string[]) => {
      const i = list.indexOf(id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= list.length) return list
      const next = [...list]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    }
    if (inRotating) setRotating(apply)
    else setFixed(apply)
  }

  // 改码时把自己排除掉，否则「没改」也会被判成重复
  const codeErr = code.trim() ? inviteCodeError(code, s.takenInviteCodes(group?.id)) : undefined
  const noSeat = !fixedSeatIds.length && !rotatingSeatIds.length
  const ok = !!name.trim() && !noSeat && !codeErr
  const before = group ? [...group.fixedSeatIds, ...group.rotatingSeatIds] : []
  const newlyAdded = [...fixedSeatIds, ...rotatingSeatIds].filter((id) => !before.includes(id))

  const submit = () => {
    if (!ok) return
    const payload = { name: name.trim(), fixedSeatIds, rotatingSeatIds, chatGroupIds, code: code.trim() ? normalizeInviteCode(code) : undefined }
    if (group) {
      const r = s.updateInviteGroup(group.id, payload, admin)
      if (!r.ok) return toast(r.error, 'warn')
      toast(newlyAdded.length ? '已保存。新加的坐席不追溯老客户，需要的话点「补加到已有客户」' : '已保存')
    } else {
      const r = s.createInviteGroup(payload, admin)
      if (!r.ok) return toast(r.error, 'warn')
      toast(`邀请组「${r.group.name}」已创建，邀请码 ${r.group.code}`)
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={group ? `编辑邀请组：${group.name}` : '创建邀请组'}
      width={640}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!ok} onClick={submit}>
            {group ? '保存' : '创建'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="组名称" required>
            <Input value={name} maxLength={32} onChange={(e) => setName(e.target.value)} placeholder="如：抖音投放组、小美老师组" />
          </Field>
          <Field label="邀请码" hint={INVITE_CODE_HINT}>
            <Input
              value={code}
              maxLength={INVITE_CODE_MAX}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={group ? group.code : '留空自动生成'}
              className="font-mono tracking-wider"
            />
          </Field>
        </div>
        {codeErr && <p className="-mt-2 text-[11px] text-red-600">{codeErr}</p>}
        {group && code.trim() && normalizeInviteCode(code) !== group.code && !codeErr && (
          <p className="-mt-2 text-[11px] text-amber-600">改码后旧码「{group.code}」立即失效，已投放的物料要同步换掉；已注册客户不受影响。</p>
        )}

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xs font-medium text-zinc-600">坐席</span>
            <span className="text-[11px] text-zinc-400">轮询坐席轮流分，一个客户只分到一位；固定坐席人人都加</span>
          </div>
          <div className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
            {availableSeats.map((seat) => {
              const slot = slotOf(seat.id)
              const list = slot === 'rotating' ? rotatingSeatIds : fixedSeatIds
              const idx = list.indexOf(seat.id)
              return (
                <div key={seat.id} className="flex items-center gap-3 px-3 py-2">
                  <SeatAvatar seat={seat} size={24} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-zinc-900">
                      {seat.displayName}
                      {seat.status === 'paused' && <span className="ml-1 text-[10px] text-amber-600">暂停接新，注册时会跳过</span>}
                    </div>
                    <div className="truncate text-[11px] text-zinc-500">{seat.roleDesc}</div>
                  </div>
                  <SlotPicker value={slot} onChange={(next) => setSlot(seat.id, next)} />
                  {slot !== 'none' && (
                    <div className="flex gap-0.5">
                      <Button size="sm" variant="ghost" disabled={idx === 0} onClick={() => move(seat.id, -1)}>
                        ↑
                      </Button>
                      <Button size="sm" variant="ghost" disabled={idx === list.length - 1} onClick={() => move(seat.id, 1)}>
                        ↓
                      </Button>
                    </div>
                  )}
                  {slot !== 'none' && group && newlyAdded.includes(seat.id) && <Pill tone="amber">新加，不追溯</Pill>}
                  {slot !== 'none' && group && before.includes(seat.id) && <BackfillButton groupId={group.id} seatId={seat.id} />}
                </div>
              )
            })}
          </div>
          {noSeat && <p className="mt-1 text-[11px] text-red-600">至少配一个坐席，否则客户注册进来没有任何坐席。</p>}
          {!noSeat && !rotatingSeatIds.length && (
            <p className="mt-1 text-[11px] text-amber-600">没有轮询坐席：主归属会落到第一个固定坐席上，这个组不参与轮询。</p>
          )}
        </div>

        <div>
          <div className="mb-1 text-xs font-medium text-zinc-600">附带入群</div>
          <div className="flex flex-wrap gap-3">
            {s.chatGroups.map((g) => (
              <Checkbox
                key={g.id}
                checked={chatGroupIds.includes(g.id)}
                onChange={(v) => setChatGroupIds((l) => (v ? [...l, g.id] : l.filter((x) => x !== g.id)))}
                label={g.name}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

const SLOT_LABEL: { key: Slot; label: string }[] = [
  { key: 'none', label: '不加' },
  { key: 'rotating', label: '轮询坐席' },
  { key: 'fixed', label: '固定' },
]

/** 三选一的槽位选择器：不加 / 轮询坐席 / 固定坐席 */
function SlotPicker({ value, onChange }: { value: Slot; onChange: (v: Slot) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-zinc-200">
      {SLOT_LABEL.map((o) => {
        const on = value === o.key
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={
              on
                ? 'bg-brand-700 px-2.5 py-1 text-[11px] text-white'
                : 'px-2.5 py-1 text-[11px] text-zinc-600 hover:bg-zinc-50'
            }
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function BackfillButton({ groupId, seatId }: { groupId: string; seatId: string }) {
  const s = useStore()
  const missing = s.customers.filter((c) => c.inviteGroupId === groupId && !s.customerSeats.some((cs) => cs.customerId === c.id && cs.seatId === seatId)).length
  if (!missing) return <span className="text-[11px] text-zinc-400">老客户已全有</span>
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() => {
        const n = s.backfillSeat(groupId, seatId, s.session.adminStaffId!)
        toast(`已补加到 ${n} 位已有客户${s.seats.find((item) => item.id === seatId)?.welcome.trim() ? '，并发出该坐席的欢迎语' : '；未配置欢迎语，不发送问候'}`)
      }}
    >
      补加到已有客户（{missing}）
    </Button>
  )
}
