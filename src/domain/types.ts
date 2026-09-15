/**
 * 领域模型。与 docs/prd/00 预留清单的建表要求一一对应：
 * - 坐席（Seat）是 users 表里的官方类型记录，员工（Staff）是登录账号，两者分离（预留 30、33）
 * - 消息同时记 seatId（客户看到的署名）与 operatorId（真正打字的员工）（预留 30）
 * - 坐席交接记录永久保留（预留 31）
 * - 客户与坐席多对多 customerSeats（预留 32）
 * - 头衔与内部标签分表（预留 34）
 */

export type ISODate = string

/** 员工角色能力键（工作台与管理后台功能，作用在员工上） */
export type Capability =
  | 'view_all_conversations'
  | 'view_all_customers'
  | 'create_invite'
  | 'broadcast'
  | 'manage_groups'
  | 'view_audit'
  | 'view_seat_operator'
  | 'assign_title'
  | 'manage_seats'
  | 'manage_staff'
  | 'manage_roles'
  | 'manage_policies'
  | 'manage_settings'
  | 'view_audit_logs'
  | 'manage_titles'

export interface Enterprise {
  id: string
  name: string
  code: string
  slogan: string
  timezone: string
  inviteCodeRequired: boolean
  defaultWelcome: string
  /** 企业默认官方群与频道：所有新客户注册后自动加入 */
  defaultChatGroupIds: string[]
}

export interface Role {
  id: string
  name: string
  builtin: boolean
  caps: Capability[]
}

export type StaffStatus = 'active' | 'disabled'

/** 员工账号：真人登录用，客户永远看不到 */
export interface Staff {
  id: string
  name: string
  username: string
  email?: string
  roleId: string
  status: StaffStatus
  lastLoginAt?: ISODate
  createdAt: ISODate
}

export type SeatType = 'assign' | 'notice'
export type SeatStatus = 'accepting' | 'paused' | 'disabled'

/** 坐席：客户看到的官方身份，不能登录，由员工实操 */
export interface Seat {
  id: string
  displayName: string
  avatarText: string
  avatarColor: string
  roleDesc: string
  type: SeatType
  operatorStaffId: string | null
  status: SeatStatus
  welcome: string
  customerDeletable: boolean
  createdAt: ISODate
}

export interface SeatHandover {
  id: string
  seatId: string
  fromStaffId: string | null
  toStaffId: string
  at: ISODate
  byStaffId: string
  reason: string
}

export interface Purchase {
  product: string
  amount: number
  at: ISODate
}

export interface Customer {
  id: string
  nickname: string
  accountId: string
  phone?: string
  registeredAt: ISODate
  lastActiveAt: ISODate
  device: string
  inviteGroupId: string
  inviteLinkId?: string
  tagIds: string[]
  titleIds: string[]
  primaryTitleId: string | null
  note: string
  purchases: Purchase[]
  referrerId: string | null
  inviteCount: number
  teamCount: number
  /** 客户系统同步来的角色文本，内部字段 */
  roleLabel?: string
  blockedSeatIds: string[]
}

export interface CustomerSeat {
  customerId: string
  seatId: string
  primary: boolean
  addedAt: ISODate
  source: 'register' | 'backfill'
}

/** 邀请组：放几个坐席加几个 */
export interface InviteGroup {
  id: string
  name: string
  code: string
  seatIds: string[]
  primarySeatId: string
  chatGroupIds: string[]
  isDefault: boolean
  enabled: boolean
  createdAt: ISODate
}

export type InviteLinkStatus = 'active' | 'expired' | 'revoked'

/** 邀请链接：邀请组下的渠道码 */
export interface InviteLink {
  id: string
  name: string
  inviteGroupId: string
  code: string
  creatorStaffId: string
  expiresAt: ISODate | null
  maxUses: number | null
  uses: number
  clicks: number
  status: InviteLinkStatus
  createdAt: ISODate
}

/** 头衔：官方发给客户、所有人可见 */
export interface Title {
  id: string
  name: string
  color: string
  desc: string
  enabled: boolean
}

/** 内部标签：员工用，客户永远看不到 */
export interface Tag {
  id: string
  name: string
  color: string
  source: 'admin' | 'staff'
}

export interface TitleAssignment {
  id: string
  customerId: string
  titleId: string
  action: 'assign' | 'remove'
  byStaffId: string
  at: ISODate
}

export type ChatGroupKind = 'group' | 'channel'

export interface ChatGroup {
  id: string
  name: string
  kind: ChatGroupKind
  official: boolean
  desc: string
  ownerSeatId: string
  memberSeatIds: string[]
  memberCustomerIds: string[]
  requiredTitleId: string | null
  createdAt: ISODate
}

export type ConversationKind = 'dm' | 'group' | 'channel'

export interface Conversation {
  id: string
  kind: ConversationKind
  /** dm：客户 */
  customerId?: string
  /** dm：坐席 */
  seatId?: string
  /** group / channel */
  chatGroupId?: string
  lastMessageAt: ISODate
}

export type SenderKind = 'customer' | 'seat' | 'system'
export type MessageKind = 'text' | 'image' | 'system'

export interface Message {
  id: string
  convId: string
  senderKind: SenderKind
  /** customer：客户 ID；seat：坐席 ID；system：空 */
  senderId: string
  /** 坐席发的消息：署名坐席 */
  seatId?: string
  /** 坐席发的消息：当时真正打字的员工 */
  operatorId?: string
  kind: MessageKind
  text: string
  at: ISODate
  mentionSeatIds?: string[]
  aiDraftUsed?: boolean
  isWelcome?: boolean
}

export type AuditType =
  | 'login'
  | 'staff.create'
  | 'staff.disable'
  | 'staff.reset_password'
  | 'seat.create'
  | 'seat.update'
  | 'seat.handover'
  | 'seat.pause'
  | 'invite_group.create'
  | 'invite_group.update'
  | 'invite_group.reset_code'
  | 'invite_group.backfill'
  | 'invite_link.create'
  | 'invite_link.revoke'
  | 'title.assign'
  | 'title.remove'
  | 'title.library'
  | 'tag.library'
  | 'policy.update'
  | 'settings.update'
  | 'customer.register'
  | 'broadcast.send'
  | 'message.delete'

export interface AuditEvent {
  id: string
  at: ISODate
  actorStaffId: string | null
  type: AuditType
  detail: string
}

export interface Broadcast {
  id: string
  name: string
  seatId: string
  operatorId: string
  targetDesc: string
  text: string
  sentAt: ISODate
  sentCount: number
  readCount: number
}

export interface QuickReply {
  id: string
  scope: 'enterprise' | 'personal'
  title: string
  text: string
}

export interface KnowledgeItem {
  id: string
  title: string
  body: string
  tags: string[]
  enabled: boolean
}

export interface PolicyItem {
  key: string
  label: string
  group: string
}

export interface PolicyPreset {
  id: string
  name: string
  builtin: boolean
  /** key → 客户角色是否允许 */
  customer: Record<string, boolean>
}

/** 一次 AI 处理记录（用量与采纳统计） */
export interface AiEvent {
  id: string
  at: ISODate
  staffId: string
  convId: string
  result: 'adopted' | 'edited' | 'ignored'
  tokens: number
}

export interface Session {
  adminStaffId: string | null
  workbenchStaffId: string | null
  workbenchSeatId: string | null
  phoneCustomerId: string | null
}

export interface DemoState {
  enterprise: Enterprise
  roles: Role[]
  staff: Staff[]
  seats: Seat[]
  handovers: SeatHandover[]
  customers: Customer[]
  customerSeats: CustomerSeat[]
  inviteGroups: InviteGroup[]
  inviteLinks: InviteLink[]
  titles: Title[]
  tags: Tag[]
  titleAssignments: TitleAssignment[]
  chatGroups: ChatGroup[]
  conversations: Conversation[]
  messages: Message[]
  audit: AuditEvent[]
  broadcasts: Broadcast[]
  quickReplies: QuickReply[]
  knowledge: KnowledgeItem[]
  policyItems: PolicyItem[]
  policyPresets: PolicyPreset[]
  activePresetId: string
  aiEvents: AiEvent[]
  session: Session
  seededAt: ISODate
}
