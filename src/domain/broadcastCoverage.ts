/**
 * 多坐席全覆盖群发的投递计划。
 *
 * 后台原来的群发只能选一个坐席，发给它的好友。"给全部客户发一条合规通知"这种事，
 * 管理员得挨个坐席建任务，还会漏掉只加了其中某一个号的客户；更麻烦的是同时加了
 * 同时添加林晓明和客户服务的客户会收到两条一模一样的话。
 *
 * 全覆盖的做法：先把选中的坐席合起来算出"能被够到的客户"，再给每个客户挑一个发送身份，
 * **一人只发一条**。挑身份的顺序是「主归属优先，其次按坐席在列表里的顺序」——客户看到的
 * 是他最熟的那个号在说话，而不是随机一个坐席。
 *
 * 这里只算计划、不写数据，所以发送前的预览和真正发送走的是同一份计算，
 * 预览说"触达 137 人"就一定发 137 条。
 */
import type { Customer, DemoState } from './types'
import { seatBroadcastSkipReason } from './messageRules'

/** 群发跳过原因：单坐席与多坐席覆盖共用，用于任务详情的可读统计。 */
export type SkipReason = 'deleted' | 'banned' | 'globalMuted' | 'blocked' | 'left' | 'muted' | 'noPostingPermission' | 'noReachableSeat' | 'rateLimited' | 'senderUnavailable'

export const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  deleted: '已注销',
  banned: '已封禁',
  globalMuted: '全部禁言',
  blocked: '已屏蔽本坐席',
  left: '已退群',
  muted: '被禁言',
  noPostingPermission: '没有发布权限',
  noReachableSeat: '所选坐席都够不到（没加过或已屏蔽）',
  rateLimited: '今天收到的群发已达上限',
  senderUnavailable: '发送身份不可用',
}

export interface CoverageDelivery {
  customer: Customer
  seatId: string
  convId: string
}

export interface CoveragePlan {
  /** 每个客户一条，去过重 */
  deliveries: CoverageDelivery[]
  skips: { customer: Customer; reason: SkipReason }[]
  /** 按坐席汇总的投递条数，顺序同传入的 seatIds */
  bySeat: { seatId: string; count: number }[]
  skipReasons: Record<SkipReason, number>
}

/** 某客户今天已经收到的群发条数（跨坐席、跨任务合并），与 sendBroadcast 的频控口径一致 */
function broadcastsReceivedToday(s: DemoState, customerId: string, today: string): number {
  return s.messages.filter((m) => m.senderKind === 'seat' && m.isBroadcast && m.at.slice(0, 10) === today && s.conversations.find((x) => x.id === m.convId)?.customerId === customerId).length
}

/**
 * @param seatIds 参与覆盖的坐席，顺序即挑选优先级（主归属仍然优先于顺序）
 * @param at 计划的执行时间，用来判断当天频控
 */
export function planCoverage(s: DemoState, seatIds: string[], at: string, recipientCustomerIds?: string[]): CoveragePlan {
  const today = at.slice(0, 10)
  const seatSet = new Set(seatIds)
  const recipientSet = recipientCustomerIds ? new Set(recipientCustomerIds) : undefined
  const rank = new Map(seatIds.map((id, i) => [id, i]))
  const deliveries: CoverageDelivery[] = []
  const skips: CoveragePlan['skips'] = []
  const perCustomerCap = s.enterprise.broadcastPerCustomerPerDay

  // 只看真的加过所选坐席之一的客户：没加过任何一个坐席的人本来就够不到
  const reach = new Map<string, string[]>()
  s.customerSeats.forEach((cs) => {
    if (!seatSet.has(cs.seatId)) return
    const list = reach.get(cs.customerId) ?? []
    // 主归属排最前，其余按坐席在所选列表里的顺序
    list.push(cs.seatId)
    reach.set(cs.customerId, list)
  })

  s.customers.forEach((c) => {
    if (recipientSet && !recipientSet.has(c.id)) return
    const mine = reach.get(c.id)
    if (!mine?.length) return
    const primaryId = s.customerSeats.find((cs) => cs.customerId === c.id && cs.primary)?.seatId
    const candidates = [...new Set(mine)]
      .map((id) => ({ id, conv: s.conversations.find((x) => x.kind === 'dm' && x.customerId === c.id && x.seatId === id) }))
      .sort((a, b) => (a.id === primaryId ? -1 : b.id === primaryId ? 1 : (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)))
    const checked = candidates.map((candidate) => ({ candidate, reason: seatBroadcastSkipReason(s, candidate.conv?.id ?? '', candidate.id, s.seats.find((seat) => seat.id === candidate.id)?.operatorStaffId ?? '', false, at) }))
    const available = checked.find((item) => !item.reason)
    if (!available?.candidate.conv) return skipWith(c, checked[0]?.reason ?? 'noReachableSeat')
    if (broadcastsReceivedToday(s, c.id, today) >= perCustomerCap) return skipWith(c, 'rateLimited')
    deliveries.push({ customer: c, seatId: available.candidate.id, convId: available.candidate.conv.id })
  })

  function skipWith(c: Customer, reason: SkipReason) {
    skips.push({ customer: c, reason })
  }

  const skipReasons = skips.reduce<Record<SkipReason, number>>((acc, x) => ({ ...acc, [x.reason]: (acc[x.reason] ?? 0) + 1 }), {} as Record<SkipReason, number>)
  const bySeat = seatIds.map((id) => ({ seatId: id, count: deliveries.filter((d) => d.seatId === id).length }))
  return { deliveries, skips, bySeat, skipReasons }
}
