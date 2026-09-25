/**
 * 成员管理弹窗：禁言 / 移出并禁止再进（选时限 + 原因）、移出（勾选"删除该用户所有消息"）。
 * 都走「限制成员」权限，由 GroupMembers 决定显示与否。
 */
import { useState } from 'react'
import type { Customer } from '@/domain/types'
import { useStore } from '@/store/store'
import { Button, Checkbox, Field, Select, Textarea } from '@/ui/primitives'
import { Modal, toast } from '@/ui/overlay'
import { RESTRICT_DURATIONS } from './groupRules'
import type { GroupPanelProps } from './shared'

const REASON_MAX = 100

export function RestrictModal({ group: g, actor, customer: c, kind, onClose }: Pick<GroupPanelProps, 'group' | 'actor'> & { customer: Customer; kind: 'mute' | 'ban'; onClose: () => void }) {
  const s = useStore()
  const [idx, setIdx] = useState(1)
  const [reason, setReason] = useState('')
  const dur = RESTRICT_DURATIONS[idx]
  const isBan = kind === 'ban'
  const submit = () => {
    const result = s.restrictGroupMember(g.id, c.id, kind, dur.hours, reason.trim(), actor)
    if (result) return toast(result.reason, 'warn')
    toast(isBan ? `已移出「${c.nickname}」并禁止再进（${dur.label}）；期间无法通过链接返回` : `已禁言「${c.nickname}」（${dur.label}）`, 'warn')
    onClose()
  }
  return (
    <Modal open onClose={onClose} title={`${isBan ? '移出并禁止再进' : '禁言'}：${c.nickname}`} width={420} footer={<><Button onClick={onClose}>取消</Button><Button variant="danger" onClick={submit}>{isBan ? '移出并禁止再进' : '禁言'}</Button></>}>
      <div className="space-y-3">
        <Field label="时限" required>
          <Select value={String(idx)} onChange={(e) => setIdx(Number(e.target.value))}>
            {RESTRICT_DURATIONS.map((d, i) => <option key={d.label} value={i}>{d.label}</option>)}
          </Select>
        </Field>
        <Field label="原因" hint={`${reason.length}/${REASON_MAX}，记入管理员日志与审计`}>
          <Textarea rows={2} maxLength={REASON_MAX} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="例如：多次发第三方理财链接" />
        </Field>
        <p className="text-[12px] leading-relaxed text-zinc-500">
          {isBan ? '移出并禁止再进会同时把客户移出群，时限内无法通过邀请链接返回；解除禁止后不会自动回群，可通过链接重新加入。' : '禁言只限制在本群发言；到期自动解除，也可以手动解除。'}
        </p>
      </div>
    </Modal>
  )
}

export function KickModal({ group: g, actor, customer: c, onClose }: Pick<GroupPanelProps, 'group' | 'actor'> & { customer: Customer; onClose: () => void }) {
  const s = useStore()
  const [purge, setPurge] = useState(false)
  const submit = () => {
    const result = s.kickGroupMember(g.id, c.id, purge, actor)
    if (result) return toast(result.reason, 'warn')
    toast(`已把「${c.nickname}」移出「${g.name}」${purge ? '，并删除其全部消息' : ''}`, 'warn')
    onClose()
  }
  return (
    <Modal open onClose={onClose} title={`把「${c.nickname}」移出群？`} width={420} footer={<><Button onClick={onClose}>取消</Button><Button variant="danger" onClick={submit}>移出</Button></>}>
      <div className="space-y-3 text-[13px] text-zinc-700">
        <p>移出后客户不再收到该群消息，可以通过邀请链接再次加入（要拦住用「移出并禁止再进」）。如果客户是本群管理员，同时撤销。</p>
        <Checkbox checked={purge} onChange={setPurge} label="同时删除该用户在本群发出的全部消息" />
      </div>
    </Modal>
  )
}
