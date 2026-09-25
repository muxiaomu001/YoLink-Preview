import type { ChatGroup, Customer } from './types'

export type GroupJoinBlockReason = 'group_not_found' | 'customer_not_found' | 'already_member' | 'full' | 'missing_title'

export interface GroupJoinCheck {
  allowed: boolean
  reason?: GroupJoinBlockReason
}

export function checkCustomerGroupJoin(
  group: ChatGroup | undefined,
  customer: Customer | undefined,
  defaultMaxMembers: number,
  pendingCustomerCount = 0,
): GroupJoinCheck {
  if (!group) return { allowed: false, reason: 'group_not_found' }
  if (!customer) return { allowed: false, reason: 'customer_not_found' }
  if (group.memberCustomerIds.includes(customer.id)) return { allowed: false, reason: 'already_member' }

  const memberCount = group.memberCustomerIds.length + group.memberSeatIds.length + pendingCustomerCount
  if (memberCount >= (group.maxMembers ?? defaultMaxMembers)) return { allowed: false, reason: 'full' }
  if (group.requiredTitleId && !customer.titleIds.includes(group.requiredTitleId)) return { allowed: false, reason: 'missing_title' }

  return { allowed: true }
}
