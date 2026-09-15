/**
 * 领域模型。与 docs/prd/00 预留清单的建表要求一一对应：
 * - 坐席（Seat）是 users 表里的官方类型记录，员工（Staff）是登录账号，两者分离（预留 30、33）
 * - 消息同时记 seatId（客户看到的署名）与 operatorId（真正打字的员工）（预留 30）
 * - 坐席交接记录永久保留（预留 31）
 * - 客户与坐席多对多 customerSeats（预留 32）
 * - 头衔与内部标签分表（预留 34）
 *
 * 管理后台完整版（docs/prd/05）用到的模型也在这里：企业设置各分页、策略矩阵与数值、
 * 举报与敏感词、钱包/签到/推荐奖励、横幅与公告、AI 模块、客户画像、日报、插件与开放 API、系统。
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
  | 'export_customers'
  | 'delete_user'
  | 'review_withdrawal'
  | 'mark_paid'
  | 'adjust'
  | 'manage_seats'
  | 'manage_titles'
  | 'manage_staff'
  | 'manage_roles'
  | 'manage_policies'
  | 'manage_settings'
  | 'view_audit_logs'
  | 'export_data'

// ---------- 企业设置 ----------

export type Language = 'zh' | 'en'
export type ThemeKey = 'classic' | 'dark' | 'ocean' | 'warm'
export type RegisterMethod = 'username' | 'phone'
export type PushMask = 'full' | 'sender_only' | 'generic'
export type StorageType = 's3' | 'oss' | 'cos' | 'minio'
export type ModuleKey = 'customers' | 'invite' | 'wallet' | 'checkin' | 'referral' | 'broadcast' | 'banner' | 'content'

/** 网站栏目：客户 App 底部标签里嵌一个 WebView */
export interface WebTab {
  id: string
  enabled: boolean
  title: string
  iconText: string
  url: string
}

export interface PushConfig {
  apnsMode: 'p8' | 'p12' | 'none'
  apnsKeyId: string
  apnsTeamId: string
  fcmConfigured: boolean
  mask: PushMask
}

export interface StorageConfig {
  type: StorageType
  bucket: string
  endpoint: string
  accessKeyConfigured: boolean
  secretKeyConfigured: boolean
  lastTestAt: ISODate | null
  lastTestOk: boolean | null
}

export interface Enterprise {
  id: string
  name: string
  code: string
  slogan: string
  timezone: string
  logoText: string
  defaultLanguage: Language
  brandColor: string
  agreementUrl: string
  privacyUrl: string
  faqUrl: string
  allowedThemes: ThemeKey[]
  defaultTheme: ThemeKey
  registerMethods: RegisterMethod[]
  inviteCodeRequired: boolean
  /** P2：随验证码一起推后，演示里只读 */
  emailVerify: boolean
  /** P2 */
  forcePhoneBind: boolean
  push: PushConfig
  storage: StorageConfig
  webTabs: WebTab[]
  defaultWelcome: string
  /** 企业默认官方群与频道：所有新客户注册后自动加入，按顺序进第一个未满的 */
  defaultChatGroupIds: string[]
  /** 模块启停：停用不删数据 */
  modules: Record<ModuleKey, boolean>
}

// ---------- 员工、角色、坐席 ----------

export interface Role {
  id: string
  name: string
  desc: string
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
  mustChangePassword?: boolean
  /** 最近一次强制下线的时间 */
  sessionsRevokedAt?: ISODate
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
  /** P1：坐席组（轮询分摊） */
  seatGroupId: string | null
  /** P1：客户数上限，null 为无限制 */
  maxCustomers: number | null
  createdAt: ISODate
}

export type SeatGroupStrategy = 'round_robin' | 'least' | 'random'

/** P1：坐席组，邀请组里的一个位置指向它，注册时从组里挑一个坐席 */
export interface SeatGroup {
  id: string
  name: string
  seatIds: string[]
  strategy: SeatGroupStrategy
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

// ---------- 客户 ----------

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
  email?: string
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
  /** 已注销：保留数据，不再出现在工作台 */
  deletedAt?: ISODate
  /** 通用字段值（P1） */
  customFields?: Record<string, string>
}

export interface CustomerSeat {
  customerId: string
  seatId: string
  primary: boolean
  addedAt: ISODate
  source: 'register' | 'backfill' | 'reassign'
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

// ---------- 头衔与内部标签 ----------

/** 头衔：官方发给客户、所有人可见 */
export interface Title {
  id: string
  name: string
  color: string
  /** 内置图标名（lucide），可不选 */
  icon?: string
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

// ---------- 群与会话 ----------

export type ChatGroupKind = 'group' | 'supergroup' | 'channel'

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
  /** 人数上限，null 用数值型策略的单群上限 */
  maxMembers: number | null
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
  /** 管理员删除：内容对客户不可见，审计仍可查 */
  deletedAt?: ISODate
}

// ---------- 审计与安全 ----------

export type AuditType =
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'staff.create'
  | 'staff.update'
  | 'staff.disable'
  | 'staff.reset_password'
  | 'staff.force_logout'
  | 'role.create'
  | 'role.update'
  | 'role.delete'
  | 'seat.create'
  | 'seat.update'
  | 'seat.handover'
  | 'seat.pause'
  | 'seat_group.update'
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
  | 'policy.preset'
  | 'policy.cap'
  | 'policy.number'
  | 'policy.override'
  | 'group.official'
  | 'group.update'
  | 'settings.update'
  | 'module.toggle'
  | 'customer.register'
  | 'customer.reassign'
  | 'customer.delete'
  | 'broadcast.send'
  | 'message.delete'
  | 'report.handle'
  | 'sensitive.update'
  | 'export'
  | 'wallet.settings'
  | 'wallet.adjust'
  | 'wallet.withdrawal'
  | 'checkin.settings'
  | 'referral.settings'
  | 'referral.cancel'
  | 'banner.update'
  | 'announcement.update'
  | 'ai.settings'
  | 'knowledge.update'
  | 'profile.sync'
  | 'profile.import'
  | 'automation.update'
  | 'daily_report.settings'
  | 'plugin.update'
  | 'api_key.create'
  | 'api_key.delete'
  | 'webhook.update'
  | 'app_version.update'
  | 'license.upload'
  | 'backup.run'
  | 'backup.restore'

export interface AuditEvent {
  id: string
  at: ISODate
  actorStaffId: string | null
  type: AuditType
  detail: string
  ip?: string
}

export type SecurityEventType = 'policy_denied' | 'abnormal_login' | 'device'

/** P1：安全日志，策略校验失败、异常登录 */
export interface SecurityEvent {
  id: string
  at: ISODate
  who: string
  ip: string
  type: SecurityEventType
  detail: string
}

/** P1：举报 */
export interface Report {
  id: string
  at: ISODate
  reporterCustomerId: string
  targetKind: 'user' | 'message'
  targetCustomerId: string
  messageId?: string
  reason: string
  status: 'pending' | 'handled'
  resolution?: 'blocked' | 'deleted' | 'ignored'
  handledBy?: string
  handledAt?: ISODate
}

export type SensitiveAction = 'block' | 'replace' | 'log'

/** P1：敏感词 */
export interface SensitiveWord {
  id: string
  word: string
  action: SensitiveAction
  replaceWith?: string
}

export interface SensitiveHit {
  id: string
  at: ISODate
  customerId: string
  convId: string
  word: string
  original: string
  result: 'blocked' | 'replaced' | 'logged'
}

// ---------- 群发、快捷回复、知识库 ----------

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

// ---------- 策略 ----------

export interface PolicyItem {
  key: string
  label: string
  group: string
}

/** 策略矩阵的列：角色 × 端 */
export type PolicyCol = 'customer_mobile' | 'customer_desktop' | 'staff_mobile' | 'staff_desktop'

/** 能力键 → 每列开关 */
export type PolicyMatrix = Record<string, Record<PolicyCol, boolean>>

export interface PolicyPreset {
  id: string
  name: string
  desc: string
  builtin: boolean
  matrix: PolicyMatrix
}

export interface PolicyNumbers {
  recallSeconds: number
  /** P1 */
  editSeconds: number
  groupMaxMembers: number
  slowModeSeconds: number
  retentionDays: number
  imageMaxMb: number
  videoMaxMb: number
  voiceMaxSeconds: number
}

/** P1：用户级覆盖，对某个客户或坐席单独放开或收紧 */
export interface PolicyOverride {
  id: string
  targetKind: 'customer' | 'seat'
  targetId: string
  caps: Record<string, boolean>
  byStaffId: string
  createdAt: ISODate
}

export interface PolicyChange {
  id: string
  at: ISODate
  byStaffId: string
  kind: 'preset' | 'cap' | 'number' | 'override'
  detail: string
}

// ---------- 钱包、签到、推荐奖励（P2） ----------

export interface WalletSettings {
  currency: 'USD' | 'USDT' | 'CNY' | 'HKD'
  unitName: string
  /** 多少积分 = 1 单位货币 */
  rate: number
  minWithdraw: number
  maxPerWithdraw: number
  dailyWithdrawCount: number
  fee: string
  reviewLevels: 1 | 2
}

export interface PayoutField {
  id: string
  name: string
  type: 'text' | 'number'
  required: boolean
}

export type WalletTxType = 'checkin_reward' | 'referral_reward' | 'admin_adjust' | 'withdraw_freeze' | 'withdraw_paid' | 'withdraw_refund'

export interface WalletTx {
  id: string
  at: ISODate
  customerId: string
  type: WalletTxType
  amount: number
  balanceAfter: number
  note: string
}

export type WithdrawalStatus = 'pending' | 'approved' | 'paid' | 'rejected'

export interface Withdrawal {
  id: string
  at: ISODate
  customerId: string
  points: number
  status: WithdrawalStatus
  account: Record<string, string>
}

export interface CheckinRules {
  /** 7 天周期，每天奖励积分 */
  cycle: number[]
  startAt: ISODate
  endAt: ISODate
  budget: number
  perCustomerMax: number
}

export interface CheckinRecord {
  id: string
  at: ISODate
  customerId: string
  day: number
  reward: number
}

export interface ReferralRules {
  timing: 'register' | 'first_checkin'
  referrerReward: number
  newcomerReward: number
  dailyMax: number
  totalMax: number
}

export interface ReferralAnomaly {
  id: string
  customerId: string
  type: 'same_device' | 'burst_register'
  relatedIds: string[]
  cancelled: boolean
}

// ---------- 公告与横幅 ----------

export type BannerAction = 'link' | 'checkin' | 'wallet' | 'group'

export interface Banner {
  id: string
  title: string
  /** 演示里用色块代替图片 */
  imageColor: string
  action: BannerAction
  url?: string
  chatGroupId?: string
  order: number
  startAt: ISODate
  endAt: ISODate
  /** P1 */
  audience: 'all' | 'tags'
  tagIds: string[]
  impressions: number
  clicks: number
}

/** P1 */
export interface Announcement {
  id: string
  title: string
  body: string
  imageColor?: string
  buttonText: string
  buttonAction: 'close' | 'link'
  url?: string
  kind: 'popup' | 'bar'
  startAt: ISODate
  endAt: ISODate
  showMode: 'once' | 'every'
  impressions: number
}

// ---------- AI 模块 ----------

export interface AiSettings {
  endpoint: string
  keyConfigured: boolean
  shareProfile: boolean
  lastTestAt: ISODate | null
  lastTestOk: boolean | null
  contextCount: number
  tone: 'professional' | 'warm' | 'concise'
  dailyLimitPerStaff: number
  group: {
    botLimit: number
    botUsed: number
    defaultRule: string
    reviewMode: 'auto' | 'review'
  }
}

/** 一次 AI 处理记录（用量与采纳统计） */
export interface AiEvent {
  id: string
  at: ISODate
  staffId: string
  convId: string
  result: 'adopted' | 'edited' | 'ignored'
  tokens: number
  module?: 'reply' | 'group' | 'knowledge'
}

// ---------- 客户画像 ----------

export interface ProfileSyncSettings {
  apiKeyConfigured: boolean
  apiKeyPrefix: string
  amountVisibleRoleIds: string[]
  shareWithAi: boolean
  /** P1 */
  scheduledPull: boolean
  /** P1 */
  webhookUrl: string
}

export interface SyncRecord {
  id: string
  at: ISODate
  kind: 'purchase' | 'referral'
  source: 'api' | 'csv'
  count: number
  failed: number
  failReason?: string
  unmatched: number
}

/** P1 */
export interface CustomField {
  id: string
  name: string
  type: 'text' | 'number' | 'date' | 'select'
  options?: string[]
}

/** P1 */
export interface AutomationRule {
  id: string
  name: string
  trigger: string
  condition: string
  action: string
  enabled: boolean
  runs: number
  lastRunAt: ISODate | null
}

// ---------- 老板可感知层 ----------

export type ReportChannel = 'app' | 'wecom' | 'feishu' | 'wechat' | 'sms' | 'email'

export interface ReportRecipient {
  id: string
  name: string
  staffId?: string
  channels: ReportChannel[]
}

export interface DailyReportSettings {
  recipients: ReportRecipient[]
  sendTime: string
  thresholds: {
    medianMinutes: number
    waitingOverMinutes: number
    idleDays: number
  }
}

export interface DailyReportRecord {
  id: string
  date: string
  sentTo: string[]
  status: 'sent' | 'failed'
  summary: string
}

// ---------- 插件与开放 API（P1） ----------

export interface PluginField {
  key: string
  label: string
  type: 'text' | 'select' | 'switch' | 'secret'
  options?: string[]
}

export interface Plugin {
  id: string
  name: string
  version: string
  desc: string
  enabled: boolean
  fields: PluginField[]
  config: Record<string, string | boolean>
}

export type ApiScope = 'read_customers' | 'write_customers' | 'read_messages' | 'send_messages' | 'manage_groups' | 'read_stats'

export interface ApiKey {
  id: string
  name: string
  prefix: string
  scopes: ApiScope[]
  createdAt: ISODate
  lastUsedAt: ISODate | null
}

export type WebhookEvent = 'message_created' | 'conversation_created' | 'user_registered' | 'title_assigned' | 'purchase_synced'

export interface Webhook {
  id: string
  name: string
  url: string
  secretConfigured: boolean
  events: WebhookEvent[]
  enabled: boolean
  lastTriggeredAt: ISODate | null
}

export interface WebhookLog {
  id: string
  webhookId: string
  at: ISODate
  event: WebhookEvent
  httpStatus: number
  ms: number
  retries: number
}

// ---------- 系统 ----------

export type AppPlatform = 'android' | 'ios' | 'windows'

export interface AppVersion {
  platform: AppPlatform
  latest: string
  downloadUrl: string
  notes: string
  minVersion: string
}

export interface LicenseModule {
  key: ModuleKey | 'ai'
  name: string
  enabled: boolean
  botLimit: number
  botUsed: number
  expiresAt: ISODate
}

export interface License {
  version: string
  instanceId: string
  type: 'saas' | 'private'
  expiresAt: ISODate
  modules: LicenseModule[]
}

export interface Backup {
  id: string
  at: ISODate
  sizeMb: number
  status: 'done' | 'running'
}

export interface HealthStatus {
  db: 'ok' | 'error'
  redis: 'ok' | 'error'
  storage: 'ok' | 'error'
  connections: number
  latencyMs: number
  checkedAt: ISODate | null
}

/** 基础统计的每日汇总（正式产品每日 10:00 跑批） */
export interface DailyStat {
  date: string
  registrations: number
  dau: number
  messages: number
  senders: number
  pushes: number
}

// ---------- 会话与整体状态 ----------

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
  seatGroups: SeatGroup[]
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
  securityEvents: SecurityEvent[]
  reports: Report[]
  sensitiveWords: SensitiveWord[]
  sensitiveHits: SensitiveHit[]
  broadcasts: Broadcast[]
  quickReplies: QuickReply[]
  knowledge: KnowledgeItem[]
  policyItems: PolicyItem[]
  policyPresets: PolicyPreset[]
  activePresetId: string
  policyMatrix: PolicyMatrix
  policyNumbers: PolicyNumbers
  policyOverrides: PolicyOverride[]
  policyChanges: PolicyChange[]
  walletSettings: WalletSettings
  payoutFields: PayoutField[]
  walletTxs: WalletTx[]
  withdrawals: Withdrawal[]
  checkinRules: CheckinRules
  checkinRecords: CheckinRecord[]
  referralRules: ReferralRules
  referralAnomalies: ReferralAnomaly[]
  banners: Banner[]
  announcements: Announcement[]
  aiSettings: AiSettings
  aiEvents: AiEvent[]
  profileSync: ProfileSyncSettings
  syncRecords: SyncRecord[]
  customFields: CustomField[]
  automationRules: AutomationRule[]
  dailyReport: DailyReportSettings
  dailyReportRecords: DailyReportRecord[]
  plugins: Plugin[]
  apiKeys: ApiKey[]
  webhooks: Webhook[]
  webhookLogs: WebhookLog[]
  appVersions: AppVersion[]
  license: License
  backups: Backup[]
  health: HealthStatus
  dailyStats: DailyStat[]
  session: Session
  seededAt: ISODate
}
