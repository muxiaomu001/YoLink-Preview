/**
 * 管理员日志：该群近 48 小时的操作记录，按事件类型筛选。有无权限看由调用方决定渲染与否。
 */
import { useMemo, useState } from 'react'
import { fmtAgo } from '@/domain/time'
import { useStore } from '@/store/store'
import { customerById, seatById, staffById } from '@/store/selectors'
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
  restrict: '禁言移出并禁止再进',
  invite_link: '邀请链接',
  delete_message: '删除消息',
}

export function GroupLogPanel({ group: g, compact }: GroupPanelProps) {
  const s = useStore()
  const [action, setAction] = useState('all')
  const [openedAt] = useState(Date.now)
  const since = new Date(openedAt - RETENTION_HOURS * 3600000).toISOString()
  const logs = useMemo(() => s.groupLogs.filter((l) => l.groupId === g.id && l.at >= since).sort((a, b) => b.at.localeCompare(a.at)), [s.groupLogs, g.id, since])
  const kinds = Array.from(new Set(logs.map((l) => l.action)))
  const visible = logs.filter((l) => action === 'all' || l.action === action)

  const actorName = (l: (typeof logs)[number]) => {
    if (l.actorKind === 'staff') {
      const staffName = staffById(s, l.actorId)?.name ?? '员工'
      const seatName = seatById(s, l.actorSeatId)?.displayName ?? '坐席'
      return l.actorSource === 'admin' ? `${staffName}（管理员后台，以群主坐席「${seatName}」身份）` : `${staffName}（工作台，以坐席「${seatName}」身份）`
    }
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
      extra={
        <Select className="h-7 w-28 text-[12px]" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="all">全部类型</option>
          {kinds.map((k) => <option key={k} value={k}>{ACTION_LABEL[k] ?? k}</option>)}
        </Select>
      }
    >
      {!visible.length && <div className="text-[12px] text-zinc-400">近 {RETENTION_HOURS} 小时没有记录。</div>}
      <ul className="thin-scroll max-h-72 space-y-2 overflow-y-auto">
        {visible.map((l) => (
          <li key={l.id} className="text-[12px]">
            <div className="flex items-center gap-1.5">
              <Pill>{ACTION_LABEL[l.action] ?? l.action}</Pill>
              <span className="font-medium text-zinc-700">{actorName(l)}</span>
              <span className="ml-auto text-[11px] text-zinc-400">{fmtAgo(l.at)}</span>
            </div>
            <div className="mt-0.5 leading-snug text-zinc-600">{l.detail}</div>
          </li>
        ))}
      </ul>
    </Section>
  )
}
