/**
 * 管理员面板：群主 + 已任命的管理员（坐席或客户"助教"）及其权限；
 * 任命 / 修改权限 / 撤销走「任免管理员」权限，任命弹窗复用 GroupAdminModal。
 */
import { useState } from 'react'
import { Crown, Shield } from 'lucide-react'
import type { Customer, GroupMemberKind } from '@/domain/types'
import { useStore } from '@/store/store'
import { customerById, seatById } from '@/store/selectors'
import { Avatar, Pill, SeatAvatar } from '@/ui/display'
import { Button, Select } from '@/ui/primitives'
import { Modal, toast } from '@/ui/overlay'
import { GroupAdminModal } from './GroupAdminModal'
import { PERM_LABEL, Section, type GroupPanelProps } from './shared'

type Target = { kind: GroupMemberKind; id: string; name: string }

export function GroupAdmins({ group: g, actor, perm, compact }: GroupPanelProps) {
  const s = useStore()
  const canPromote = perm('can_promote_members')
  const [target, setTarget] = useState<Target | null>(null)
  const [picking, setPicking] = useState(false)
  const owner = seatById(s, g.ownerSeatId)

  const admins = g.admins
    .map((a) => {
      const seat = a.memberKind === 'seat' ? seatById(s, a.memberId) : undefined
      const customer = a.memberKind === 'customer' ? customerById(s, a.memberId) : undefined
      const name = seat?.displayName ?? customer?.nickname
      if (!name) return null
      return { a, name, avatar: seat ? <SeatAvatar seat={seat} size={22} /> : <Avatar text={name} size={22} /> }
    })
    .filter((x) => !!x)

  const demote = (t: Target) => {
    s.demoteGroupAdmin(g.id, t.kind, t.id, actor)
    toast(`已撤销「${t.name}」的管理员`)
  }

  return (
    <Section title={`管理员（${g.admins.length}）`} compact={compact} extra={canPromote && <Button size="sm" variant="primary" onClick={() => setPicking(true)}>任命管理员</Button>}>
      <ul className="space-y-1.5">
        {owner && (
          <li className="flex items-center gap-2 text-[13px]">
            <SeatAvatar seat={owner} size={22} />
            <span className="min-w-0 flex-1 truncate text-zinc-900">{owner.displayName}</span>
            <Pill tone="amber">
              <Crown size={10} className="mr-0.5" />
              群主 · 全部权限
            </Pill>
          </li>
        )}
        {admins.map(({ a, name, avatar }) => {
          const t: Target = { kind: a.memberKind, id: a.memberId, name }
          return (
            <li key={`${a.memberKind}-${a.memberId}`} className="flex items-center gap-2 text-[13px]">
              {avatar}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="truncate text-zinc-900">{name}</span>
                  <Pill tone={a.memberKind === 'seat' ? 'blue' : 'zinc'}>
                    <Shield size={10} className="mr-0.5" />
                    {a.memberKind === 'seat' ? '坐席' : '客户'}
                  </Pill>
                </div>
                <div className="truncate text-[11px] text-zinc-400">{a.perms.map((p) => PERM_LABEL[p]).join('、') || '无权限'}</div>
              </div>
              {canPromote && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setTarget(t)}>
                    修改权限
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-700" onClick={() => demote(t)}>
                    撤销
                  </Button>
                </>
              )}
            </li>
          )
        })}
        {admins.length === 0 && <li className="text-[12px] text-zinc-400">还没有任命管理员。</li>}
      </ul>
      {picking && (
        <PickMemberModal
          group={g}
          onPick={(t) => {
            setPicking(false)
            setTarget(t)
          }}
          onClose={() => setPicking(false)}
        />
      )}
      {target && <GroupAdminModal group={g} actor={actor} target={target} onClose={() => setTarget(null)} />}
    </Section>
  )
}

/** 从群成员里选一个还不是管理员的坐席或客户 */
function PickMemberModal({ group: g, onPick, onClose }: { group: GroupPanelProps['group']; onPick: (t: Target) => void; onClose: () => void }) {
  const s = useStore()
  const isAdmin = (kind: GroupMemberKind, id: string) => g.admins.some((a) => a.memberKind === kind && a.memberId === id)
  const seats = g.memberSeatIds.filter((id) => id !== g.ownerSeatId && !isAdmin('seat', id)).map((id) => seatById(s, id)).filter((x) => !!x)
  const customers = g.memberCustomerIds
    .filter((id) => !isAdmin('customer', id))
    .map((id) => customerById(s, id))
    .filter((c): c is Customer => !!c && !c.deletedAt)
  const [value, setValue] = useState('')
  const pick = () => {
    const [kind, id] = value.split(':') as [GroupMemberKind, string]
    const name = kind === 'seat' ? seatById(s, id)?.displayName : customerById(s, id)?.nickname
    if (!name) return
    onPick({ kind, id, name })
  }
  return (
    <Modal open onClose={onClose} title="任命管理员" width={400} footer={<><Button onClick={onClose}>取消</Button><Button variant="primary" disabled={!value} onClick={pick}>下一步：选权限</Button></>}>
      <Select value={value} onChange={(e) => setValue(e.target.value)}>
        <option value="">选择成员…</option>
        {seats.length > 0 && (
          <optgroup label="坐席">
            {seats.map((x) => <option key={x.id} value={`seat:${x.id}`}>{x.displayName}</option>)}
          </optgroup>
        )}
        {customers.length > 0 && (
          <optgroup label="客户（助教）">
            {customers.map((c) => <option key={c.id} value={`customer:${c.id}`}>{c.nickname}</option>)}
          </optgroup>
        )}
      </Select>
      {!seats.length && !customers.length && <p className="mt-2 text-[12px] text-zinc-400">群里没有可任命的成员。</p>}
    </Modal>
  )
}
