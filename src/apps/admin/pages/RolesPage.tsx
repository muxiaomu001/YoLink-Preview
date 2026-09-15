import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { Capability, Role } from '@/domain/types'
import { CAPABILITIES } from '@/domain/labels'
import { useStore } from '@/store/store'
import { Button, Checkbox, Field, Input, Textarea } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, Table } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'

const ADMIN_ROLE_ID = 'role_admin'
const ALL_CAPS: Capability[] = CAPABILITIES.map((c) => c.key)
const CATEGORIES = Array.from(new Set(CAPABILITIES.map((c) => c.cat)))

export function RolesPage() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)
  const memberCount = (roleId: string) => s.staff.filter((x) => x.roleId === roleId).length

  const remove = async (r: Role) => {
    const ok = await confirm({ title: `删除角色「${r.name}」？`, body: '删除后不可恢复。只有非内置且没有成员的角色才能删除。', okText: '删除', danger: true })
    if (!ok) return
    if (s.deleteRole(r.id, admin)) toast(`已删除角色「${r.name}」`)
    else toast('内置角色或仍有成员的角色不能删除', 'warn')
  }

  return (
    <div>
      <PageHeader
        title="员工角色"
        desc="角色控制员工能用工作台和后台的哪些功能。权限跟人走，身份跟号走：同一个员工换到另一个坐席，角色能力不变。"
        extra={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={14} /> 创建角色
          </Button>
        }
      />
      <Note>
        内置预置「管理员」（全部权限）与「坐席」（只看本人坐席的会话与客户，能发邀请链接、群发、挂头衔），不可删除，可改权限；管理员的权限固定为全部。聊天层能力（建群、拉人、发消息）不在这里，那是策略矩阵，作用在坐席上。
      </Note>

      <Card className="mt-4" padded={false}>
        <Table
          rows={s.roles}
          rowKey={(r) => r.id}
          columns={[
            {
              key: 'name',
              title: '角色名称',
              render: (r) => (
                <span className="font-medium text-zinc-900">
                  {r.name}
                  {r.builtin && <Pill className="ml-1.5">系统</Pill>}
                </span>
              ),
            },
            { key: 'desc', title: '描述', render: (r) => <span className="text-zinc-500">{r.desc || '-'}</span> },
            { key: 'caps', title: '权限数', align: 'right', render: (r) => <span className="tabular-nums">{r.caps.length} / {ALL_CAPS.length}</span> },
            {
              key: 'members',
              title: '成员数',
              align: 'right',
              render: (r) => (
                <span className="tabular-nums" title={s.staff.filter((x) => x.roleId === r.id).map((x) => x.name).join('、') || '无'}>
                  {memberCount(r.id)}
                </span>
              ),
            },
            {
              key: 'ops',
              title: '操作',
              align: 'right',
              render: (r) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                    编辑
                  </Button>
                  <Button size="sm" variant="danger" disabled={r.builtin || memberCount(r.id) > 0} title={r.builtin ? '内置角色不可删除' : memberCount(r.id) ? '还有成员，先改成员的角色' : undefined} onClick={() => void remove(r)}>
                    删除
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Card className="mt-4" title="权限矩阵总览（勾选即改；管理员列固定为全部）" padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80">
                <th className="px-3 py-2 text-left text-[11px] font-medium text-zinc-500">能力</th>
                {s.roles.map((r) => (
                  <th key={r.id} className="px-3 py-2 text-center text-[11px] font-medium text-zinc-700">
                    {r.name}
                    {r.builtin && <Pill className="ml-1">系统</Pill>}
                    <div className="text-[10px] font-normal text-zinc-400">{memberCount(r.id)} 人</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CAPABILITIES.map((c, i) => (
                <tr key={c.key} className="border-b border-zinc-100 bg-white">
                  <td className="px-3 py-2">
                    {(i === 0 || CAPABILITIES[i - 1].cat !== c.cat) && <div className="mb-0.5 text-[10px] font-medium text-zinc-400">{c.cat}</div>}
                    <div className="font-mono text-xs text-zinc-800">
                      {c.key}
                      {c.level !== 'P0' && <Pill className="ml-1.5">{c.level}</Pill>}
                    </div>
                    <div className="text-[11px] text-zinc-500">{c.desc}</div>
                  </td>
                  {s.roles.map((r) => (
                    <td key={r.id} className="px-3 py-2 text-center">
                      <Checkbox
                        checked={r.id === ADMIN_ROLE_ID || r.caps.includes(c.key)}
                        disabled={r.id === ADMIN_ROLE_ID}
                        onChange={(v) => {
                          s.updateRoleCaps(r.id, v ? [...r.caps, c.key] : r.caps.filter((x) => x !== c.key))
                          toast(`「${r.name}」${v ? '开启' : '关闭'} ${c.key}`)
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {creating && <RoleEditModal onClose={() => setCreating(false)} />}
      {editing && <RoleEditModal role={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function RoleEditModal({ role, onClose }: { role?: Role; onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const isAdmin = role?.id === ADMIN_ROLE_ID
  const [name, setName] = useState(role?.name ?? '')
  const [desc, setDesc] = useState(role?.desc ?? '')
  const [caps, setCaps] = useState<Capability[]>(isAdmin ? ALL_CAPS : (role?.caps ?? []))
  const nameOk = name.trim().length >= 1 && name.trim().length <= 32
  const descOk = desc.length <= 255
  const dup = s.roles.some((r) => r.name === name.trim() && r.id !== role?.id)
  const error = !nameOk ? '角色名称 1 到 32 字' : dup ? '角色名称已存在' : !descOk ? '描述最多 255 字' : null

  const toggle = (k: Capability, v: boolean) => setCaps((l) => (v ? [...l, k] : l.filter((x) => x !== k)))
  const toggleCat = (cat: string, v: boolean) => {
    const keys = CAPABILITIES.filter((c) => c.cat === cat).map((c) => c.key)
    setCaps((l) => (v ? Array.from(new Set([...l, ...keys])) : l.filter((x) => !keys.includes(x))))
  }
  const submit = () => {
    if (error) return
    if (role) {
      s.updateRole(role.id, isAdmin ? { name: name.trim(), desc } : { name: name.trim(), desc, caps }, admin)
      toast(`已保存角色「${name.trim()}」${isAdmin ? '' : `，${caps.length} 项权限`}`)
    } else {
      s.createRole({ name: name.trim(), desc, caps }, admin)
      toast(`已创建角色「${name.trim()}」，${caps.length} 项权限`)
    }
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={role ? `编辑角色：${role.name}` : '创建角色'}
      width={640}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!!error} onClick={submit}>
            {role ? '保存' : '创建'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="角色名称" required hint="1 到 32 字">
          <Input value={name} maxLength={32} onChange={(e) => setName(e.target.value)} placeholder="如：运营主管" />
        </Field>
        <Field label="角色描述" hint="0 到 255 字">
          <Textarea rows={2} maxLength={255} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="一句话说明这个角色干什么" />
        </Field>
        {name.length > 0 && error && <p className="text-[11px] text-red-600">{error}</p>}
        {isAdmin && <Note tone="amber">管理员角色拥有全部权限，不可修改；只能改名称与描述。</Note>}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs font-medium text-zinc-600">
            <span>权限勾选</span>
            <span className="text-[11px] font-normal text-zinc-400">已选 {caps.length} / {ALL_CAPS.length}</span>
          </div>
          <div className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
            {CATEGORIES.map((cat) => {
              const items = CAPABILITIES.filter((c) => c.cat === cat)
              const all = items.every((c) => caps.includes(c.key))
              return (
                <div key={cat} className="px-3 py-2">
                  <Checkbox checked={all} disabled={isAdmin} onChange={(v) => toggleCat(cat, v)} label={<span className="font-medium text-zinc-800">{cat}</span>} />
                  <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 pl-5">
                    {items.map((c) => (
                      <Checkbox
                        key={c.key}
                        checked={caps.includes(c.key)}
                        disabled={isAdmin}
                        onChange={(v) => toggle(c.key, v)}
                        label={
                          <span className="text-xs">
                            <span className="font-mono text-zinc-800">{c.key}</span>
                            {c.level !== 'P0' && <Pill className="ml-1">{c.level}</Pill>}
                            <span className="block text-[11px] text-zinc-500">{c.desc}</span>
                          </span>
                        }
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}
