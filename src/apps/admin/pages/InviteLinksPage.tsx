import { fmtDate } from '@/domain/time'
import { useStore } from '@/store/store'
import { staffById } from '@/store/selectors'
import { Button } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, Table } from '@/ui/display'
import { toast } from '@/ui/overlay'

export function InviteLinksPage() {
  const s = useStore()
  return (
    <div>
      <PageHeader title="邀请链接总览" desc="邀请链接是邀请组下面的渠道码：同一个组可以开多条链接给不同渠道或不同员工，落点都是该组的坐席，只是统计分开。" />
      <Note>
        「邀请码必填」当前{s.enterprise.inviteCodeRequired ? '开启' : '关闭'}：{s.enterprise.inviteCodeRequired ? '没有码不能注册。' : '没带码的注册走默认组。'}在企业设置里改。
      </Note>
      <Card className="mt-4" padded={false}>
        <Table
          rows={[...s.inviteLinks].sort((a, b) => b.createdAt.localeCompare(a.createdAt))}
          rowKey={(l) => l.id}
          columns={[
            { key: 'name', title: '链接名称', render: (l) => <span className="font-medium text-zinc-900">{l.name}</span> },
            { key: 'code', title: '短码', render: (l) => <span className="rounded bg-zinc-100 px-1.5 font-mono text-xs tracking-wider">{l.code}</span> },
            { key: 'group', title: '邀请组', render: (l) => s.inviteGroups.find((g) => g.id === l.inviteGroupId)?.name },
            { key: 'creator', title: '创建者', render: (l) => staffById(s, l.creatorStaffId)?.name },
            { key: 'expires', title: '有效期', render: (l) => <span className="text-zinc-600">{l.expiresAt ? fmtDate(l.expiresAt) : '永久'}</span> },
            { key: 'uses', title: '已使用/上限', align: 'right', render: (l) => <span className="tabular-nums">{l.uses}/{l.maxUses ?? '∞'}</span> },
            { key: 'clicks', title: '点击', align: 'right', render: (l) => <span className="tabular-nums text-zinc-500">{l.clicks}</span> },
            { key: 'reg', title: '注册', align: 'right', render: (l) => <span className="tabular-nums">{l.uses}</span> },
            { key: 'status', title: '状态', render: (l) => (l.status === 'active' ? <Pill tone="green">有效</Pill> : l.status === 'expired' ? <Pill>已过期</Pill> : <Pill tone="red">已失效</Pill>) },
            {
              key: 'ops',
              title: '操作',
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
                    复制链接
                  </Button>
                  {l.status === 'active' && (
                    <Button size="sm" variant="danger" onClick={() => s.revokeInviteLink(l.id, s.session.adminStaffId!)}>
                      失效
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
