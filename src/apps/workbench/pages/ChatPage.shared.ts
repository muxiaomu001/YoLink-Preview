import { Inbox, Mail, MessageSquare } from 'lucide-react'
import type { DemoState, Message } from '@/domain/types'
import { isIdle, type ConvRow, type WorkbenchView } from '@/store/selectors'

export const VIEWS: { key: WorkbenchView; label: string; icon: typeof Inbox; hint: (idleDays: number) => string }[] = [
  { key: 'all', label: '全部', icon: MessageSquare, hint: () => '当前坐席身份下的全部会话' },
  { key: 'waiting', label: '待我回复', icon: Inbox, hint: () => '客户最后发言、坐席尚未回复，按等待时长排' },
  { key: 'unread', label: '未读', icon: Mail, hint: () => '有未读消息的会话' },
]

export type TypeFilter = 'all' | 'dm' | 'group' | 'channel'
export interface Filters {
  type: TypeFilter
  tagIds: string[]
  idle: boolean
  q: string
}

export const EMPTY_FILTERS: Filters = { type: 'all', tagIds: [], idle: false, q: '' }

export function activeFilterCount(f: Filters): number {
  return (f.type !== 'all' ? 1 : 0) + (f.tagIds.length ? 1 : 0) + (f.idle ? 1 : 0)
}

export function previewOf(m: Message | undefined): string {
  if (!m) return ''
  if (m.recalledAt) return '[已撤回]'
  if (m.deletedAt) return '[已删除]'
  if (m.kind === 'image') return '[图片]'
  if (m.kind === 'file') return `[文件] ${m.media?.name ?? ''}`.trim()
  return m.text
}

export function applyFilters(rows: ConvRow[], s: DemoState, f: Filters, idleDays: number): ConvRow[] {
  const q = f.q.trim().toLowerCase()
  return rows.filter((r) => {
    if (f.type !== 'all' && r.conv.kind !== f.type) return false
    if (f.tagIds.length && !f.tagIds.every((t) => r.customer?.tagIds.includes(t))) return false
    if (f.idle && !isIdle(r, idleDays)) return false
    if (q) {
      const inTitle = r.title.toLowerCase().includes(q) || !!r.customer?.nickname.toLowerCase().includes(q)
      const inMsgs = inTitle || s.messages.some((m) => m.convId === r.conv.id && !m.recalledAt && !m.deletedAt && m.text.toLowerCase().includes(q))
      if (!inMsgs) return false
    }
    return true
  })
}
