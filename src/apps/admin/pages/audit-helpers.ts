/**
 * 内容与审计几个页面共用的小工具：会话名、带秒的时间、消息展示文本、日期范围判断。
 */
import type { DemoState, Message } from '@/domain/types'
import { fmtDate } from '@/domain/time'
import { customerById, seatById, staffById } from '@/store/selectors'

const pad = (n: number) => String(n).padStart(2, '0')

/** PRD 要求审计类表格显示到秒：YYYY-MM-DD HH:MM:SS */
export function fmtDateTimeSec(s: string): string {
  const d = new Date(s)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 会话名：私聊显示「客户 ↔ 坐席」，群与频道显示群名 */
export function convName(s: DemoState, convId: string): string {
  const conv = s.conversations.find((c) => c.id === convId)
  if (!conv) return '（会话不存在）'
  if (conv.kind === 'dm') return `${customerById(s, conv.customerId)?.nickname ?? '未知客户'} ↔ ${seatById(s, conv.seatId)?.displayName ?? '未知坐席'}`
  return s.chatGroups.find((g) => g.id === conv.chatGroupId)?.name ?? '（群不存在）'
}

/** 消息在审计表格里的文本：删除的显示占位，图片 / 文件显示类型（文件带文件名），随附说明跟在后面 */
export function messageText(m: Message): string {
  if (m.deletedAt) return m.deletedByManager ? '[管理删除]' : '[已删除]'
  if (m.kind === 'image') return m.text ? `[图片] ${m.text}` : '[图片]'
  if (m.kind === 'file') return `[文件] ${m.media?.name ?? ''}${m.text ? ` ${m.text}` : ''}`.trim()
  return m.text
}

/** 发送者显示名（导出用纯文本）：客户「昵称（账号 ID）」，坐席「坐席名（坐席）」 */
export function senderLabel(s: DemoState, m: Message): string {
  if (m.senderKind === 'seat') return `${seatById(s, m.seatId)?.displayName ?? '未知坐席'}（坐席）`
  if (m.senderKind === 'system') return '系统'
  const c = customerById(s, m.senderId)
  return c ? `${c.nickname}（${c.accountId}）` : '未知客户'
}

/** 坐席消息的实操员工姓名，导出用 */
export function operatorLabel(s: DemoState, m: Message): string {
  if (m.senderKind !== 'seat') return ''
  return staffById(s, m.operatorId)?.name ?? '未记录'
}

/** 日期范围（两个 <input type="date"> 的 YYYY-MM-DD 值）是否包含该时间；空值表示不限 */
export function inDateRange(at: string, from: string, to: string): boolean {
  const day = fmtDate(at)
  if (from && day < from) return false
  if (to && day > to) return false
  return true
}
