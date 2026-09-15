import { useState } from 'react'
import { Copy, Plus, RefreshCw, Star } from 'lucide-react'
import type { InviteGroup } from '@/domain/types'
import { useStore } from '@/store/store'
import { Button, Checkbox, Field, Input } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, SeatAvatar, Table } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'

export function InviteGroupsPage() {
  const s = useStore()
  const [editing, setEditing] = useState<InviteGroup | null>(null)
  const [creating, setCreating] = useState(false)
  const admin = s.session.adminStaffId!

  const rows = s.inviteGroups.map((g) => ({
    g,
    seats: g.seatIds.map((id) => s.seats.find((x) => x.id === id)!).filter(Boolean),
    customers: s.customers.filter((c) => c.inviteGroupId === g.id).length,
    links: s.inviteLinks.filter((l) => l.inviteGroupId === g.id).length,
  }))

  return (
    <div>
      <PageHeader
        title="邀请组"
        desc="客户注册完成的那一刻，官方联系人已经在通讯录里了。组里放几个坐席，输这个组的邀请码注册的客户就自动添加这几个：放三个加三个，放一个加一个。"
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
                    title="重置邀请码（旧码立即失效，已注册客户不受影响）"
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
              key: 'seats',
              title: '成员（注册即添加，按此顺序）',
              render: (r) => (
                <div className="flex flex-wrap gap-1.5">
                  {r.seats.map((seat) => (
                    <span key={seat.id} className="inline-flex items-center gap-1 rounded-full border border-zinc-200 py-0.5 pr-2 pl-0.5 text-xs">
                      <SeatAvatar seat={seat} size={18} />
                      {seat.displayName}
                      {seat.id === r.g.primarySeatId && <Star size={11} className="fill-gold-500 text-gold-500" />}
                    </span>
                  ))}
                </div>
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
      <p className="mt-2 text-[11px] text-zinc-400">★ 主归属：决定客户列表的归属列、业绩归属、群发的默认发送身份。一个组里只能有一个。</p>

      {editing && <GroupEditor group={editing} onClose={() => setEditing(null)} />}
      {creating && <GroupEditor onClose={() => setCreating(false)} />}
    </div>
  )
}

function GroupEditor({ group, onClose }: { group?: InviteGroup; onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [name, setName] = useState(group?.name ?? '')
  const [seatIds, setSeatIds] = useState<string[]>(group?.seatIds ?? [])
  const [primary, setPrimary] = useState(group?.primarySeatId ?? '')
  const [chatGroupIds, setChatGroupIds] = useState<string[]>(group?.chatGroupIds ?? [])
  const availableSeats = s.seats.filter((x) => x.status !== 'disabled')

  const toggleSeat = (id: string) => {
    setSeatIds((list) => {
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
      if (!next.includes(primary)) setPrimary(next.find((x) => s.seats.find((y) => y.id === x)?.type === 'assign') ?? next[0] ?? '')
      return next
    })
  }
  const move = (id: string, dir: -1 | 1) => {
    setSeatIds((list) => {
      const i = list.indexOf(id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= list.length) return list
      const next = [...list]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }
  const ok = name.trim() && seatIds.length > 0 && primary && seatIds.includes(primary)
  const newlyAdded = group ? seatIds.filter((id) => !group.seatIds.includes(id)) : []

  const submit = () => {
    if (!ok) return
    if (group) {
      s.updateInviteGroup(group.id, { name: name.trim(), seatIds, primarySeatId: primary, chatGroupIds }, admin)
      toast(newlyAdded.length ? '已保存。新加的坐席不追溯老客户，需要的话点「补加到已有客户」' : '已保存')
    } else {
      const g = s.createInviteGroup({ name: name.trim(), seatIds, primarySeatId: primary, chatGroupIds }, admin)
      toast(`邀请组「${g.name}」已创建，邀请码 ${g.code}`)
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={group ? `编辑邀请组：${group.name}` : '创建邀请组'}
      width={600}
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
        <Field label="组名称" required>
          <Input value={name} maxLength={32} onChange={(e) => setName(e.target.value)} placeholder="如：抖音投放组、小美老师组" />
        </Field>
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-600">成员坐席（放几个加几个；顺序决定客户会话列表里的排序）</div>
          <div className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
            {availableSeats.map((seat) => {
              const on = seatIds.includes(seat.id)
              const idx = seatIds.indexOf(seat.id)
              return (
                <div key={seat.id} className="flex items-center gap-3 px-3 py-2">
                  <Checkbox checked={on} onChange={() => toggleSeat(seat.id)} />
                  <SeatAvatar seat={seat} size={24} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-zinc-900">
                      {seat.displayName}
                      {seat.type === 'notice' && <span className="ml-1 text-[10px] text-amber-600">通知型</span>}
                      {seat.status === 'paused' && <span className="ml-1 text-[10px] text-amber-600">暂停接新，注册时会跳过</span>}
                    </div>
                    <div className="truncate text-[11px] text-zinc-500">{seat.roleDesc}</div>
                  </div>
                  {on && (
                    <>
                      <label className="flex items-center gap-1 text-[11px] text-zinc-600">
                        <input type="radio" name="primary" className="accent-brand-700" checked={primary === seat.id} onChange={() => setPrimary(seat.id)} disabled={seat.type === 'notice'} />
                        主归属
                      </label>
                      <div className="flex gap-0.5">
                        <Button size="sm" variant="ghost" disabled={idx === 0} onClick={() => move(seat.id, -1)}>
                          ↑
                        </Button>
                        <Button size="sm" variant="ghost" disabled={idx === seatIds.length - 1} onClick={() => move(seat.id, 1)}>
                          ↓
                        </Button>
                      </div>
                      {group && newlyAdded.includes(seat.id) && <Pill tone="amber">新加，不追溯</Pill>}
                      {group && group.seatIds.includes(seat.id) && (
                        <BackfillButton groupId={group.id} seatId={seat.id} />
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-600">附带入群（在企业默认官方群之上叠加）</div>
          <div className="flex flex-wrap gap-3">
            {s.chatGroups.map((g) => (
              <Checkbox
                key={g.id}
                checked={chatGroupIds.includes(g.id) || s.enterprise.defaultChatGroupIds.includes(g.id)}
                disabled={s.enterprise.defaultChatGroupIds.includes(g.id)}
                onChange={(v) => setChatGroupIds((l) => (v ? [...l, g.id] : l.filter((x) => x !== g.id)))}
                label={
                  <span>
                    {g.name}
                    {s.enterprise.defaultChatGroupIds.includes(g.id) && <span className="ml-1 text-[10px] text-zinc-400">企业默认</span>}
                  </span>
                }
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
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
        toast(`已补加到 ${n} 位已有客户，并发出该坐席的欢迎语`)
      }}
    >
      补加到已有客户（{missing}）
    </Button>
  )
}
