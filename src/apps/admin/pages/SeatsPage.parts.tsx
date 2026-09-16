/**
 * 坐席页的弹窗：交接、创建/编辑。
 */
import { useState } from 'react'
import type { Seat } from '@/domain/types'
import { useStore } from '@/store/store'
import { customersOfSeat, staffById } from '@/store/selectors'
import { Button, Field, Input, Select, Switch, Textarea } from '@/ui/primitives'
import { Note, SeatAvatar } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'

export function HandoverModal({ seat, onClose }: { seat: Seat; onClose: () => void }) {
  const s = useStore()
  const from = staffById(s, seat.operatorStaffId)
  const candidates = s.staff.filter((x) => x.status === 'active' && x.id !== seat.operatorStaffId)
  const [to, setTo] = useState(candidates[0]?.id ?? '')
  const [reason, setReason] = useState('')
  const customers = customersOfSeat(s, seat.id).length
  const convs = s.conversations.filter((c) => c.kind === 'dm' && c.seatId === seat.id).length
  const reasonOk = reason.trim().length >= 1 && reason.trim().length <= 128
  const submit = () => {
    if (!to || !reasonOk) return
    s.handoverSeat(seat.id, to, reason.trim(), s.session.adminStaffId!)
    toast(`「${seat.displayName}」已交接给 ${staffById(s, to)?.name}，客户侧无任何变化`)
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`坐席交接：${seat.displayName}`}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!to || !reasonOk} onClick={submit}>
            确认交接
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-md bg-zinc-50 p-3">
          <SeatAvatar seat={seat} size={40} />
          <div className="text-xs">
            <div className="font-medium text-zinc-900">{seat.displayName}</div>
            <div className="text-zinc-500">{seat.roleDesc}</div>
            <div className="mt-1 text-zinc-500">
              主归属客户 {customers} 位 · 私聊会话 {convs} 条 · 当前实操：{from?.name ?? '无'}
            </div>
          </div>
        </div>
        <Field label="新实操员工" required>
          <Select value={to} onChange={(e) => setTo(e.target.value)}>
            {candidates.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}（{s.roles.find((r) => r.id === st.roleId)?.name}）
              </option>
            ))}
          </Select>
        </Field>
        <Field label="交接原因" required hint="1 到 128 字，进永久记录">
          <Textarea rows={2} maxLength={128} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="例如：林薇离职，客户由王芳接手" />
        </Field>
        {reason.length > 0 && !reasonOk && <p className="text-[11px] text-red-600">交接原因 1 到 128 字</p>}
        <Note>
          交接后：<b>客户零感知</b>，显示名、头像、历史消息全不变；新人立即看到该坐席全部会话与完整历史；旧人立即失去该坐席的访问。这条记录永久保留，是「这句话到底是谁说的」的审计依据。
        </Note>
      </div>
    </Modal>
  )
}

interface SeatForm {
  displayName: string
  roleDesc: string
  operatorStaffId: string
  welcome: string
  customerDeletable: boolean
}

/** 校验：显示名 1-32、职能说明 0-64 */
function validate(f: SeatForm): string | null {
  const name = f.displayName.trim()
  if (name.length < 1 || name.length > 32) return '显示名 1 到 32 字'
  if (f.roleDesc.length > 64) return '职能说明最多 64 字'
  return null
}

export function SeatEditModal({ seat, onClose }: { seat?: Seat; onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [form, setForm] = useState<SeatForm>({
    displayName: seat?.displayName ?? '',
    roleDesc: seat?.roleDesc ?? '',
    operatorStaffId: seat?.operatorStaffId ?? '',
    welcome: seat?.welcome ?? '',
    customerDeletable: seat?.customerDeletable ?? false,
  })
  const set = <K extends keyof SeatForm>(k: K, v: SeatForm[K]) => setForm((f) => ({ ...f, [k]: v }))
  const error = validate(form)
  const submit = () => {
    if (error) return
    const patch = {
      displayName: form.displayName.trim(),
      roleDesc: form.roleDesc.trim(),
      operatorStaffId: form.operatorStaffId || null,
      welcome: form.welcome,
      customerDeletable: form.customerDeletable,
    }
    if (seat) {
      s.updateSeat(seat.id, patch, admin)
      toast('坐席已更新')
    } else {
      s.createSeat({ ...patch, status: patch.operatorStaffId ? 'accepting' : 'paused' }, admin)
      toast('坐席已创建。记得把它放进邀请组，否则新客户不会加到它')
    }
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={seat ? `编辑坐席：${seat.displayName}` : '创建坐席'}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={submit} disabled={!!error}>
            {seat ? '保存' : '创建'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {seat && <Note tone="amber">显示名和头像创建后可改，但客户会看到名字变了。除非确实要改，否则不要动。</Note>}
        <Field label="显示名" required hint="客户看到的名字，1 到 32 字">
          <Input value={form.displayName} maxLength={32} onChange={(e) => set('displayName', e.target.value)} placeholder="如：林顾问" />
        </Field>
        <Field label="职能说明" hint="0 到 64 字，多个官方号时客户靠它判断该找谁">
          <Input value={form.roleDesc} maxLength={64} onChange={(e) => set('roleDesc', e.target.value)} placeholder="如：资深投资顾问 · 全球资产配置" />
        </Field>
        <Field label="实操员工" hint="留空则暂停接新">
          <Select value={form.operatorStaffId} onChange={(e) => set('operatorStaffId', e.target.value)}>
            <option value="">无</option>
            {s.staff
              .filter((x) => x.status === 'active')
              .map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="欢迎语" hint="支持 {{customer.nickname}}、{{seat.name}}；留空用企业默认">
          <Textarea rows={3} value={form.welcome} onChange={(e) => set('welcome', e.target.value)} />
        </Field>
        <div className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2">
          <div className="text-xs">
            <div className="font-medium text-zinc-800">客户可删除会话</div>
            <div className="text-zinc-500">关闭时客户删不掉与该坐席的会话（主归属坐席、公告号建议关闭）</div>
          </div>
          <Switch checked={form.customerDeletable} onChange={(v) => set('customerDeletable', v)} />
        </div>
        {error && form.displayName.length > 0 && <p className="text-[11px] text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}
