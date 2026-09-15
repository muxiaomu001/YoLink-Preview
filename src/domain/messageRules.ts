import type { DemoState, Message } from './types'
import { seatCan, seatGroupPerm } from '@/store/policy'

/** 普通聊天不露出坐席撤回的内容，也不留撤回提示；审计保留完整对象。 */
export function customerVisibleMessage(m: Message) {
  return !(m.senderKind === 'seat' && m.recalledAt)
}

/** 0 为不限时间；演示初值用于体验，正式默认值待产品确认。 */
export function messageLimitSeconds(s: DemoState, role: 'seat' | 'customer', action: 'recall' | 'edit') {
  if (role === 'seat') return (action === 'recall' ? s.policyNumbers.seatRecallSeconds : s.policyNumbers.seatEditSeconds) ?? 0
  return (action === 'recall' ? s.policyNumbers.customerRecallSeconds : s.policyNumbers.customerEditSeconds) ?? 0
}

export function timeLimitLabel(seconds: number) {
  if (seconds === 0) return '不限时间'
  if (seconds % 86400 === 0) return `${seconds / 86400} 天内`
  if (seconds % 3600 === 0) return `${seconds / 3600} 小时内`
  if (seconds % 60 === 0) return `${seconds / 60} 分钟内`
  return `${seconds} 秒内`
}

export function seatConversationAllowed(s: DemoState, convId: string, seatId: string, staffId: string) {
  const seat = s.seats.find((x) => x.id === seatId && x.operatorStaffId === staffId && x.status !== 'disabled')
  const staff = s.staff.find((x) => x.id === staffId && x.status === 'active')
  const conv = s.conversations.find((x) => x.id === convId)
  if (!seat || !staff || !conv) return false
  if (conv.kind === 'dm') return conv.seatId === seatId
  return !!s.chatGroups.find((g) => g.id === conv.chatGroupId && g.memberSeatIds.includes(seatId))
}

export function seatMessageSendAllowed(s: DemoState, convId: string, seatId: string, staffId: string, media = false) {
  if (!seatConversationAllowed(s, convId, seatId, staffId)) return false
  const conv = s.conversations.find((c) => c.id === convId)!
  if (conv.kind === 'dm') {
    const c = s.customers.find((x) => x.id === conv.customerId)
    return !!c && !c.deletedAt && !c.blockedSeatIds.includes(seatId) && seatCan(s, seatId, media ? 'dm.send_media' : 'dm.send')
  }
  const g = s.chatGroups.find((x) => x.id === conv.chatGroupId)!
  return seatCan(s, seatId, media ? 'group.send_media' : 'group.send', g.id) && (g.kind !== 'channel' || seatGroupPerm(s, g, seatId, staffId, 'can_post_messages'))
}

/** 只将本会话成员的完整名字视为提及，避免 @林 匹配到 @林顾问。 */
export function mentionsIn(s: DemoState, convId: string, text: string, selected?: { mentionSeatIds: string[]; mentionCustomerIds: string[] }) {
  const conv = s.conversations.find((c) => c.id === convId)
  const g = s.chatGroups.find((x) => x.id === conv?.chatGroupId)
  const has = (name: string) => text.includes(`@${name} `) || text.endsWith(`@${name}`)
  const seats = g?.memberSeatIds ?? (conv?.seatId ? [conv.seatId] : [])
  const customers = g?.memberCustomerIds ?? (conv?.customerId ? [conv.customerId] : [])
  return {
    mentionSeatIds: s.seats.filter((x) => seats.includes(x.id) && has(x.displayName) && (selected?.mentionSeatIds.includes(x.id) || s.seats.filter((p) => seats.includes(p.id) && p.displayName === x.displayName).length === 1)).map((x) => x.id),
    mentionCustomerIds: s.customers.filter((x) => customers.includes(x.id) && !x.deletedAt && has(x.nickname) && (selected?.mentionCustomerIds.includes(x.id) || s.customers.filter((p) => customers.includes(p.id) && p.nickname === x.nickname).length === 1)).map((x) => x.id),
    mentionAll: !!g && has('所有人'),
  }
}
