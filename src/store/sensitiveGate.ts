import type { DemoState, SensitiveScope } from '@/domain/types'
import { scanSensitive, sensitiveHitsOf } from '@/domain/sensitive'

/** 新发、编辑和群发使用同一套词库判定；调用方决定何时保存命中记录。 */
export function runSensitiveGate(s: DemoState, input: {
  text: string; scope: SensitiveScope; senderId: string; operatorStaffId?: string | null
  convId: string; at: string
}) {
  const scan = scanSensitive(s.sensitiveWords, input.text, input.scope)
  // 坐席词库不支持影子发送；兼容旧数据时也不能静默吞掉员工消息。
  const invalidSeatShadow = input.scope === 'seat' && scan.action === 'shadow'
  const blockedWord = scan.blockedBy?.word ?? scan.hits.find((h) => h.word.action === 'shadow')?.word.word
  const blocked = scan.action === 'block' || invalidSeatShadow
    ? input.scope === 'seat'
      ? `合规词库拦截：「${blockedWord}」不能对客户说，换个说法再发`
      : `消息里的「${blockedWord}」不能发送，改一下再试`
    : undefined
  const hits = sensitiveHitsOf(invalidSeatShadow ? { ...scan, action: 'block' } : scan, { ...input, original: input.text })
  return { blocked, text: scan.text, hits, shadowByWord: !invalidSeatShadow && scan.action === 'shadow' }
}
