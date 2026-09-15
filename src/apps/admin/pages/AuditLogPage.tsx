import { useState } from 'react'
import { fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { staffById } from '@/store/selectors'
import { Select } from '@/ui/primitives'
import { Card, PageHeader, Pill, Table } from '@/ui/display'

const LABEL: Record<string, string> = {
  login: '登录',
  'staff.create': '创建员工',
  'staff.disable': '停用/激活员工',
  'staff.reset_password': '重置密码',
  'seat.create': '创建坐席',
  'seat.update': '修改坐席',
  'seat.handover': '坐席交接',
  'seat.pause': '暂停接新',
  'invite_group.create': '创建邀请组',
  'invite_group.update': '修改邀请组',
  'invite_group.reset_code': '重置邀请码',
  'invite_group.backfill': '补加到已有客户',
  'invite_link.create': '创建邀请链接',
  'invite_link.revoke': '失效邀请链接',
  'title.assign': '挂头衔',
  'title.remove': '摘头衔',
  'title.library': '头衔库',
  'tag.library': '内部标签库',
  'policy.update': '策略',
  'settings.update': '企业设置',
  'customer.register': '客户注册',
  'broadcast.send': '群发',
  'message.delete': '删除消息',
}

export function AuditLogPage() {
  const s = useStore()
  const [type, setType] = useState('')
  const rows = s.audit.filter((e) => !type || e.type === type).slice(0, 100)
  return (
    <div>
      <PageHeader title="审计日志" desc="管理员与员工的所有管理操作。客户注册、坐席交接、补加、挂摘头衔都在这里。" extra={
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-44">
          <option value="">全部事件</option>
          {Object.entries(LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      } />
      <Card padded={false}>
        <Table
          rows={rows}
          rowKey={(e) => e.id}
          dense
          columns={[
            { key: 'at', title: '时间', width: '140px', render: (e) => <span className="tabular-nums text-zinc-500">{fmtDateTime(e.at)}</span> },
            { key: 'actor', title: '操作人', width: '90px', render: (e) => (e.actorStaffId ? staffById(s, e.actorStaffId)?.name : <span className="text-zinc-400">系统</span>) },
            { key: 'type', title: '事件', width: '120px', render: (e) => <Pill tone={e.type === 'seat.handover' ? 'amber' : e.type === 'customer.register' ? 'green' : 'zinc'}>{LABEL[e.type] ?? e.type}</Pill> },
            { key: 'detail', title: '详情', render: (e) => <span className="text-zinc-700">{e.detail}</span> },
          ]}
        />
      </Card>
    </div>
  )
}
