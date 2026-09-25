/**
 * 派生数据：会话视图、未读、等待时长、客户的官方号等。
 * 全部是纯函数，输入是 DemoState，方便页面和测试复用。
 */
import type { Conversation, Customer, DemoState, Message, QuickReply, QuickReplyCategory, Seat, Staff } from '@/domain/types'
import { messageVisibleFor } from '@/domain/messageRules'
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

/** 坐席视角的未读：坐席上次读到之后（或最后一条坐席消息之后）其他成员发的条数；手动标未读算 1 */
export function unreadForSeat(s: DemoState, conv: Conversation, seatId?: string): number {
  const list = messagesOf(s, conv.id).filter((m) => !seatId || messageVisibleFor(s,m,{kind:'seat',id:seatId,staffId:s.seats.find((x)=>x.id===seatId)?.operatorStaffId??undefined}))
  const readAt = seatId ? conv.readAtBySeat?.[seatId] : undefined
  let n = 0
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const m = list[i]
    if (readAt && m.at <= readAt) break
    if (m.senderKind === 'customer') n += 1
    else if (!readAt && m.senderKind === 'seat' && (!seatId || m.seatId === seatId)) break
    else if (m.senderKind === 'seat' && m.seatId !== seatId) n += 1
  }
  if (seatId && conv.unreadMarkBySeatIds?.includes(seatId)) return Math.max(1, n)
  return n
}

export type WorkbenchView = 'all' | 'waiting' | 'unread'

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
      const actor = { kind: 'seat' as const, id: seatId, staffId: s.seats.find((x) => x.id === seatId)?.operatorStaffId ?? undefined }
      const visibleMessages = messagesOf(s,conv.id).filter((m)=>messageVisibleFor(s,m,actor))
      const last = visibleMessages.at(-1)
      if (conv.kind === 'dm') {
        const customer = customerById(s, conv.customerId)
        return {
          conv,
          title: customer?.nickname ?? '未知客户',
          subtitle: last?.text ?? '',
          customer,
          last,
          unread: unreadForSeat(s, conv, seatId),
          waitingSince: last?.senderKind === 'customer' ? last.at : null,
          mentioned: false,
          idleDays: daysSince(conv.lastMessageAt),
          pinned: !!conv.pinnedBySeatIds?.includes(seatId),
          muted: !!conv.mutedBySeatIds?.includes(seatId),
        }
      }
      const g = s.chatGroups.find((x) => x.id === conv.chatGroupId)
      const list = visibleMessages
      const mentioned = list.some((m) => (m.mentionSeatIds?.includes(seatId) || m.mentionAll) && m.senderId !== seatId && m.at > (conv.readAtBySeat?.[seatId] ?? ''))
      return {
        conv,
        title: g?.name ?? '群',
        subtitle: last ? `${senderName(s, last)}：${last.text}` : '',
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
    .sort((a, b) => (a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : (b.last?.at??b.conv.lastMessageAt).localeCompare(a.last?.at??a.conv.lastMessageAt)))
}

/** 三个视图：全部 / 待我回复（按等待时长）/ 未读。「长期未跟进」是筛选条件，见 isIdle */
export function applyView(rows: ConvRow[], view: WorkbenchView): ConvRow[] {
  switch (view) {
    case 'waiting':
      return rows.filter((r) => r.waitingSince).sort((a, b) => a.waitingSince!.localeCompare(b.waitingSince!))
    case 'unread':
      return rows.filter((r) => r.unread > 0)
    default:
      return rows
  }
}

/** 长期未跟进：私聊且超过企业数值型策略 idleDays 天没有往来 */
export function isIdle(row: ConvRow, idleDays: number = LONG_IDLE_DAYS): boolean {
  return row.conv.kind === 'dm' && row.idleDays >= idleDays
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

/**
 * 会不会分到主归属：在任一邀请组的轮询队列里，或手上已经有主归属客户。
 * 只做固定坐席的号不占主归属，统计与 KPI 都不该把它们算进去。
 */
export function holdsPrimary(s: DemoState, seatId: string): boolean {
  return s.inviteGroups.some((g) => g.rotatingSeatIds.includes(seatId)) || s.customerSeats.some((cs) => cs.seatId === seatId && cs.primary)
}

/** 某坐席的全部好友：所有把它加为官方联系人的在册客户（含非主归属），一键群发的范围 */
export function friendsOfSeat(s: DemoState, seatId: string): Customer[] {
  const ids = new Set(s.customerSeats.filter((cs) => cs.seatId === seatId).map((cs) => cs.customerId))
  return s.customers.filter((c) => ids.has(c.id) && !c.deletedAt)
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
      const last = messagesOf(s, conv.id).filter((m)=>messageVisibleFor(s,m,{kind:'customer',id:customerId})).at(-1)
      if (conv.kind === 'dm') {
        const seat = seatById(s, conv.seatId)!
        return { conv, title: seat.displayName, seat, group: undefined, last, official: true, order: order.get(seat.id) ?? 99 }
      }
      const group = s.chatGroups.find((x) => x.id === conv.chatGroupId)!
      return { conv, title: group.name, seat: undefined, group, last, official: group.official, order: 100 }
    })
    .sort((a, b) => (a.order !== b.order ? a.order - b.order : (b.last?.at??b.conv.lastMessageAt).localeCompare(a.last?.at??a.conv.lastMessageAt)))
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
  }
}

// ---------- 话术库 ----------

/** 某员工在工作台能用的话术：启用的企业话术 + 本人个人话术 */
export function quickRepliesForStaff(s: DemoState, staffId: string | null): QuickReply[] {
  return s.quickReplies.filter((q) => (q.scope === 'enterprise' && q.enabled) || (q.scope === 'personal' && q.staffId === staffId))
}

/** 某员工看到的分类：企业分类 + 本人个人分类，各自按 sortOrder */
export function quickReplyCategoriesForStaff(s: DemoState, staffId: string | null): QuickReplyCategory[] {
  return s.quickReplyCategories.filter((c) => c.scope === 'enterprise' || c.staffId === staffId).sort((a, b) => (a.scope !== b.scope ? (a.scope === 'enterprise' ? -1 : 1) : a.sortOrder - b.sortOrder))
}

/** 最近用过的话术：按 lastUsedAt 倒序 */
export function recentQuickReplies(s: DemoState, staffId: string | null, limit = 8): QuickReply[] {
  return quickRepliesForStaff(s, staffId)
    .filter((q) => q.lastUsedAt)
    .sort((a, b) => b.lastUsedAt!.localeCompare(a.lastUsedAt!))
    .slice(0, limit)
}

/** 命中的那一小段：候选行按它高亮，让人一眼看出这条为什么被匹配出来 */
export interface QuickReplySnippet {
  before: string
  match: string
  after: string
}

export interface QuickReplyMatch {
  item: QuickReply
  /** 命中的字段：标题 > 正文 > 附件文件名 */
  hit: 'title' | 'text' | 'file'
  score: number
  /** 命中字段里截出的一段（含高亮位置）；query 为空时没有 */
  snippet: QuickReplySnippet | null
}

/** 正文命中时左右各留一点上下文，太长的两头加省略号 */
const SNIPPET_BEFORE = 10
const SNIPPET_AFTER = 26

/** source 需已压过空白，index 是在 source 上的下标 */
function cutSnippet(flat: string, index: number, length: number): QuickReplySnippet {
  const head = Math.max(0, index - SNIPPET_BEFORE)
  const tail = Math.min(flat.length, index + length + SNIPPET_AFTER)
  return {
    before: (head > 0 ? '…' : '') + flat.slice(head, index),
    match: flat.slice(index, index + length),
    after: flat.slice(index + length, tail) + (tail < flat.length ? '…' : ''),
  }
}

/**
 * 全文匹配（对齐易歪歪：不维护关键词表，输入什么就在整条话术里找什么）。
 * 找的范围是 标题 3 分 > 正文 2 分 > 附件文件名 1 分，取第一个命中的字段，同分按使用次数。
 * 打字自动匹配、`/` 弹层、面板搜索、群发选话术共用；query 为空时返回最近使用 + 常用。
 */
export function matchQuickReplies(s: DemoState, staffId: string | null, query: string, limit = 6): QuickReplyMatch[] {
  const q = query.trim().toLowerCase()
  const pool = quickRepliesForStaff(s, staffId)
  if (!q) {
    return [...pool]
      .sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '') || b.useCount - a.useCount)
      .slice(0, limit)
      .map((item) => ({ item, hit: 'title' as const, score: 0, snippet: null }))
  }
  const out: QuickReplyMatch[] = []
  pool.forEach((item) => {
    const fields: { hit: QuickReplyMatch['hit']; score: number; source: string }[] = [
      { hit: 'title', score: 3, source: item.title.replace(/\s+/g, ' ') },
      { hit: 'text', score: 2, source: item.text.replace(/\s+/g, ' ') },
      { hit: 'file', score: 1, source: item.media?.name.replace(/\s+/g, ' ') ?? '' },
    ]
    for (const f of fields) {
      const i = f.source.toLowerCase().indexOf(q)
      if (i < 0) continue
      out.push({ item, hit: f.hit, score: f.score, snippet: cutSnippet(f.source, i, q.length) })
      break
    }
  })
  return out.sort((a, b) => b.score - a.score || b.item.useCount - a.item.useCount).slice(0, limit)
}

/** 话术正文里的变量替换（发送前） */
export function renderQuickReplyVars(text: string, vars: { customer?: string; staff: string; company: string }): string {
  return text.replaceAll('{{customer.nickname}}', vars.customer ?? '各位').replaceAll('{{staff.name}}', vars.staff).replaceAll('{{company.name}}', vars.company)
}
