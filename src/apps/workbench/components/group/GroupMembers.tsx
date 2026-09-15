/**
 * 成员列表：坐席（群主 / 管理员 / 成员，标"官方"）、机器人、客户（管理员在前），可搜索。
 * 每项操作按 12 文档权限：任免管理员 can_promote_members；移出 / 禁言 / 封禁 / 解除 can_restrict_members；
 * 加坐席与批量拉人 can_invite_users。客户也可被设为管理员（"助教"）。
 */
import { useMemo, useState } from 'react'
import { Bot, Crown, MoreHorizontal, Shield } from 'lucide-react'
import type { Customer, GroupMemberKind } from '@/domain/types'
import { useStore } from '@/store/store'
import { groupRoleOf } from '@/store/policy'
import { customerById, seatById } from '@/store/selectors'
import { Avatar, Pill, SeatAvatar, TitleChip } from '@/ui/display'
import { Button, Input, Select } from '@/ui/primitives'
import { Modal, toast } from '@/ui/overlay'
import { GroupAdminModal } from './GroupAdminModal'
import { GroupBulkAddModal } from './GroupBulkAdd'
import { KickModal, RestrictModal } from './GroupMemberModals'
import { isRestrictionActive, PERM_LABEL, restrictionLabel, Section, type GroupPanelProps } from './shared'

const PAGE = 50

type Target = { kind: GroupMemberKind; id: string; name: string }
type Dialog = { type: 'admin'; target: Target } | { type: 'mute' | 'ban'; customer: Customer } | { type: 'kick'; customer: Customer } | { type: 'bulk' } | { type: 'seat' } | null

export function GroupMembers({ group: g, actor, perm, compact, canViewAll }: GroupPanelProps & { canViewAll: boolean }) {
  const s = useStore()
  const canPromote = perm('can_promote_members')
  const canRestrict = perm('can_restrict_members')
  const canInvite = perm('can_invite_users')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [menu, setMenu] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const nowIso = new Date().toISOString()

  const seats = useMemo(() => {
    const rank = (id: string) => (id === g.ownerSeatId ? 0 : groupRoleOf(g, 'seat', id) === 'admin' ? 1 : 2)
    return g.memberSeatIds.map((id) => seatById(s, id)).filter((x) => !!x).sort((a, b) => rank(a.id) - rank(b.id))
  }, [g, s])
  const bots = g.memberBotIds.map((id) => s.bots.find((b) => b.id === id)).filter((x) => !!x)
  const customers = useMemo(() => {
    const kw = q.trim()
    const rank = (id: string) => (groupRoleOf(g, 'customer', id) === 'admin' ? 0 : 1)
    return g.memberCustomerIds
      .map((id) => customerById(s, id))
      .filter((c): c is Customer => !!c && !c.deletedAt && (!kw || c.nickname.includes(kw)))
      .sort((a, b) => rank(a.id) - rank(b.id))
  }, [g, s, q])
  const banned = g.restrictions.filter((r) => r.kind === 'ban' && isRestrictionActive(r, nowIso)).map((r) => ({ r, c: customerById(s, r.customerId) })).filter((x) => !!x.c)
  const kw = q.trim()
  const shownSeats = kw ? seats.filter((x) => x.displayName.includes(kw)) : seats
  const shownBots = kw ? bots.filter((b) => b.nickname.includes(kw)) : bots

  const demote = (t: Target) => {
    s.demoteGroupAdmin(g.id, t.kind, t.id, actor)
    toast(`已撤销「${t.name}」的管理员`)
  }
  const lift = (c: Customer) => {
    s.liftGroupRestriction(g.id, c.id, actor)
    toast(`已解除「${c.nickname}」的限制`)
  }
  const adminPerms = (kind: GroupMemberKind, id: string) => g.admins.find((a) => a.memberKind === kind && a.memberId === id)?.perms ?? []

  return (
    <Section
      id="group-members"
      title={`成员（${g.memberSeatIds.length + g.memberCustomerIds.length + g.memberBotIds.length}）`}
      compact={compact}
      hint={g.settings.membersVisible ? '客户可见' : '客户端按策略不可见'}
      extra={
        canInvite && (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setDialog({ type: 'seat' })}>加坐席</Button>
            <Button size="sm" variant="primary" onClick={() => setDialog({ type: 'bulk' })}>批量拉人</Button>
          </div>
        )
      }
    >
      <div className="mb-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索成员昵称" className="h-7 text-[12px]" />
      </div>
      <ul className="space-y-1" onMouseLeave={() => setMenu(null)}>
        {shownSeats.map((seat) => {
          const role = groupRoleOf(g, 'seat', seat.id)
          const t: Target = { kind: 'seat', id: seat.id, name: seat.displayName }
          // 群主不可降级；没有任免权限时不出现菜单
          const actions = canPromote && role !== 'owner' ? (
            <>
              {role === 'member' && <MenuItem onClick={() => setDialog({ type: 'admin', target: t })}>设为管理员</MenuItem>}
              {role === 'admin' && <MenuItem onClick={() => setDialog({ type: 'admin', target: t })}>修改权限</MenuItem>}
              {role === 'admin' && <MenuItem danger onClick={() => demote(t)}>撤销管理员</MenuItem>}
            </>
          ) : undefined
          return (
            <Row key={seat.id} avatar={<SeatAvatar seat={seat} size={22} />} name={seat.displayName} role={role} extra={<Pill tone="blue">官方</Pill>} perms={adminPerms('seat', seat.id)} menuOpen={menu === seat.id} onMenu={() => setMenu(menu === seat.id ? null : seat.id)}>
              {actions}
            </Row>
          )
        })}
        {shownBots.map((b) => (
          <Row key={b.id} avatar={<Avatar text={b.nickname} size={22} color={b.avatarColor} />} name={b.nickname} role="bot" extra={<Pill tone="purple"><Bot size={10} className="mr-0.5" />机器人</Pill>} perms={[]} menuOpen={false} onMenu={() => toast('机器人账号在「群活跃助手」页管理', 'info')} />
        ))}
        {customers.slice(0, limit).map((c) => {
          const role = groupRoleOf(g, 'customer', c.id)
          const r = g.restrictions.find((x) => x.customerId === c.id && isRestrictionActive(x, nowIso))
          const title = c.primaryTitleId ? s.titles.find((x) => x.id === c.primaryTitleId && x.enabled) : undefined
          const t: Target = { kind: 'customer', id: c.id, name: c.nickname }
          const actions = canPromote || canRestrict ? (
            <>
              {canPromote && role === 'member' && <MenuItem onClick={() => setDialog({ type: 'admin', target: t })}>设为管理员（助教）</MenuItem>}
              {canPromote && role === 'admin' && <MenuItem onClick={() => setDialog({ type: 'admin', target: t })}>修改权限</MenuItem>}
              {canPromote && role === 'admin' && <MenuItem danger onClick={() => demote(t)}>撤销管理员</MenuItem>}
              {canRestrict && !r && <MenuItem onClick={() => setDialog({ type: 'mute', customer: c })}>禁言</MenuItem>}
              {canRestrict && r && <MenuItem onClick={() => lift(c)}>解除{r.kind === 'ban' ? '封禁' : '禁言'}</MenuItem>}
              {canRestrict && <MenuItem danger onClick={() => setDialog({ type: 'ban', customer: c })}>封禁</MenuItem>}
              {canRestrict && <MenuItem danger onClick={() => setDialog({ type: 'kick', customer: c })}>移出</MenuItem>}
            </>
          ) : undefined
          return (
            <Row key={c.id} avatar={<Avatar text={c.nickname} size={22} />} name={c.nickname} role={role} extra={title && <TitleChip title={title} size="xs" />} status={r ? restrictionLabel(r) : undefined} perms={adminPerms('customer', c.id)} menuOpen={menu === c.id} onMenu={() => setMenu(menu === c.id ? null : c.id)}>
              {actions}
            </Row>
          )
        })}
        {customers.length > limit && (
          <li>
            <Button size="sm" variant="ghost" onClick={() => setLimit((n) => n + PAGE)}>还有 {customers.length - limit} 位，显示更多</Button>
          </li>
        )}
        {!shownSeats.length && !shownBots.length && !customers.length && <li className="text-[12px] text-zinc-400">没有匹配的成员</li>}
      </ul>
      {banned.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[11px] font-medium text-zinc-500">已封禁（不在群，时限内无法通过链接返回）</div>
          <ul className="space-y-1">
            {banned.map(({ r, c }) => (
              <li key={c!.id} className="flex items-center gap-2 text-[12px]">
                <Avatar text={c!.nickname} size={20} />
                <span className="min-w-0 flex-1 truncate text-zinc-600">{c!.nickname}</span>
                <span className="text-[11px] text-red-600">{restrictionLabel(r)}</span>
                {canRestrict && <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[11px]" onClick={() => lift(c!)}>解封</Button>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {dialog?.type === 'admin' && <GroupAdminModal group={g} actor={actor} target={dialog.target} onClose={() => setDialog(null)} />}
      {(dialog?.type === 'mute' || dialog?.type === 'ban') && <RestrictModal group={g} actor={actor} customer={dialog.customer} kind={dialog.type} onClose={() => setDialog(null)} />}
      {dialog?.type === 'kick' && <KickModal group={g} actor={actor} customer={dialog.customer} onClose={() => setDialog(null)} />}
      {dialog?.type === 'bulk' && <GroupBulkAddModal group={g} actor={actor} canViewAll={canViewAll} onClose={() => setDialog(null)} />}
      {dialog?.type === 'seat' && <AddSeatModal group={g} actor={actor} onClose={() => setDialog(null)} />}
    </Section>
  )
}

const ROLE_TEXT: Record<string, { label: string; tone: 'amber' | 'blue' | 'zinc' | 'purple' }> = {
  owner: { label: '群主', tone: 'amber' },
  admin: { label: '管理员', tone: 'blue' },
  member: { label: '成员', tone: 'zinc' },
  bot: { label: '机器人', tone: 'purple' },
}

function Row({ avatar, name, role, extra, status, perms, menuOpen, onMenu, children }: { avatar: React.ReactNode; name: string; role: string; extra?: React.ReactNode; status?: string; perms: string[]; menuOpen: boolean; onMenu: () => void; children?: React.ReactNode }) {
  const rt = ROLE_TEXT[role] ?? ROLE_TEXT.member
  return (
    <li className="relative flex items-center gap-2 text-[13px]">
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-zinc-900">{name}</span>
          {extra}
          <Pill tone={rt.tone}>{role === 'owner' ? <Crown size={10} className="mr-0.5" /> : role === 'admin' ? <Shield size={10} className="mr-0.5" /> : null}{rt.label}</Pill>
        </div>
        {(status || perms.length > 0) && (
          <div className="truncate text-[11px] text-zinc-400" title={perms.map((p) => PERM_LABEL[p as keyof typeof PERM_LABEL]).join('、')}>
            {status && <span className="text-red-600">{status}</span>}
            {status && perms.length > 0 && ' · '}
            {perms.length > 0 && `权限：${perms.map((p) => PERM_LABEL[p as keyof typeof PERM_LABEL]).join('、')}`}
          </div>
        )}
      </div>
      {children !== undefined && (
        <button type="button" onClick={onMenu} className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="操作">
          <MoreHorizontal size={14} />
        </button>
      )}
      {menuOpen && <div className="absolute top-6 right-0 z-20 w-48 rounded-md border border-zinc-200 bg-white py-1 shadow-lg">{children}</div>}
    </li>
  )
}

function MenuItem({ children, onClick, danger, disabled }: { children: React.ReactNode; onClick?: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`block w-full px-3 py-1.5 text-left text-[13px] ${disabled ? 'cursor-default text-zinc-400' : danger ? 'text-red-700 hover:bg-red-50' : 'text-zinc-700 hover:bg-zinc-50'}`}>
      {children}
    </button>
  )
}

function AddSeatModal({ group: g, actor, onClose }: Pick<GroupPanelProps, 'group' | 'actor'> & { onClose: () => void }) {
  const s = useStore()
  const options = s.seats.filter((x) => x.status !== 'disabled' && !g.memberSeatIds.includes(x.id))
  const [seatId, setSeatId] = useState(options[0]?.id ?? '')
  const submit = () => {
    s.addGroupSeat(g.id, seatId, actor)
    toast(`坐席「${seatById(s, seatId)?.displayName}」已加入群`)
    onClose()
  }
  return (
    <Modal open onClose={onClose} title="把坐席加入群" width={400} footer={<><Button onClick={onClose}>取消</Button><Button variant="primary" disabled={!seatId} onClick={submit}>加入</Button></>}>
      {!options.length && <div className="text-xs text-zinc-500">所有可用坐席都已在群里。</div>}
      {options.length > 0 && (
        <Select value={seatId} onChange={(e) => setSeatId(e.target.value)}>
          {options.map((x) => <option key={x.id} value={x.id}>{x.displayName}（{x.roleDesc}）</option>)}
        </Select>
      )}
      <div className="mt-2 text-[12px] text-zinc-400">坐席入群后默认是普通成员；要给管理权限再在成员列表里「设为管理员」。</div>
    </Modal>
  )
}
