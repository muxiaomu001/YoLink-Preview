/**
 * 邀请链接总览的弹窗：查看详情、生成链接。
 */
import { useState } from 'react'
import type { InviteLink, InviteLinkStatus } from '@/domain/types'
import { fmtDate, fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { staffById } from '@/store/selectors'
import { Button, Field, Input, Select } from '@/ui/primitives'
import { Avatar, KV, Note, Pill, Table, TitleChip } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { linkUrl } from './InviteLinksPage.shared'
import { DemoLevelTag } from '@/ui/DemoNote'

const STATUS_LABEL: Record<InviteLinkStatus, string> = { active: '有效', expired: '已过期', revoked: '已失效' }

export function StatusPill({ status }: { status: InviteLinkStatus }) {
  return status === 'active' ? <Pill tone="green">{STATUS_LABEL.active}</Pill> : status === 'expired' ? <Pill>{STATUS_LABEL.expired}</Pill> : <Pill tone="red">{STATUS_LABEL.revoked}</Pill>
}

export function InviteLinkDetailModal({ link, onClose }: { link: InviteLink; onClose: () => void }) {
  const s = useStore()
  const group = s.inviteGroups.find((g) => g.id === link.inviteGroupId)
  const customers = s.customers.filter((c) => c.inviteLinkId === link.id).sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))
  const url = linkUrl(link.code)
  return (
    <Modal
      open
      onClose={onClose}
      title={`邀请链接：${link.name}`}
      width={640}
      footer={
        <>
          <Button onClick={onClose}>关闭</Button>
          <Button
            variant="primary"
            onClick={() => {
              void navigator.clipboard?.writeText(url)
              toast(`已复制链接 ${url}`)
            }}
          >
            复制链接
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md bg-zinc-50 px-3 py-2 font-mono text-[13px] break-all text-zinc-800">{url}</div>
        <KV
          items={[
            { k: '链接名称', v: link.name },
            { k: '短码', v: <span className="font-mono">{link.code}</span> },
            { k: '邀请组', v: group ? `${group.name}（坐席：${group.seatIds.map((id) => s.seats.find((x) => x.id === id)?.displayName).join('、')}）` : '-' },
            { k: '创建者', v: staffById(s, link.creatorStaffId)?.name ?? '-' },
            { k: '创建时间', v: fmtDateTime(link.createdAt) },
            { k: '有效期', v: link.expiresAt ? fmtDate(link.expiresAt) : '永久' },
            { k: '使用情况', v: `${link.uses}/${link.maxUses ?? '不限'}` },
            { k: <>点击数<DemoLevelTag level="P1" /></>, v: String(link.clicks) },
            { k: '注册数', v: String(customers.length || link.uses) },
            { k: '状态', v: <StatusPill status={link.status} /> },
          ]}
        />
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-600">通过该链接注册的客户（{customers.length}）</div>
          <div className="rounded-md border border-zinc-200">
            <Table
              rows={customers}
              rowKey={(c) => c.id}
              dense
              empty="还没有客户通过该链接注册"
              columns={[
                { key: 'avatar', title: '', width: '40px', render: (c) => <Avatar text={c.nickname} size={24} /> },
                { key: 'nick', title: '昵称', render: (c) => <span className="font-medium">{c.nickname}</span> },
                {
                  key: 'title',
                  title: '主头衔',
                  render: (c) => {
                    const t = s.titles.find((x) => x.id === c.primaryTitleId)
                    return t ? <TitleChip title={t} size="xs" /> : <span className="text-zinc-400">无</span>
                  },
                },
                { key: 'at', title: '注册时间', render: (c) => <span className="tabular-nums text-zinc-500">{fmtDateTime(c.registeredAt)}</span> },
              ]}
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}

/** 生成链接：名称、邀请组、有效期（空=永久）、使用上限（空=不限）；创建者是当前管理员 */
export function InviteLinkCreateModal({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const groups = s.inviteGroups.filter((g) => g.enabled)
  const [name, setName] = useState('')
  const [groupId, setGroupId] = useState(groups.find((g) => g.isDefault)?.id ?? groups[0]?.id ?? '')
  const [expires, setExpires] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const trimmed = name.trim()
  const nameOk = trimmed.length >= 1 && trimmed.length <= 32
  const today = fmtDate(new Date().toISOString())
  const expiresOk = expires === '' || expires >= today
  const maxNum = maxUses.trim() === '' ? null : Number(maxUses)
  const maxOk = maxNum == null || (Number.isInteger(maxNum) && maxNum > 0)
  const error = !expiresOk ? '有效期不能早于今天。' : !maxOk ? '使用上限必须是正整数，留空表示不限。' : ''
  const ok = nameOk && !!groupId && expiresOk && maxOk

  const submit = () => {
    if (!ok) return
    const link = s.createInviteLink({ name: trimmed, inviteGroupId: groupId, creatorStaffId: admin, expiresAt: expires ? new Date(`${expires}T23:59:59`).toISOString() : null, maxUses: maxNum })
    toast(`已生成链接「${link.name}」：${linkUrl(link.code)}`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="生成邀请链接"
      width={480}
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
        <Field label="链接名称" required hint="1 到 32 字，标明渠道或用途">
          <Input value={name} maxLength={32} onChange={(e) => setName(e.target.value)} placeholder="如：抖音 9 月投放、线下沙龙签到" />
        </Field>
        <Field label="邀请组" required hint="决定注册后自动添加哪些坐席">
          <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
                {g.isDefault ? '（默认）' : ''}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="有效期" hint="留空 = 永久">
            <Input type="date" value={expires} min={today} onChange={(e) => setExpires(e.target.value)} />
          </Field>
          <Field label="使用上限" hint="留空 = 不限">
            <Input value={maxUses} inputMode="numeric" placeholder="不限" onChange={(e) => setMaxUses(e.target.value)} />
          </Field>
        </div>
        {error && <div className="text-xs text-red-600">{error}</div>}
        <Note>创建者记为当前管理员。员工在工作台生成的链接与这里生成的落在同一张表，只是创建者不同。</Note>
      </div>
    </Modal>
  )
}
