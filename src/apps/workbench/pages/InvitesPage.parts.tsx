/**
 * 邀请链接的「附带动作」：注册时自动入群取邀请组与本链接的并集，
 * 这里算出并渲染；管理后台的邀请链接总览也用 AttachedActionsCell。
 * 另有工作台的生成链接弹窗。
 */
import { useState } from 'react'
import type { DemoState, InviteLink } from '@/domain/types'
import { fmtDate } from '@/domain/time'
import { seatIdsOf } from '@/domain/allocation'
import { INVITE_CODE_HINT, INVITE_CODE_MAX, inviteCodeError, normalizeInviteCode } from '@/domain/inviteCode'
import { Button, Checkbox, Field, Input, Select } from '@/ui/primitives'
import { Pill } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { useWorkbench } from '../useWorkbench'
import { LINK_HOST, MAX_USES_LIMIT, attachedGroups, type AttachLayer } from './InvitesPage.shared'

const LAYER_LABEL: Record<AttachLayer, string> = { group: '组', link: '本链接' }
const LAYER_TONE: Record<AttachLayer, 'purple' | 'green'> = { group: 'purple', link: 'green' }

export function AttachedActionsCell({ s, link }: { s: DemoState; link: Pick<InviteLink, 'inviteGroupId' | 'chatGroupIds'> }) {
  const list = attachedGroups(s, link)
  if (!list.length) return <span className="text-zinc-300">无</span>
  return (
    <div className="flex flex-wrap gap-1">
      {list.map(({ group, layer }) => (
        <span key={group.id} className="inline-flex items-center gap-0.5 rounded-md border border-zinc-200 px-1 text-[11px] leading-5 text-zinc-700" title={`${group.kind === 'channel' ? '频道' : '群'} · 来源：${LAYER_LABEL[layer]}`}>
          {group.name}
          <Pill tone={LAYER_TONE[layer]} className="ml-0.5 !px-1 !leading-4">
            {LAYER_LABEL[layer]}
          </Pill>
        </span>
      ))}
    </div>
  )
}

const EXPIRE_OPTIONS = [
  { value: 'never', label: '永久' },
  { value: '1', label: '1 天' },
  { value: '7', label: '7 天' },
  { value: '30', label: '30 天' },
  { value: 'custom', label: '自定义日期' },
]

/** 工作台生成链接：邀请组只列包含当前坐席的组；附带动作里已被组覆盖的群打勾禁用 */
export function InviteCreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { s, staff, seat } = useWorkbench()
  const [form, setForm] = useState({ name: '', groupId: '', expires: 'never', customDate: '', max: '', code: '', chatGroupIds: [] as string[] })
  const patch = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }))
  const myGroups = s.inviteGroups.filter((g) => g.enabled && seat && seatIdsOf(g).includes(seat.id))
  const ig = s.inviteGroups.find((g) => g.id === form.groupId)
  const today = fmtDate(new Date().toISOString())
  const coveredBy = (gid: string): AttachLayer | null => (ig?.chatGroupIds.includes(gid) ? 'group' : null)

  const nameOk = form.name.trim().length >= 1 && form.name.trim().length <= 32
  const dateOk = form.expires !== 'custom' || (!!form.customDate && form.customDate >= today)
  const maxNum = form.max.trim() === '' ? null : Number(form.max)
  const maxOk = maxNum == null || (Number.isInteger(maxNum) && maxNum >= 1 && maxNum <= MAX_USES_LIMIT)
  const codeErr = form.code.trim() ? inviteCodeError(form.code, s.takenInviteCodes()) : undefined
  const error = !dateOk ? '自定义有效期不能早于今天' : !maxOk ? `使用上限须为 1 到 ${MAX_USES_LIMIT} 的整数，留空表示无限制` : (codeErr ?? '')
  const ok = nameOk && !!form.groupId && dateOk && maxOk && !codeErr

  const submit = () => {
    if (!ok || !staff) return
    const expiresAt = form.expires === 'never' ? null : form.expires === 'custom' ? new Date(`${form.customDate}T23:59:59`).toISOString() : new Date(Date.now() + Number(form.expires) * 86400000).toISOString()
    const chatGroupIds = form.chatGroupIds.filter((gid) => !coveredBy(gid))
    const r = s.createInviteLink({ name: form.name.trim(), inviteGroupId: form.groupId, creatorStaffId: staff.id, expiresAt, maxUses: maxNum, chatGroupIds, code: form.code.trim() ? normalizeInviteCode(form.code) : undefined })
    if (!r.ok) return toast(r.error, 'warn')
    toast(`已生成：${LINK_HOST}${r.link.code}，邀请码 ${r.link.code}。客户在注册页输码等同点链接`)
    setForm({ name: '', groupId: '', expires: 'never', customDate: '', max: '', code: '', chatGroupIds: [] })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="生成邀请链接"
      width={520}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!ok} onClick={submit}>
            生成
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="链接名称" required hint="1 到 32 字符">
          <Input value={form.name} maxLength={32} onChange={(e) => patch({ name: e.target.value })} placeholder="如：10 月直播 · 第二场" />
        </Field>
        <Field label="自定义邀请码" hint={`留空自动生成；${INVITE_CODE_HINT}`}>
          <Input value={form.code} maxLength={INVITE_CODE_MAX} onChange={(e) => patch({ code: e.target.value.toUpperCase() })} placeholder="留空自动生成" className="font-mono tracking-wider" />
        </Field>
        <Field label="邀请组" required hint="只列出包含当前坐席的组；组决定自动添加哪几个坐席">
          <Select value={form.groupId} onChange={(e) => patch({ groupId: e.target.value })}>
            <option value="">选择…</option>
            {myGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}（{seatIdsOf(g).map((id) => s.seats.find((x) => x.id === id)?.displayName).join('、')}）
              </option>
            ))}
          </Select>
        </Field>
        <Field label="附带动作" hint="通过本链接注册的客户额外自动加入；已被邀请组覆盖的群打勾禁用">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-md border border-zinc-200 px-3 py-2">
            {s.chatGroups.map((g) => {
              const covered = coveredBy(g.id)
              return (
                <Checkbox
                  key={g.id}
                  checked={!!covered || form.chatGroupIds.includes(g.id)}
                  disabled={!!covered}
                  onChange={(v) => patch({ chatGroupIds: v ? [...form.chatGroupIds, g.id] : form.chatGroupIds.filter((x) => x !== g.id) })}
                  label={
                    <span>
                      {g.name}
                      {covered && <span className="ml-1 text-[11px] text-zinc-400">（{LAYER_LABEL[covered]}已覆盖）</span>}
                    </span>
                  }
                />
              )
            })}
            {s.chatGroups.length === 0 && <span className="text-[11px] text-zinc-400">企业还没有群或频道</span>}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="有效期">
            <Select value={form.expires} onChange={(e) => patch({ expires: e.target.value })}>
              {EXPIRE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="使用上限" hint={`1 到 ${MAX_USES_LIMIT}，留空无限制`}>
            <Input inputMode="numeric" value={form.max} placeholder="无限制" onChange={(e) => patch({ max: e.target.value })} />
          </Field>
        </div>
        {form.expires === 'custom' && (
          <Field label="截止日期" required hint="当天 23:59 过期">
            <Input type="date" min={today} value={form.customDate} onChange={(e) => patch({ customDate: e.target.value })} />
          </Field>
        )}
        {error && <div className="text-[12px] text-red-600">{error}</div>}
        <p className="text-[11px] text-zinc-400">生成后链接与邀请码同时可用，落点与所选邀请组相同，注册数分开统计。</p>
      </div>
    </Modal>
  )
}
