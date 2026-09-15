/** 本地推荐演示：只引用当前已发布的知识正文，不把固定答案冒充知识命中。 */
import type { Customer, KnowledgeItem, Seat } from './types'

interface DraftInput {
  lastCustomerText: string
  customer: Customer
  seat: Seat
  knowledge: KnowledgeItem[]
}

export interface AiDraft {
  text: string
  basis: string
  knowledgeId: string
  sourceBody: string
}

export function knowledgeStatus(k: KnowledgeItem): 'draft' | 'published' | 'offline' {
  return k.status ?? (k.enabled ? 'published' : 'offline')
}

/** 关键词匹配只用于演示发布闭环，不模拟语义理解、业务查询或真实模型能力。 */
export function draftsFor(input: DraftInput): AiDraft[] {
  const query = input.lastCustomerText.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  if (query.length < 2) return []
  const parts = Array.from(new Set(Array.from({ length: query.length - 1 }, (_, i) => query.slice(i, i + 2))))
  return input.knowledge
    .filter((k) => knowledgeStatus(k) === 'published' && k.body.trim())
    .map((k) => {
      const title = k.title.toLowerCase()
      const body = k.body.toLowerCase()
      const tagScore = k.tags.filter((t) => t.trim().length >= 2 && query.includes(t.trim().toLowerCase())).length * 10
      const score = tagScore + parts.reduce((sum, p) => sum + (title.includes(p) ? 3 : body.includes(p) ? 1 : 0), 0)
      return { k, score }
    })
    .filter(({ score }) => score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ k }) => ({
      text: k.body,
      basis: `知识库「${k.title}」· v${k.version ?? 1}`,
      knowledgeId: k.id,
      sourceBody: k.body,
    }))
}
