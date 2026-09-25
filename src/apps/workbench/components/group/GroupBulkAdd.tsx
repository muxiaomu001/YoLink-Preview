/**
 * 批量拉人：按范围（我的客户 / 全部客户）、标签多选、注册时间范围、最近活跃范围（P1）筛选，
 * 勾选后一次拉入；跳过原因（已在群 / 已满 / 被禁止再进 / 头衔不符）在 toast 里说清。走「邀请用户」权限。
 */
import { useMemo, useState } from 'react'
import type { Customer } from '@/domain/types'
import { fmtDate } from '@/domain/time'
import { useStore } from '@/store/store'
import { groupCapacity } from '@/store/policy'
import { activeCustomers, customersOfSeat } from '@/store/selectors'
import { Avatar, Pill, TagChip, TitleChip } from '@/ui/display'
import { Button, Checkbox, Field, Input, Select } from '@/ui/primitives'
import { Modal, toast } from '@/ui/overlay'
import { isRestrictionActive } from './groupRules'
import type { GroupPanelProps } from './shared'

type Scope = 'mine' | 'all'
type SkipReason = '已在群' | '被禁止再进' | '头衔不符' | '已满'

export function GroupBulkAddModal({ group: g, actor, canViewAll, onClose }: Pick<GroupPanelProps, 'group' | 'actor'> & { canViewAll: boolean; onClose: () => void }) {
  const s = useStore()
  const [scope, setScope] = useState<Scope>('mine')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [regFrom, setRegFrom] = useState('')
  const [regTo, setRegTo] = useState('')
  const [actFrom, setActFrom] = useState('')
  const [actTo, setActTo] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const nowIso = new Date().toISOString()
  const cap = groupCapacity(s, g)
  const room = Math.max(0, cap - g.memberCustomerIds.length)

  const skipReason = (c: Customer): SkipReason | null => {
    if (g.memberCustomerIds.includes(c.id)) return '已在群'
    if (g.restrictions.some((r) => r.customerId === c.id && r.kind === 'ban' && isRestrictionActive(r, nowIso))) return '被禁止再进'
    if (g.requiredTitleId && !c.titleIds.includes(g.requiredTitleId)) return '头衔不符'
    return null
  }

  const results = useMemo(() => {
    const base = scope === 'mine' ? customersOfSeat(s, actor.seatId).filter((c) => !c.deletedAt) : activeCustomers(s)
    return base.filter((c) => {
      if (tagIds.length && !tagIds.every((t) => c.tagIds.includes(t))) return false
      if (regFrom && c.registeredAt < `${regFrom}T00:00:00.000Z`) return false
      if (regTo && c.registeredAt > `${regTo}T23:59:59.999Z`) return false
      if (actFrom && c.lastActiveAt < `${actFrom}T00:00:00.000Z`) return false
      if (actTo && c.lastActiveAt > `${actTo}T23:59:59.999Z`) return false
      return true
    })
  }, [s, scope, actor.seatId, tagIds, regFrom, regTo, actFrom, actTo])

  const addable = results.filter((c) => !skipReason(c))
  const toggleTag = (id: string) => setTagIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const togglePick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const allPicked = addable.length > 0 && addable.every((c) => picked.includes(c.id))

  const submit = () => {
    const ids = picked.filter((id) => results.some((c) => c.id === id))
    const reasons: Record<string, number> = {}
    let seatsLeft = room
    ids.forEach((id) => {
      const c = results.find((x) => x.id === id)!
      const r = skipReason(c) ?? (seatsLeft <= 0 ? '已满' : null)
      if (r) reasons[r] = (reasons[r] ?? 0) + 1
      else seatsLeft -= 1
    })
    const res = s.addGroupMembers(g.id, ids, actor)
    if ('reason' in res) return toast(res.reason, 'warn')
    const skipText = Object.entries(reasons).map(([k, v]) => `${k} ${v}`).join('、')
    toast(`拉入 ${res.added} 人${res.skipped.length ? `，跳过 ${res.skipped.length} 人（${skipText}）` : ''}`, res.added ? 'ok' : 'warn')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`批量拉人到「${g.name}」`}
      width={720}
      footer={
        <>
          <span className="mr-auto text-[11px] text-zinc-500">已选 {picked.length} 人 · 群还能进 {room} 人（上限 {cap}）</span>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!picked.length} onClick={submit}>拉入群</Button>
        </>
      }
    >
      <div className="grid grid-cols-[220px_minmax(0,1fr)] gap-4">
        <div className="space-y-3">
          <Field label="范围">
            <Select value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
              <option value="mine">我的客户（本坐席主归属）</option>
              <option value="all" disabled={!canViewAll}>全部客户{canViewAll ? '' : '（需「查看全部客户」）'}</option>
            </Select>
          </Field>
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-600">按标签（同时满足）</div>
            <div className="flex flex-wrap gap-1">
              {s.tags.map((t) => (
                <button key={t.id} type="button" onClick={() => toggleTag(t.id)} className={tagIds.includes(t.id) ? 'ring-2 ring-brand-300 rounded-md' : 'opacity-70 hover:opacity-100'}>
                  <TagChip tag={t} />
                </button>
              ))}
            </div>
          </div>
          <Field label="注册时间">
            <div className="flex items-center gap-1">
              <Input type="date" value={regFrom} onChange={(e) => setRegFrom(e.target.value)} />
              <span className="text-zinc-400">~</span>
              <Input type="date" value={regTo} onChange={(e) => setRegTo(e.target.value)} />
            </div>
          </Field>
          <Field label="最近活跃">
            <div className="flex items-center gap-1">
              <Input type="date" value={actFrom} onChange={(e) => setActFrom(e.target.value)} />
              <span className="text-zinc-400">~</span>
              <Input type="date" value={actTo} onChange={(e) => setActTo(e.target.value)} />
            </div>
          </Field>
          <p className="text-[11px] leading-relaxed text-zinc-400">跳过规则：已在群、被禁止再进、不满足入群头衔、群已满。{g.requiredTitleId ? `本群要求头衔「${s.titles.find((t) => t.id === g.requiredTitleId)?.name}」。` : ''}</p>
        </div>
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-zinc-500">
            <span>筛出 {results.length} 人，可拉入 {addable.length} 人</span>
            <Checkbox checked={allPicked} onChange={(v) => setPicked(v ? addable.map((c) => c.id) : [])} label="全选可拉入" />
          </div>
          <ul className="thin-scroll max-h-[420px] divide-y divide-zinc-100 overflow-y-auto rounded-md border border-zinc-200">
            {!results.length && <li className="py-8 text-center text-xs text-zinc-400">没有匹配的客户</li>}
            {results.map((c) => {
              const r = skipReason(c)
              const t = c.primaryTitleId ? s.titles.find((x) => x.id === c.primaryTitleId && x.enabled) : undefined
              return (
                <li key={c.id} className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
                  <Checkbox checked={picked.includes(c.id)} disabled={!!r} onChange={() => togglePick(c.id)} />
                  <Avatar text={c.nickname} size={24} />
                  <span className="min-w-0 flex-1 truncate font-medium text-zinc-800">{c.nickname}</span>
                  {t && <TitleChip title={t} size="xs" />}
                  <span className="text-[11px] tabular-nums text-zinc-400">注册 {fmtDate(c.registeredAt)}</span>
                  {r ? <Pill tone="zinc">{r}</Pill> : <Pill tone="green">可拉入</Pill>}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </Modal>
  )
}
