import { seatMessageSendAllowed } from '@/domain/messageRules'
import type { DemoState, Seat } from '@/domain/types'
import { seatGroupPerm } from '@/store/policy'
import type { ConvRow } from '@/store/selectors'

/** 当前会话为什么发不出去：客户屏蔽坐席、没有「频道发布」权限的频道；能发返回 undefined。 */
export function sendBlockReason(s: DemoState, row: ConvRow, seat: Seat, staffId: string | null): string | undefined {
  if (row.customer?.blockedSeatIds.includes(seat.id)) return `对方已拉黑「${seat.displayName}」，发不出去`
  const group = row.conv.kind !== 'dm' ? s.chatGroups.find((g) => g.id === row.conv.chatGroupId) : undefined
  if (group?.kind === 'channel' && !seatGroupPerm(s, group, seat.id, staffId, 'can_post_messages')) return '没有「频道发布」权限，不能发布'
  if (!staffId || !seatMessageSendAllowed(s, row.conv.id, seat.id, staffId)) return '当前身份或策略不允许在此会话发送'
  return undefined
}
