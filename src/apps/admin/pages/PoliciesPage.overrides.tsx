/**
 * 群级 / 用户级覆盖（P1）：对某个群（只作用于客户在该群里的能力）、客户或坐席单独放开或收紧某项能力。
 */
import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import type { DemoState, PolicyOverride, PolicyOverrideTarget } from '@/domain/types'
import { fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { customerById, seatById, staffById } from '@/store/selectors'
import { Button, Field, Input, Select } from '@/ui/primitives'
import { Card, Note, Pill, Table } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { DemoLevelTag } from '@/ui/DemoNote'

type Tri = 'inherit' | 'on' | 'off'

const KIND_LABEL: Record<PolicyOverrideTarget, string> = { customer: '客户', seat: '坐席', group: '群' }

function targetLabel(s: DemoState, o: Pick<PolicyOverride, 'targetKind' | 'targetId'>) {
  if (o.targetKind === 'customer') {
    const c = customerById(s, o.targetId)
    return (
      <span>
        <span className="font-medium text-zinc-900">{c?.nickname ?? '未知客户'}</span>
        <span className="ml-1 font-mono text-[11px] text-zinc-400">{c?.accountId}</span>
      </span>
    )
  }
  if (o.targetKind === 'group') {
    const g = s.chatGroups.find((x) => x.id === o.targetId)
    return (
      <span>
        <span className="font-medium text-zinc-900">{g?.name ?? '未知群'}</span>
        <Pill tone="green" className="ml-1">
          {g?.kind === 'channel' ? '频道' : '群'}
        </Pill>
        {g?.official && (
          <Pill tone="blue" className="ml-1">
            官方
          </Pill>
        )}
      </span>
    )
  }
  const seat = seatById(s, o.targetId)
  return (
    <span>
      <span className="font-medium text-zinc-900">{seat?.displayName ?? '未知坐席'}</span>
      <Pill tone="blue" className="ml-1">
        坐席
      </Pill>
    </span>
  )
}

export function OverridesTab() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<PolicyOverride | null>(null)

  const remove = async (o: PolicyOverride) => {
    const ok = await confirm({ title: `删除这条${KIND_LABEL[o.targetKind]}级覆盖？`, body: '删除后回到企业默认策略。', okText: '删除', danger: true })
    if (!ok) return
    s.removePolicyOverride(o.id, admin)
    toast('已删除覆盖，在线用户立即生效')
  }

  return (
    <>
      <Note>
        <b>群级覆盖</b>只作用于客户在该群里的能力（如私享会员群里放开「查看群成员」）；<b>用户级覆盖</b>作用在客户或坐席上（聊天层能力作用在坐席上，不在员工上）。优先级：用户级 &gt; 群级 &gt; 企业默认。只提交选了「开 / 关」的键，其余仍走默认。
      </Note>
      <Card
        className="mt-4"
        title="群级 / 用户级覆盖"
        level="P1"
        extra={
          <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
            <Plus size={12} /> 添加覆盖
          </Button>
        }
        padded={false}
      >
        <Table
          rows={s.policyOverrides}
          rowKey={(o) => o.id}
          empty="暂无覆盖"
          columns={[
            { key: 'target', title: '目标', render: (o) => targetLabel(s, o) },
            {
              key: 'caps',
              title: '覆盖项',
              render: (o) => (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(o.caps).map(([k, v]) => (
                    <Pill key={k} tone={v ? 'green' : 'red'}>
                      <span className="font-mono">{k}</span>={v ? '开' : '关'}
                    </Pill>
                  ))}
                </div>
              ),
            },
            { key: 'by', title: '添加人 / 时间', render: (o) => <span className="text-[11px] text-zinc-500">{staffById(s, o.byStaffId)?.name} · {fmtDateTime(o.createdAt)}</span> },
            {
              key: 'ops',
              title: '操作',
              align: 'right',
              render: (o) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(o)}>
                    编辑
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => void remove(o)}>
                    删除
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      {adding && <OverrideModal onClose={() => setAdding(false)} />}
      {editing && <OverrideModal override={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function OverrideModal({ override, onClose }: { override?: PolicyOverride; onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [kind, setKind] = useState<PolicyOverrideTarget>(override?.targetKind ?? 'customer')
  const [targetId, setTargetId] = useState(override?.targetId ?? '')
  const [q, setQ] = useState('')
  const [tri, setTri] = useState<Record<string, Tri>>(() => Object.fromEntries(Object.entries(override?.caps ?? {}).map(([k, v]) => [k, v ? 'on' : 'off'])))

  const options = useMemo(() => {
    const kw = q.trim().toLowerCase()
    if (kind === 'customer') {
      return s.customers
        .filter((c) => !c.deletedAt)
        .filter((c) => !kw || c.nickname.toLowerCase().includes(kw) || c.accountId.toLowerCase().includes(kw))
        .map((c) => ({ id: c.id, label: `${c.nickname}（${c.accountId}）` }))
    }
    if (kind === 'group') {
      return s.chatGroups.filter((g) => !kw || g.name.toLowerCase().includes(kw)).map((g) => ({ id: g.id, label: `${g.kind === 'channel' ? '频道' : '群'} · ${g.name}${g.official ? '（官方）' : ''}` }))
    }
    return s.seats.filter((x) => x.status !== 'disabled').filter((x) => !kw || x.displayName.toLowerCase().includes(kw)).map((x) => ({ id: x.id, label: x.displayName }))
  }, [s, kind, q])

  // 群级覆盖只对客户有意义：坐席专属键不出现
  const items = kind === 'group' ? s.policyItems.filter((p) => !p.staffOnly) : s.policyItems
  const caps = Object.fromEntries(Object.entries(tri).filter(([, v]) => v !== 'inherit').map(([k, v]) => [k, v === 'on']))
  const count = Object.keys(caps).length
  const error = !targetId ? `先选一个${KIND_LABEL[kind]}` : count === 0 ? '至少选一项覆盖为开或关' : null

  const switchKind = (k: PolicyOverrideTarget) => {
    setKind(k)
    setTargetId('')
    setQ('')
  }
  const submit = () => {
    if (error) return
    if (override) {
      s.updatePolicyOverride(override.id, caps, admin)
      toast(`已更新覆盖，${count} 项`)
    } else if (kind === 'group') {
      s.addGroupPolicyOverride(targetId, caps, admin)
      toast(`已添加群级覆盖，${count} 项；只在该群内生效`)
    } else {
      s.addPolicyOverride({ targetKind: kind, targetId, caps }, admin)
      toast(`已添加用户级覆盖，${count} 项；在线用户立即生效`)
    }
    onClose()
  }
  const groups = Array.from(new Set(items.map((p) => p.group)))
  const triOptions: { v: Tri; label: string; cls: string }[] = [
    { v: 'inherit', label: '不覆盖', cls: 'text-zinc-500' },
    { v: 'on', label: '开', cls: 'text-emerald-700' },
    { v: 'off', label: '关', cls: 'text-red-700' },
  ]

  return (
    <Modal
      open
      onClose={onClose}
      title={override ? `编辑${KIND_LABEL[override.targetKind]}级覆盖` : '添加覆盖'}
      width={640}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!!error} onClick={submit}>
            {override ? '保存' : '添加'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {override ? (
          <div className="rounded-md bg-zinc-50 px-3 py-2 text-[13px]">目标：{targetLabel(s, override)}</div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <Field label="目标类型">
              <Select value={kind} onChange={(e) => switchKind(e.target.value as PolicyOverrideTarget)}>
                <option value="customer">客户（用户级）</option>
                <option value="seat">坐席（用户级）</option>
                <option value="group">群 / 频道（群级）</option>
              </Select>
            </Field>
            <Field label="搜索" hint={kind === 'customer' ? '昵称或账号 ID' : kind === 'group' ? '群名' : '坐席显示名'}>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="输入过滤" />
            </Field>
            <Field label={KIND_LABEL[kind]} required>
              <Select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                <option value="">请选择（{options.length}）</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        {kind === 'group' && !override && <p className="text-[11px] text-zinc-500">群级覆盖只作用于客户在这个群里的能力，例如在私享会员群里放开「查看群成员」「拉人入群」。</p>}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs font-medium text-zinc-600">
            <span>能力覆盖（三态）</span>
            <span className="text-[11px] font-normal text-zinc-400">已覆盖 {count} 项</span>
          </div>
          <div className="thin-scroll max-h-80 overflow-y-auto rounded-md border border-zinc-200">
            {groups.map((g) => (
              <div key={g}>
                <div className="bg-zinc-50/80 px-3 py-1 text-[11px] font-medium text-zinc-500">{g}</div>
                {items
                  .filter((p) => p.group === g)
                  .map((p) => {
                    const cur = tri[p.key] ?? 'inherit'
                    return (
                      <div key={p.key} className="flex items-center justify-between border-b border-zinc-100 px-3 py-1.5 last:border-0">
                        <div>
                          <div className="text-[13px] text-zinc-800">
                            {p.label}
                            {p.level !== 'P0' && <DemoLevelTag level={p.level} />}
                          </div>
                          <div className="font-mono text-[11px] text-zinc-400">{p.key}</div>
                        </div>
                        <div className="flex overflow-hidden rounded-md border border-zinc-200 text-[11px]">
                          {triOptions.map((t) => (
                            <button
                              key={t.v}
                              type="button"
                              onClick={() => setTri((m) => ({ ...m, [p.key]: t.v }))}
                              className={`px-2 py-1 ${cur === t.v ? `bg-zinc-100 font-medium ${t.cls}` : 'text-zinc-400 hover:bg-zinc-50'}`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
              </div>
            ))}
          </div>
        </div>
        {(targetId || count > 0) && error && <p className="text-[11px] text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}
