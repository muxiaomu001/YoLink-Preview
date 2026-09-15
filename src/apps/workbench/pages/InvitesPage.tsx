import { useState } from 'react'
import { Plus } from 'lucide-react'
import { fmtDate } from '@/domain/time'
import { Button, Field, Input, Select } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, SeatAvatar, Table } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { useWorkbench } from '../useWorkbench'

export function InvitesPage() {
  const { s, staff, seat, can } = useWorkbench()
  const [creating, setCreating] = useState(false)
  const mine = s.inviteLinks.filter((l) => l.creatorStaffId === staff?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const myGroups = s.inviteGroups.filter((g) => g.enabled && seat && g.seatIds.includes(seat.id))
  const [form, setForm] = useState({ name: '', groupId: '', expires: 'never', max: '' })

  const submit = () => {
    if (!staff || !form.name.trim() || !form.groupId) return
    const expiresAt = form.expires === 'never' ? null : new Date(Date.now() + Number(form.expires) * 86400000).toISOString()
    const link = s.createInviteLink({ name: form.name.trim(), inviteGroupId: form.groupId, creatorStaffId: staff.id, expiresAt, maxUses: form.max ? Number(form.max) : null })
    toast(`已生成，邀请码 ${link.code}。客户在注册页输码等同点链接`)
    setCreating(false)
    setForm({ name: '', groupId: '', expires: 'never', max: '' })
  }

  return (
    <div className="thin-scroll h-full overflow-y-auto p-5">
      <PageHeader
        title="我的邀请链接"
        desc="链接是邀请组下面的渠道码，落点由组决定。想要「只加我一个」的推广码，让管理员建一个只放本坐席的组。"
        extra={
          can('create_invite') ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus size={14} /> 生成邀请链接
            </Button>
          ) : undefined
        }
      />
      {myGroups.length > 0 && (
        <Note>
          当前坐席「{seat?.displayName}」所在的邀请组：
          {myGroups.map((g) => (
            <span key={g.id} className="ml-2 inline-flex items-center gap-1">
              <b>{g.name}</b> <span className="rounded bg-white px-1 font-mono text-[11px]">{g.code}</span>
              <span className="text-[11px] text-brand-700">（{g.seatIds.map((id) => s.seats.find((x) => x.id === id)?.displayName).join('、')}）</span>
            </span>
          ))}
        </Note>
      )}
      <Card className="mt-4" padded={false}>
        <Table
          rows={mine}
          rowKey={(l) => l.id}
          empty="还没有生成过邀请链接"
          columns={[
            { key: 'name', title: '链接名称', render: (l) => <span className="font-medium text-zinc-900">{l.name}</span> },
            { key: 'code', title: '邀请码', render: (l) => <span className="rounded bg-zinc-100 px-1.5 font-mono tracking-wider">{l.code}</span> },
            {
              key: 'group',
              title: '邀请组（注册即添加）',
              render: (l) => {
                const g = s.inviteGroups.find((x) => x.id === l.inviteGroupId)
                return (
                  <div className="flex items-center gap-1.5">
                    <span>{g?.name}</span>
                    <span className="flex -space-x-1">
                      {g?.seatIds.map((id) => {
                        const st = s.seats.find((x) => x.id === id)
                        return st ? <SeatAvatar key={id} seat={st} size={18} className="ring-1 ring-white" /> : null
                      })}
                    </span>
                  </div>
                )
              },
            },
            { key: 'expires', title: '有效期', render: (l) => (l.expiresAt ? fmtDate(l.expiresAt) : '永久') },
            { key: 'uses', title: '已用/上限', align: 'right', render: (l) => <span className="tabular-nums">{l.uses}/{l.maxUses ?? '∞'}</span> },
            { key: 'status', title: '状态', render: (l) => (l.status === 'active' ? <Pill tone="green">有效</Pill> : l.status === 'expired' ? <Pill>已过期</Pill> : <Pill tone="red">已失效</Pill>) },
            {
              key: 'ops',
              title: '',
              align: 'right',
              render: (l) => (
                <div className="flex justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      void navigator.clipboard?.writeText(`https://hxwm.example/i/${l.code}`)
                      toast('已复制链接')
                    }}
                  >
                    复制
                  </Button>
                  {l.status === 'active' && (
                    <Button size="sm" variant="ghost" onClick={() => s.revokeInviteLink(l.id, staff!.id)}>
                      失效
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="生成邀请链接"
        footer={
          <>
            <Button onClick={() => setCreating(false)}>取消</Button>
            <Button variant="primary" disabled={!form.name.trim() || !form.groupId} onClick={submit}>
              生成
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="链接名称" required>
            <Input value={form.name} maxLength={32} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="如：10 月直播 · 第二场" />
          </Field>
          <Field label="邀请组" required hint="只列出包含当前坐席的组">
            <Select value={form.groupId} onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value }))}>
              <option value="">选择…</option>
              {myGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}（{g.seatIds.map((id) => s.seats.find((x) => x.id === id)?.displayName).join('、')}）
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="有效期">
              <Select value={form.expires} onChange={(e) => setForm((f) => ({ ...f, expires: e.target.value }))}>
                <option value="never">永久</option>
                <option value="1">1 天</option>
                <option value="7">7 天</option>
                <option value="30">30 天</option>
              </Select>
            </Field>
            <Field label="使用上限" hint="留空无限制">
              <Input type="number" value={form.max} onChange={(e) => setForm((f) => ({ ...f, max: e.target.value }))} />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  )
}
