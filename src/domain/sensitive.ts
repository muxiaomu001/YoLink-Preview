/**
 * 敏感词检查：客户发出的每条文本在落库前过这一道。
 *
 * 匹配只做最朴素的一件事——大小写归一后的子串匹配。去空格、去符号、全角半角、
 * 拼音首字母、谐音字这些变形匹配排在后续版本，这一版先把「后台配的词真的会生效」
 * 变成事实，而不是一个只能看的页面。
 *
 * 坐席发言暂不查：坐席该有自己一套合规词库（顾问说「保本」是事故，客户问「保本」只是提问），
 * 两边共用一个词库会误伤，所以留到坐席词库那一版一起做。
 *
 * 一条消息可能同时踩中几个词，整条消息的动作取最重的一个：拦截 > 替换 > 放行并记录。
 * 但命中记录是一词一条——后台要看的是「这句话踩了哪几个词」，不是只看最重的那个。
 */
import type { SensitiveAction, SensitiveHit, SensitiveWord } from './types'
import { newId } from './ids'

const SEVERITY: Record<SensitiveAction, number> = { block: 3, replace: 2, log: 1 }
const DEFAULT_MASK = '***'

/** 词本身可能带正则元字符，转义后再做全局替换 */
function maskAll(text: string, word: string, mask: string): string {
  return text.replace(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), mask)
}

export interface SensitiveScan {
  /** 命中的词，按词库顺序；空数组表示没踩到 */
  hits: SensitiveWord[]
  /** 整条消息的最终动作；没命中时为 undefined */
  action?: SensitiveAction
  /** 替换后的文本。被拦截时保持原文不动，命中记录里要存客户真正想发的那句 */
  text: string
  /** 触发拦截的那个词，用来给发送方一句说得清的提示 */
  blockedBy?: SensitiveWord
}

export function scanSensitive(words: SensitiveWord[], text: string): SensitiveScan {
  const lower = text.toLowerCase()
  const hits = words.filter((w) => {
    const word = w.word.trim()
    return !!word && lower.includes(word.toLowerCase())
  })
  if (!hits.length) return { hits, text }
  const action = hits.reduce<SensitiveAction>((worst, w) => (SEVERITY[w.action] > SEVERITY[worst] ? w.action : worst), 'log')
  if (action === 'block') return { hits, action, text, blockedBy: hits.find((w) => w.action === 'block') }
  const masked = hits.filter((w) => w.action === 'replace').reduce((acc, w) => maskAll(acc, w.word.trim(), w.replaceWith || DEFAULT_MASK), text)
  return { hits, action, text: masked }
}

/**
 * 把一次扫描结果写成命中记录。
 * 整条被拦下时每个词都记「已拦截」——替换型的词这次并没有真的替换成功，
 * 记成「已替换」后台就会看到一条没发生过的事。
 */
export function sensitiveHitsOf(scan: SensitiveScan, ctx: { customerId: string; convId: string; original: string; at: string }): SensitiveHit[] {
  return scan.hits.map((w) => ({
    id: newId('sh'),
    at: ctx.at,
    customerId: ctx.customerId,
    convId: ctx.convId,
    word: w.word.trim(),
    original: ctx.original,
    result: scan.action === 'block' ? 'blocked' : w.action === 'replace' ? 'replaced' : 'logged',
  }))
}
