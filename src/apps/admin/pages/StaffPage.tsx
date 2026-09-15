import { useState } from 'react'
import { Plus } from 'lucide-react'
import { fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { seatsOfStaff } from '@/store/selectors'
import { Button, Checkbox, Field, Input, Select } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, SeatAvatar, Table } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'

export function StaffPage() {
  const s = useStore()
  const [creating, setCreating] = useState(false)
  return (
    <div>
      <PageHeader
        title="员工账号"
        desc="员工是真人，用自己的账号登录工作台，操作时以坐席身份对外。客户永远看不到员工。"
        extra={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={14} /> 创建员工
          </Button>
        }
      />
      <Note>
        人员变更走「坐席交接 + 停用账号」，不再用重置密码改显示名的老办法。停用后立即撤销全部登录会话；该员工持有的坐席先在坐席页交接给新人。
      </Note>
      <Card className="mt-4" padded={false}>
        <Table
          rows={s.staff}
          rowKey={(st) => st.id}
          columns={[
            { key: 'name', title: '姓名', render: (st) => <span className="font-medium text-zinc-900">{st.name}</span> },
            { key: 'username', title: '用户名', render: (st) => <span className="font-mono text-xs text-zinc-600">{st.username}</span> },
            { key: 'email', title: '邮箱', render: (st) => <span className="text-zinc-500">{st.email ?? '-'}</span> },
            { key: 'role', title: '角色', render: (st) => s.roles.find((r) => r.id === st.roleId)?.name },
            {
              key: 'seats',
              title: '持有坐席',
              render: (st) => {
                const seats = seatsOfStaff(s, st.id)
                return seats.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {seats.map((seat) => (
                      <span key={seat.id} className="inline-flex items-center gap-1 rounded-full border border-zinc-200 py-0.5 pr-2 pl-0.5 text-xs">
                        <SeatAvatar seat={seat} size={18} /> {seat.displayName}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-zinc-400">无（等待交接）</span>
                )
              },
            },
            { key: 'status', title: '状态', render: (st) => (st.status === 'active' ? <Pill tone="green">激活</Pill> : <Pill tone="red">停用</Pill>) },
            { key: 'login', title: '最后登录', render: (st) => <span className="tabular-nums text-zinc-500">{st.lastLoginAt ? fmtDateTime(st.lastLoginAt) : '从未登录'}</span> },
            {
              key: 'ops',
              title: '操作',
              align: 'right',
              render: (st) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => toast('演示：已生成随机密码并显示给管理员一次')}>
                    重置密码
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toast(`演示：已撤销 ${st.name} 的全部登录会话`)}>
                    强制下线
                  </Button>
                  {st.status === 'active' ? (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={st.id === s.session.adminStaffId}
                      onClick={() => {
                        const held = seatsOfStaff(s, st.id)
                        if (held.length) {
                          toast(`${st.name} 还持有 ${held.map((x) => x.displayName).join('、')}，先去坐席页交接`, 'warn')
                          return
                        }
                        s.setStaffStatus(st.id, 'disabled', s.session.adminStaffId!)
                        toast(`${st.name} 已停用，全部会话已撤销`)
                      }}
                    >
                      停用
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => s.setStaffStatus(st.id, 'active', s.session.adminStaffId!)}>
                      激活
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>
      {creating && <CreateStaffModal onClose={() => setCreating(false)} />}
    </div>
  )
}

function CreateStaffModal({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const [form, setForm] = useState({ name: '', username: '', email: '', roleId: 'role_seat', withSeat: true, roleDesc: '投资顾问' })
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))
  const ok = form.name.trim() && form.username.trim() && !s.staff.some((x) => x.username === form.username.trim())
  const submit = () => {
    if (!ok) return
    s.createStaff({ name: form.name.trim(), username: form.username.trim(), email: form.email.trim() || undefined, roleId: form.roleId, withSeat: form.withSeat, roleDesc: form.roleDesc }, s.session.adminStaffId!)
    toast(form.withSeat ? `已创建员工 ${form.name} 与同名坐席「${form.name}」` : `已创建员工 ${form.name}`)
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="创建员工"
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!ok} onClick={submit}>
            创建
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="姓名" required>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="真人姓名" />
          </Field>
          <Field label="用户名" required hint="登录用，唯一">
            <Input value={form.username} onChange={(e) => set('username', e.target.value)} placeholder="拼音或英文" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="邮箱">
            <Input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="可选" />
          </Field>
          <Field label="员工角色">
            <Select value={form.roleId} onChange={(e) => set('roleId', e.target.value)}>
              {s.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="初始密码" hint="演示中不真正校验">
          <Input type="password" defaultValue="Demo@12345" />
        </Field>
        <div className="rounded-md border border-brand-100 bg-brand-50/50 p-3">
          <Checkbox checked={form.withSeat} onChange={(v) => set('withSeat', v)} label={<span className="font-medium">同时创建同名坐席并指派给他</span>} />
          <p className="mt-1 pl-5 text-[11px] leading-relaxed text-zinc-500">默认勾选。三人团队第一天的操作就是建三个员工、各自登录，跟「客服就是一个账号」的用法一样。显示名、头像、职能说明之后在坐席页改。</p>
          {form.withSeat && (
            <div className="mt-2 pl-5">
              <Field label="坐席职能说明">
                <Input value={form.roleDesc} onChange={(e) => set('roleDesc', e.target.value)} />
              </Field>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
