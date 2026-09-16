/**
 * 敏感词检查：客户与坐席发出的每条文本在落库前过这一道。
 *
 * 三件事在这一个文件里：
 * 1. 变形匹配。直接子串匹配的词库只能拦住老实人——「保 本」「保_本」「ｂａｏ本」「褓本」
 *    都能绕过去，而真要绕的人第一次就会这么干。这里先把文本归一（全角转半角、大小写、
 *    去空白与分隔符号、常见形近谐音字换成本字），再匹配，同时把命中位置映射回原文，
 *    「替换」动作才能把原文里那一段（含中间被插进去的空格）整段改掉。
 * 2. 两套词库。scope='customer' 查客户发言，scope='seat' 查坐席发言。顾问说「保本」是
 *    合规事故，客户问「保本」只是提问，共用一个词库必然误伤。
 * 3. 影子屏蔽。见下面 SensitiveAction 的注释。
 *
 * 一条消息可能同时踩中几个词，整条消息的动作取最重的一个：拦截 > 影子屏蔽 > 替换 > 放行并记录。
 * 但命中记录是一词一条——后台要看的是「这句话踩了哪几个词」，不是只看最重的那个。
 */
import type { SensitiveAction, SensitiveHit, SensitiveScope, SensitiveWord } from './types'
import { newId } from './ids'

const SEVERITY: Record<SensitiveAction, number> = { block: 4, shadow: 3, replace: 2, log: 1 }

/** 动作与词库的中文名放在 domain 里：后台页面、审计日志、命中记录都读这一份 */
export const SENSITIVE_ACTION_LABEL: Record<SensitiveAction, string> = {
  block: '拦截',
  shadow: '影子屏蔽',
  replace: '替换',
  log: '放行并记录',
}

export const SENSITIVE_SCOPE_LABEL: Record<SensitiveScope, string> = {
  customer: '客户词库',
  seat: '坐席合规词库',
}
const DEFAULT_MASK = '***'

// ---------- 变形归一 ----------

/**
 * 归一时直接删掉的字符：空白、零宽字符、常见用来断词的标点与符号。
 * 「保.本」「保-本」「保、本」和「保本」在词库眼里应该是同一句话。
 */
const STRIP_RE = /[\s​-‏⁠﻿.·。，,、_\-*~^…!！?？:：;；'"“”‘’()（）[\]【】{}<>《》/\\|#$%&+=]/

/**
 * 形近字与谐音字：变体 → 本字。
 *
 * 演示里只放一小张表，够把「褓夲」「穩賺」这类最常见的写法拉回来。真实实现这张表是
 * 服务端词典（同音字按拼音生成、形近字按字形聚类），不写死在代码里；拼音全拼与首字母
 * （baoben / bb）也归这一层做，不在这一版。
 */
const HOMOGLYPH: Record<string, string> = {
  褓: '保', 堡: '保', 煲: '保', 寶: '宝', 夲: '本', 苯: '本', 穩: '稳', 賺: '赚', 轉: '转',
  內: '内', 幕: '幕', 幙: '幕', 理: '理', 財: '财', 個: '个', 賬: '账', 帳: '账', 戶: '户',
  '０': '0', '１': '1', '２': '2', '３': '3', '４': '4', '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
}

interface Normalized {
  text: string
  /** map[i] = 归一后第 i 个字符在原文里的下标 */
  map: number[]
}

/**
 * fuzzy=false 时只做大小写归一，位置与原文一一对应——给关掉变形匹配的词用。
 * 两种模式共用一个函数，位置映射的代码就只有一份，不会出现「精确匹配替换错位」这种 bug。
 */
function normalize(raw: string, fuzzy: boolean): Normalized {
  const out: string[] = []
  const map: number[] = []
  for (let i = 0; i < raw.length; i += 1) {
    let ch = raw[i]
    if (fuzzy) {
      const code = ch.charCodeAt(0)
      // 全角 ASCII（！到 ～）整体平移回半角；全角空格单独处理
      if (code >= 0xff01 && code <= 0xff5e) ch = String.fromCharCode(code - 0xfee0)
      else if (code === 0x3000) ch = ' '
      ch = HOMOGLYPH[ch] ?? ch
      if (STRIP_RE.test(ch)) continue
    }
    out.push(ch.toLowerCase())
    map.push(i)
  }
  return { text: out.join(''), map }
}

/** 一个词在一段文本里命中的全部位置，位置是原文下标 [start, end) */
function rangesOf(raw: string, word: string, fuzzy: boolean): [number, number][] {
  const hay = normalize(raw, fuzzy)
  const needle = normalize(word, fuzzy).text
  if (!needle) return []
  const out: [number, number][] = []
  let from = 0
  for (;;) {
    const i = hay.text.indexOf(needle, from)
    if (i < 0) break
    // 归一时被删掉的字符落在命中区间中间，按原文下标取首尾就能把它们一起圈进来
    out.push([hay.map[i], hay.map[i + needle.length - 1] + 1])
    from = i + needle.length
  }
  return out
}

// ---------- 扫描 ----------

export interface SensitiveMatch {
  word: SensitiveWord
  /** 在原文里的命中区间，「替换」动作按这些区间改写 */
  ranges: [number, number][]
}

export interface SensitiveScan {
  /** 命中的词，按词库顺序；空数组表示没踩到 */
  hits: SensitiveMatch[]
  /** 整条消息的最终动作；没命中时为 undefined */
  action?: SensitiveAction
  /**
   * 送出去的文本。拦截与影子屏蔽都保持原文不动：
   * 拦截时没人看得到这句话，影子屏蔽时**发送方必须看到自己原样的那句**，
   * 一旦给他看到 *** 他立刻就知道被处理了，影子也就不成其为影子。
   */
  text: string
  /** 触发拦截的那个词，用来给发送方一句说得清的提示 */
  blockedBy?: SensitiveWord
}

/** 词默认查客户发言；历史数据里没有 scope 字段，按客户词库算 */
export function scopeOf(w: SensitiveWord): SensitiveScope {
  return w.scope ?? 'customer'
}

export function wordsOfScope(words: SensitiveWord[], scope: SensitiveScope): SensitiveWord[] {
  return words.filter((w) => scopeOf(w) === scope)
}

/** 把命中区间换成掩码；从后往前改，前面的下标才不会被改动带偏 */
function maskRanges(text: string, ranges: { range: [number, number]; mask: string }[]): string {
  const sorted = [...ranges].sort((a, b) => b.range[0] - a.range[0])
  let out = text
  let lastStart = text.length
  for (const { range, mask } of sorted) {
    // 两个词命中区间重叠时只认后面那个，避免把已经换成掩码的部分再切一刀
    if (range[1] > lastStart) continue
    out = out.slice(0, range[0]) + mask + out.slice(range[1])
    lastStart = range[0]
  }
  return out
}

export function scanSensitive(words: SensitiveWord[], text: string, scope: SensitiveScope = 'customer'): SensitiveScan {
  const hits: SensitiveMatch[] = []
  for (const w of wordsOfScope(words, scope)) {
    const word = w.word.trim()
    if (!word) continue
    const ranges = rangesOf(text, word, !w.exact)
    if (ranges.length) hits.push({ word: w, ranges })
  }
  if (!hits.length) return { hits, text }
  const action = hits.reduce<SensitiveAction>((worst, h) => (SEVERITY[h.word.action] > SEVERITY[worst] ? h.word.action : worst), 'log')
  if (action === 'block') return { hits, action, text, blockedBy: hits.find((h) => h.word.action === 'block')!.word }
  if (action === 'shadow') return { hits, action, text }
  const masked = maskRanges(
    text,
    hits.filter((h) => h.word.action === 'replace').flatMap((h) => h.ranges.map((range) => ({ range, mask: h.word.replaceWith || DEFAULT_MASK }))),
  )
  return { hits, action, text: masked }
}

/**
 * 把一次扫描结果写成命中记录。
 * 整条被拦下时每个词都记「已拦截」——替换型的词这次并没有真的替换成功，
 * 记成「已替换」后台就会看到一条没发生过的事。影子屏蔽同理。
 */
export function sensitiveHitsOf(
  scan: SensitiveScan,
  ctx: { scope: SensitiveScope; senderId: string; operatorStaffId?: string | null; convId: string; original: string; at: string },
): SensitiveHit[] {
  const overall = scan.action
  return scan.hits.map((h) => ({
    id: newId('sh'),
    at: ctx.at,
    scope: ctx.scope,
    senderId: ctx.senderId,
    operatorStaffId: ctx.operatorStaffId ?? undefined,
    convId: ctx.convId,
    word: h.word.word.trim(),
    original: ctx.original,
    result: overall === 'block' ? 'blocked' : overall === 'shadow' ? 'shadowed' : h.word.action === 'replace' ? 'replaced' : 'logged',
  }))
}
