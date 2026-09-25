/**
 * 客户列表页的筛选模型与面板、排序表头、批量打标签 / 批量拉群弹窗、CSV 导出。
 */
import { useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { groupCapacity, seatGroupPerm } from '@/store/policy'
import { Button, Checkbox, Input, Select } from '@/ui/primitives'
import { Modal, toast } from '@/ui/overlay'
import { useWorkbench } from '../useWorkbench'
import { advancedFilterCount, EMPTY_FILTER, type CustomerFilter, type SortKey, type SortState } from './CustomersPage.shared'

export function SortHeader({ label, k, sort, onChange }: { label: string; k: SortKey; sort: SortState; onChange: (s: SortState) => void }) {
  const active = sort.key === k
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <button type="button" className={`inline-flex items-center gap-0.5 ${active ? 'text-brand-700' : ''}`} onClick={() => onChange({ key: k, dir: active && sort.dir === 'desc' ? 'asc' : 'desc' })} title={k === 'nickname' ? '按拼音排序' : '按时间排序'}>
      {label} <Icon size={11} />
    </button>
  )
}

// ---------- 筛选面板 ----------

function ChipToggle({ label, color, on, onClick }: { label: string; color: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-md border px-1.5 text-[11px] leading-5 whitespace-nowrap transition-opacity ${on ? '' : 'opacity-45 hover:opacity-80'}`} style={{ borderColor: color, color, background: on ? `${color}1a` : 'transparent' }}>
      {label}
    </button>
  )
}

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

export function FilterPanel({ f, onChange, products, roles }: { f: CustomerFilter; onChange: (f: CustomerFilter) => void; products: string[]; roles: string[] }) {
  const { s } = useWorkbench()
  const patch = (p: Partial<CustomerFilter>) => onChange({ ...f, ...p })
  const range = (fromKey: 'regFrom' | 'activeFrom', toKey: 'regTo' | 'activeTo') => (
    <div className="flex items-center gap-1">
      <Input type="date" className="h-7 text-[12px]" value={f[fromKey]} onChange={(e) => patch({ [fromKey]: e.target.value })} />
      <span className="text-zinc-400">–</span>
      <Input type="date" className="h-7 text-[12px]" value={f[toKey]} onChange={(e) => patch({ [toKey]: e.target.value })} />
    </div>
  )
  const count = advancedFilterCount(f)
  return (
    <div className="mb-3 space-y-2 rounded-lg border border-zinc-200 bg-white p-3 text-[12px]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-zinc-500">标签</span>
          {s.tags.map((t) => (
            <ChipToggle key={t.id} label={t.name} color={t.color} on={f.tagIds.includes(t.id)} onClick={() => patch({ tagIds: toggle(f.tagIds, t.id) })} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-zinc-500">头衔</span>
          {s.titles
            .filter((t) => t.enabled)
            .map((t) => (
              <ChipToggle key={t.id} label={t.name} color={t.color} on={f.titleIds.includes(t.id)} onClick={() => patch({ titleIds: toggle(f.titleIds, t.id) })} />
            ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1">
          <span className="text-zinc-500">购买</span>
          <Select className="h-7 w-24 text-[12px]" value={f.bought} onChange={(e) => patch({ bought: e.target.value as CustomerFilter['bought'] })}>
            <option value="any">不限</option>
            <option value="yes">买过</option>
            <option value="no">未买过</option>
          </Select>
          <Select className="h-7 w-40 text-[12px]" value={f.product} onChange={(e) => patch({ product: e.target.value })}>
            <option value="">任一产品</option>
            {products.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
          <span className="text-zinc-500">最近</span>
          <Input type="number" min={1} className="h-7 w-16 text-[12px]" placeholder="天" value={f.boughtWithinDays} onChange={(e) => patch({ boughtWithinDays: e.target.value })} />
          <span className="text-zinc-500">天内</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-zinc-500">角色</span>
          <Select className="h-7 w-28 text-[12px]" value={f.roleLabel} onChange={(e) => patch({ roleLabel: e.target.value })}>
            <option value="">不限</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <span className="text-zinc-500">直接邀请</span>
          <Input type="number" min={0} className="h-7 w-14 text-[12px]" value={f.inviteMin} onChange={(e) => patch({ inviteMin: e.target.value })} />
          <span className="text-zinc-400">–</span>
          <Input type="number" min={0} className="h-7 w-14 text-[12px]" value={f.inviteMax} onChange={(e) => patch({ inviteMax: e.target.value })} />
          <span className="text-zinc-500">人</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1">
          <span className="text-zinc-500">注册时间</span>
          {range('regFrom', 'regTo')}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-zinc-500">最近活跃</span>
          {range('activeFrom', 'activeTo')}
        </div>
        <Button size="sm" variant="ghost" className="ml-auto" disabled={count === 0} onClick={() => onChange({ ...EMPTY_FILTER, q: f.q })}>
          清空{count ? `（${count}）` : ''}
        </Button>
      </div>
    </div>
  )
}

// ---------- 批量操作 ----------

export function BulkTagModal({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const { s } = useWorkbench()
  const [picked, setPicked] = useState<string[]>([])
  const apply = () => {
    ids.forEach((cid) => picked.forEach((tid) => s.addTag(cid, tid)))
    toast(`已给 ${ids.length} 位客户加上 ${picked.length} 个内部标签`)
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="批量打标签"
      width={420}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={picked.length === 0} onClick={apply}>
            应用到 {ids.length} 人
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap gap-3">
        {s.tags.map((t) => (
          <Checkbox key={t.id} checked={picked.includes(t.id)} onChange={() => setPicked((l) => toggle(l, t.id))} label={<span style={{ color: t.color }}>{t.name}</span>} />
        ))}
      </div>
      <p className="mt-3 text-[11px] text-zinc-400">已有该标签的客户不重复加。内部标签客户永远看不到。</p>
    </Modal>
  )
}

export function BulkGroupModal({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const { s, staff, seat } = useWorkbench()
  const [gid, setGid] = useState('')
  if (!staff || !seat) return null
  const g = s.chatGroups.find((x) => x.id === gid)
  const apply = () => {
    if (!g) return
    const r = s.addGroupMembers(g.id, ids, { seatId: seat.id, staffId: staff.id })
    toast(r.added ? `已把 ${r.added} 人拉入「${g.name}」${r.skipped.length ? `，跳过 ${r.skipped.length} 人（已在群、已满、被禁止再进或不满足头衔条件）` : ''}` : '没有人被拉入：都已在群、已满、被禁止再进或不满足头衔条件', r.added ? 'ok' : 'warn')
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="批量拉群"
      width={420}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!g} onClick={apply}>
            拉入 {ids.length} 人
          </Button>
        </>
      }
    >
      <Select value={gid} onChange={(e) => setGid(e.target.value)}>
        <option value="">选择群或频道…</option>
        {s.chatGroups.map((x) => {
          const allowed = seatGroupPerm(s, x, seat.id, staff.id, 'can_invite_users')
          return (
            <option key={x.id} value={x.id} disabled={!allowed}>
              {x.name}（{x.memberCustomerIds.length}/{groupCapacity(s, x)}）{allowed ? '' : ' · 本坐席无拉人权限'}
            </option>
          )
        })}
      </Select>
      <p className="mt-2 text-[11px] text-zinc-400">需要群主、有「邀请用户」权限的管理员或 manage_groups 能力。群里会出现「xx 等 n 人加入了群聊」。</p>
    </Modal>
  )
}
