import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import type { InviteLink, InviteLinkStatus } from '@/domain/types'
import { fmtDate, fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { staffById } from '@/store/selectors'
import { Button, Select } from '@/ui/primitives'
import { Card, Note, PageHeader, Table, type Column } from '@/ui/display'
import { DemoLevelTag, DemoNote } from '@/ui/DemoNote'
import { toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { AttachedActionsCell } from '@/apps/workbench/pages/InvitesPage.parts'
import { InviteLinkCreateModal, InviteLinkDetailModal, StatusPill } from './InviteLinksPage.parts'
import { linkUrl } from './InviteLinksPage.shared'

export function InviteLinksPage() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [creator, setCreator] = useState('all')
  const [group, setGroup] = useState('all')
  const [status, setStatus] = useState<'all' | InviteLinkStatus>('all')
  const [detail, setDetail] = useState<InviteLink | null>(null)
  const [creating, setCreating] = useState(false)

  const creatorIds = useMemo(() => Array.from(new Set(s.inviteLinks.map((l) => l.creatorStaffId))), [s.inviteLinks])
  const rows = useMemo(
    () =>
      [...s.inviteLinks]
        .filter((l) => (creator === 'all' || l.creatorStaffId === creator) && (group === 'all' || l.inviteGroupId === group) && (status === 'all' || l.status === status))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [s.inviteLinks, creator, group, status],
  )

  const copy = (l: InviteLink) => {
    void navigator.clipboard?.writeText(linkUrl(l.code))
    toast(`已复制链接 ${linkUrl(l.code)}`)
  }
  const revoke = async (l: InviteLink) => {
    const ok = await confirm({ title: `失效邀请链接「${l.name}」？`, body: '失效后通过该链接不能再注册，已注册的客户不受影响。此操作不可撤销。', okText: '失效', danger: true })
    if (!ok) return
    s.revokeInviteLink(l.id, admin)
    toast(`「${l.name}」已失效，已注册客户不受影响`)
  }

  const columns: Column<InviteLink>[] = [
    {
      key: 'name',
      title: '链接名称',
      render: (l) => (
        <div>
          <div className="font-medium text-zinc-900">{l.name}</div>
          <div className="font-mono text-[11px] text-zinc-400">{l.code}</div>
        </div>
      ),
    },
    { key: 'creator', title: '创建者', render: (l) => staffById(s, l.creatorStaffId)?.name ?? '-' },
    { key: 'group', title: '邀请组', render: (l) => s.inviteGroups.find((g) => g.id === l.inviteGroupId)?.name ?? '-' },
    { key: 'attach', title: '附带动作', render: (l) => <AttachedActionsCell s={s} link={l} /> },
    { key: 'expires', title: '有效期', render: (l) => <span className="text-zinc-600">{l.expiresAt ? fmtDate(l.expiresAt) : '永久'}</span> },
    { key: 'uses', title: '使用情况', align: 'right', render: (l) => <span className="tabular-nums">{l.uses}/{l.maxUses ?? '不限'}</span> },
    {
      key: 'clicks',
      title: (
        <>
          点击数
          <DemoLevelTag level="P1" />
        </>
      ),
      align: 'right',
      render: (l) => <span className="tabular-nums text-zinc-500">{l.clicks}</span>,
    },
    { key: 'reg', title: '注册数', align: 'right', render: (l) => <span className="tabular-nums">{s.customers.filter((c) => c.inviteLinkId === l.id).length || l.uses}</span> },
    { key: 'status', title: '状态', render: (l) => <StatusPill status={l.status} /> },
    {
      key: 'ops',
      title: '操作',
      align: 'right',
      render: (l) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setDetail(l)}>
            查看详情
          </Button>
          <Button size="sm" variant="ghost" onClick={() => copy(l)}>
            复制链接
          </Button>
          {l.status === 'active' && (
            <Button size="sm" variant="danger" onClick={() => void revoke(l)}>
              失效
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="邀请链接总览"
        desc="邀请链接是邀请组下面的渠道码：同一个组可以开多条链接给不同渠道或不同员工，落点都是该组的坐席，只是统计分开。"
        extra={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={14} /> 生成链接
          </Button>
        }
      />
      <Note>
        员工在工作台生成的链接也在这里，创建者一列区分。「附带动作」是注册即入群的三层叠加：企业默认 → 邀请组 → 本链接，取并集。「邀请码必填」当前{s.enterprise.inviteCodeRequired ? '开启：没有码不能注册' : '关闭：没带码的注册走默认组'}，在企业设置里改。
      </Note>
      <Card
        className="mt-4"
        padded={false}
        title={`共 ${rows.length} 条`}
        extra={
          <div className="flex items-center gap-2">
            <Select value={creator} onChange={(e) => setCreator(e.target.value)} className="h-7 w-32 text-xs">
              <option value="all">全部创建者</option>
              {creatorIds.map((id) => (
                <option key={id} value={id}>
                  {staffById(s, id)?.name ?? id}
                </option>
              ))}
            </Select>
            <Select value={group} onChange={(e) => setGroup(e.target.value)} className="h-7 w-36 text-xs">
              <option value="all">全部邀请组</option>
              {s.inviteGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value as 'all' | InviteLinkStatus)} className="h-7 w-28 text-xs">
              <option value="all">全部状态</option>
              <option value="active">有效</option>
              <option value="expired">已过期</option>
              <option value="revoked">已失效</option>
            </Select>
          </div>
        }
      >
        <Table rows={rows} columns={columns} rowKey={(l) => l.id} empty="没有符合条件的链接" />
      </Card>
      <p className="mt-2 text-[11px] text-zinc-400">最近一条创建于 {rows[0] ? fmtDateTime(rows[0].createdAt) : '-'}。</p>
      <DemoNote className="mt-2">点击数由短链服务统计，排在第二版<DemoLevelTag level="P1" />。</DemoNote>

      {detail && <InviteLinkDetailModal link={detail} onClose={() => setDetail(null)} />}
      {creating && <InviteLinkCreateModal onClose={() => setCreating(false)} />}
    </div>
  )
}
