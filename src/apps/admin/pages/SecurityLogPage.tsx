import { useMemo, useState } from 'react'
import type { SecurityEvent, SecurityEventType } from '@/domain/types'
import { useStore } from '@/store/store'
import { Card, Note, PageHeader, Pill, Table, Tabs, type Column } from '@/ui/display'
import { fmtDateTimeSec } from './audit-helpers'

type Filter = 'all' | SecurityEventType

const TYPE_META: Record<SecurityEventType, { label: string; tone: 'amber' | 'red' | 'purple' }> = {
  policy_denied: { label: '策略校验失败', tone: 'amber' },
  abnormal_login: { label: '异常登录', tone: 'red' },
  device: { label: '设备异常', tone: 'purple' },
}

export function SecurityLogPage() {
  const s = useStore()
  const [filter, setFilter] = useState<Filter>('all')

  const sorted = useMemo(() => [...s.securityEvents].sort((a, b) => b.at.localeCompare(a.at)), [s.securityEvents])
  const rows = useMemo(() => (filter === 'all' ? sorted : sorted.filter((e) => e.type === filter)), [sorted, filter])
  const countOf = (t: SecurityEventType) => sorted.filter((e) => e.type === t).length

  const columns: Column<SecurityEvent>[] = [
    { key: 'at', title: '时间', width: '150px', render: (e) => <span className="tabular-nums text-zinc-500">{fmtDateTimeSec(e.at)}</span> },
    { key: 'who', title: '用户', render: (e) => <span className="text-zinc-900">{e.who}</span> },
    { key: 'ip', title: 'IP 地址', width: '130px', render: (e) => <span className="font-mono text-xs text-zinc-600">{e.ip}</span> },
    { key: 'type', title: '事件类型', width: '130px', render: (e) => <Pill tone={TYPE_META[e.type].tone}>{TYPE_META[e.type].label}</Pill> },
    { key: 'detail', title: '详情', render: (e) => <span className="text-zinc-700">{e.detail}</span> },
  ]

  return (
    <div>
      <PageHeader title="安全日志" level="P1" desc="策略校验失败、异常登录与设备异常记录，由系统自动写入，不可修改或删除。" />
      <Note>
        <b>策略校验失败</b>：客户端绕过界面直接调接口、被策略引擎拒绝时记一条，是发现被篡改客户端的信号。<b>异常登录</b>：连续密码错误、异地登录。<b>设备异常</b>：同一设备指纹登多个账号，常见于刷推荐奖励。
      </Note>

      <Tabs
        className="mt-4"
        value={filter}
        onChange={setFilter}
        items={[
          { key: 'all', label: '全部', count: sorted.length },
          { key: 'policy_denied', label: TYPE_META.policy_denied.label, count: countOf('policy_denied') },
          { key: 'abnormal_login', label: TYPE_META.abnormal_login.label, count: countOf('abnormal_login') },
          { key: 'device', label: TYPE_META.device.label, count: countOf('device') },
        ]}
      />
      <Card className="mt-3" padded={false}>
        <Table rows={rows} rowKey={(e) => e.id} dense columns={columns} empty="没有该类型的安全事件" />
      </Card>
    </div>
  )
}
