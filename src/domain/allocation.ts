/**
 * 注册时的坐席分配。
 *
 * 邀请组里的坐席分两类：
 * - 固定坐席：从这个码进来的客户全部添加，顺序照配置；
 * - 轮询坐席（接待员）：排成一队，客户按顺序轮流分，一人一个。
 *
 * 轮询是严格的「下一个」，不做客户数均衡、不看上限——多劳多得由 KPI 兜着，
 * 这里只保证队列公平。唯一的例外是停用与暂停接新的坐席要跳过，
 * 否则客户进来就对着一个死号；被跳过的那一轮不补差额。
 */
import type { InviteGroup, Seat } from './types'

export interface SeatAllocation {
  /** 客户通讯录里的顺序：接待员在前，固定坐席按配置顺序在后 */
  seatIds: string[]
  /** 主归属；整组都不可用时为 undefined */
  primarySeatId?: string
  /** 分配后的新游标，回写到邀请组 */
  rotationIndex: number
  /** 因停用或暂停接新被跳过的坐席 */
  skippedSeatIds: string[]
}

type SeatLookup = Record<string, Seat | undefined>

const isOpen = (seat: Seat | undefined): boolean => !!seat && seat.status === 'accepting'

/** 取下一位可接客的接待员，并给出推进后的游标 */
function nextRotating(queue: string[], from: number, seatById: SeatLookup): { seatId?: string; index: number; skipped: string[] } {
  if (!queue.length) return { index: 0, skipped: [] }
  const start = ((from % queue.length) + queue.length) % queue.length
  const skipped: string[] = []
  for (let step = 0; step < queue.length; step += 1) {
    const at = (start + step) % queue.length
    const seatId = queue[at]
    if (isOpen(seatById[seatId])) return { seatId, index: (at + 1) % queue.length, skipped }
    skipped.push(seatId)
  }
  // 整队都不可用：游标不动，免得下一个客户莫名其妙从队中间开始
  return { index: start, skipped }
}

/** 按邀请组给一位新客户分配坐席 */
export function allocateSeats(group: InviteGroup, seatById: SeatLookup): SeatAllocation {
  const rotation = nextRotating(group.rotatingSeatIds, group.rotationIndex, seatById)
  const skippedSeatIds = [...rotation.skipped]
  const fixed = group.fixedSeatIds.filter((id) => {
    if (isOpen(seatById[id])) return true
    if (seatById[id]) skippedSeatIds.push(id)
    return false
  })
  const ordered = [...(rotation.seatId ? [rotation.seatId] : []), ...fixed.filter((id) => id !== rotation.seatId)]
  return {
    seatIds: ordered,
    // 队里没人可接时，主归属退到第一个固定坐席，客户不能没有归属
    primarySeatId: rotation.seatId ?? ordered[0],
    rotationIndex: rotation.index,
    skippedSeatIds,
  }
}

/** 邀请组里配到的全部坐席，用于「这个坐席在哪些组里」这类反查 */
export function seatIdsOf(group: Pick<InviteGroup, 'fixedSeatIds' | 'rotatingSeatIds'>): string[] {
  return [...new Set([...group.rotatingSeatIds, ...group.fixedSeatIds])]
}
