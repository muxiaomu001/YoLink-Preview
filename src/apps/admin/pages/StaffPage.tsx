import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { Staff } from '@/domain/types'
import { fmtAgo, fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { seatsOfStaff } from '@/store/selectors'
import { Button } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, SeatAvatar, Table } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { CreateStaffModal, EditStaffModal, ResetPasswordModal } from './StaffPage.parts'

export function StaffPage() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Staff | null>(null)
  const [resetting, setResetting] = useState<Staff | null>(null)

  const forceLogout = async (st: Staff) => {
    const ok = await confirm({ title: `强制下线 ${st.name}？`, body: '立即撤销该员工的全部登录 session 与 token，所有设备被登出。账号不停用，可重新登录。', okText: '强制下线', danger: true })
    if (!ok) return
    s.forceLogout(st.id, admin)
    toast(`已撤销 ${st.name} 的全部登录会话，所有设备已登出`)
  }
  const disable = async (st: Staff) => {
    const blocker = s.staffDisableBlocker(st.id)
    if (blocker) {
      toast(blocker, 'warn')
      return
    }
    const ok = await confirm({ title: `停用 ${st.name}？`, body: '保留数据，立即撤销全部 session，停用后无法登录。可随时激活。', okText: '停用', danger: true })
    if (!ok) return
    // 确认前再次检查，防止其他窗口刚刚交接回该员工。
    const confirmed = s.disableStaff(st.id, admin)
    if (!confirmed.ok) {
      toast(confirmed.error, 'warn')
      return
    }
    toast(`${st.name} 已停用，全部会话已撤销`)
  }

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
                  <span className="text-zinc-400">未持有坐席</span>
                )
              },
            },
            { key: 'status', title: '状态', render: (st) => (st.status === 'active' ? <Pill tone="green">激活</Pill> : <Pill tone="red">停用</Pill>) },
            { key: 'login', title: '最后登录', render: (st) => <span className="tabular-nums text-zinc-500">{st.lastLoginAt ? fmtDateTime(st.lastLoginAt) : '从未登录'}</span> },
            {
              key: 'flags',
              title: '提示',
              render: (st) => (
                <div className="flex flex-wrap gap-1">
                  {st.mustChangePassword && <Pill tone="amber">下次登录须改密码</Pill>}
                  {st.sessionsRevokedAt && (
                    <span title={`强制下线于 ${fmtDateTime(st.sessionsRevokedAt)}`}>
                      <Pill>{fmtAgo(st.sessionsRevokedAt)}强制下线</Pill>
                    </span>
                  )}
                  {!st.mustChangePassword && !st.sessionsRevokedAt && <span className="text-zinc-300">-</span>}
                </div>
              ),
            },
            {
              key: 'ops',
              title: '操作',
              align: 'right',
              render: (st) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(st)}>
                    编辑
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setResetting(st)}>
                    重置密码
                  </Button>
                  <Button size="sm" variant="ghost" disabled={st.id === admin || st.status === 'disabled'} onClick={() => void forceLogout(st)}>
                    强制下线
                  </Button>
                  {st.status === 'active' ? (
                    <Button size="sm" variant="danger" disabled={st.id === admin} onClick={() => void disable(st)}>
                      停用
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        s.activateStaff(st.id, admin)
                        toast(`${st.name} 已激活，可以重新登录`)
                      }}
                    >
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
      {editing && <EditStaffModal staff={editing} onClose={() => setEditing(null)} />}
      {resetting && <ResetPasswordModal staff={resetting} onClose={() => setResetting(null)} />}
    </div>
  )
}
