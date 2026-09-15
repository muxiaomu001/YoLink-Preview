/**
 * 话术库动作：企业话术与分类（后台）、个人话术与分类（工作台）、使用计数。
 * 企业话术改动记审计 quick_reply.library，个人的记 quick_reply.update。
 */
import type { MessageMedia, QuickReply, QuickReplyCategory, QuickReplyKind, QuickReplyScope } from '@/domain/types'
import { newId } from '@/domain/ids'
import { type Get, type Set, now, withAudit } from './helpers'

export interface QuickReplyInput {
  id?: string
  categoryId: string | null
  kind: QuickReplyKind
  title: string
  text: string
  keywords: string[]
  media?: MessageMedia
}

export interface QuickReplyActions {
  /** 新建或编辑一条话术；personal 时 staffId 必填且只能改自己的 */
  saveQuickReply: (scope: QuickReplyScope, input: QuickReplyInput, byStaffId: string) => QuickReply | null
  deleteQuickReply: (scope: QuickReplyScope, id: string, byStaffId: string) => void
  /** 企业话术启停 */
  setQuickReplyEnabled: (id: string, enabled: boolean, byStaffId: string) => void
  saveQuickReplyCategory: (scope: QuickReplyScope, input: { id?: string; name: string }, byStaffId: string) => QuickReplyCategory | null
  /** 删分类：分类下的话术变成未分类，不删话术 */
  deleteQuickReplyCategory: (scope: QuickReplyScope, id: string, byStaffId: string) => void
  /** 发送或填入一条话术后计数 */
  touchQuickReply: (id: string) => void
}

const KIND_LABEL: Record<QuickReplyKind, string> = { text: '文字', image: '图片', file: '文件' }

function normalize(input: QuickReplyInput): QuickReplyInput {
  return {
    ...input,
    title: input.title.trim(),
    text: input.text.trim(),
    keywords: Array.from(new Set(input.keywords.map((k) => k.trim()).filter(Boolean))),
  }
}

export function quickReplyActions(set: Set, get: Get): QuickReplyActions {
  return {
    saveQuickReply: (scope, raw, byStaffId) => {
      const input = normalize(raw)
      if (!input.title) return null
      if (input.kind === 'text' && !input.text) return null
      if (input.kind !== 'text' && !input.media) return null
      const s = get()
      const owner = scope === 'personal' ? byStaffId : undefined
      const auditType = scope === 'enterprise' ? 'quick_reply.library' : 'quick_reply.update'
      if (input.id) {
        const old = s.quickReplies.find((q) => q.id === input.id && q.scope === scope && (scope === 'enterprise' || q.staffId === byStaffId))
        if (!old) return null
        const next: QuickReply = { ...old, categoryId: input.categoryId, kind: input.kind, title: input.title, text: input.text, keywords: input.keywords, media: input.kind === 'text' ? undefined : input.media }
        set({
          quickReplies: s.quickReplies.map((q) => (q.id === next.id ? next : q)),
          audit: withAudit(s.audit, auditType, `编辑${scope === 'enterprise' ? '企业' : '个人'}话术「${next.title}」`, byStaffId),
        })
        return next
      }
      const q: QuickReply = {
        id: newId('qr'),
        scope,
        staffId: owner,
        categoryId: input.categoryId,
        kind: input.kind,
        title: input.title,
        text: input.text,
        keywords: input.keywords,
        media: input.kind === 'text' ? undefined : input.media,
        enabled: true,
        useCount: 0,
      }
      set({
        quickReplies: [...s.quickReplies, q],
        audit: withAudit(s.audit, auditType, `新建${scope === 'enterprise' ? '企业' : '个人'}${KIND_LABEL[q.kind]}话术「${q.title}」`, byStaffId),
      })
      return q
    },

    deleteQuickReply: (scope, id, byStaffId) =>
      set((s) => {
        const q = s.quickReplies.find((x) => x.id === id && x.scope === scope && (scope === 'enterprise' || x.staffId === byStaffId))
        if (!q) return {}
        return {
          quickReplies: s.quickReplies.filter((x) => x.id !== id),
          audit: withAudit(s.audit, scope === 'enterprise' ? 'quick_reply.library' : 'quick_reply.update', `删除${scope === 'enterprise' ? '企业' : '个人'}话术「${q.title}」`, byStaffId),
        }
      }),

    setQuickReplyEnabled: (id, enabled, byStaffId) =>
      set((s) => {
        const q = s.quickReplies.find((x) => x.id === id && x.scope === 'enterprise')
        if (!q) return {}
        return {
          quickReplies: s.quickReplies.map((x) => (x.id === id ? { ...x, enabled } : x)),
          audit: withAudit(s.audit, 'quick_reply.library', `${enabled ? '启用' : '停用'}企业话术「${q.title}」`, byStaffId),
        }
      }),

    saveQuickReplyCategory: (scope, input, byStaffId) => {
      const name = input.name.trim()
      if (!name) return null
      const s = get()
      const auditType = scope === 'enterprise' ? 'quick_reply.library' : 'quick_reply.update'
      if (input.id) {
        const old = s.quickReplyCategories.find((c) => c.id === input.id && c.scope === scope && (scope === 'enterprise' || c.staffId === byStaffId))
        if (!old) return null
        const next = { ...old, name }
        set({ quickReplyCategories: s.quickReplyCategories.map((c) => (c.id === next.id ? next : c)), audit: withAudit(s.audit, auditType, `重命名话术分类「${old.name}」→「${name}」`, byStaffId) })
        return next
      }
      const siblings = s.quickReplyCategories.filter((c) => c.scope === scope && (scope === 'enterprise' || c.staffId === byStaffId))
      const cat: QuickReplyCategory = { id: newId('qrc'), scope, staffId: scope === 'personal' ? byStaffId : undefined, name, sortOrder: siblings.length + 1 }
      set({ quickReplyCategories: [...s.quickReplyCategories, cat], audit: withAudit(s.audit, auditType, `新建话术分类「${name}」`, byStaffId) })
      return cat
    },

    deleteQuickReplyCategory: (scope, id, byStaffId) =>
      set((s) => {
        const cat = s.quickReplyCategories.find((c) => c.id === id && c.scope === scope && (scope === 'enterprise' || c.staffId === byStaffId))
        if (!cat) return {}
        return {
          quickReplyCategories: s.quickReplyCategories.filter((c) => c.id !== id),
          quickReplies: s.quickReplies.map((q) => (q.categoryId === id ? { ...q, categoryId: null } : q)),
          audit: withAudit(s.audit, scope === 'enterprise' ? 'quick_reply.library' : 'quick_reply.update', `删除话术分类「${cat.name}」，其下话术转为未分类`, byStaffId),
        }
      }),

    touchQuickReply: (id) =>
      set((s) => ({ quickReplies: s.quickReplies.map((q) => (q.id === id ? { ...q, useCount: q.useCount + 1, lastUsedAt: now() } : q)) })),
  }
}
