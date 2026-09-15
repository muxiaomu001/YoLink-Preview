/**
 * 管理员日志：该群近 48 小时的操作记录，仅有「管理群」权限的管理员可见；按事件类型筛选（P1）。
 */
import { useMemo, useState } from 'react'
import { fmtAgo } from '@/domain/time'
import { useStore } from '@/store/store'
import { customerById, seatById } from '@/store/selectors'
import { Pill } from '@/ui/display'
import { Select } from '@/ui/primitives'
import { Section, type GroupPanelProps } from './shared'

const RETENTION_HOURS = 48

const ACTION_LABEL: Record<string, string> = {
  create: '建群',
  setting: '群设置',
  announcement: '公告',
  pin: '置顶',
  member: '成员变更',
  admin: '管理员任免',
  restrict: '禁言封禁',
  invite_link: '邀请链接',
  delete_message: '删除消息',
}

export function GroupLogPanel({ group: g, perm, compact }: GroupPanelProps) {
  const s = useStore()
  const [action, setAction] = useState('all')
  const since = new Date(Date.now() - RETENTION_HOURS * 3600000).toISOString()
  const logs = useMemo(() => s.groupLogs.filter((l) => l.groupId === g.id && l.at >= since).sort((a, b) => b.at.localeCompare(a.at)), [s.groupLogs, g.id, since])
  const kinds = Array.from(new Set(logs.map((l) => l.action)))
  const visible = logs.filter((l) => action === 'all' || l.action === action)

  const actorName = (l: (typeof logs)[number]) => {
    if (l.actorKind === 'seat') return seatById(s, l.actorId)?.displayName ?? '坐席'
    if (l.actorKind === 'customer') return customerById(s, l.actorId)?.nickname ?? '客户'
    return '系统'
  }

  return (
    <Section
      title={`管理员日志（${logs.length}）`}
      compact={compact}
      hint={`保留 ${RETENTION_HOURS} 小时`}
      defaultOpen={!compact}
      locked={!perm('can_manage_chat')}
      lockedReason="需要「管理群」权限才能看管理员日志"
      extra={
        <span className="inline-flex items-center gap-1">
          <Pill>P1</Pill>
          <Select className="h-6 w-28 text-[11px]" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="all">全部类型</option>
            {kinds.map((k) => <option key={k} value={k}>{ACTION_LABEL[k] ?? k}</option>)}
          </Select>
        </span>
      }
    >
      {!visible.length && <div className="text-[11px] text-zinc-400">近 {RETENTION_HOURS} 小时没有记录。</div>}
      <ul className="thin-scroll max-h-72 space-y-1.5 overflow-y-auto">
        {visible.map((l) => (
          <li key={l.id} className="text-[11px]">
            <div className="flex items-center gap-1.5">
              <Pill>{ACTION_LABEL[l.action] ?? l.action}</Pill>
              <span className="font-medium text-zinc-700">{actorName(l)}</span>
              <span className="ml-auto text-[10px] text-zinc-400">{fmtAgo(l.at)}</span>
            </div>
            <div className="mt-0.5 leading-snug text-zinc-600">{l.detail}</div>
          </li>
        ))}
      </ul>
    </Section>
  )
}
