/**
 * 把客户拉进群的弹窗（从「拉进群」快捷动作与所在群分区打开）：
 * 选一个本坐席有「邀请用户」权限的群，跳过原因在 toast 里说清。
 */
import { useState } from 'react'
import type { ChatGroup, Customer, DemoState } from '@/domain/types'
import { groupCapacity, seatGroupPerm } from '@/store/policy'
import { Button, Select } from '@/ui/primitives'
import { Modal, toast } from '@/ui/overlay'
import { useWorkbench } from '../../useWorkbench'

/** 拉不进群的原因（与 addGroupMembers 的跳过条件一致） */
function skipReason(s: DemoState, g: ChatGroup, c: Customer): string {
  if (c.deletedAt) return '客户已注销'
  if (g.memberCustomerIds.includes(c.id)) return '已在群里'
  if (g.restrictions.some((r) => r.customerId === c.id && r.kind === 'ban' && (r.until === null || r.until > new Date().toISOString()))) return '该客户已被移出并禁止再进'
  if (g.requiredTitleId && !c.titleIds.includes(g.requiredTitleId)) return `需要头衔「${s.titles.find((t) => t.id === g.requiredTitleId)?.name ?? ''}」`
  if (g.memberCustomerIds.length >= groupCapacity(s, g)) return '群已满'
  return '未知原因'
}

export function JoinGroupModal({ c, open, onClose }: { c: Customer; open: boolean; onClose: () => void }) {
  const { s, staff, seat } = useWorkbench()
  const [pick, setPick] = useState('')
  if (!staff || !seat) return null
  const candidates = s.chatGroups.filter((g) => !g.memberCustomerIds.includes(c.id))
  const picked = s.chatGroups.find((g) => g.id === pick)

  const close = () => {
    setPick('')
    onClose()
  }
  const join = () => {
    if (!picked) return
    const r = s.addGroupMembers(picked.id, [c.id], { seatId: seat.id, staffId: staff.id })
    if ('reason' in r) return toast(r.reason, 'warn')
    if (r.added) toast(`已把「${c.nickname}」拉入「${picked.name}」`)
    else toast(`未拉入「${picked.name}」：${skipReason(s, picked, c)}`, 'warn')
    close()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={`把「${c.nickname}」拉入群`}
      width={420}
      footer={
        <>
          <Button onClick={close}>取消</Button>
          <Button variant="primary" disabled={!picked} onClick={join}>
            拉入
          </Button>
        </>
      }
    >
      <Select value={pick} onChange={(e) => setPick(e.target.value)}>
        <option value="">选择群或频道…</option>
        {candidates.map((g) => {
          const allowed = seatGroupPerm(s, g, seat.id, staff.id, 'can_invite_users')
          return (
            <option key={g.id} value={g.id} disabled={!allowed}>
              {g.name}（{g.memberCustomerIds.length}/{groupCapacity(s, g)}）{allowed ? '' : ' · 本坐席无拉人权限'}
            </option>
          )
        })}
      </Select>
      {candidates.length === 0 && <p className="mt-2 text-[12px] text-zinc-400">客户已在所有群里。</p>}
    </Modal>
  )
}
