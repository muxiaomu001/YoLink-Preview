import { useState } from 'react'
import { seatGroupPerm } from '@/store/policy'
import { Empty, Note } from '@/ui/display'
import { Button, Field, Select } from '@/ui/primitives'
import { Modal } from '@/ui/overlay'
import { useWorkbench } from '../../useWorkbench'
import { GroupCard } from './GroupCard'

export function AllGroupsManager() {
  const { staff, can } = useWorkbench()
  const [open, setOpen] = useState(false)
  if (staff?.status !== 'active' || !can('manage_groups')) return null
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>管理群</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="管理所有群" width={880}>
        <AllGroupsPanel />
      </Modal>
    </>
  )
}

export function AllGroupsPanel() {
  const { s, staff, seat, can } = useWorkbench()
  const [groupId, setGroupId] = useState(s.chatGroups[0]?.id ?? '')
  if (staff?.status !== 'active' || !can('manage_groups')) return <Note>需要「管理所有群」权限</Note>
  const group = s.chatGroups.find((item) => item.id === groupId)
  if (!group) return <Empty text="暂无可管理的群" />
  const actorSeatId = seat?.id ?? group.ownerSeatId
  const actorSeat = s.seats.find((item) => item.id === actorSeatId)
  const identityNote = `以${seat ? '当前坐席' : '群主坐席'}「${actorSeat?.displayName ?? '坐席'}」的身份操作，操作记在你的名下`
  return (
    <div className="space-y-3">
      <Field label="选择群">
        <Select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
          {s.chatGroups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
      </Field>
      <GroupCard key={group.id} group={group} actor={{ seatId: actorSeatId, staffId: staff.id, source: 'workbench' }} perm={(permission) => seatGroupPerm(s, group, actorSeatId, staff.id, permission)} officialEditable canViewAllCustomers={can('view_all_customers')} identityNote={identityNote} />
    </div>
  )
}
