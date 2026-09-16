import type { ChatActor, DemoState, Message } from './types'
import { customerCan, customerCanSpeakIn, groupPerm, seatCan, seatGroupPerm } from '@/store/policy'

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


export const actorKey = (actor: ChatActor) => `${actor.kind}:${actor.id}`
export const draftKey = (actor: ChatActor, convId: string) => `${actor.kind === 'seat' ? actor.staffId + ':' : ''}${actorKey(actor)}:${convId}`

export function actorCanView(s: DemoState, convId: string, actor: ChatActor) {
  if (actor.kind === 'seat') return seatConversationAllowed(s, convId, actor.id, actor.staffId ?? '')
  const c = s.customers.find((x) => x.id === actor.id && !x.deletedAt)
  const conv = s.conversations.find((x) => x.id === convId)
  return !!c && !!conv && (conv.kind === 'dm' ? conv.customerId === actor.id : s.chatGroups.some((g) => g.id === conv.chatGroupId && g.memberCustomerIds.includes(actor.id)))
}

function messageVisibleCore(s: DemoState, m: Message, actor: ChatActor, keepRecalled: boolean) {
  const conv = s.conversations.find((c) => c.id === m.convId)
  if(m.recipientCustomerId && (actor.kind!=='customer'||actor.id!==m.recipientCustomerId))return false
  if (!conv || !actorCanView(s, conv.id, actor) || m.deletedAt || (m.recalledAt && !keepRecalled)) return false
  if (m.hiddenFor?.includes(actorKey(actor)) || m.at <= (conv.clearedThroughByViewer?.[actorKey(actor)] ?? '')) return false
  if (m.delivery && m.delivery !== 'sent') return m.senderKind === actor.kind && m.senderId === actor.id && (actor.kind !== 'seat' || m.operatorId === actor.staffId)
  return true
}

/** 消息是否还「算数」：撤回与删除的都不算，用于引用、转发、搜索、未读、置顶、资料库。 */
export function messageVisibleFor(s: DemoState, m: Message, actor: ChatActor) {
  return messageVisibleCore(s, m, actor, false)
}

/**
 * 聊天气泡列表专用。两种消失方式在演示里刻意不同：
 * 撤回（本人、限时内）双方都留一条「消息已撤回」灰条，和常见 IM 一致；
 * 管理删除（管理员清他人消息）直接消失、不留痕，免得反而把注意力引过去。原文两种都保留在审计里。
 */
export function messageVisibleInChat(s: DemoState, m: Message, actor: ChatActor) {
  return messageVisibleCore(s, m, actor, true)
}

export function canManageDelete(s: DemoState, m: Message, actor: ChatActor) {
  if (!actorCanView(s, m.convId, actor)) return false
  const conv = s.conversations.find((c) => c.id === m.convId)!
  const group = s.chatGroups.find((g) => g.id === conv.chatGroupId)
  if (actor.kind === 'seat') {
    const staff = s.staff.find((x) => x.id === actor.staffId)
    const caps = s.roles.find((x) => x.id === staff?.roleId)?.caps ?? []
    if (staff?.roleId === 'role_admin' || caps.includes('manage_messages')) return true
    return !!group && seatGroupPerm(s, group, actor.id, actor.staffId ?? null, 'can_delete_messages')
  }
  return !!group && groupPerm(group, 'customer', actor.id, 'can_delete_messages')
}

export function deleteAllBlock(s: DemoState, m: Message, actor: ChatActor) {
  if (!messageVisibleFor(s, m, actor)) return '消息已不可用或无权访问'
  if (m.delivery && m.delivery !== 'sent') return '这条消息尚未发出，只需从本方删除'
  if (canManageDelete(s, m, actor)) return undefined
  if (m.senderKind !== actor.kind || m.senderId !== actor.id) return '没有管理删除他人消息的权限'
  const cap = actor.kind === 'seat' ? seatCan(s, actor.id, 'dm.recall') : customerCan(s, actor.id, 'dm.recall', s.conversations.find((c) => c.id === m.convId)?.chatGroupId)
  if (!cap) return '当前策略未开放撤回'
  const limit = messageLimitSeconds(s, actor.kind, 'recall')
  return limit > 0 && Date.now() - new Date(m.at).getTime() > limit * 1000 ? '已超过后台设置的撤回时限' : undefined
}

export function sendFailure(s: DemoState, convId: string, actor: ChatActor, media = false) {
  if (!actorCanView(s, convId, actor)) return '当前身份已无权访问此会话'
  if (actor.kind === 'seat') return seatMessageSendAllowed(s, convId, actor.id, actor.staffId ?? '', media) ? undefined : '当前身份或策略不允许发送'
  const conv = s.conversations.find((c) => c.id === convId)!
  const customer = s.customers.find((c) => c.id === actor.id)!
  if (customer.blacklistedAt) return '你已被限制发送消息'
  if (conv.kind === 'dm') {
    if (customer.blockedSeatIds.includes(conv.seatId!)) return '请先解除对该官方联系人的拉黑'
    if (media && !customerCan(s, actor.id, 'dm.send_media')) return '当前不允许发送附件'
  } else {
    const group = s.chatGroups.find((g) => g.id === conv.chatGroupId)!
    const result = customerCanSpeakIn(s, group, actor.id, new Date().toISOString())
    if (!result.ok) return result.reason
    if (media && !customerCan(s, actor.id, 'group.send_media', group.id)) return '当前不允许发送附件'
  }
  return undefined
}

export function channelOf(s: DemoState, m: Message) {
  if (m.senderKind !== 'seat') return undefined
  const conv = s.conversations.find((c) => c.id === m.convId)
  return s.chatGroups.find((g) => g.id === (m.channelId ?? (conv?.kind === 'channel' ? conv.chatGroupId : undefined)))
}
