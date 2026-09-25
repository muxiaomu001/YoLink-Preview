/**
 * 领域模型。与 docs/prd/00 预留清单的建表要求一一对应：
 * - 坐席（Seat）是 users 表里的官方类型记录，员工（Staff）是登录账号，两者分离（预留 30、33）
 * - 消息同时记 seatId（客户看到的署名）与 operatorId（真正打字的员工）（预留 30）
 * - 坐席交接记录永久保留（预留 31）
 * - 客户与坐席多对多 customerSeats（预留 32）
 * - 头衔与内部标签分表（预留 34）
 *
 * 管理后台完整版（docs/prd/05）用到的模型也在这里：企业设置各分页、策略矩阵与数值、
 * 举报与敏感词、钱包/签到/推荐奖励、横幅与公告、客户画像、日报、插件与开放 API、系统。
 */

import type { NicknamePolicy } from './register'

export type ISODate = string

/** 员工角色能力键（工作台与管理后台功能，作用在员工上） */
export type Capability =
  | 'manage_messages'
  | 'moderate_customers'
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
  | 'manage_automation'

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

export interface StartupBrand {
  enabled: boolean
  backgroundColor: string
  tagline: string
  durationSeconds: 1 | 2 | 3
  allowSkip: boolean
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
  /** 客户端每次冷启动先展示的企业品牌画面 */
  startupBrand: StartupBrand
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
  /** 模块启停：停用不删数据 */
  modules: Record<ModuleKey, boolean>
  /** 群发频控：每个实操员工每天任务数（跨其持有的坐席合并） */
  broadcastPerStaffPerDay: number
  /** 群发频控：每客户每天最多收到的群发条数（跨坐席、跨任务合并） */
  broadcastPerCustomerPerDay: number
  /** 是否允许员工在工作台建个人话术（企业话术库始终可用） */
  allowPersonalQuickReply: boolean
  /** 注册时昵称怎么问：必填 / 选填 / 不问，见 domain/register */
  nicknamePolicy: NicknamePolicy
  /** 客户没填昵称时用的默认昵称模板，{n} = 账号 ID 后四位 */
  defaultNicknameTemplate: string
  /** 同一设备 24 小时内最多注册几个账号；0 = 不限 */
  registerPerDevicePerDay: number
  /** 新号观察期小时数；0 = 关闭。观察期内只能私聊坐席，不能在群里发言 */
  newAccountWatchHours: number
}

/** 员工个人设置：跟人走，不跟坐席走 */
export interface StaffPrefs {
  theme: 'auto' | 'light' | 'dark'
  desktopNotify: boolean
  sound: boolean
  language: Language
  /** 打字时全文匹配话术并浮出候选（标题 / 正文 / 文件名）；关了只能用 `/` 或话术面板 */
  quickMatch: boolean
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
  /** 工作台个人设置；缺省用 DEFAULT_STAFF_PREFS */
  prefs?: StaffPrefs
}

export type SeatStatus = 'accepting' | 'paused'

/** 坐席：客户看到的官方身份，不能登录，由员工实操 */
export interface Seat {
  id: string
  displayName: string
  avatarText: string
  avatarColor: string
  roleDesc: string
  operatorStaffId: string
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
  /** 业务系统同步来的角色文本，内部字段 */
  roleLabel?: string
  blockedSeatIds: string[]
  /** 已注销：保留数据，不再出现在工作台 */
  deletedAt?: ISODate
  /** 企业封禁：账号无法登录 */
  bannedAt?: ISODate | null
  /** 群聊禁言到期时间；群与频道不能发言，私聊不受影响 */
  mutedAllUntil?: ISODate | null
  /** 全部禁言到期时间；坐席、群与频道都不能发消息 */
  globalMutedUntil?: ISODate | null
  /** 员工重置过密码，首次登录强制修改 */
  mustChangePassword?: boolean
  /** 最近一次强制下线的时间；下线是一次性动作，不是持续状态 */
  sessionsRevokedAt?: ISODate
  /** 注册设备指纹，同设备注册风控按它计数 */
  deviceId?: string
  /** 昵称是注册时系统给的默认名，不是客户自己起的；软引导据此提示改名 */
  nicknameAuto?: boolean
  /** 客户还没自己更换过头像；软引导据此提醒完善资料 */
  avatarUpdatedAt?: ISODate
  /** 客户对外展示最后上线时间的范围；不影响企业侧已读回执 */
  lastSeenVisibility?: LastSeenVisibility
  /** 新号观察期到期时间；按注册时的企业设置算死，后来改设置不追溯已有客户 */
  watchUntil?: ISODate
  /** 客户关掉了注册后的完善资料引导，关了就不再出现 */
  profileGuideDismissedAt?: ISODate
  /** 客户级影子模式：他发的每条群消息只有他自己和坐席看得见，与踩没踩敏感词无关 */
  shadowModeAt?: ISODate
  /** 为什么把他放进影子模式，后台列表与审计都读这一句 */
  shadowModeReason?: string
  /** 通用字段值（P1） */
  customFields?: Record<string, string>
}

export type LastSeenVisibility = 'everyone' | 'friends' | 'nobody'

export interface CustomerSeat {
  customerId: string
  seatId: string
  primary: boolean
  addedAt: ISODate
  source: 'register' | 'backfill' | 'reassign'
}

/** 邀请组：固定坐席人人都加，轮询坐席按顺序轮流分一个 */
export interface InviteGroup {
  id: string
  name: string
  /** 邀请码，可自定义；与邀请链接共用一个命名空间 */
  code: string
  /** 固定坐席：从这个码进来的客户全部添加，按此顺序排在轮询坐席之后 */
  fixedSeatIds: string[]
  /** 轮询坐席：排成一队，每个客户按顺序分到其中一位，分到谁谁就是主归属 */
  rotatingSeatIds: string[]
  /** 轮询游标：下一个客户从队列的第几位开始取 */
  rotationIndex: number
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
  /** 附带动作：通过该链接注册的客户额外自动加入的群或频道（叠加在邀请组之上） */
  chatGroupIds: string[]
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

/** 群只有一种（上限走策略数值 groupMaxMembers），不再分普通群 / 大群；频道客户只读 */
export type ChatGroupKind = 'group' | 'channel'

/** 群内管理员权限粒度（12 文档，P0 实现 9 项里的 8 项 + 频道发布） */
export type GroupAdminPerm =
  | 'can_manage_chat'
  | 'can_delete_messages'
  | 'can_restrict_members'
  | 'can_promote_members'
  | 'can_change_info'
  | 'can_invite_users'
  | 'can_pin_messages'
  | 'can_post_messages'

export type GroupMemberKind = 'seat' | 'customer'

/** 群内管理员：坐席或客户都可以被任命，权限按项配置 */
export interface GroupAdmin {
  memberKind: GroupMemberKind
  memberId: string
  perms: GroupAdminPerm[]
  promotedBySeatId: string
  promotedAt: ISODate
}

/** 群设置：全员禁言、成员可见、限流档位（P2）、历史可见（P1） */
export interface GroupSettings {
  allMuted: boolean
  membersVisible: boolean
  /** null 用企业数值型策略 */
  slowModeSeconds: number | null
  historyVisible: boolean
}

/** 群公告：最多 1 条有效公告，新成员入群弹窗 */
export interface GroupAnnouncement {
  title: string
  content: string
  bySeatId: string
  at: ISODate
  notified: boolean
}

/** 单人禁言或移出并禁止再进 */
export interface GroupRestriction {
  customerId: string
  kind: 'mute' | 'ban'
  /** null 为永久 */
  until: ISODate | null
  bySeatId: string
  at: ISODate
  reason?: string
}

/** 群邀请链接：主链接一条 + 附加链接若干（与注册用的邀请链接不是一回事） */
export interface GroupInviteLink {
  id: string
  name: string
  code: string
  main: boolean
  expiresAt: ISODate | null
  maxUses: number | null
  uses: number
  status: 'active' | 'revoked' | 'expired'
  bySeatId: string
  createdAt: ISODate
}

export interface ChatGroup {
  id: string
  name: string
  kind: ChatGroupKind
  official: boolean
  desc: string
  /** 群主：坐席 */
  ownerSeatId: string
  /** 坐席成员（含群主）；是否管理员看 admins */
  memberSeatIds: string[]
  memberCustomerIds: string[]
  admins: GroupAdmin[]
  settings: GroupSettings
  announcement: GroupAnnouncement | null
  pinnedMessageIds: string[]
  restrictions: GroupRestriction[]
  inviteLinks: GroupInviteLink[]
  requiredTitleId: string | null
  /** 人数上限，null 用数值型策略的单群上限 */
  maxMembers: number | null
  createdAt: ISODate
  /** 频道帖子可选坐席署名 */
  showSignature?: boolean
  welcomeText?: string
}

/** 管理员日志：仅管理员可见，保留 48 小时 */
export interface GroupLog {
  id: string
  groupId: string
  at: ISODate
  actorKind: GroupMemberKind | 'staff' | 'system'
  actorId: string
  actorSeatId?: string
  actorSource?: 'admin' | 'workbench'
  /** 操作类型，如 setting / member / admin / pin / announcement / delete_message / restrict */
  action: string
  detail: string
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
  /** 坐席侧会话操作：置顶、静音、手动标记（按坐席） */
  pinnedBySeatIds?: string[]
  mutedBySeatIds?: string[]
  /** 坐席最近一次读到的时间；缺省按"最后一条坐席消息之后"算未读 */
  readAtBySeat?: Record<string, ISODate>
  /** 客户在演示会话里实际看到的最后一条消息时间 */
  readAtByCustomer?: Record<string, ISODate>
  /** 坐席手动标为未读 */
  unreadMarkBySeatIds?: string[]
  clearedThroughByViewer?: Record<string, ISODate>
  hiddenAtByViewer?: Record<string, ISODate>
}

export type SenderKind = 'customer' | 'seat' | 'system'
export type MessageKind = 'text' | 'image' | 'file' | 'video' | 'voice' | 'system'

/** 图片 / 文件消息的附件：演示里 url 是 public 下的静态文件或本机上传后的 data URL */
export interface MessageMedia {
  url: string
  name: string
  /** 字节数 */
  size: number
  mime?: string
  width?: number
  height?: number
  duration?: number
  album?: MessageMedia[]
}

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
  /** 文字消息的正文；图片 / 文件消息里是说明文字（可空） */
  text: string
  /** kind 为 image / file 时的附件 */
  media?: MessageMedia
  at: ISODate
  mentionSeatIds?: string[]
  mentionCustomerIds?: string[]
  /** 群回执按发送时的成员范围统计，不把之后加入的人算未读。 */
  receiptMemberSeatIds?: string[]
  receiptMemberCustomerIds?: string[]
  mentionAll?: boolean
  isWelcome?: boolean
  /** 为所有人删除：普通聊天中直接消失、不留占位；原文与操作人保留在审计 */
  deletedAt?: ISODate
  /** 该次删除是否由管理权限发起（而非作者本人），只用于审计区分 */
  deletedByManager?: boolean
  editedAt?: ISODate
  /** 编辑前的正文留在本地审计数据中 */
  editHistory?: { text: string; at: ISODate; operatorId: string }[]
  /** 回复的目标消息 */
  replyToId?: string
  quoteText?: string
  /** 转发来源 */
  forwardedFrom?: { convId: string; messageId: string; name?: string }
  /** 群发任务产生的消息（频控按它统计） */
  isBroadcast?: boolean
  hiddenFor?: string[]
  /**
   * 影子屏蔽：发送方自己看得见、坐席看得见，群里其他客户看不见。
   * 记时间点而不是 true，后台要答得上「什么时候开始被屏蔽的」。
   */
  shadowedAt?: ISODate
  /** 因为踩了影子词，还是因为这个客户整个人在影子模式里 */
  shadowReason?: 'word' | 'customer'
  /** 衍生消息沿用原消息允许查看的客户；坐席转发不能扩大客户可见范围。 */
  shadowCustomerIds?: string[]
  /** 置顶通知等复制了原文的载体，用于跟随来源后续的影子状态。 */
  shadowSourceIds?: string[]
  recipientCustomerId?: string
  channelId?: string
  channelSignature?: string
  delivery?: 'pending' | 'failed' | 'sent'
  failureReason?: string
  attemptId?: string
}

export interface ChatActor { kind: 'seat' | 'customer'; id: string; staffId?: string }
export interface ChatDraft { text: string; replyToId?: string; quoteText?: string }

// ---------- 审计与安全 ----------

export type AuditType =
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'staff.create'
  | 'staff.update'
  | 'staff.disable'
  | 'staff.activate'
  | 'staff.reset_password'
  | 'staff.force_logout'
  | 'role.create'
  | 'role.update'
  | 'role.delete'
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
  | 'policy.preset'
  | 'policy.cap'
  | 'policy.number'
  | 'policy.override'
  | 'group.official'
  | 'group.update'
  | 'settings.update'
  | 'module.toggle'
  | 'customer.register'
  | 'customer.register_blocked'
  | 'customer.reassign'
  | 'customer.delete'
  | 'broadcast.send'
  | 'quick_reply.library'
  | 'message.delete'
  | 'report.handle'
  | 'sensitive.update'
  | 'customer.shadow'
  | 'export'
  | 'wallet.settings'
  | 'wallet.adjust'
  | 'wallet.withdrawal'
  | 'checkin.settings'
  | 'referral.settings'
  | 'referral.cancel'
  | 'banner.update'
  | 'announcement.update'
  | 'profile.sync'
  | 'profile.import'
  | 'automation.update'
  | 'daily_report.settings'
  | 'plugin.update'
  | 'api_key.create'
  | 'api_key.delete'
  | 'webhook.update'
  | 'app_version.update'
  | 'backup.run'
  | 'backup.restore'
  | 'group.setting'
  | 'group.announcement'
  | 'group.pin'
  | 'group.member'
  | 'group.admin'
  | 'group.restrict'
  | 'group.invite_link'
  | 'group.create'
  | 'message.recall'
  | 'message.edit'
  | 'customer.ban'
  | 'customer.mute'
  | 'customer.unmute'
  | 'customer.group_mute'
  | 'customer.group_unmute'
  | 'customer.reset_password'
  | 'customer.force_logout'
  | 'quick_reply.update'
  | 'staff.prefs'

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
  resolution?: 'banned' | 'deleted' | 'ignored'
  handledBy?: string
  handledAt?: ISODate
}

/**
 * shadow = 影子屏蔽：发送方看到消息正常发出去了，坐席也看得见，**群里其他客户看不见**。
 * 拦截会告诉对方「你这句不行」，于是他换个说法再试一次，直到试出一句能过的；
 * 影子屏蔽不给任何反馈，他以为发出去了，就不会再换写法。
 * 只对客户词库开放：屏蔽坐席等于客户收不到客服回复，那是事故不是风控。
 */
export type SensitiveAction = 'block' | 'shadow' | 'replace' | 'log'

/** 客户词库查客户发言，坐席合规词库查坐席发言，两套互不干扰 */
export type SensitiveScope = 'customer' | 'seat'

/** P1：敏感词 */
export interface SensitiveWord {
  id: string
  word: string
  /** 缺省按客户词库算 */
  scope?: SensitiveScope
  action: SensitiveAction
  replaceWith?: string
  /** 关掉变形匹配，只认原样写法；给那些一模糊就误伤的短词用 */
  exact?: boolean
}

export interface SensitiveHit {
  id: string
  at: ISODate
  scope: SensitiveScope
  /** 客户 ID 或坐席 ID，按 scope 解释 */
  senderId: string
  /** 坐席命中时背后的实操员工：合规追责要追到人，不能停在坐席身份 */
  operatorStaffId?: string
  convId: string
  word: string
  original: string
  result: 'blocked' | 'shadowed' | 'replaced' | 'logged'
}

// ---------- 群发、快捷回复 ----------

/** friends：本坐席全部好友（所有添加了该坐席的客户），一键群发的默认目标；mine：只算主归属 */
export type BroadcastTargetKind = 'friends' | 'mine' | 'tag' | 'title' | 'purchase' | 'role' | 'group' | 'coverage'
export type BroadcastStatus = 'scheduled' | 'sending' | 'done' | 'failed'

export interface Broadcast {
  id: string
  name: string
  /** 单坐席任务的发送身份；多坐席覆盖时记主力坐席（发得最多的那个），明细看 coverage */
  seatId: string
  operatorId: string
  targetKind: BroadcastTargetKind
  targetDesc: string
  contentKind: 'text' | 'image' | 'file'
  text: string
  /** 图片 / 文件群发的附件（可从话术库选） */
  media?: MessageMedia
  sentAt: ISODate
  /** P1：定时发送 */
  scheduledAt?: ISODate | null
  status: BroadcastStatus
  sentCount: number
  /** 因频控、拉黑、注销跳过的人数 */
  skippedCount: number
  readCount: number
  /** 多坐席覆盖：参与的坐席（按选择顺序）与各自实际发出的条数 */
  coverage?: { seatId: string; count: number }[]
  /** 跳过原因分布，键见 domain/broadcastCoverage 的 SkipReason */
  skipReasons?: Record<string, number>
}

// ---------- 话术库（易歪歪式：分类 + 文字 / 图片 / 文件 + 全文匹配，不设关键词字段） ----------

export type QuickReplyScope = 'enterprise' | 'personal'
export type QuickReplyKind = 'text' | 'image' | 'file'

/** 话术分类：企业分类由后台维护，个人分类由员工自己在工作台建 */
export interface QuickReplyCategory {
  id: string
  scope: QuickReplyScope
  /** 个人分类的主人 */
  staffId?: string
  name: string
  sortOrder: number
}

/**
 * 一条话术。文字话术 text 为正文（支持变量）；图片 / 文件话术 media 为附件，text 是随附说明（可空）。
 * 打字自动匹配走全文：标题、正文、附件文件名都参与，命中顺序 标题 > 正文 > 文件名，不需要另外维护关键词。
 */
export interface QuickReply {
  id: string
  scope: QuickReplyScope
  /** 个人话术的主人 */
  staffId?: string
  /** 所属分类；空为「未分类」 */
  categoryId: string | null
  kind: QuickReplyKind
  title: string
  text: string
  media?: MessageMedia
  /** 企业话术可停用：停用后工作台不可见，后台保留 */
  enabled: boolean
  useCount: number
  lastUsedAt?: ISODate
}

// ---------- 策略 ----------

export interface PolicyItem {
  key: string
  label: string
  group: string
  desc: string
  level: 'P0' | 'P1' | 'P2'
  /** 模块能力键：模块停用时整体不生效 */
  module?: ModuleKey
  /** 只对坐席有意义的键：客户列显示"—" */
  staffOnly?: boolean
}

/** 策略矩阵的列：客户（只有手机端）与坐席（只有桌面端），用户 2026-09-15 决定不按端拆列 */
export type PolicyCol = 'customer' | 'staff'

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
  /** 旧版本统一时限仅保留兼容数据，新演示按身份设置。 */
  editSeconds: number
  seatRecallSeconds?: number
  seatEditSeconds?: number
  customerRecallSeconds?: number
  customerEditSeconds?: number
  groupMaxMembers: number
  slowModeSeconds: number
  retentionDays: number
  fileMaxMb?: number
  imageMaxMb: number
  videoMaxMb: number
  voiceMaxSeconds: number
  /** 最大同时在线设备数（03 文档 account.max_devices） */
  maxDevices: number
  /** 工作台"长期未跟进"的天数阈值（04 文档，默认 14） */
  idleDays: number
}

/** 覆盖目标：群级覆盖（只作用于客户在该群里的能力）或用户级覆盖（客户 / 坐席） */
export type PolicyOverrideTarget = 'customer' | 'seat' | 'group'

/** P1：群级 / 用户级覆盖，对某个群、客户或坐席单独放开或收紧 */
export interface PolicyOverride {
  id: string
  targetKind: PolicyOverrideTarget
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

// ---------- 客户画像 ----------

export interface ProfileSyncSettings {
  apiKeyConfigured: boolean
  apiKeyPrefix: string
  amountVisibleRoleIds: string[]
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

// ---------- 经营数据与提醒 ----------

export type ReportChannel = 'wecom' | 'feishu' | 'wechat' | 'sms' | 'email'

export interface ReportRecipient {
  id: string
  name: string
  staffId: string
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

export interface License {
  version: string
  instanceId: string
  type: 'saas' | 'private'
  expiresAt: ISODate
}

export interface ProviderInstance {
  id: string
  enterpriseName: string
  enterpriseCode: string
  deviceCode: string
  instanceId: string
  version: string
  boundAt: ISODate
  expiresAt: ISODate
  stoppedAt: ISODate | null
  stopReason: string | null
}

export interface ProviderLicenseAction {
  id: string
  instanceId: string
  at: ISODate
  operatorName: string
  action: 'bind' | 'renew' | 'stop' | 'resume'
  detail: string
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
  /** 当前手机端登录建立时间；强制下线后用来判定这次登录已失效 */
  phoneSessionStartedAt?: ISODate | null
}

export interface DemoState {
  mediaDrafts?: Record<string,{kind:'image'|'file'|'video'|'voice';items:MessageMedia[];text:string}>
  chatTyping?: Record<string,{convId:string;until:number}>
  chatDrafts?: Record<string, ChatDraft>
  failNextSend?: boolean
  chatRulesVersion?: number
  customerModerationVersion?: number
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
  securityEvents: SecurityEvent[]
  reports: Report[]
  sensitiveWords: SensitiveWord[]
  sensitiveHits: SensitiveHit[]
  broadcasts: Broadcast[]
  quickReplyCategories: QuickReplyCategory[]
  quickReplies: QuickReply[]
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
  providerInstances: ProviderInstance[]
  providerLicenseActions: ProviderLicenseAction[]
  backups: Backup[]
  health: HealthStatus
  dailyStats: DailyStat[]
  groupLogs: GroupLog[]
  session: Session
  seededAt: ISODate
}
