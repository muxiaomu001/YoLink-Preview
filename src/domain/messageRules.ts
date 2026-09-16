import type { ChatActor, DemoState, Message } from './types'
import { fmtDuration } from './time'
import { customerCan, customerCanSpeakIn, groupPerm, seatCan, seatGroupPerm } from '@/store/policy'
import { globalMuteReason } from './customerStatus'

/**
 * 0 为不限时间；演示初值用于体验，正式默认值待产品确认。
 * deleteAll 即「为所有人删除自己的消息」，持久化字段沿用旧的 *RecallSeconds 名字。
 */
export function messageLimitSeconds(s: DemoState, role: 'seat' | 'customer', action: 'deleteAll' | 'edit') {
  if (role === 'seat') return (action === 'deleteAll' ? s.policyNumbers.seatRecallSeconds : s.policyNumbers.seatEditSeconds) ?? 0
  return (action === 'deleteAll' ? s.policyNumbers.customerRecallSeconds : s.policyNumbers.customerEditSeconds) ?? 0
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

/**
 * 消息对某个身份是否还存在。删除只有一套语义：
 * 为所有人删除的直接消失、不留占位，仅为本方删除的只在该身份隐藏；
 * 两种原文都保留在审计。气泡、回复、转发、搜索、未读、置顶、资料库共用这一个判断。
 *
 * 影子屏蔽也接在这一个判断上，不另起一套。会话列表的最后一条、未读数、@我提示、
 * 回复与转发的目标全都走 messageVisibleFor，接在这里才没有漏网的入口——
 * 少接一处，被屏蔽的那句话就会从会话列表的预览里冒出来，影子当场穿帮。
 */
const messageIndexes = new WeakMap<Message[], Map<string, Message>>()

/**
 * 回复、转发和置顶通知沿来源收窄可见范围。
 * 来源后来编辑成影子时，已存在的衍生内容也不能继续公开原文。
 */
export function messageShadow(s: DemoState, m: Message): Pick<Message, 'shadowedAt' | 'shadowReason' | 'shadowCustomerIds'> {
  let index = messageIndexes.get(s.messages)
  if (!index) {
    index = new Map(s.messages.map((x) => [x.id, x]))
    messageIndexes.set(s.messages, index)
  }
  const pending = [m], visited = new Set<string>()
  let shadowedAt: string | undefined, shadowReason: Message['shadowReason'], allowed: string[] | undefined
  while (pending.length) {
    const current = pending.pop()!
    if (visited.has(current.id)) continue
    visited.add(current.id)
    if (current.shadowedAt) {
      const customers = current.shadowCustomerIds ?? (current.senderKind === 'customer' ? [current.senderId] : [])
      allowed = allowed === undefined ? customers : allowed.filter((id) => customers.includes(id))
      if (!shadowedAt || current.shadowedAt < shadowedAt) {
        shadowedAt = current.shadowedAt
        shadowReason = current.shadowReason
      }
    }
    for (const id of [current.replyToId, current.forwardedFrom?.messageId, ...(current.shadowSourceIds ?? [])]) {
      const source = id ? index.get(id) : undefined
      if (source) pending.push(source)
    }
  }
  return shadowedAt ? { shadowedAt, shadowReason, shadowCustomerIds: allowed ?? [] } : {}
}

export function messageVisibleFor(s: DemoState, m: Message, actor: ChatActor) {
  const conv = s.conversations.find((c) => c.id === m.convId)
  if(m.recipientCustomerId && (actor.kind!=='customer'||actor.id!==m.recipientCustomerId))return false
  // 影子屏蔽：发的人自己看得见（他不知道被屏蔽了），坐席看得见（要能判断这人在干什么），
  // 其他客户看不见。私聊里没有「其他客户」，所以影子屏蔽实际只在群和频道里起作用。
  if (actor.kind === 'customer') {
    const shadow = messageShadow(s, m)
    if (shadow.shadowedAt && !shadow.shadowCustomerIds?.includes(actor.id)) return false
  }
  if (!conv || !actorCanView(s, conv.id, actor) || m.deletedAt) return false
  if (m.hiddenFor?.includes(actorKey(actor)) || m.at <= (conv.clearedThroughByViewer?.[actorKey(actor)] ?? '')) return false
  if (m.delivery && m.delivery !== 'sent') return m.senderKind === actor.kind && m.senderId === actor.id && (actor.kind !== 'seat' || m.operatorId === actor.staffId)
  return true
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
  if (!messageVisibleFor(s, m, actor)) return '这条消息已经不在了'
  if (m.delivery && m.delivery !== 'sent') return '这条消息还没发出去'
  if (canManageDelete(s, m, actor)) return undefined
  if (m.senderKind !== actor.kind || m.senderId !== actor.id) return '只能为所有人删除自己发出的消息'
  const cap = actor.kind === 'seat' ? seatCan(s, actor.id, 'dm.recall') : customerCan(s, actor.id, 'dm.recall', s.conversations.find((c) => c.id === m.convId)?.chatGroupId)
  if (!cap) return '这个会话不支持为所有人删除'
  const limit = messageLimitSeconds(s, actor.kind, 'deleteAll')
  return limit > 0 && Date.now() - new Date(m.at).getTime() > limit * 1000 ? `发送已超过 ${fmtDuration(limit)}，只能从这边删除` : undefined
}

export function sendFailure(s: DemoState, convId: string, actor: ChatActor, media = false) {
  if (!actorCanView(s, convId, actor)) return '当前身份已无权访问此会话'
  if (actor.kind === 'seat') return seatMessageSendAllowed(s, convId, actor.id, actor.staffId ?? '', media) ? undefined : '当前身份或策略不允许发送'
  const conv = s.conversations.find((c) => c.id === convId)!
  const customer = s.customers.find((c) => c.id === actor.id)!
  if (customer.bannedAt) return '账号已被封禁'
  const globalMute = globalMuteReason(customer)
  if (globalMute) return globalMute
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
