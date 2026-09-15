import { Clock, Image, LayoutGrid, Paperclip, Zap } from 'lucide-react'
import type { DemoState, QuickReply, QuickReplyKind } from '@/domain/types'
import { quickRepliesForStaff, quickReplyCategoriesForStaff, recentQuickReplies } from '@/store/selectors'

export const KIND_META: Record<QuickReplyKind, { label: string; icon: typeof Zap }> = {
  text: { label: '文字', icon: Zap },
  image: { label: '图片', icon: Image },
  file: { label: '文件', icon: Paperclip },
}

export function categoryName(s: DemoState, id: string | null): string {
  return (id && s.quickReplyCategories.find((c) => c.id === id)?.name) || '未分类'
}

export function previewLine(q: QuickReply, max = 40): string {
  const t = q.text.trim().replace(/\s+/g, ' ')
  if (t) return t.length > max ? `${t.slice(0, max)}…` : t
  return q.media?.name ?? ''
}

export interface QuickReplyTab {
  key: string
  title: string
  count: number
  section: 'top' | 'enterprise' | 'mine' | 'other'
  icon?: typeof Zap
}

export const TAB_RECENT = 'recent'
export const TAB_ALL = 'all'
export const TAB_NONE = 'none'

export function buildQuickReplyTabs(s: DemoState, staffId: string | null): QuickReplyTab[] {
  const all = quickRepliesForStaff(s, staffId)
  const cats = quickReplyCategoriesForStaff(s, staffId)
  const inCat = (id: string) => all.filter((x) => x.categoryId === id).length
  const uncategorized = all.filter((x) => x.categoryId === null || !cats.some((c) => c.id === x.categoryId)).length
  return [
    { key: TAB_RECENT, title: '最近', count: recentQuickReplies(s, staffId).length, section: 'top', icon: Clock },
    { key: TAB_ALL, title: '全部', count: all.length, section: 'top', icon: LayoutGrid },
    ...cats.filter((c) => c.scope === 'enterprise').map((c) => ({ key: c.id, title: c.name, count: inCat(c.id), section: 'enterprise' as const })),
    ...cats.filter((c) => c.scope === 'personal').map((c) => ({ key: c.id, title: c.name, count: inCat(c.id), section: 'mine' as const })),
    ...(uncategorized ? [{ key: TAB_NONE, title: '未分类', count: uncategorized, section: 'other' as const }] : []),
  ]
}

export function quickRepliesInTab(s: DemoState, staffId: string | null, tabKey: string): QuickReply[] {
  const all = quickRepliesForStaff(s, staffId)
  if (tabKey === TAB_RECENT) return recentQuickReplies(s, staffId)
  if (tabKey === TAB_ALL) return all
  if (tabKey === TAB_NONE) {
    const cats = quickReplyCategoriesForStaff(s, staffId)
    return all.filter((x) => x.categoryId === null || !cats.some((c) => c.id === x.categoryId))
  }
  return all.filter((x) => x.categoryId === tabKey)
}
