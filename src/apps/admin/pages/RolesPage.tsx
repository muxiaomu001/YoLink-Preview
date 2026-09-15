import type { Capability } from '@/domain/types'
import { useStore } from '@/store/store'
import { Checkbox } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill } from '@/ui/display'

const CAPS: { cat: string; key: Capability; label: string; desc: string }[] = [
  { cat: '会话访问', key: 'view_all_conversations', label: 'view_all_conversations', desc: '查看全部会话；关闭时仅看本人持有坐席的会话' },
  { cat: '工作台', key: 'view_all_customers', label: 'view_all_customers', desc: '查看全部客户；关闭时仅看本人持有坐席主归属的客户' },
  { cat: '工作台', key: 'create_invite', label: 'create_invite', desc: '在邀请组下生成邀请链接' },
  { cat: '工作台', key: 'broadcast', label: 'broadcast', desc: '群发消息' },
  { cat: '工作台', key: 'manage_groups', label: 'manage_groups', desc: '管理所有群' },
  { cat: '工作台', key: 'view_audit', label: 'view_audit', desc: '查看消息审计' },
  { cat: '工作台', key: 'view_seat_operator', label: 'view_seat_operator', desc: '查看坐席背后的实操员工与交接记录；关闭时只看得到坐席身份' },
  { cat: '工作台', key: 'assign_title', label: 'assign_title', desc: '给客户挂、摘头衔（只能从头衔库选）' },
  { cat: '管理后台', key: 'manage_seats', label: 'manage_seats', desc: '管理坐席与坐席交接' },
  { cat: '管理后台', key: 'manage_staff', label: 'manage_staff', desc: '管理员工账号' },
  { cat: '管理后台', key: 'manage_roles', label: 'manage_roles', desc: '管理员工角色' },
  { cat: '管理后台', key: 'manage_titles', label: 'manage_titles', desc: '维护内部标签库与头衔库' },
  { cat: '管理后台', key: 'manage_policies', label: 'manage_policies', desc: '管理策略' },
  { cat: '管理后台', key: 'manage_settings', label: 'manage_settings', desc: '管理企业设置' },
  { cat: '管理后台', key: 'view_audit_logs', label: 'view_audit_logs', desc: '查看审计日志' },
]

export function RolesPage() {
  const s = useStore()
  return (
    <div>
      <PageHeader title="员工角色" desc="角色控制员工能用工作台和后台的哪些功能。权限跟人走，身份跟号走：同一个员工换到另一个坐席，角色能力不变。" />
      <Note>内置的「管理员」与「坐席」不可删除，可改权限。聊天层能力（建群、拉人、发消息）不在这里，那是策略矩阵，作用在坐席上。</Note>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/80">
              <th className="px-3 py-2 text-left text-[11px] font-medium text-zinc-500">能力</th>
              {s.roles.map((r) => (
                <th key={r.id} className="px-3 py-2 text-center text-[11px] font-medium text-zinc-700">
                  {r.name}
                  {r.builtin && <Pill className="ml-1">系统</Pill>}
                  <div className="text-[10px] font-normal text-zinc-400">{s.staff.filter((x) => x.roleId === r.id).length} 人</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAPS.map((c, i) => (
              <tr key={c.key} className="border-b border-zinc-100 bg-white">
                <td className="px-3 py-2">
                  {(i === 0 || CAPS[i - 1].cat !== c.cat) && <div className="mb-0.5 text-[10px] font-medium text-zinc-400">{c.cat}</div>}
                  <div className="font-mono text-xs text-zinc-800">{c.label}</div>
                  <div className="text-[11px] text-zinc-500">{c.desc}</div>
                </td>
                {s.roles.map((r) => (
                  <td key={r.id} className="px-3 py-2 text-center">
                    <Checkbox
                      checked={r.caps.includes(c.key)}
                      disabled={r.id === 'role_admin'}
                      onChange={(v) => s.updateRoleCaps(r.id, v ? [...r.caps, c.key] : r.caps.filter((x) => x !== c.key))}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Card className="mt-4" title="谁在用哪个角色">
        <div className="grid grid-cols-3 gap-3 text-xs">
          {s.roles.map((r) => (
            <div key={r.id}>
              <div className="mb-1 font-medium text-zinc-800">{r.name}</div>
              <div className="text-zinc-500">{s.staff.filter((x) => x.roleId === r.id).map((x) => x.name).join('、') || '无'}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
