/**
 * 派生数据：会话视图、未读、等待时长、客户的官方号等。
 * 全部是纯函数，输入是 DemoState，方便页面和测试复用。
 */
import type { Conversation, Customer, DemoState, Message, Seat, Staff } from '@/domain/types'
import { daysSince } from '@/domain/time'
import { senderName } from './policy'

export const LONG_IDLE_DAYS = 14

export function seatById(s: DemoState, id: string | null | undefined): Seat | undefined {
  return id ? s.seats.find((x) => x.id === id) : undefined
}

export function staffById(s: DemoState, id: string | null | undefined): Staff | undefined {
  return id ? s.staff.find((x) => x.id === id) : undefined
}

export function customerById(s: DemoState, id: string | null | undefined): Customer | undefined {
  return id ? s.customers.find((x) => x.id === id) : undefined
}

/** 某员工当前持有的坐席 */
export function seatsOfStaff(s: DemoState, staffId: string | null): Seat[] {
  if (!staffId) return []
  return s.seats.filter((x) => x.operatorStaffId === staffId && x.status !== 'disabled')
}

export function messagesOf(s: DemoState, convId: string): Message[] {
  return s.messages.filter((m) => m.convId === convId).sort((a, b) => a.at.localeCompare(b.at))
}

export function lastMessage(s: DemoState, convId: string): Message | undefined {
  const list = messagesOf(s, convId)
  return list[list.length - 1]
}

/** 会话是否在"待我回复"：最后一条是客户发的 */
export function isWaiting(s: DemoState, conv: Conversation): boolean {
  const last = lastMessage(s, conv.id)
  return !!last && last.senderKind === 'customer'
}

/** 客户说完到现在等了多久（毫秒） */
export function waitingSince(s: DemoState, conv: Conversation): string | null {
  const last = lastMessage(s, conv.id)
  return last && last.senderKind === 'customer' ? last.at : null
}

/** 坐席视角的未读：坐席上次读到之后（或最后一条坐席消息之后）客户与机器人发的条数；手动标未读算 1 */
export function unreadForSeat(s: DemoState, conv: Conversation, seatId?: string): number {
  const list = messagesOf(s, conv.id)
  const readAt = seatId ? conv.readAtBySeat?.[seatId] : undefined
  let n = 0
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const m = list[i]
    if (readAt && m.at <= readAt) break
    if (m.senderKind === 'customer' || m.senderKind === 'bot') n += 1
    else if (m.senderKind === 'seat') break
  }
  if (seatId && conv.unreadMarkBySeatIds?.includes(seatId)) return Math.max(1, n)
  return n
}

export type WorkbenchView = 'waiting' | 'all' | 'mentions' | 'idle'

export interface ConvRow {
  conv: Conversation
  title: string
  subtitle: string
  customer?: Customer
  last?: Message
  unread: number
  waitingSince: string | null
  mentioned: boolean
  idleDays: number
  pinned: boolean
  muted: boolean
}

/** 某坐席能看到的会话：它的私聊 + 它所在的群与频道 */
export function conversationsForSeat(s: DemoState, seatId: string): ConvRow[] {
  const groupIds = s.chatGroups.filter((g) => g.memberSeatIds.includes(seatId)).map((g) => g.id)
  return s.conversations
    .filter((c) => (c.kind === 'dm' ? c.seatId === seatId : groupIds.includes(c.chatGroupId!)))
    .map((conv) => {
      const last = lastMessage(s, conv.id)
      if (conv.kind === 'dm') {
        const customer = customerById(s, conv.customerId)
        return {
          conv,
          title: customer?.nickname ?? '未知客户',
          subtitle: last?.text ?? '',
          customer,
          last,
          unread: unreadForSeat(s, conv, seatId),
          waitingSince: waitingSince(s, conv),
          mentioned: false,
          idleDays: daysSince(conv.lastMessageAt),
          pinned: !!conv.pinnedBySeatIds?.includes(seatId),
          muted: !!conv.mutedBySeatIds?.includes(seatId),
        }
      }
      const g = s.chatGroups.find((x) => x.id === conv.chatGroupId)
      const list = messagesOf(s, conv.id)
      const mentioned = list.some((m) => m.mentionSeatIds?.includes(seatId) && !list.some((r) => r.seatId === seatId && r.at > m.at))
      return {
        conv,
        title: g?.name ?? '群',
        subtitle: last ? `${senderName(s, last)}：${last.recalledAt ? '[已撤回]' : last.deletedAt ? '[已删除]' : last.text}` : '',
        last,
        unread: unreadForSeat(s, conv, seatId),
        waitingSince: null,
        mentioned,
        idleDays: daysSince(conv.lastMessageAt),
        pinned: !!conv.pinnedBySeatIds?.includes(seatId),
        muted: !!conv.mutedBySeatIds?.includes(seatId),
      }
    })
    // 置顶在前，其余按最后消息时间
    .sort((a, b) => (a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : b.conv.lastMessageAt.localeCompare(a.conv.lastMessageAt)))
}

/** idleDays：企业数值型策略里的"长期未跟进天数"，默认 14 */
export function applyView(rows: ConvRow[], view: WorkbenchView, idleDays: number = LONG_IDLE_DAYS): ConvRow[] {
  switch (view) {
    case 'waiting':
      return rows.filter((r) => r.waitingSince).sort((a, b) => a.waitingSince!.localeCompare(b.waitingSince!))
    case 'mentions':
      return rows.filter((r) => r.mentioned)
    case 'idle':
      return rows.filter((r) => r.conv.kind === 'dm' && r.idleDays >= idleDays).sort((a, b) => b.idleDays - a.idleDays)
    default:
      return rows
  }
}

/** 客户的全部官方号（按邀请组顺序），带主归属 */
export function seatsOfCustomer(s: DemoState, customerId: string) {
  return s.customerSeats
    .filter((cs) => cs.customerId === customerId)
    .map((cs) => ({ ...cs, seat: seatById(s, cs.seatId)!, conv: s.conversations.find((c) => c.kind === 'dm' && c.customerId === customerId && c.seatId === cs.seatId) }))
    .filter((x) => x.seat)
}

export function primarySeatOfCustomer(s: DemoState, customerId: string): Seat | undefined {
  const cs = s.customerSeats.find((x) => x.customerId === customerId && x.primary)
  return seatById(s, cs?.seatId)
}

/** 未注销的客户 */
export function activeCustomers(s: DemoState): Customer[] {
  return s.customers.filter((c) => !c.deletedAt)
}

/** 某坐席主归属的客户 */
export function customersOfSeat(s: DemoState, seatId: string): Customer[] {
  const ids = new Set(s.customerSeats.filter((cs) => cs.seatId === seatId && cs.primary).map((cs) => cs.customerId))
  return s.customers.filter((c) => ids.has(c.id))
}

/** 客户屏视角：客户的会话列表（官方号私聊 + 群 + 频道） */
export function conversationsForCustomer(s: DemoState, customerId: string) {
  const c = customerById(s, customerId)
  if (!c) return []
  const groupIds = s.chatGroups.filter((g) => g.memberCustomerIds.includes(customerId)).map((g) => g.id)
  const order = new Map(seatsOfCustomer(s, customerId).map((x, i) => [x.seatId, i]))
  return s.conversations
    .filter((conv) => (conv.kind === 'dm' ? conv.customerId === customerId : groupIds.includes(conv.chatGroupId!)))
    .map((conv) => {
      const last = lastMessage(s, conv.id)
      if (conv.kind === 'dm') {
        const seat = seatById(s, conv.seatId)!
        return { conv, title: seat.displayName, seat, group: undefined, last, official: true, order: order.get(seat.id) ?? 99 }
      }
      const group = s.chatGroups.find((x) => x.id === conv.chatGroupId)!
      return { conv, title: group.name, seat: undefined, group, last, official: group.official, order: 100 }
    })
    .sort((a, b) => (a.order !== b.order ? a.order - b.order : b.conv.lastMessageAt.localeCompare(a.conv.lastMessageAt)))
}

/** 消息发出时坐席归谁：按交接区间反推（与 operatorId 互为双保险） */
export function operatorAt(s: DemoState, seatId: string, at: string): Staff | undefined {
  const hos = s.handovers.filter((h) => h.seatId === seatId).sort((a, b) => a.at.localeCompare(b.at))
  const before = hos.filter((h) => h.at <= at)
  if (before.length) return staffById(s, before[before.length - 1].toStaffId)
  const after = hos.filter((h) => h.at > at)
  if (after.length) return staffById(s, after[0].fromStaffId)
  const seat = seatById(s, seatId)
  return staffById(s, seat?.operatorStaffId)
}

export function staffHasCap(s: DemoState, staffId: string | null, cap: string): boolean {
  const st = staffById(s, staffId)
  const role = s.roles.find((r) => r.id === st?.roleId)
  return !!role?.caps.includes(cap as never)
}

/** 老板看板六个数 */
export function dashboardNumbers(s: DemoState) {
  const today = new Date().toDateString()
  const isToday = (x: string) => new Date(x).toDateString() === today
  const week = Date.now() - 7 * 86400000
  const customersTotal = s.customers.length
  const newThisWeek = s.customers.filter((c) => new Date(c.registeredAt).getTime() > week).length
  const active7 = s.customers.filter((c) => new Date(c.lastActiveAt).getTime() > week).length
  const lastBc = s.broadcasts[0]
  const todaySeatMsgs = s.messages.filter((m) => m.senderKind === 'seat' && isToday(m.at) && !m.isWelcome)
  const repliedCustomers = new Set(todaySeatMsgs.map((m) => s.conversations.find((c) => c.id === m.convId)?.customerId).filter(Boolean)).size
  const onlineStaff = s.staff.filter((x) => x.status === 'active' && x.lastLoginAt && Date.now() - new Date(x.lastLoginAt).getTime() < 8 * 3600000).length
  const aiToday = s.aiEvents.filter((e) => isToday(e.at))
  const adopted = aiToday.filter((e) => e.result !== 'ignored').length
  // 首次响应中位数：客户消息到坐席下一条回复
  const gaps: number[] = []
  s.conversations.filter((c) => c.kind === 'dm').forEach((conv) => {
    const list = messagesOf(s, conv.id)
    for (let i = 0; i < list.length - 1; i += 1) {
      if (list[i].senderKind === 'customer' && list[i + 1].senderKind === 'seat' && isToday(list[i + 1].at)) {
        gaps.push((new Date(list[i + 1].at).getTime() - new Date(list[i].at).getTime()) / 60000)
      }
    }
  })
  gaps.sort((a, b) => a - b)
  const median = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0
  return {
    customersTotal,
    newThisWeek,
    active7,
    active7Pct: customersTotal ? Math.round((active7 / customersTotal) * 100) : 0,
    lastBc,
    repliedCustomers,
    onlineStaff,
    perStaff: onlineStaff ? (repliedCustomers / onlineStaff).toFixed(1) : '0',
    medianMin: Math.round(median),
    aiDrafts: aiToday.length,
    aiAdopted: adopted,
    aiPct: aiToday.length ? Math.round((adopted / aiToday.length) * 100) : 0,
  }
}
