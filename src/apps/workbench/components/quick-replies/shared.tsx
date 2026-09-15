/**
 * 话术库共用：类型元数据（图标 / 名称）、分类名、条目预览行、命中高亮、右栏分类标签列、面板与聊天区之间的发送接口。
 * 没有关键词字段：搜索与打字匹配都走 selectors.matchQuickReplies 的全文匹配。
 */
import { Clock, Image, LayoutGrid, Paperclip, Zap } from 'lucide-react'
import type { DemoState, MessageMedia, QuickReply, QuickReplyKind } from '@/domain/types'
import type { QuickReplySnippet } from '@/store/selectors'
import { quickRepliesForStaff, quickReplyCategoriesForStaff, recentQuickReplies } from '@/store/selectors'

export const KIND_META: Record<QuickReplyKind, { label: string; icon: typeof Zap }> = {
  text: { label: '文字', icon: Zap },
  image: { label: '图片', icon: Image },
  file: { label: '文件', icon: Paperclip },
}

/** 面板「发送 / 填入」要用到的当前会话能力：由会话页从聊天区拿到后传进来 */
export interface QuickReplyTarget {
  /** 当前有没有选中会话 */
  active: boolean
  /** 有值即不能发（拉黑 / 无频道发布权限），用于禁用按钮并在 title 里说明 */
  blockReason?: string
  /** 私聊客户昵称，渲染 {{customer.nickname}} 用 */
  customerName?: string
  sendText: (text: string) => void
  sendMedia: (kind: 'image' | 'file', media: MessageMedia, text: string) => void
  insertText: (text: string) => void
}

export function categoryName(s: DemoState, id: string | null): string {
  return (id && s.quickReplyCategories.find((c) => c.id === id)?.name) || '未分类'
}

/** 候选行副标题用的一行预览：正文前 max 字，没有正文用附件名 */
export function previewLine(q: QuickReply, max = 40): string {
  const t = q.text.trim().replace(/\s+/g, ' ')
  if (t) return t.length > max ? `${t.slice(0, max)}…` : t
  return q.media?.name ?? ''
}

/** 全文匹配命中的那一段加底色，让人知道这条为什么被搜出来 */
export function Highlight({ snippet, fallback, className }: { snippet: QuickReplySnippet | null; fallback?: string; className?: string }) {
  if (!snippet) return <span className={className}>{fallback ?? ''}</span>
  return (
    <span className={className}>
      {snippet.before}
      <mark className="rounded-[2px] bg-amber-100 px-px text-inherit">{snippet.match}</mark>
      {snippet.after}
    </span>
  )
}

// ---------- 右栏分类标签列 ----------

/** 侧栏一个标签：最近 / 全部在最上，然后企业分类，再是「我的」下的个人分类，最后未分类 */
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

/** 某个标签下的话术 */
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
