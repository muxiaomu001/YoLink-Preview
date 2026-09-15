/**
 * 话术库共用：类型元数据（图标 / 名称）、分类名、条目预览行、命中高亮、右栏分类标签列、面板与聊天区之间的发送接口。
 * 没有关键词字段：搜索与打字匹配都走 selectors.matchQuickReplies 的全文匹配。
 */
import type { MessageMedia } from '@/domain/types'
import type { QuickReplySnippet } from '@/store/selectors'

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
