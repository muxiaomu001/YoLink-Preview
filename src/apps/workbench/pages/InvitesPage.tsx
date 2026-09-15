/**
 * 我的邀请链接（04 文档）：表格列按 PRD，附带动作显示三层入群叠加；生成弹窗在 InvitesPage.parts。
 */
import { useState } from 'react'
import { Copy, Plus } from 'lucide-react'
import type { InviteLink } from '@/domain/types'
import { fmtDate } from '@/domain/time'
import { Button } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, SeatAvatar, Table } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { useWorkbench } from '../useWorkbench'
import { AttachedActionsCell, InviteCreateModal, LINK_HOST, effectiveStatus } from './InvitesPage.parts'

function StatusPill({ l }: { l: InviteLink }) {
  const st = effectiveStatus(l)
  if (st === 'active') return <Pill tone="green">有效</Pill>
  if (st === 'expired') return <Pill>已过期</Pill>
  if (st === 'exhausted') return <Pill tone="amber">已用满</Pill>
  return <Pill tone="red">已失效</Pill>
}

export function InvitesPage() {
  const { s, staff, seat, can } = useWorkbench()
  const [creating, setCreating] = useState(false)
  const mine = s.inviteLinks.filter((l) => l.creatorStaffId === staff?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const myGroups = s.inviteGroups.filter((g) => g.enabled && seat && g.seatIds.includes(seat.id))
  const defaults = s.enterprise.defaultChatGroupIds.map((id) => s.chatGroups.find((g) => g.id === id)?.name).filter(Boolean)

  const copy = (l: InviteLink) => {
    void navigator.clipboard?.writeText(`${LINK_HOST}${l.code}`)
    toast(`已复制 ${LINK_HOST}${l.code}`)
  }
  const revoke = async (l: InviteLink) => {
    const ok = await confirm({ title: `失效「${l.name}」？`, body: '失效后通过该链接不能再注册，已注册客户不受影响。不可撤销。', okText: '失效', danger: true })
    if (!ok || !staff) return
    s.revokeInviteLink(l.id, staff.id)
    toast('已失效')
  }

  return (
    <div className="thin-scroll h-full overflow-y-auto p-5">
      <PageHeader
        title="我的邀请链接"
        desc="链接是邀请组下面的渠道码，落点由组决定。想要「只加我一个」的推广码，让管理员建一个只放本坐席的组。"
        extra={
          can('create_invite') ? (
            <Button variant="primary" disabled={myGroups.length === 0} title={myGroups.length ? '' : '当前坐席不在任何邀请组里，让管理员先把坐席放进组'} onClick={() => setCreating(true)}>
              <Plus size={14} /> 生成邀请链接
            </Button>
          ) : (
            <Button variant="primary" disabled title="需员工角色能力 create_invite">
              <Plus size={14} /> 生成邀请链接
            </Button>
          )
        }
      />
      <div className="space-y-2">
        <Note>
          注册时自动入群按三层叠加取并集：<b>企业默认</b>（{defaults.length ? defaults.join('、') : '无'}）→ <b>邀请组</b>的群 → <b>本链接</b>的附带动作。表格「附带动作」列把三层都列出来并标明来源；生成链接时已被前两层覆盖的群会打勾禁用。
        </Note>
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
      </div>
      <Card className="mt-4" padded={false}>
        <Table
          rows={mine}
          rowKey={(l) => l.id}
          empty="还没有生成过邀请链接"
          columns={[
            {
              key: 'name',
              title: '链接名称',
              render: (l) => (
                <button type="button" className="text-left" title="点击复制链接" onClick={() => copy(l)}>
                  <span className="inline-flex items-center gap-1 font-medium text-zinc-900 hover:text-brand-700">
                    {l.name} <Copy size={11} className="text-zinc-400" />
                  </span>
                  <div className="font-mono text-[11px] tracking-wider text-zinc-400">{l.code}</div>
                </button>
              ),
            },
            {
              key: 'group',
              title: '邀请组',
              render: (l) => {
                const g = s.inviteGroups.find((x) => x.id === l.inviteGroupId)
                return (
                  <div className="flex items-center gap-1.5">
                    <span>{g?.name ?? '-'}</span>
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
            { key: 'attach', title: '附带动作', render: (l) => <AttachedActionsCell s={s} link={l} /> },
            { key: 'expires', title: '有效期', render: (l) => <span className="text-zinc-600">{l.expiresAt ? fmtDate(l.expiresAt) : '永久'}</span> },
            { key: 'uses', title: '使用上限', align: 'right', render: (l) => <span className="tabular-nums">{l.uses}/{l.maxUses ?? '∞'}</span> },
            {
              key: 'clicks',
              title: (
                <span>
                  点击数 <Pill>P1</Pill>
                </span>
              ),
              align: 'right',
              render: (l) => <span className="tabular-nums text-zinc-500">{l.clicks}</span>,
            },
            { key: 'reg', title: '注册数', align: 'right', render: (l) => <span className="tabular-nums">{s.customers.filter((c) => c.inviteLinkId === l.id).length}</span> },
            { key: 'status', title: '状态', render: (l) => <StatusPill l={l} /> },
            {
              key: 'ops',
              title: '操作',
              align: 'right',
              render: (l) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => copy(l)}>
                    复制
                  </Button>
                  {l.status === 'active' && (
                    <Button size="sm" variant="danger" onClick={() => void revoke(l)}>
                      失效
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>
      <p className="mt-2 text-[11px] text-zinc-400">点击数为 P1：正式版由短链服务统计。</p>
      <InviteCreateModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}
