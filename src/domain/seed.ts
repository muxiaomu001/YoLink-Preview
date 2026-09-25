/**
 * 演示种子数据：恒信财富（虚构的海外资产配置公司）。
 * 所有人名、对话、金额均为虚构。
 */
import type {
  AuditEvent,
  Broadcast,
  ChatGroup,
  Conversation,
  Customer,
  CustomerSeat,
  DemoState,
  Enterprise,
  InviteGroup,
  InviteLink,
  Message,
  MessageMedia,
  Role,
  Seat,
  SeatHandover,
  Staff,
  Tag,
  Title,
  TitleAssignment,
} from './types'
import { ago, agoMs, iso } from './time'
import { allocateSeats } from './allocation'
import { DEFAULT_NICKNAME_TEMPLATE, watchUntilOf } from './register'
import { buildAdminSeed } from './seed-admin'
import { MEDIA, QUICK_REPLIES, QUICK_REPLY_CATEGORIES } from './seed-quick-replies'
import { DEFAULT_STAFF_PREFS, GROUP_EXTRAS, buildGroupLogs, groupDefaults } from './seed-groups'

/** 确定性伪随机，保证每次重置出来的数据一样 */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SEED = 20260915
let rand = mulberry32(SEED)
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]
const chance = (p: number) => rand() < p
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1))

let seq = 0
const sid = (p: string) => {
  seq += 1
  return `${p}_${String(seq).padStart(4, '0')}`
}

// ---------- 企业、角色、员工 ----------

export const ENTERPRISE: Enterprise = {
  id: 'ent_hx',
  name: '恒信财富',
  code: 'HXWM',
  slogan: '海外资产配置 · 长期陪伴',
  timezone: 'Asia/Hong_Kong',
  logoText: '恒',
  defaultLanguage: 'zh',
  brandColor: '#1f3b73',
  startupBrand: {
    enabled: true,
    backgroundColor: '#10203f',
    tagline: '让每一次客户沟通都有延续',
    durationSeconds: 2,
    allowSkip: true,
  },
  agreementUrl: 'https://hxwm.example/legal/terms',
  privacyUrl: 'https://hxwm.example/legal/privacy',
  faqUrl: 'https://hxwm.example/help/faq',
  allowedThemes: ['classic', 'dark', 'ocean'],
  defaultTheme: 'classic',
  registerMethods: ['username', 'phone'],
  inviteCodeRequired: true,
  emailVerify: false,
  forcePhoneBind: false,
  push: { apnsMode: 'p8', apnsKeyId: 'K7M2Q9XA', apnsTeamId: 'HX8Z2T4Y', fcmConfigured: true, mask: 'sender_only' },
  storage: { type: 'oss', bucket: 'hxwm-im-prod', endpoint: 'oss-cn-hongkong.aliyuncs.com', accessKeyConfigured: true, secretKeyConfigured: true, lastTestAt: ago(3), lastTestOk: true },
  webTabs: [
    { id: 'wt_1', enabled: true, title: '我的账户', iconText: '账', url: 'https://portal.hxwm.example/account?uid={user_id}&ext={external_id}&ts={ts}&sig={sig}' },
    { id: 'wt_2', enabled: false, title: '产品中心', iconText: '产', url: 'https://portal.hxwm.example/products' },
  ],
  modules: { customers: true, invite: true, wallet: true, checkin: true, referral: true, broadcast: true, banner: true, content: true },
  broadcastPerStaffPerDay: 3,
  allowPersonalQuickReply: true,
  broadcastPerCustomerPerDay: 2,
  // 注册提速：昵称选填，不填就发「客户1234」；风控与提速同批开，不然就是把闸门单向拆了
  nicknamePolicy: 'optional',
  defaultNicknameTemplate: DEFAULT_NICKNAME_TEMPLATE,
  registerPerDevicePerDay: 3,
  newAccountWatchHours: 24,
}

export const ALL_CAPS: Role['caps'] = [
  'manage_messages',
  'view_all_conversations',
  'view_all_customers',
  'create_invite',
  'broadcast',
  'manage_groups',
  'view_audit',
  'view_seat_operator',
  'assign_title',
  'export_customers',
  'delete_user',
  'review_withdrawal',
  'mark_paid',
  'adjust',
  'manage_seats',
  'manage_titles',
  'manage_staff',
  'manage_roles',
  'manage_policies',
  'manage_settings',
  'view_audit_logs',
  'export_data',
  'manage_automation',
]

export const ROLES: Role[] = [
  { id: 'role_super', name: '超级管理员', desc: '全部权限，系统内置，不可删除、停用或降级', builtin: true, caps: ALL_CAPS },
  { id: 'role_admin', name: '管理员', desc: '除管理员工角色外的全部权限，系统内置', builtin: true, caps: ALL_CAPS.filter((cap) => cap !== 'manage_roles') },
  {
    id: 'role_cs',
    name: '客服',
    desc: '只看本人持有坐席的会话与客户；能发邀请链接、群发、挂头衔',
    builtin: true,
    caps: ['create_invite', 'broadcast', 'assign_title'],
  },
  {
    id: 'role_lead',
    name: '运营主管',
    desc: '看全部会话与客户，管群，查消息审计与实操员工，审提现',
    builtin: false,
    caps: [
      'review_withdrawal',
      'mark_paid',
      'export_customers',
      'manage_automation',
      'view_all_conversations',
      'view_all_customers',
      'create_invite',
      'broadcast',
      'manage_groups',
      'view_audit',
      'view_seat_operator',
      'assign_title',
    ],
  },
]

const STAFF_BASE: Staff[] = [
  {
    id: 'st_admin',
    name: '周敏',
    username: 'zhoumin',
    email: 'zhoumin@hxwm.example',
    roleId: 'role_super',
    status: 'active',
    lastLoginAt: ago(0, 1),
    createdAt: ago(120),
  },
  {
    id: 'st_lin',
    name: '林薇',
    username: 'linwei',
    email: 'linwei@hxwm.example',
    roleId: 'role_cs',
    status: 'active',
    lastLoginAt: ago(0, 0, 25),
    createdAt: ago(110),
  },
  {
    id: 'st_chen',
    name: '陈默',
    username: 'chenmo',
    email: 'chenmo@hxwm.example',
    roleId: 'role_cs',
    status: 'active',
    lastLoginAt: ago(0, 2),
    createdAt: ago(110),
  },
  {
    id: 'st_zhao',
    name: '赵磊',
    username: 'zhaolei',
    email: 'zhaolei@hxwm.example',
    roleId: 'role_lead',
    status: 'active',
    lastLoginAt: ago(0, 5),
    createdAt: ago(100),
  },
  {
    id: 'st_wang',
    name: '王芳',
    username: 'wangfang',
    email: 'wangfang@hxwm.example',
    roleId: 'role_cs',
    status: 'active',
    lastLoginAt: undefined,
    createdAt: ago(2),
  },
]

/** 个人设置缺省值跟人走 */
export const STAFF: Staff[] = STAFF_BASE.map((st) => ({ ...st, prefs: { ...DEFAULT_STAFF_PREFS } }))

// ---------- 坐席 ----------

export const SEATS: Seat[] = [
  {
    id: 'seat_lin',
    displayName: '林晓明',
    avatarText: '林',
    avatarColor: '#1f3b73',
    roleDesc: '资深投资服务专员 · 全球资产配置',
    operatorStaffId: 'st_lin',
    status: 'accepting',
    welcome:
      '{{customer.nickname}}您好，我是您的专属投资服务专员林晓明。先花两分钟做个风险测评，我再根据结果给您一版配置思路，可以吗？',
    customerDeletable: false,
    createdAt: ago(110),
  },
  {
    id: 'seat_chen',
    displayName: '陈二宝',
    avatarText: '陈',
    avatarColor: '#2f56ad',
    roleDesc: '投资服务专员 · 固收与现金管理',
    operatorStaffId: 'st_chen',
    status: 'accepting',
    welcome:
      '{{customer.nickname}}您好，我是陈二宝，负责您的账户配置与日常跟进。您先说说这笔资金的用途和期限，我们从这里开始。',
    customerDeletable: false,
    createdAt: ago(110),
  },
  {
    id: 'seat_cs',
    displayName: '客户服务',
    avatarText: '服',
    avatarColor: '#0f766e',
    roleDesc: '开户、入金、账户与资料问题',
    operatorStaffId: 'st_chen',
    status: 'accepting',
    welcome: '您好，这里是恒信财富客户服务。开户、入金到账、资料修改这类问题直接在这里说，工作时间 15 分钟内回复。',
    customerDeletable: true,
    createdAt: ago(105),
  },
]

export const HANDOVERS: SeatHandover[] = [
  {
    id: 'ho_0001',
    seatId: 'seat_cs',
    fromStaffId: 'st_zhao',
    toStaffId: 'st_chen',
    at: ago(45),
    byStaffId: 'st_admin',
    reason: '赵磊转任运营主管，客户服务坐席交由陈默兼管',
  },
]

// ---------- 头衔与内部标签 ----------

/** 头衔：官方授予、对外可见的身份（用户 2026-09-15：「官方讲师」「认证团队长」这类，彰显角色或权益；内部判断走标签） */
export const TITLES: Title[] = [
  { id: 't_vip', name: '私享会员', color: '#b45309', icon: 'crown', desc: '年度私享服务会员，享专属策略与线下活动', enabled: true },
  { id: 't_lecturer', name: '官方讲师', color: '#1d4ed8', icon: 'shield-check', desc: '受恒信邀请在群里讲课的外部讲师', enabled: true },
  { id: 't_leader', name: '认证团队长', color: '#7e22ce', icon: 'star', desc: '带团队的推荐人，团队人数 ≥ 30', enabled: true },
  { id: 't_referrer', name: '认证推荐人', color: '#15803d', desc: '直接邀请 ≥ 10 人', enabled: true },
]

export const TAGS: Tag[] = [
  { id: 'tag_new', name: '新客', color: '#0f766e', source: 'admin' },
  { id: 'tag_guest', name: '活动嘉宾', color: '#7e22ce', source: 'admin' },
  { id: 'tag_hnw', name: '高净值', color: '#b45309', source: 'admin' },
  { id: 'tag_funded', name: '已入金', color: '#15803d', source: 'admin' },
  { id: 'tag_watch', name: '观望中', color: '#6b7280', source: 'admin' },
  { id: 'tag_aggr', name: '风险偏好进取', color: '#dc2626', source: 'admin' },
  { id: 'tag_cons', name: '风险偏好稳健', color: '#0369a1', source: 'admin' },
  { id: 'tag_refund', name: '退款风险', color: '#be123c', source: 'staff' },
  { id: 'tag_callback', name: '需回访', color: '#7c3aed', source: 'staff' },
]

// ---------- 群与频道 ----------

const CHAT_GROUPS_BASE: Omit<ChatGroup, keyof ReturnType<typeof groupDefaults>>[] = [
  {
    id: 'cg_strategy',
    name: '恒信官方通知',
    kind: 'channel',
    official: true,
    desc: '合规提示、系统维护与活动安排，只读',
    ownerSeatId: 'seat_cs',
    memberSeatIds: ['seat_cs', 'seat_lin', 'seat_chen'],
    memberCustomerIds: [],
    requiredTitleId: null,
    maxMembers: null,
    createdAt: ago(100),
  },
  {
    id: 'cg_community',
    name: '恒信财富社群',
    kind: 'group',
    official: true,
    desc: '客户交流与服务专员答疑',
    ownerSeatId: 'seat_lin',
    memberSeatIds: ['seat_lin', 'seat_chen', 'seat_cs'],
    memberCustomerIds: [],
    requiredTitleId: null,
    maxMembers: 500,
    createdAt: ago(100),
  },
  {
    id: 'cg_vip',
    name: '私享会员群',
    kind: 'group',
    official: true,
    desc: '仅私享会员可入，服务专员一对一答疑优先',
    ownerSeatId: 'seat_lin',
    memberSeatIds: ['seat_lin', 'seat_chen'],
    memberCustomerIds: [],
    requiredTitleId: 't_vip',
    maxMembers: 200,
    createdAt: ago(80),
  },
]

/** 基础字段 + 管理字段（群内角色、设置、公告、群邀请链接） */
export const CHAT_GROUPS: ChatGroup[] = CHAT_GROUPS_BASE.map((g) => ({ ...g, ...groupDefaults(), ...GROUP_EXTRAS[g.id] }))

// ---------- 邀请组与邀请链接 ----------

export const INVITE_GROUPS: InviteGroup[] = [
  {
    id: 'ig_default',
    name: '默认组',
    code: 'HX2026',
    // 客户服务人人都加；两位坐席轮流接
    fixedSeatIds: ['seat_cs'],
    rotatingSeatIds: ['seat_chen', 'seat_lin'],
    rotationIndex: 0,
    chatGroupIds: ['cg_strategy', 'cg_community'],
    isDefault: true,
    enabled: true,
    createdAt: ago(100),
  },
  {
    id: 'ig_live',
    name: '直播间组',
    code: 'LIVE88',
    fixedSeatIds: [],
    rotatingSeatIds: ['seat_lin', 'seat_chen'],
    rotationIndex: 0,
    chatGroupIds: ['cg_strategy', 'cg_community'],
    isDefault: false,
    enabled: true,
    createdAt: ago(60),
  },
  {
    id: 'ig_lin',
    name: '林晓明专属码',
    code: 'LIN001',
    // 一对一专属码：没有固定坐席，队列里只有他自己
    fixedSeatIds: [],
    rotatingSeatIds: ['seat_lin'],
    rotationIndex: 0,
    chatGroupIds: ['cg_strategy', 'cg_community'],
    isDefault: false,
    enabled: true,
    createdAt: ago(40),
  },
]

export const INVITE_LINKS: InviteLink[] = [
  {
    id: 'il_douyin',
    name: '抖音直播 · 9 月',
    inviteGroupId: 'ig_live',
    code: 'DY0901',
    creatorStaffId: 'st_lin',
    expiresAt: iso(agoMs(-20)),
    maxUses: 500,
    uses: 63,
    clicks: 412,
    status: 'active',
    chatGroupIds: ['cg_vip'],
    createdAt: ago(14),
  },
  {
    id: 'il_xhs',
    name: '小红书投放',
    inviteGroupId: 'ig_default',
    code: 'XHS202',
    creatorStaffId: 'st_zhao',
    expiresAt: null,
    maxUses: null,
    uses: 28,
    clicks: 190,
    status: 'active',
    chatGroupIds: [],
    createdAt: ago(30),
  },
  {
    id: 'il_referral',
    name: '林薇 · 老客户转介绍',
    inviteGroupId: 'ig_lin',
    code: 'LINREF',
    creatorStaffId: 'st_lin',
    expiresAt: null,
    maxUses: 100,
    uses: 9,
    clicks: 31,
    status: 'active',
    chatGroupIds: [],
    createdAt: ago(35),
  },
  {
    id: 'il_old',
    name: '8 月线下沙龙',
    inviteGroupId: 'ig_default',
    code: 'SALON8',
    creatorStaffId: 'st_zhao',
    expiresAt: ago(10),
    maxUses: 50,
    uses: 22,
    clicks: 60,
    status: 'expired',
    chatGroupIds: [],
    createdAt: ago(50),
  },
]

// ---------- 客户 ----------

const SURNAMES = ['张', '李', '王', '刘', '陈', '杨', '黄', '赵', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '何', '林', '罗', '高']
const ENGLISH = ['Kevin', 'Cathy', 'Alan', 'Grace', 'Leo', 'Vivian', 'Jason', 'Mia', 'Eric', 'Sophie']
const DEVICES = ['iPhone 15 Pro · iOS 18', 'iPhone 14 · iOS 17', 'Samsung S24 · Android 14', 'Xiaomi 14 · Android 14', 'iPad Air · iPadOS 18']
const PRODUCTS = ['全球均衡组合', '美元货币基金', '港股科技主题', '黄金 ETF 配置', '美元短债策略']

interface CustomerPlan {
  inviteGroupId: string
  inviteLinkId?: string
  daysAgo: number
  scenario: ScenarioKey
}

type ScenarioKey =
  | 'onboarding_pending'
  | 'us_market_question'
  | 'deposit_arrival'
  | 'risk_survey_done'
  | 'renewal'
  | 'quiet_long'
  | 'complaint_refund'
  | 'referral_intro'
  | 'just_registered'
  | 'active_investor'

/** 对话脚本：c = 客户，s = 主归属坐席。最后一条是 c 的会落在"待我回复" */
type ScriptLine = { from: 'c' | 's'; text: string; gapMin: number; kind?: 'image' | 'file'; media?: MessageMedia }

const SCENARIOS: Record<ScenarioKey, ScriptLine[]> = {
  onboarding_pending: [
    { from: 'c', text: '你好，我在直播里看到你们的美元资产配置，想了解一下', gapMin: 0 },
    { from: 's', text: '您好！先问一下，这笔资金大概计划放多久？一年以内还是三年以上？这决定我们从哪类产品聊起。', gapMin: 6 },
    { from: 'c', text: '三年左右吧，主要是想分散一下，不想全放在国内', gapMin: 40 },
    { from: 's', text: '明白。三年期比较适合"均衡组合 + 一部分美元短债"的搭配，波动可控。我发您一份简版说明，您看完我们再约个时间过一遍。', gapMin: 5 },
    { from: 's', kind: 'file', media: MEDIA.productGuide, text: '这是产品说明书，重点看第二部分的配置区间。', gapMin: 1 },
    { from: 's', kind: 'image', media: MEDIA.feeTable, text: '', gapMin: 1 },
    { from: 'c', text: '好的，那开户需要准备什么材料？', gapMin: 120 },
  ],
  us_market_question: [
    { from: 'c', text: '林晓明，美股现在这个位置还能进吗？感觉涨太多了', gapMin: 0 },
    { from: 's', text: '这个问题我不会给"能"或"不能"这种回答，说实话谁也判断不了短期。您现在的组合里美股占比是 35%，在合理区间；如果担心高位，可以把新增资金分三个月分批进，不用一次到位。', gapMin: 8 },
    { from: 'c', text: '分批的话每次多少合适？', gapMin: 30 },
  ],
  deposit_arrival: [
    { from: 'c', text: '我昨天汇的款到了吗？银行那边显示已经出去了', gapMin: 0 },
    { from: 's', text: '收到，我帮您查一下。跨境汇款一般 1 到 2 个工作日到账，您这笔是昨天下午发起的，正常今天下午能看到。到账后系统会给您发通知，我这边也会跟您确认。', gapMin: 4 },
    { from: 'c', text: '好的，麻烦了', gapMin: 3 },
    { from: 's', text: '已到账，金额与您汇款单一致。您可以在 App 里的账户页看到，配置我按之前确认的方案在明天开盘后执行。', gapMin: 260 },
    { from: 'c', text: '收到，辛苦', gapMin: 15 },
    { from: 's', text: '不客气，有问题随时找我。', gapMin: 2 },
  ],
  risk_survey_done: [
    { from: 's', text: '您的风险测评结果出来了，是"稳健型"。按这个结果，权益类资产建议控制在四成以内，剩下放固收和现金管理。', gapMin: 0 },
    { from: 's', kind: 'image', media: MEDIA.riskLevels, text: '', gapMin: 1 },
    { from: 'c', text: '四成会不会太保守了，我朋友都是七成以上', gapMin: 50 },
    { from: 's', text: '每个人的情况不一样。测评看的是您能承受多大回撤，不是您想赚多少。真要提高权益比例也可以，但我建议先按四成跑三个月，看看实际波动您是不是舒服，再往上调。', gapMin: 6 },
    { from: 'c', text: '行，那先按你说的来', gapMin: 20 },
    { from: 's', text: '好，我今天把方案整理好发您确认。', gapMin: 3 },
  ],
  renewal: [
    { from: 's', text: '您的私享会员下个月到期，续费后策略会和线下活动的资格延续，费率不变。需要我给您发续费链接吗？', gapMin: 0 },
    { from: 'c', text: '先不急，这一年感觉活动参加得不多', gapMin: 90 },
    { from: 's', text: '理解。其实这一年会员的核心不是活动，是每季度那次组合复盘，您的组合今年调了两次仓，都是复盘时定的。要不要我把这两次的记录整理给您看看？', gapMin: 10 },
    { from: 'c', text: '可以，发我看看', gapMin: 200 },
  ],
  quiet_long: [
    { from: 'c', text: '谢谢，我先看看资料', gapMin: 0 },
    { from: 's', text: '好的，随时联系。', gapMin: 5 },
  ],
  complaint_refund: [
    { from: 'c', text: '我想把上个月买的港股那个赎回，跌得有点多，心里不踏实', gapMin: 0 },
    { from: 's', text: '理解您的感受。先说事实：这只产品当前回撤 8%，同期恒生科技指数回撤 11%，产品跑赢指数。赎回随时可以，T+3 到账。但我想先问一句，这笔钱近期有用途吗？', gapMin: 7 },
    { from: 'c', text: '没有用途，就是看着难受', gapMin: 25 },
    { from: 's', text: '那我给您两个选择：一是现在赎回，落袋为安；二是保留，但把它在组合里的占比从 20% 降到 10%，减一半仓位，难受的程度也减一半。您定，我都执行。', gapMin: 5 },
    { from: 'c', text: '让我想想，明天答复你', gapMin: 30 },
  ],
  referral_intro: [
    { from: 'c', text: '林晓明你好，我是老王介绍来的，他说你这边配置做得挺稳', gapMin: 0 },
    { from: 's', text: '欢迎！王先生是我三年的老客户了。既然是他介绍的，我先不推产品，先了解您的情况：目前资产大概怎么分布的，有没有海外账户？', gapMin: 5 },
    { from: 'c', text: '还没有海外账户，都在国内银行理财', gapMin: 60 },
    { from: 's', text: '那第一步是开户，我让客户服务同事把材料清单发您，一般三个工作日办完。开好户我们再聊配置。', gapMin: 4 },
    { from: 'c', text: '好的，我这边资料齐了', gapMin: 1500 },
  ],
  just_registered: [],
  active_investor: [
    { from: 'c', text: '今天的策略我看了，黄金那部分是不是该加一点？', gapMin: 0 },
    { from: 's', text: '您现在黄金占 8%，研究部的建议区间是 5% 到 12%。可以加到 10%，从美元货币基金里转，不动其他仓位。您确认我就下单。', gapMin: 6 },
    { from: 'c', text: '确认，加到 10%', gapMin: 12 },
    { from: 's', text: '已提交，明天成交后我发您确认。', gapMin: 3 },
    { from: 'c', text: '好', gapMin: 2 },
    { from: 's', text: '成交了，黄金 ETF 占比 10.1%，货币基金相应减少。', gapMin: 1400 },
  ],
}

const PLANS: CustomerPlan[] = [
  // 直播间组（林晓明主归属）
  { inviteGroupId: 'ig_live', inviteLinkId: 'il_douyin', daysAgo: 0.1, scenario: 'just_registered' },
  { inviteGroupId: 'ig_live', inviteLinkId: 'il_douyin', daysAgo: 1, scenario: 'onboarding_pending' },
  { inviteGroupId: 'ig_live', inviteLinkId: 'il_douyin', daysAgo: 2, scenario: 'us_market_question' },
  { inviteGroupId: 'ig_live', inviteLinkId: 'il_douyin', daysAgo: 3, scenario: 'risk_survey_done' },
  { inviteGroupId: 'ig_live', inviteLinkId: 'il_douyin', daysAgo: 5, scenario: 'onboarding_pending' },
  { inviteGroupId: 'ig_live', inviteLinkId: 'il_douyin', daysAgo: 6, scenario: 'complaint_refund' },
  { inviteGroupId: 'ig_live', inviteLinkId: 'il_douyin', daysAgo: 8, scenario: 'deposit_arrival' },
  { inviteGroupId: 'ig_live', inviteLinkId: 'il_douyin', daysAgo: 9, scenario: 'us_market_question' },
  { inviteGroupId: 'ig_live', daysAgo: 12, scenario: 'active_investor' },
  { inviteGroupId: 'ig_live', daysAgo: 15, scenario: 'renewal' },
  { inviteGroupId: 'ig_live', daysAgo: 20, scenario: 'quiet_long' },
  { inviteGroupId: 'ig_live', daysAgo: 24, scenario: 'quiet_long' },
  { inviteGroupId: 'ig_live', daysAgo: 30, scenario: 'active_investor' },
  { inviteGroupId: 'ig_live', daysAgo: 38, scenario: 'quiet_long' },
  { inviteGroupId: 'ig_live', daysAgo: 45, scenario: 'deposit_arrival' },
  { inviteGroupId: 'ig_live', daysAgo: 55, scenario: 'renewal' },
  // 林晓明专属码
  { inviteGroupId: 'ig_lin', inviteLinkId: 'il_referral', daysAgo: 4, scenario: 'referral_intro' },
  { inviteGroupId: 'ig_lin', inviteLinkId: 'il_referral', daysAgo: 11, scenario: 'referral_intro' },
  { inviteGroupId: 'ig_lin', inviteLinkId: 'il_referral', daysAgo: 18, scenario: 'active_investor' },
  { inviteGroupId: 'ig_lin', daysAgo: 26, scenario: 'quiet_long' },
  { inviteGroupId: 'ig_lin', daysAgo: 33, scenario: 'risk_survey_done' },
  { inviteGroupId: 'ig_lin', daysAgo: 41, scenario: 'active_investor' },
  // 默认组（陈二宝主归属）
  { inviteGroupId: 'ig_default', inviteLinkId: 'il_xhs', daysAgo: 0.3, scenario: 'just_registered' },
  { inviteGroupId: 'ig_default', inviteLinkId: 'il_xhs', daysAgo: 1, scenario: 'onboarding_pending' },
  { inviteGroupId: 'ig_default', inviteLinkId: 'il_xhs', daysAgo: 2, scenario: 'deposit_arrival' },
  { inviteGroupId: 'ig_default', inviteLinkId: 'il_xhs', daysAgo: 3, scenario: 'us_market_question' },
  { inviteGroupId: 'ig_default', inviteLinkId: 'il_xhs', daysAgo: 4, scenario: 'risk_survey_done' },
  { inviteGroupId: 'ig_default', daysAgo: 6, scenario: 'complaint_refund' },
  { inviteGroupId: 'ig_default', daysAgo: 7, scenario: 'onboarding_pending' },
  { inviteGroupId: 'ig_default', daysAgo: 10, scenario: 'active_investor' },
  { inviteGroupId: 'ig_default', daysAgo: 13, scenario: 'renewal' },
  { inviteGroupId: 'ig_default', daysAgo: 17, scenario: 'quiet_long' },
  { inviteGroupId: 'ig_default', daysAgo: 22, scenario: 'quiet_long' },
  { inviteGroupId: 'ig_default', daysAgo: 28, scenario: 'active_investor' },
  { inviteGroupId: 'ig_default', inviteLinkId: 'il_old', daysAgo: 36, scenario: 'deposit_arrival' },
  { inviteGroupId: 'ig_default', inviteLinkId: 'il_old', daysAgo: 42, scenario: 'quiet_long' },
  { inviteGroupId: 'ig_default', inviteLinkId: 'il_old', daysAgo: 48, scenario: 'renewal' },
  { inviteGroupId: 'ig_default', inviteLinkId: 'il_old', daysAgo: 52, scenario: 'active_investor' },
  { inviteGroupId: 'ig_default', daysAgo: 58, scenario: 'quiet_long' },
  { inviteGroupId: 'ig_default', daysAgo: 62, scenario: 'risk_survey_done' },
]

const NOTICE_TEXTS = [
  '【合规提示】近期有不法分子冒充服务专员私下收款。恒信财富所有资金往来均通过您本人名下的托管账户，服务专员不会以任何理由要求您向个人账户转账。',
  '【系统通知】9 月 20 日 02:00 至 04:00（香港时间）进行系统维护，期间账户查询可能短暂不可用，交易不受影响。',
  '【策略会通知】10 月 12 日"四季度全球配置展望"线下策略会开放报名，私享会员优先。详情请咨询您的服务专员。',
]

/** 某坐席在某时刻由谁实操：按交接记录反推，保证种子数据与审计口径一致 */
function opAt(seatId: string, atMs: number): string | undefined {
  const at = iso(atMs)
  const hos = HANDOVERS.filter((h) => h.seatId === seatId).sort((a, b) => a.at.localeCompare(b.at))
  const before = hos.filter((h) => h.at <= at)
  if (before.length) return before[before.length - 1].toStaffId
  const after = hos.filter((h) => h.at > at)
  if (after.length) return after[0].fromStaffId ?? undefined
  return SEATS.find((x) => x.id === seatId)?.operatorStaffId ?? undefined
}

function renderWelcome(tpl: string, nickname: string, seatName: string): string {
  return tpl.replace('{{customer.nickname}}', nickname).replace('{{seat.name}}', seatName)
}

function buildCustomers() {
  const customers: Customer[] = []
  const customerSeats: CustomerSeat[] = []
  const conversations: Conversation[] = []
  const messages: Message[] = []
  const titleAssignments: TitleAssignment[] = []
  const usedNames = new Set<string>()

  const seatById = Object.fromEntries(SEATS.map((s) => [s.id, s]))
  const groupById = Object.fromEntries(INVITE_GROUPS.map((g) => [g.id, g]))
  // 历史客户也按轮询分：种子数据跟线上注册走同一套 allocateSeats
  const rotationAt: Record<string, number> = {}

  PLANS.forEach((plan, idx) => {
    let nickname = ''
    do {
      nickname = chance(0.25) ? `${pick(ENGLISH)} ${pick(SURNAMES)}` : `${pick(SURNAMES)}${chance(0.5) ? '先生' : '女士'}`
    } while (usedNames.has(nickname) || nickname === '张先生') // 「张先生」留给演示流程注册用
    usedNames.add(nickname)

    const registeredMs = agoMs(plan.daysAgo, between(0, 10), between(0, 59))
    const group = groupById[plan.inviteGroupId]
    const alloc = allocateSeats({ ...group, rotationIndex: rotationAt[group.id] ?? 0 }, seatById)
    rotationAt[group.id] = alloc.rotationIndex
    const c: Customer = {
      id: sid('cus'),
      nickname,
      accountId: `HX${String(88000 + idx * 7).padStart(6, '0')}`,
      phone: chance(0.8) ? `+852 ${between(5000, 9999)} ${between(1000, 9999)}` : undefined,
      registeredAt: iso(registeredMs),
      lastActiveAt: iso(registeredMs),
      device: pick(DEVICES),
      inviteGroupId: plan.inviteGroupId,
      inviteLinkId: plan.inviteLinkId,
      tagIds: [],
      titleIds: [],
      primaryTitleId: null,
      note: '',
      purchases: [],
      referrerId: null,
      inviteCount: 0,
      teamCount: 0,
      roleLabel: undefined,
      blockedSeatIds: [],
    }

    // 场景决定内部标签、头衔、购买
    const s = plan.scenario
    if (s === 'active_investor' || s === 'deposit_arrival' || s === 'renewal') {
      c.tagIds.push('tag_funded')
      c.purchases.push({ product: pick(PRODUCTS), amount: between(5, 60) * 10000, at: iso(registeredMs + 86400000 * between(1, 5)) })
      if (chance(0.5)) c.purchases.push({ product: pick(PRODUCTS), amount: between(2, 30) * 10000, at: iso(registeredMs + 86400000 * between(6, 20)) })
    }
    if (s === 'renewal' || (s === 'active_investor' && chance(0.6))) {
      c.titleIds.push('t_vip')
      c.primaryTitleId = 't_vip'
      c.tagIds.push('tag_hnw')
    }
    if (s === 'risk_survey_done' || s === 'active_investor') c.tagIds.push(chance(0.5) ? 'tag_aggr' : 'tag_cons')
    // 头衔是对外身份：带人的客户挂「认证推荐人」，其中团队大的挂「认证团队长」
    if (s === 'referral_intro' || (s === 'active_investor' && chance(0.3))) {
      c.inviteCount = between(10, 40)
      c.teamCount = c.inviteCount + between(0, 60)
      const title = c.teamCount >= 30 ? 't_leader' : 't_referrer'
      c.titleIds.push(title)
      c.primaryTitleId ??= title
    }
    if (plan.daysAgo <= 30) c.tagIds.push('tag_new')
    if (s === 'onboarding_pending' || s === 'quiet_long') c.tagIds.push('tag_watch')
    if (s === 'complaint_refund') {
      c.tagIds.push('tag_refund', 'tag_funded')
      c.purchases.push({ product: '港股科技主题', amount: between(10, 40) * 10000, at: iso(registeredMs + 86400000 * 3) })
      c.note = '对回撤敏感，沟通时先讲事实再给选项，不催单。'
    }
    if (s === 'referral_intro') {
      c.referrerId = 'REF'
      c.tagIds.push('tag_callback')
    }
    if (s === 'renewal') c.note = '会员到期前两周提醒；偏好电话沟通，工作日 19 点后。'
    if (c.purchases.length > 1 && !c.inviteCount) {
      c.inviteCount = between(0, 4)
      c.teamCount = c.inviteCount + between(0, 6)
      if (c.inviteCount >= 3) c.roleLabel = '推荐大使'
    }
    // 给几个客户种上管控状态：状态列与筛选空着演示不了，
    // 而"封禁 / 群聊禁言 / 全部禁言 / 待首次改密"本来就是任何一个跑了半年的企业都有几个的常态
    if (s === 'complaint_refund') c.bannedAt = iso(registeredMs + 86400000 * 12)
    if (s === 'quiet_long' && idx % 7 === 3) c.mutedAllUntil = iso(Date.now() + 86400000 * 2)
    if (s === 'quiet_long' && idx % 7 === 4) c.globalMutedUntil = iso(Date.now() + 86400000 * 2)
    if (s === 'quiet_long' && idx % 7 === 5) {
      c.mutedAllUntil = iso(Date.now() + 86400000 * 2)
      c.globalMutedUntil = iso(Date.now() + 86400000 * 2)
    }
    if (s === 'onboarding_pending' && idx % 5 === 1) c.mustChangePassword = true
    // 影子模式只种一个：这是个重手段，满屏紫色标记会让人以为它是日常操作
    if (s === 'quiet_long' && idx % 11 === 5) {
      c.shadowModeAt = iso(Date.now() - 86400000 * 3)
      c.shadowModeReason = '连续三天在群里发第三方理财链接，已确认是引流号'
    }
    // 最近两天注册的当新号看：观察期与「系统发的默认昵称」不种上，
    // 状态列的「新号观察期」和软引导在演示数据里就永远是空的
    if (plan.daysAgo <= 2) {
      c.deviceId = `dev_seed_${idx}`
      c.watchUntil = watchUntilOf(iso(registeredMs), ENTERPRISE.newAccountWatchHours)
      if (idx % 3 === 0) c.nicknameAuto = true
    }

    c.titleIds.forEach((tid) => {
      titleAssignments.push({ id: sid('ta'), customerId: c.id, titleId: tid, action: 'assign', byStaffId: alloc.primarySeatId === 'seat_lin' ? 'st_lin' : 'st_chen', at: iso(registeredMs + 3600000 * between(2, 48)) })
    })

    customers.push(c)

    // 固定坐席全加，轮询坐席按轮询分到一位
    let lastActivity = registeredMs
    alloc.seatIds.forEach((seatId, order) => {
      const seat = seatById[seatId]
      customerSeats.push({ customerId: c.id, seatId, primary: seatId === alloc.primarySeatId, addedAt: iso(registeredMs), source: 'register' })
      const conv: Conversation = { id: sid('conv'), kind: 'dm', customerId: c.id, seatId, lastMessageAt: iso(registeredMs) }
      conversations.push(conv)
      if (seat.welcome.trim()) {
        const welcomeAt = registeredMs + 1000 * (order + 1)
        messages.push({
          id: sid('msg'),
          convId: conv.id,
          senderKind: 'seat',
          senderId: seatId,
          seatId,
          operatorId: opAt(seatId, welcomeAt),
          kind: 'text',
          text: renderWelcome(seat.welcome, c.nickname, seat.displayName),
          at: iso(welcomeAt),
          isWelcome: true,
        })
        conv.lastMessageAt = iso(welcomeAt)
      }

      if (seatId !== alloc.primarySeatId) {
        // 非主归属坐席：偶尔有一两句
        if (seatId === 'seat_cs' && chance(0.5)) {
          const at1 = registeredMs + 3600000 * between(2, 30)
          messages.push({ id: sid('msg'), convId: conv.id, senderKind: 'customer', senderId: c.id, kind: 'text', text: '开户资料我上传了，帮忙看下有没有问题', at: iso(at1) })
          messages.push({ id: sid('msg'), convId: conv.id, senderKind: 'seat', senderId: seatId, seatId, operatorId: opAt(seatId, at1 + 600000), kind: 'text', text: '收到，资料齐全，已提交审核，一般一个工作日出结果，通过后我在这里通知您。', at: iso(at1 + 600000) })
          conv.lastMessageAt = iso(at1 + 600000)
          lastActivity = Math.max(lastActivity, at1 + 600000)
        }
        return
      }

      // 主归属坐席：跑场景脚本
      const script = SCENARIOS[plan.scenario]
      let t = registeredMs + 3600000 * between(1, 6)
      // 以客户发言结尾的脚本（会落在"待我回复"）整体挪到最近 36 小时内，
      // 否则老客户会出现"等了 50 天没人回"这种不真实的状态
      const endsWithCustomer = script.length > 0 && script[script.length - 1].from === 'c'
      if (endsWithCustomer) {
        const total = script.reduce((a, l) => a + l.gapMin, 0) * 60000
        const wantedStart = Date.now() - total - 60000 * between(20, 36 * 60)
        t = Math.max(t, wantedStart)
      }
      script.forEach((line) => {
        t += line.gapMin * 60000
        if (t > Date.now() - 60000) t = Date.now() - 60000 * between(3, 90)
        const isC = line.from === 'c'
        messages.push({
          id: sid('msg'),
          convId: conv.id,
          senderKind: isC ? 'customer' : 'seat',
          senderId: isC ? c.id : seatId,
          seatId: isC ? undefined : seatId,
          operatorId: isC ? undefined : opAt(seatId, t),
          kind: line.kind ?? 'text',
          text: line.text,
          media: line.media,
          at: iso(t),
        })
        conv.lastMessageAt = iso(t)
        lastActivity = Math.max(lastActivity, t)
      })
    })

    c.lastActiveAt = iso(Math.max(lastActivity, registeredMs))
  })

  // 修正：转介绍客户的推荐人指向一个老客户
  const oldOnes = customers.filter((c) => c.purchases.length > 0 && c.inviteGroupId !== 'ig_lin')
  customers.forEach((c) => {
    if (c.referrerId === 'REF') {
      const ref = pick(oldOnes)
      c.referrerId = ref.id
      ref.inviteCount += 1
      ref.teamCount += 1
    }
  })

  return { customers, customerSeats, conversations, messages, titleAssignments, rotationAt }
}

function buildGroupMessages(customers: Customer[], chatGroups: ChatGroup[]) {
  const conversations: Conversation[] = []
  const messages: Message[] = []

  // 成员：所有客户进社群与官方通知频道；私享会员进 VIP 群
  const community = chatGroups.find((g) => g.id === 'cg_community')!
  const strategy = chatGroups.find((g) => g.id === 'cg_strategy')!
  const vip = chatGroups.find((g) => g.id === 'cg_vip')!
  community.memberCustomerIds = customers.map((c) => c.id)
  strategy.memberCustomerIds = customers.map((c) => c.id)
  vip.memberCustomerIds = customers.filter((c) => c.titleIds.includes('t_vip')).map((c) => c.id)
  for (const group of [community, strategy, vip]) {
    group.customerJoinedAt = Object.fromEntries(group.memberCustomerIds.map((customerId) => [customerId, group.createdAt]))
  }

  // 频道：承接原私聊通知的历史消息
  const convStrategy: Conversation = { id: sid('conv'), kind: 'channel', chatGroupId: strategy.id, lastMessageAt: ago(30) }
  NOTICE_TEXTS.forEach((t, i) => {
    const at = agoMs(4 - i, 14 - i)
    messages.push({ id: sid('msg'), convId: convStrategy.id, senderKind: 'seat', senderId: 'seat_cs', seatId: 'seat_cs', operatorId: 'st_chen', kind: 'text', text: t, at: iso(at) })
    convStrategy.lastMessageAt = iso(at)
  })
  conversations.push(convStrategy)

  // 社群：客户闲聊 + @林晓明
  const convCommunity: Conversation = { id: sid('conv'), kind: 'group', chatGroupId: community.id, lastMessageAt: ago(1) }
  const members = customers.slice(0, 12)
  const CHAT = [
    { c: 0, text: '今天美元又涨了，换汇的朋友注意一下' },
    { c: 1, text: '请问黄金 ETF 现在还适合进吗' },
    { s: 'seat_chen', text: '黄金建议看研究部给的区间，5% 到 12%，在区间内按纪律配，不看单日价格。' },
    { c: 2, text: '@林晓明 上次说的四季度策略会什么时候报名' },
    { s: 'seat_lin', text: '10 月 12 日，私享会员优先，报名链接稍后我私发大家。' },
    { c: 3, text: '收到' },
    { c: 4, text: '@林晓明 我的组合今天怎么没更新净值' },
    { c: 5, text: '同问，我的也没更新' },
    { s: 'seat_cs', text: '净值更新有延迟，托管行数据要到晚上 8 点后才推送，各位稍后刷新即可。' },
    { c: 6, text: '好的谢谢' },
    { c: 7, text: '@林晓明 想约个时间聊聊美元短债，明天下午方便吗' },
  ]
  let t = agoMs(1, 6)
  CHAT.forEach((line) => {
    t += 60000 * between(3, 40)
    if ('s' in line && line.s) {
      const seat = SEATS.find((x) => x.id === line.s)!
      messages.push({ id: sid('msg'), convId: convCommunity.id, senderKind: 'seat', senderId: seat.id, seatId: seat.id, operatorId: seat.operatorStaffId, kind: 'text', text: line.text, at: iso(t) })
    } else if ('c' in line && typeof line.c === 'number') {
      const cus = members[line.c % members.length]
      const mentions = line.text.includes('@林晓明') ? ['seat_lin'] : undefined
      messages.push({ id: sid('msg'), convId: convCommunity.id, senderKind: 'customer', senderId: cus.id, kind: 'text', text: line.text, at: iso(t), mentionSeatIds: mentions })
    }
    convCommunity.lastMessageAt = iso(t)
  })
  // 置顶：策略会报名那条
  const pinned = messages.find((m) => m.convId === convCommunity.id && m.text.startsWith('10 月 12 日'))
  if (pinned) community.pinnedMessageIds = [pinned.id]
  conversations.push(convCommunity)

  // VIP 群：安静一点
  const convVip: Conversation = { id: sid('conv'), kind: 'group', chatGroupId: vip.id, lastMessageAt: ago(3) }
  const vipMembers = customers.filter((c) => vip.memberCustomerIds.includes(c.id))
  const t2 = agoMs(3, 2)
  messages.push({ id: sid('msg'), convId: convVip.id, senderKind: 'seat', senderId: 'seat_lin', seatId: 'seat_lin', operatorId: 'st_lin', kind: 'text', text: '各位好，三季度组合复盘报告已经放到 App 的"我的文件"里，本周五晚 8 点线上讲一遍，有问题当场答。', at: iso(t2) })
  if (vipMembers[0]) messages.push({ id: sid('msg'), convId: convVip.id, senderKind: 'customer', senderId: vipMembers[0].id, kind: 'text', text: '收到，周五见', at: iso(t2 + 900000) })
  convVip.lastMessageAt = iso(t2 + 900000)
  conversations.push(convVip)

  return { conversations, messages }
}

// ---------- 其他 ----------


function buildBroadcasts(): Broadcast[] {
  return [
    { id: sid('bc'), name: '本周市场观点', seatId: 'seat_lin', operatorId: 'st_lin', targetKind: 'title', targetDesc: '头衔 = 私享会员', contentKind: 'text', status: 'done', skippedCount: 1, text: '各位会员好，本周观点已整理：美元短端仍有吸引力，港股科技反弹属修复，黄金维持区间配置。周五晚 8 点线上复盘，欢迎参加。', sentAt: ago(2, 3), sentCount: 9, readCount: 7 },
    { id: sid('bc'), name: '策略会报名', seatId: 'seat_lin', operatorId: 'st_lin', targetKind: 'mine', targetDesc: '我的客户', contentKind: 'text', status: 'done', skippedCount: 3, text: '10 月 12 日"四季度全球配置展望"线下策略会开放报名，回复"报名"我帮您登记。', sentAt: ago(5, 1), sentCount: 22, readCount: 15 },
    { id: sid('bc'), name: '开户资料提醒', seatId: 'seat_cs', operatorId: 'st_chen', targetKind: 'tag', targetDesc: '内部标签 = 观望中', contentKind: 'text', status: 'done', skippedCount: 0, text: '您的开户流程还差资料上传这一步，需要帮助的话在这里回复我即可。', sentAt: ago(9, 4), sentCount: 8, readCount: 5 },
  ]
}

function buildAudit(): AuditEvent[] {
  const list: AuditEvent[] = [
    { id: sid('au'), at: ago(45), actorStaffId: 'st_admin', type: 'seat.handover', detail: '坐席「客户服务」由 赵磊 交接给 陈默；原因：赵磊转任运营主管' },
    { id: sid('au'), at: ago(40), actorStaffId: 'st_admin', type: 'invite_group.create', detail: '创建邀请组「林晓明专属码」，轮询坐席：林晓明；固定坐席：无' },
    { id: sid('au'), at: ago(35), actorStaffId: 'st_lin', type: 'invite_link.create', detail: '在「林晓明专属码」下创建邀请链接「林薇 · 老客户转介绍」' },
    { id: sid('au'), at: ago(30), actorStaffId: 'st_zhao', type: 'invite_link.create', detail: '在「默认组」下创建邀请链接「小红书投放」' },
    { id: sid('au'), at: ago(20), actorStaffId: 'st_admin', type: 'title.library', detail: '头衔库新增「官方讲师」' },
    { id: sid('au'), at: ago(14), actorStaffId: 'st_lin', type: 'invite_link.create', detail: '在「直播间组」下创建邀请链接「抖音直播 · 9 月」' },
    { id: sid('au'), at: ago(9, 4), actorStaffId: 'st_chen', type: 'broadcast.send', detail: '以「客户服务」身份群发「开户资料提醒」，目标：内部标签 = 观望中，8 人' },
    { id: sid('au'), at: ago(5, 1), actorStaffId: 'st_lin', type: 'broadcast.send', detail: '以「林晓明」身份群发「策略会报名」，目标：我的客户，22 人' },
    { id: sid('au'), at: ago(3), actorStaffId: 'st_admin', type: 'policy.update', detail: '应用策略预设「客服预设」' },
    { id: sid('au'), at: ago(2), actorStaffId: 'st_admin', type: 'staff.create', detail: '创建员工 王芳（角色：坐席），未创建同名坐席' },
    { id: sid('au'), at: ago(2, 3), actorStaffId: 'st_lin', type: 'broadcast.send', detail: '以「林晓明」身份群发「本周市场观点」，目标：头衔 = 私享会员，9 人' },
    { id: sid('au'), at: ago(0, 5), actorStaffId: 'st_zhao', type: 'login', detail: '登录工作台' },
    { id: sid('au'), at: ago(0, 2), actorStaffId: 'st_chen', type: 'login', detail: '登录工作台' },
    { id: sid('au'), at: ago(0, 1), actorStaffId: 'st_admin', type: 'login', detail: '登录管理后台' },
    { id: sid('au'), at: ago(0, 0, 25), actorStaffId: 'st_lin', type: 'login', detail: '登录工作台' },
  ]
  const ips = ['10.0.8.21', '10.0.8.35', '192.0.2.190', '198.51.100.8']
  return list.map((e, i) => ({ ...e, ip: ips[i % ips.length] }))
}

/** 生成整份演示状态 */
export function buildSeed(): DemoState {
  seq = 0
  rand = mulberry32(SEED)
  const chatGroups = CHAT_GROUPS.map((g) => ({ ...g, memberCustomerIds: [...g.memberCustomerIds], customerJoinedAt: { ...g.customerJoinedAt }, pinnedMessageIds: [...g.pinnedMessageIds], restrictions: [...g.restrictions] }))
  const c = buildCustomers()
  const g = buildGroupMessages(c.customers, chatGroups)
  const conversations = [...c.conversations, ...g.conversations]
  const messages = [...c.messages, ...g.messages].sort((a, b) => a.at.localeCompare(b.at))
  // 种子消息自带成员快照，之后加群的人不进入这些旧消息的未读名单。
  for (const message of messages) {
    const conv = conversations.find((x) => x.id === message.convId)
    const group = chatGroups.find((x) => x.id === conv?.chatGroupId)
    if (group) {
      message.receiptMemberSeatIds = [...group.memberSeatIds]
      message.receiptMemberCustomerIds = [...group.memberCustomerIds]
    }
  }
  return {
    enterprise: ENTERPRISE,
    roles: ROLES,
    staff: STAFF,
    seats: SEATS,
    handovers: HANDOVERS,
    customers: c.customers,
    customerSeats: c.customerSeats,
    // 游标接着历史客户往下走：演示里注册的下一位继续排队，不会从队首重来
    inviteGroups: INVITE_GROUPS.map((x) => ({ ...x, rotationIndex: c.rotationAt[x.id] ?? 0 })),
    inviteLinks: INVITE_LINKS,
    titles: TITLES,
    tags: TAGS,
    titleAssignments: c.titleAssignments,
    chatGroups,
    conversations,
    messages,
    audit: buildAudit(),
    broadcasts: buildBroadcasts(),
    quickReplyCategories: QUICK_REPLY_CATEGORIES,
    quickReplies: QUICK_REPLIES,
    ...buildAdminSeed({ customers: c.customers, conversations, messages }),
    groupLogs: buildGroupLogs(),
    session: { adminStaffId: 'st_admin', workbenchStaffId: 'st_lin', workbenchSeatId: 'seat_lin', phoneCustomerId: null },
    seededAt: iso(Date.now()),
  }
}
