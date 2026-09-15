/**
 * 策略解析与群内角色：纯函数，页面按结果渲染。
 *
 * 裁决顺序（03 文档）：模块授权 → 角色硬边界 → 策略矩阵（企业默认 → 群级覆盖 → 用户级覆盖）→ 员工角色能力与群内角色。
 * 群级覆盖只作用于客户在该群里的能力；用户级覆盖作用在客户或坐席上（坐席不是员工）。
 */
import type { BotAccount, ChatGroup, DemoState, GroupAdminPerm, GroupMemberKind, Message, PolicyCol } from '@/domain/types'

export type PolicyRole = 'customer' | 'staff'
export type PolicyPlatform = 'mobile' | 'desktop'

export interface CapQuery {
  role: PolicyRole
  platform: PolicyPlatform
  key: string
  /** 群级覆盖：客户在这个群里 */
  groupId?: string | null
  /** 用户级覆盖：客户 ID 或坐席 ID */
  userId?: string | null
}

export interface CapResult {
  allowed: boolean
  /** 哪一层决定的 */
  source: 'module_off' | 'unknown' | 'default' | 'group' | 'user' | 'official_group'
}

/** 解析一个能力键 */
export function resolveCap(s: DemoState, q: CapQuery): CapResult {
  const item = s.policyItems.find((p) => p.key === q.key)
  if (!item) return { allowed: true, source: 'unknown' }
  if (item.module && !s.enterprise.modules[item.module]) return { allowed: false, source: 'module_off' }
  const col = `${q.role}_${q.platform}` as PolicyCol
  let allowed = s.policyMatrix[q.key]?.[col] ?? true
  let source: CapResult['source'] = 'default'
  if (q.groupId && q.role === 'customer') {
    const g = s.chatGroups.find((x) => x.id === q.groupId)
    const o = s.policyOverrides.find((x) => x.targetKind === 'group' && x.targetId === q.groupId)
    if (o && q.key in o.caps) {
      allowed = o.caps[q.key]
      source = 'group'
    }
    // 官方群：退群对客户强制关闭（12 文档）
    if (g?.official && q.key === 'group.leave') return { allowed: false, source: 'official_group' }
  }
  if (q.userId) {
    const kind = q.role === 'customer' ? 'customer' : 'seat'
    const o = s.policyOverrides.find((x) => x.targetKind === kind && x.targetId === q.userId)
    if (o && q.key in o.caps) {
      allowed = o.caps[q.key]
      source = 'user'
    }
  }
  return { allowed, source }
}

/** 客户在手机上能不能 */
export function customerCan(s: DemoState, customerId: string | null | undefined, key: string, groupId?: string | null): boolean {
  return resolveCap(s, { role: 'customer', platform: 'mobile', key, groupId, userId: customerId }).allowed
}

/** 坐席在工作台上能不能（聊天层能力判坐席，不判员工） */
export function seatCan(s: DemoState, seatId: string | null | undefined, key: string, groupId?: string | null): boolean {
  return resolveCap(s, { role: 'staff', platform: 'desktop', key, groupId, userId: seatId }).allowed
}

/** 客户的能力快照：登录后服务端下发的那张键值表 */
export function customerSnapshot(s: DemoState, customerId: string): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  s.policyItems.forEach((p) => {
    out[p.key] = customerCan(s, customerId, p.key)
  })
  return out
}

// ---------- 群内角色 ----------

export type GroupRole = 'owner' | 'admin' | 'member' | 'none'

export function groupRoleOf(g: ChatGroup, memberKind: GroupMemberKind, memberId: string): GroupRole {
  if (memberKind === 'seat' && g.ownerSeatId === memberId) return 'owner'
  if (g.admins.some((a) => a.memberKind === memberKind && a.memberId === memberId)) return 'admin'
  const isMember = memberKind === 'seat' ? g.memberSeatIds.includes(memberId) : g.memberCustomerIds.includes(memberId)
  return isMember ? 'member' : 'none'
}

/** 某成员在群里有没有某项管理员权限：群主全有；管理员按项；成员没有 */
export function groupPerm(g: ChatGroup, memberKind: GroupMemberKind, memberId: string, perm: GroupAdminPerm): boolean {
  const role = groupRoleOf(g, memberKind, memberId)
  if (role === 'owner') return true
  if (role !== 'admin') return false
  return g.admins.find((a) => a.memberKind === memberKind && a.memberId === memberId)?.perms.includes(perm) ?? false
}

/**
 * 工作台里"这个坐席（由这个员工实操）能不能做某项群管理"：
 * 员工角色有 manage_groups → 全部可以；否则看坐席在群里的角色与权限。
 */
export function seatGroupPerm(s: DemoState, g: ChatGroup, seatId: string, staffId: string | null, perm: GroupAdminPerm): boolean {
  const st = s.staff.find((x) => x.id === staffId)
  const role = s.roles.find((r) => r.id === st?.roleId)
  if (role?.caps.includes('manage_groups')) return true
  return groupPerm(g, 'seat', seatId, perm)
}

/** 群内谁被禁言 / 封禁（未过期） */
export function activeRestriction(g: ChatGroup, customerId: string, nowIso: string) {
  return g.restrictions.find((r) => r.customerId === customerId && (r.until === null || r.until > nowIso))
}

/** 客户此刻能不能在群里发言：全员禁言、单人禁言、全局禁言、策略 group.send */
export function customerCanSpeakIn(s: DemoState, g: ChatGroup, customerId: string, nowIso: string): { ok: boolean; reason?: string } {
  const c = s.customers.find((x) => x.id === customerId)
  if (!c) return { ok: false, reason: '不是成员' }
  if (c.blacklistedAt) return { ok: false, reason: '已被拉黑' }
  if (c.mutedAllUntil && c.mutedAllUntil > nowIso) return { ok: false, reason: '所有群禁言中' }
  if (g.kind === 'channel') return { ok: false, reason: '频道只读' }
  if (g.settings.allMuted && groupRoleOf(g, 'customer', customerId) === 'member') return { ok: false, reason: '全员禁言中' }
  const r = activeRestriction(g, customerId, nowIso)
  if (r) return { ok: false, reason: r.kind === 'ban' ? '已被封禁' : '已被禁言' }
  if (!customerCan(s, customerId, 'group.send', g.id)) return { ok: false, reason: '策略不允许群内发言' }
  return { ok: true }
}

/** 群人数上限：群自己的或数值型策略 */
export function groupCapacity(s: DemoState, g: ChatGroup): number {
  return g.maxMembers ?? s.policyNumbers.groupMaxMembers
}

// ---------- 发送者 ----------

export function botById(s: DemoState, id: string | null | undefined): BotAccount | undefined {
  return id ? s.bots.find((b) => b.id === id) : undefined
}

/** 消息发送者的显示名（客户 / 坐席 / 机器人 / 系统） */
export function senderName(s: DemoState, m: Message): string {
  if (m.senderKind === 'seat') return s.seats.find((x) => x.id === m.seatId)?.displayName ?? '坐席'
  if (m.senderKind === 'customer') return s.customers.find((x) => x.id === m.senderId)?.nickname ?? '客户'
  if (m.senderKind === 'bot') return botById(s, m.senderId)?.nickname ?? '成员'
  return '系统'
}

/** 撤回或删除后各端看到的占位文本 */
export function visibleText(m: Message, viewer: 'customer' | 'staff'): string {
  if (m.recalledAt) return viewer === 'staff' ? `[已撤回] ${m.text}` : '消息已撤回'
  if (m.deletedAt) return viewer === 'staff' ? `[已删除] ${m.text}` : '消息已被管理员删除'
  return m.text
}
