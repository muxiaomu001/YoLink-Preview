/**
 * 员工页的弹窗：创建员工、编辑员工、重置密码。
 */
import { useState } from 'react'
import type { Staff } from '@/domain/types'
import { useStore } from '@/store/store'
import { staffById } from '@/store/selectors'
import { Button, Checkbox, Field, Input, Select } from '@/ui/primitives'
import { Note, Pill, SeatAvatar } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 8

/** 姓名 1-32、邮箱可选但要合法 */
function validateProfile(name: string, email: string): string | null {
  const n = name.trim()
  if (n.length < 1 || n.length > 32) return '姓名 1 到 32 字'
  if (email.trim() && !EMAIL_RE.test(email.trim())) return '邮箱格式不正确'
  return null
}

export function CreateStaffModal({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', mustChange: true, roleId: 'role_seat', withSeat: true, roleDesc: '投资顾问' })
  const [assignSeatIds, setAssignSeatIds] = useState<string[]>([])
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const seats = s.seats.filter((x) => x.status !== 'disabled')

  const error = (() => {
    const p = validateProfile(form.name, form.email)
    if (p) return p
    if (!form.username.trim()) return '用户名必填'
    if (s.staff.some((x) => x.username === form.username.trim())) return '用户名已被占用'
    if (form.password.length < MIN_PASSWORD) return `密码至少 ${MIN_PASSWORD} 位`
    return null
  })()
  const touched = form.name || form.username || form.password
  const submit = () => {
    if (error) return
    s.createStaff(
      { name: form.name.trim(), username: form.username.trim(), email: form.email.trim() || undefined, roleId: form.roleId, withSeat: form.withSeat, roleDesc: form.roleDesc, assignSeatIds, mustChangePassword: form.mustChange },
      admin,
    )
    const parts = [form.withSeat ? `与同名坐席「${form.name}」` : '', assignSeatIds.length ? `，并接手 ${assignSeatIds.length} 个已有坐席` : ''].join('')
    toast(`已创建员工 ${form.name}${parts}`)
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="创建员工"
      width={600}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!!error} onClick={submit}>
            创建
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="姓名" required hint="1 到 32 字">
            <Input value={form.name} maxLength={32} onChange={(e) => set('name', e.target.value)} placeholder="真人姓名" />
          </Field>
          <Field label="用户名" required hint="登录用，唯一">
            <Input value={form.username} onChange={(e) => set('username', e.target.value)} placeholder="拼音或英文" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="邮箱" hint="可选">
            <Input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="name@company.com" />
          </Field>
          <Field label="员工角色" required>
            <Select value={form.roleId} onChange={(e) => set('roleId', e.target.value)}>
              {s.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 items-end gap-3">
          <Field label="密码" required hint={`至少 ${MIN_PASSWORD} 字符`}>
            <Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="初始密码" />
          </Field>
          <div className="pb-1.5">
            <Checkbox checked={form.mustChange} onChange={(v) => set('mustChange', v)} label="下次登录必须修改密码" />
          </div>
        </div>
        <div className="rounded-md border border-brand-100 bg-brand-50/50 p-3">
          <Checkbox checked={form.withSeat} onChange={(v) => set('withSeat', v)} label={<span className="font-medium">同时创建同名坐席并指派给他</span>} />
          <p className="mt-1 pl-5 text-[11px] leading-relaxed text-zinc-500">默认勾选。以员工姓名为显示名建一个分配型坐席并指派给他；显示名、头像、职能说明之后在坐席页改。</p>
          {form.withSeat && (
            <div className="mt-2 pl-5">
              <Field label="坐席职能说明">
                <Input value={form.roleDesc} maxLength={64} onChange={(e) => set('roleDesc', e.target.value)} />
              </Field>
            </div>
          )}
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-600">指派已有坐席（可选，多选）</div>
          <div className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
            {seats.map((seat) => {
              const holder = staffById(s, seat.operatorStaffId)
              return (
                <div key={seat.id} className="flex items-center gap-3 px-3 py-1.5">
                  <Checkbox checked={assignSeatIds.includes(seat.id)} onChange={(v) => setAssignSeatIds((l) => (v ? [...l, seat.id] : l.filter((x) => x !== seat.id)))} />
                  <SeatAvatar seat={seat} size={22} />
                  <span className="text-[13px] text-zinc-900">{seat.displayName}</span>
                  <span className="text-[11px] text-zinc-400">当前实操：{holder?.name ?? '无'}</span>
                </div>
              )
            })}
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">选中的坐席会从原实操员工那里交接过来（记入交接记录），客户零感知。也可以之后在坐席页做交接。</p>
        </div>
        {touched && error && <p className="text-[11px] text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}

export function EditStaffModal({ staff, onClose }: { staff: Staff; onClose: () => void }) {
  const s = useStore()
  const [form, setForm] = useState({ name: staff.name, email: staff.email ?? '', roleId: staff.roleId })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const error = validateProfile(form.name, form.email)
  const submit = () => {
    if (error) return
    s.updateStaff(staff.id, { name: form.name.trim(), email: form.email.trim() || undefined, roleId: form.roleId }, s.session.adminStaffId!)
    toast(`已更新员工 ${form.name.trim()}`)
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`编辑员工：${staff.name}`}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!!error} onClick={submit}>
            保存
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="姓名" required hint="1 到 32 字">
          <Input value={form.name} maxLength={32} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="用户名" hint="登录用，创建后不可改">
          <Input value={staff.username} disabled />
        </Field>
        <Field label="邮箱" hint="可选">
          <Input value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="员工角色" required>
          <Select value={form.roleId} disabled={staff.id === s.session.adminStaffId} onChange={(e) => set('roleId', e.target.value)}>
            {s.roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
        <Note>改姓名只影响后台与工作台显示，客户看到的是坐席显示名，不受影响。</Note>
      </div>
    </Modal>
  )
}

type ResetMode = 'random' | 'manual' | 'email'

export function ResetPasswordModal({ staff, onClose }: { staff: Staff; onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [mode, setMode] = useState<ResetMode>('random')
  const [password, setPassword] = useState('')
  const [mustChange, setMustChange] = useState(true)
  const [generated, setGenerated] = useState<string | null>(null)
  const manualOk = password.length >= MIN_PASSWORD

  const runRandom = () => {
    const pwd = s.resetPassword(staff.id, { mode: 'random' }, admin)
    setGenerated(pwd ?? null)
  }
  const runManual = () => {
    if (!manualOk) return
    s.resetPassword(staff.id, { mode: 'manual', password, mustChange }, admin)
    toast(`已为 ${staff.name} 设置新密码${mustChange ? '，下次登录必须修改' : ''}`)
    onClose()
  }
  const modes: { key: ResetMode; label: string; disabled?: boolean }[] = [
    { key: 'random', label: '随机生成' },
    { key: 'manual', label: '手动设置' },
    { key: 'email', label: '邮件发送（P2）', disabled: true },
  ]
  return (
    <Modal
      open
      onClose={onClose}
      title={`重置密码：${staff.name}`}
      footer={
        <>
          <Button onClick={onClose}>{generated ? '关闭' : '取消'}</Button>
          {mode === 'random' && !generated && (
            <Button variant="primary" onClick={runRandom}>
              随机生成
            </Button>
          )}
          {mode === 'manual' && (
            <Button variant="primary" disabled={!manualOk} onClick={runManual}>
              设置密码
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex gap-4">
          {modes.map((m) => (
            <label key={m.key} className={`flex items-center gap-1.5 text-[13px] ${m.disabled ? 'text-zinc-400' : 'text-zinc-700 cursor-pointer'}`}>
              <input type="radio" name="reset-mode" className="accent-brand-700" checked={mode === m.key} disabled={m.disabled || !!generated} onChange={() => setMode(m.key)} />
              {m.label}
            </label>
          ))}
        </div>
        {mode === 'random' && !generated && <Note>系统生成随机密码显示给管理员一次，由管理员转告员工；员工首次登录强制修改。</Note>}
        {generated && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <div className="text-[11px] text-amber-800">新密码（只显示一次，请立即转告员工；首次登录强制修改）</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded bg-white px-2 py-1 font-mono text-base tracking-wider text-zinc-900">{generated}</span>
              <Button
                size="sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(generated)
                  toast('已复制新密码')
                }}
              >
                复制
              </Button>
            </div>
          </div>
        )}
        {mode === 'manual' && (
          <>
            <Field label="新密码" required hint={`至少 ${MIN_PASSWORD} 字符`}>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {password.length > 0 && !manualOk && <p className="text-[11px] text-red-600">密码至少 {MIN_PASSWORD} 位</p>}
            <Checkbox checked={mustChange} onChange={setMustChange} label="下次登录必须修改密码" />
          </>
        )}
        <p className="text-[11px] text-zinc-400">
          <Pill>P2</Pill> 邮件发送：随机密码发到员工邮箱，随邮件服务商一起推到 P2。
        </p>
      </div>
    </Modal>
  )
}
