/**
 * 话术库共用：类型元数据（图标 / 名称）、分类名、条目预览行、关键词解析、右栏面板的分组构造、面板与聊天区之间的发送接口。
 */
import { Image, Paperclip, Zap } from 'lucide-react'
import type { DemoState, MessageMedia, QuickReply, QuickReplyKind } from '@/domain/types'
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

/** 关键词输入：逗号 / 顿号 / 空格分隔，去重去空 */
export function parseKeywords(raw: string): string[] {
  return Array.from(new Set(raw.split(/[,，、\s]+/).map((k) => k.trim()).filter(Boolean)))
}

export interface QuickReplyGroup {
  key: string
  title: string
  items: QuickReply[]
  /** 个人分类归在「我的」小节下 */
  section?: 'mine'
}

/** 右栏面板分组：最近使用 → 企业分类（按 sortOrder）→ 我的（个人分类）→ 未分类（企业 + 个人） */
export function buildQuickReplyGroups(s: DemoState, staffId: string | null): QuickReplyGroup[] {
  const all = quickRepliesForStaff(s, staffId)
  const cats = quickReplyCategoriesForStaff(s, staffId)
  const recent = recentQuickReplies(s, staffId)
  const byCat = (id: string) => all.filter((x) => x.categoryId === id)
  const enterprise = cats.filter((c) => c.scope === 'enterprise').map((c) => ({ key: c.id, title: c.name, items: byCat(c.id) }))
  const mine = cats.filter((c) => c.scope === 'personal').map((c) => ({ key: c.id, title: c.name, items: byCat(c.id), section: 'mine' as const }))
  const none = all.filter((x) => x.categoryId === null || !cats.some((c) => c.id === x.categoryId))
  return [
    ...(recent.length ? [{ key: 'recent', title: '最近使用', items: recent }] : []),
    ...enterprise,
    ...mine,
    ...(none.length ? [{ key: 'none', title: '未分类', items: none }] : []),
  ]
}
