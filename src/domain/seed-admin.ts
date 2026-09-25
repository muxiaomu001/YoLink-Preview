/**
 * 管理后台完整版的种子数据：策略矩阵与数值、举报、敏感词、安全日志、钱包、签到、
 * 推荐奖励、横幅公告、客户画像同步、日报、插件与开放 API、系统。
 * 与 seed.ts 分开放，避免单文件过长。所有数据均为虚构。
 */
import type {
  Announcement,
  ApiKey,
  AppVersion,
  AutomationRule,
  Backup,
  Banner,
  CheckinRecord,
  CheckinRules,
  Conversation,
  CustomField,
  Customer,
  DailyReportRecord,
  DailyReportSettings,
  DailyStat,
  HealthStatus,
  License,
  Message,
  PayoutField,
  Plugin,
  PolicyChange,
  PolicyCol,
  PolicyItem,
  PolicyMatrix,
  PolicyNumbers,
  PolicyOverride,
  PolicyPreset,
  ProviderInstance,
  ProviderLicenseAction,
  ProfileSyncSettings,
  ReferralAnomaly,
  ReferralRules,
  Report,
  SecurityEvent,
  SensitiveHit,
  SensitiveWord,
  SyncRecord,
  WalletSettings,
  WalletTx,
  Webhook,
  WebhookLog,
  Withdrawal,
} from './types'
import { ago, agoMs, iso } from './time'

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

let rand = mulberry32(20260916)
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1))
const chance = (p: number) => rand() < p

let seq = 0
const aid = (p: string) => {
  seq += 1
  return `${p}_${String(seq).padStart(4, '0')}`
}

const DAY = 86400000
const dateStr = (ms: number) => iso(ms).slice(0, 10)

// ---------- 策略 ----------

/** 能力目录：03 文档全量。desc 给矩阵页做说明列；module 为模块能力键。 */
export const POLICY_ITEMS: PolicyItem[] = [
  // 关系链
  { key: 'friend.add', label: '主动添加好友', group: '关系链', desc: '主动发起好友申请', level: 'P0' },
  { key: 'friend.accept', label: '接受好友申请', group: '关系链', desc: '收到申请后能否同意', level: 'P0' },
  { key: 'friend.search_user', label: '搜索用户', group: '关系链', desc: '按昵称或账号 ID 搜其他用户', level: 'P0' },
  { key: 'friend.view_profile', label: '查看非好友资料', group: '关系链', desc: '点开陌生人的资料页', level: 'P0' },
  { key: 'friend.block', label: '拉黑', group: '关系链', desc: '把某个用户或坐席拉黑', level: 'P0' },
  // 私聊
  { key: 'dm.create_with_friend', label: '与好友发起私聊', group: '私聊', desc: '客服预设下客户的好友只有官方坐席', level: 'P0' },
  { key: 'dm.create_with_stranger', label: '与非好友发起私聊', group: '私聊', desc: '不加好友直接私聊', level: 'P0' },
  { key: 'dm.send_media', label: '私聊发送媒体', group: '私聊', desc: '图片、视频、语音', level: 'P0' },
  { key: 'dm.recall', label: '为所有人删除自己发出的消息', group: '私聊', desc: '两端普通聊天里直接消失、不留占位，原文保留审计；时限见数值型策略', level: 'P0' },
  { key: 'dm.edit', label: '编辑自己的消息', group: '私聊', desc: '时限见数值型策略', level: 'P0' },
  { key: 'dm.forward', label: '转发私聊消息', group: '私聊', desc: '转发到其他会话', level: 'P0' },
  // 群与频道
  { key: 'group.create', label: '创建群', group: '群与频道', desc: '自己建群并成为群主', level: 'P0' },
  { key: 'channel.create', label: '创建频道', group: '群与频道', desc: '自己建频道并成为频道主', level: 'P0' },
  { key: 'group.join_by_link', label: '通过链接入群', group: '群与频道', desc: '点群邀请链接加入', level: 'P0' },
  { key: 'group.invite', label: '拉人入群', group: '群与频道', desc: '把自己的好友拉进群', level: 'P0' },
  { key: 'group.view_members', label: '查看群成员列表', group: '群与频道', desc: '关闭后客户看不到群里有谁', level: 'P0' },
  { key: 'group.view_member_profile', label: '点看群成员资料', group: '群与频道', desc: '点群里的人看资料', level: 'P0' },
  { key: 'group.send', label: '群内发言', group: '群与频道', desc: '发文本；全员禁言时另算', level: 'P0' },
  { key: 'group.send_media', label: '群内发送媒体', group: '群与频道', desc: '图片、视频、语音', level: 'P0' },
  { key: 'group.mention_all', label: '@ 所有人', group: '群与频道', desc: '一次提醒全群', level: 'P0' },
  { key: 'group.leave', label: '主动退群', group: '群与频道', desc: '官方群会强制关闭这一项', level: 'P0' },
  { key: 'group.forward', label: '转发群消息', group: '群与频道', desc: '把群消息转到别处', level: 'P0' },
  { key: 'channel.join_by_link', label: '通过链接加入频道', group: '群与频道', desc: '点频道链接订阅', level: 'P0' },
  { key: 'channel.leave', label: '退出频道', group: '群与频道', desc: '取消订阅频道', level: 'P0' },
  // 账号与设备
  { key: 'account.edit_profile', label: '修改昵称与头像', group: '账号与设备', desc: '头衔不在此列，客户改不了', level: 'P0' },
  { key: 'account.delete', label: '注销账号', group: '账号与设备', desc: '客户自助注销', level: 'P1' },
  // 工作台
  { key: 'tag.create', label: '工作台新建内部标签', group: '工作台', desc: '员工在资料卡直接新建标签', level: 'P0', staffOnly: true },
  // 模块能力键：模块停用或未授权时整体不生效
  { key: 'wallet.view', label: '查看钱包', group: '模块 · 钱包', desc: '客户 App 显示钱包入口', level: 'P2', module: 'wallet' },
  { key: 'wallet.withdraw', label: '申请提现', group: '模块 · 钱包', desc: '发起提现申请', level: 'P2', module: 'wallet' },
  { key: 'wallet.bind_account', label: '绑定收款账户', group: '模块 · 钱包', desc: '填写收款信息', level: 'P2', module: 'wallet' },
  { key: 'checkin.sign', label: '每日签到', group: '模块 · 签到', desc: '客户 App 显示签到入口', level: 'P2', module: 'checkin' },
  { key: 'referral.invite', label: '邀请好友得奖励', group: '模块 · 推荐', desc: '客户 App 显示邀请入口', level: 'P2', module: 'referral' },
  { key: 'appearance.change_theme', label: '切换主题', group: '模块 · 外观', desc: '在企业允许的主题里选', level: 'P0' },
  { key: 'appearance.dark_mode', label: '暗色模式', group: '模块 · 外观', desc: '明暗切换', level: 'P0' },
]

/** 客服预设下客户关闭的键：其余默认开 */
const CS_CUSTOMER_OFF = [
  'dm.recall',
  'friend.add',
  'friend.accept',
  'friend.search_user',
  'friend.view_profile',
  'dm.create_with_stranger',
  'dm.forward',
  'group.create',
  'channel.create',
  'group.invite',
  'group.view_members',
  'group.view_member_profile',
  'group.mention_all',
  'group.forward',
  'account.delete',
  'tag.create',
]

export const POLICY_COLS: { key: PolicyCol; label: string; hint: string }[] = [
  { key: 'customer', label: '客户', hint: '客户只用手机 App' },
  { key: 'staff', label: '坐席', hint: '坐席只用桌面工作台' },
]

/** 用"客户是否允许"生成整张矩阵：坐席列全开 */
function matrixFrom(customerAllowed: Record<string, boolean>): PolicyMatrix {
  const m: PolicyMatrix = {}
  POLICY_ITEMS.forEach((p) => {
    const c = p.staffOnly ? false : (customerAllowed[p.key] ?? true)
    m[p.key] = { customer: c, staff: true }
  })
  return m
}

export const POLICY_PRESETS: PolicyPreset[] = [
  {
    id: 'preset_cs',
    name: '客服预设',
    desc: '客户不能加好友、不能搜索、不能互聊、看不到群成员、不能建群建频道、不能 @ 所有人；只与官方坐席往来。坐席全部开放。',
    builtin: true,
    matrix: matrixFrom(Object.fromEntries(CS_CUSTOMER_OFF.map((k) => [k, false]))),
  },
  {
    id: 'preset_social',
    name: '社交预设',
    desc: '所有角色开放全部社交能力，数值取主流社交 IM 默认值。',
    builtin: true,
    matrix: matrixFrom({}),
  },
]

export const POLICY_NUMBERS: PolicyNumbers = {
  seatRecallSeconds: 120,
  seatEditSeconds: 900,
  customerRecallSeconds: 120,
  customerEditSeconds: 900,
  recallSeconds: 120,
  editSeconds: 900,
  groupMaxMembers: 10000,
  slowModeSeconds: 0,
  retentionDays: 0,
  fileMaxMb: 20,
  imageMaxMb: 10,
  videoMaxMb: 100,
  voiceMaxSeconds: 60,
  maxDevices: 2,
  idleDays: 14,
}

export const POLICY_CHANGES: PolicyChange[] = [
  { id: 'pc_0001', at: ago(90), byStaffId: 'st_admin', kind: 'preset', detail: '应用预设「客服预设」' },
  { id: 'pc_0002', at: ago(60), byStaffId: 'st_admin', kind: 'number', detail: '「为所有人删除」时限 60 → 120 秒' },
  { id: 'pc_0003', at: ago(21), byStaffId: 'st_admin', kind: 'cap', detail: 'group.send_media 客户 · 手机：关 → 开' },
  { id: 'pc_0004', at: ago(3), byStaffId: 'st_admin', kind: 'preset', detail: '应用预设「客服预设」' },
]

// ---------- 钱包、签到、推荐（P2） ----------

export const WALLET_SETTINGS: WalletSettings = {
  currency: 'USD',
  unitName: '积分',
  rate: 1000,
  minWithdraw: 10000,
  maxPerWithdraw: 0,
  dailyWithdrawCount: 1,
  fee: '2%',
  reviewLevels: 2,
}

export const PAYOUT_FIELDS: PayoutField[] = [
  { id: 'pf_1', name: '银行名称', type: 'text', required: true },
  { id: 'pf_2', name: '户名', type: 'text', required: true },
  { id: 'pf_3', name: '账号', type: 'text', required: true },
  { id: 'pf_4', name: 'SWIFT', type: 'text', required: false },
]

export const CHECKIN_RULES: CheckinRules = {
  cycle: [10, 10, 20, 20, 30, 30, 50],
  startAt: ago(30),
  endAt: iso(agoMs(-60)),
  budget: 200000,
  perCustomerMax: 2000,
}

export const REFERRAL_RULES: ReferralRules = {
  timing: 'first_checkin',
  referrerReward: 500,
  newcomerReward: 200,
  dailyMax: 5,
  totalMax: 50,
}

// ---------- 横幅与公告 ----------

export const BANNERS: Banner[] = [
  { id: 'bn_1', title: '四季度全球配置展望 · 线下策略会报名', imageColor: '#1f3b73', action: 'link', url: 'https://hxwm.example/event/q4', order: 1, startAt: ago(10), endAt: iso(agoMs(-27)), audience: 'all', tagIds: [], impressions: 1840, clicks: 212 },
  { id: 'bn_2', title: '每日签到领积分', imageColor: '#b45309', action: 'checkin', order: 2, startAt: ago(30), endAt: iso(agoMs(-60)), audience: 'all', tagIds: [], impressions: 5120, clicks: 903 },
  { id: 'bn_3', title: '私享会员群 · 季度复盘直播', imageColor: '#7e22ce', action: 'group', chatGroupId: 'cg_vip', order: 3, startAt: ago(5), endAt: iso(agoMs(-2)), audience: 'tags', tagIds: ['tag_hnw'], impressions: 320, clicks: 88 },
  { id: 'bn_4', title: '8 月线下沙龙回顾', imageColor: '#0f766e', action: 'link', url: 'https://hxwm.example/event/aug', order: 4, startAt: ago(40), endAt: ago(12), audience: 'all', tagIds: [], impressions: 2210, clicks: 140 },
]

export const ANNOUNCEMENTS: Announcement[] = [
  { id: 'an_1', title: '系统维护通知', body: '9 月 20 日 02:00 至 04:00（香港时间）进行系统维护，期间账户查询可能短暂不可用，交易不受影响。', buttonText: '我知道了', buttonAction: 'close', kind: 'popup', startAt: ago(2), endAt: iso(agoMs(-5)), showMode: 'once', impressions: 612 },
  { id: 'an_2', title: '合规提示：谨防冒充顾问收款', body: '恒信财富所有资金往来均通过您本人名下的托管账户，顾问不会要求您向个人账户转账。', buttonText: '查看详情', buttonAction: 'link', url: 'https://hxwm.example/compliance', kind: 'bar', startAt: ago(20), endAt: iso(agoMs(-30)), showMode: 'every', impressions: 4380 },
]

// ---------- 客户画像 ----------

export const PROFILE_SYNC: ProfileSyncSettings = {
  apiKeyConfigured: true,
  apiKeyPrefix: 'hxp_7f3a',
  amountVisibleRoleIds: ['role_admin', 'role_lead'],
  scheduledPull: false,
  webhookUrl: '',
}

export const SYNC_RECORDS: SyncRecord[] = [
  { id: 'sr_1', at: ago(0, 3), kind: 'purchase', source: 'api', count: 6, failed: 0, unmatched: 1 },
  { id: 'sr_2', at: ago(1, 3), kind: 'purchase', source: 'api', count: 4, failed: 0, unmatched: 0 },
  { id: 'sr_3', at: ago(2, 3), kind: 'referral', source: 'api', count: 3, failed: 1, failReason: '推荐人手机号在客户库中不存在', unmatched: 1 },
  { id: 'sr_4', at: ago(7), kind: 'purchase', source: 'csv', count: 18, failed: 0, unmatched: 2 },
]

export const CUSTOM_FIELDS: CustomField[] = [
  { id: 'cf_risk', name: '风险等级', type: 'select', options: ['保守型', '稳健型', '平衡型', '进取型'] },
  { id: 'cf_open', name: '开户日期', type: 'date' },
  { id: 'cf_aum', name: '资产规模（万美元）', type: 'number' },
]

export const AUTOMATION_RULES: AutomationRule[] = [
  { id: 'ar_1', name: '推荐满 10 人挂「认证推荐人」', trigger: '推荐关系同步', condition: '直接邀请人数 ≥ 10', action: '挂头衔：认证推荐人', enabled: true, runs: 14, lastRunAt: ago(0, 3) },
  { id: 'ar_2', name: '30 天没聊过打「需回访」', trigger: '每日 10:00', condition: '最近消息距今 ≥ 30 天且已入金', action: '打内部标签：需回访', enabled: false, runs: 0, lastRunAt: null },
  { id: 'ar_3', name: '会员到期前两周提醒顾问', trigger: '每日 10:00', condition: '头衔 = 私享会员 且 到期日 ≤ 14 天', action: '给主归属坐席的实操员工发提醒', enabled: true, runs: 3, lastRunAt: ago(1, 2) },
]

// ---------- 日报 ----------

export const DAILY_REPORT: DailyReportSettings = {
  recipients: [
    { id: 'rr_1', name: '周敏', staffId: 'st_admin', channels: ['app', 'feishu'] },
    { id: 'rr_2', name: '李总（经营者）', channels: ['wecom'] },
  ],
  sendTime: '08:30',
  thresholds: { medianMinutes: 10, waitingOverMinutes: 60, idleDays: 14 },
}

function buildDailyReportRecords(): DailyReportRecord[] {
  const list: DailyReportRecord[] = []
  for (let d = 1; d <= 30; d += 1) {
    const ms = agoMs(d)
    const failed = d === 9
    list.push({
      id: aid('dr'),
      date: dateStr(ms),
      sentTo: failed ? ['周敏'] : ['周敏', '李总（经营者）'],
      status: failed ? 'failed' : 'sent',
      summary: failed ? '企微机器人 webhook 超时，已重试 3 次' : `客户 ${36 + between(-3, 3)} 位 · 7 日活跃 ${between(14, 24)} · 首响中位 ${between(3, 14)} 分钟`,
    })
  }
  return list
}

// ---------- 插件与开放 API（P1） ----------

export const PLUGINS: Plugin[] = [
  {
    id: 'pl_crm',
    name: 'CRM 同步',
    version: '1.2.0',
    desc: '把客户、内部标签与购买记录同步到企业 CRM',
    enabled: true,
    fields: [
      { key: 'crm_url', label: 'CRM 地址', type: 'text' },
      { key: 'token', label: 'API Token', type: 'secret' },
      { key: 'interval', label: '同步频率', type: 'select', options: ['5 分钟', '30 分钟', '每小时'] },
      { key: 'sync_tags', label: '同步内部标签', type: 'switch' },
    ],
    config: { crm_url: 'https://crm.hxwm.example/api', token: '', interval: '30 分钟', sync_tags: true },
  },
  {
    id: 'pl_sig',
    name: '合规签名',
    version: '0.9.1',
    desc: '坐席发出的每条消息自动附一行合规声明',
    enabled: false,
    fields: [
      { key: 'text', label: '声明文字', type: 'text' },
      { key: 'only_dm', label: '仅私聊附加', type: 'switch' },
    ],
    config: { text: '以上内容不构成投资建议，投资有风险。', only_dm: true },
  },
  {
    id: 'pl_translate',
    name: '消息翻译',
    version: '2.0.3',
    desc: '客户发英文时给坐席显示中文译文',
    enabled: true,
    fields: [
      { key: 'provider', label: '翻译服务', type: 'select', options: ['DeepL', 'Google', '内置'] },
      { key: 'key', label: '服务密钥', type: 'secret' },
    ],
    config: { provider: 'DeepL', key: '' },
  },
]

export const API_KEYS: ApiKey[] = [
  { id: 'ak_1', name: 'CRM 对接', prefix: 'yk_live_8a3f2c91', scopes: ['read_customers', 'write_customers', 'read_stats'], createdAt: ago(80), lastUsedAt: ago(0, 0, 12) },
  { id: 'ak_2', name: '数据仓库拉取', prefix: 'yk_live_4d7e1b02', scopes: ['read_customers', 'read_messages', 'read_stats'], createdAt: ago(35), lastUsedAt: ago(1, 2) },
]

export const WEBHOOKS: Webhook[] = [
  { id: 'wh_1', name: 'CRM 客户同步', url: 'https://crm.hxwm.example/hooks/yolink', secretConfigured: true, events: ['user_registered', 'title_assigned', 'purchase_synced'], enabled: true, lastTriggeredAt: ago(0, 0, 40) },
  { id: 'wh_2', name: '数据仓库消息流', url: 'https://dw.hxwm.example/ingest/messages', secretConfigured: true, events: ['message_created', 'conversation_created'], enabled: false, lastTriggeredAt: ago(6) },
]

function buildWebhookLogs(): WebhookLog[] {
  const list: WebhookLog[] = []
  const events: Webhook['events'] = ['user_registered', 'title_assigned', 'purchase_synced']
  for (let i = 0; i < 12; i += 1) {
    const fail = i === 2 || i === 7
    list.push({ id: aid('wl'), webhookId: 'wh_1', at: iso(agoMs(0, i * 2, between(0, 59))), event: events[i % events.length], httpStatus: fail ? (i === 2 ? 500 : 502) : 200, ms: fail ? between(3000, 8000) : between(80, 420), retries: fail ? 3 : 0 })
  }
  for (let i = 0; i < 4; i += 1) {
    list.push({ id: aid('wl'), webhookId: 'wh_2', at: iso(agoMs(6, i * 3)), event: 'message_created', httpStatus: 200, ms: between(60, 200), retries: 0 })
  }
  return list.sort((a, b) => b.at.localeCompare(a.at))
}

// ---------- 系统 ----------

export const APP_VERSIONS: AppVersion[] = [
  { platform: 'android', latest: '1.4.2', downloadUrl: 'https://dl.hxwm.example/app/android/1.4.2.apk', notes: '新增头衔展示；修复群消息偶发不同步', minVersion: '1.3.0' },
  { platform: 'ios', latest: '1.4.2', downloadUrl: 'https://apps.apple.com/app/id0000000000', notes: '新增头衔展示；修复群消息偶发不同步', minVersion: '1.3.0' },
  { platform: 'windows', latest: '1.2.0', downloadUrl: 'https://dl.hxwm.example/workbench/1.2.0.exe', notes: '工作台：话术库与打字匹配', minVersion: '1.1.0' },
]

export const LICENSE: License = {
  version: 'v1.0.3',
  instanceId: '6f1c2a3e-9b4d-4c8e-a1f2-7d5e8b9c0a11',
  type: 'private',
  expiresAt: iso(agoMs(-200)),
  modules: [
    { key: 'customers', name: '客户管理', enabled: true, expiresAt: iso(agoMs(-200)) },
    { key: 'invite', name: '邀请与分配', enabled: true, expiresAt: iso(agoMs(-200)) },
    { key: 'broadcast', name: '群发', enabled: true, expiresAt: iso(agoMs(-200)) },
    { key: 'banner', name: '公告与横幅', enabled: true, expiresAt: iso(agoMs(-200)) },
    { key: 'content', name: '内容管控', enabled: true, expiresAt: iso(agoMs(-200)) },
    { key: 'wallet', name: '钱包', enabled: true, expiresAt: iso(agoMs(-110)) },
    { key: 'checkin', name: '签到', enabled: true, expiresAt: iso(agoMs(-110)) },
    { key: 'referral', name: '推荐奖励', enabled: true, expiresAt: iso(agoMs(-110)) },
  ],
}

export const PROVIDER_INSTANCES: ProviderInstance[] = [
  {
    id: 'pi_hxwm',
    enterpriseName: '恒信财富',
    enterpriseCode: 'HXWM',
    deviceCode: 'HX-PROD-7C2A-91F4',
    instanceId: LICENSE.instanceId,
    version: LICENSE.version,
    boundAt: ago(168),
    expiresAt: LICENSE.expiresAt,
    stoppedAt: null,
    stopReason: null,
  },
  {
    id: 'pi_yhjy',
    enterpriseName: '远航教育',
    enterpriseCode: 'YHJY',
    deviceCode: 'YH-PROD-38B1-2D6E',
    instanceId: '14d81e39-5f32-4ac8-9b63-bd6f151b08af',
    version: 'v1.0.2',
    boundAt: ago(403),
    expiresAt: ago(12),
    stoppedAt: null,
    stopReason: null,
  },
  {
    id: 'pi_dhmy',
    enterpriseName: '东海贸易',
    enterpriseCode: 'DHMY',
    deviceCode: 'DH-PROD-5E90-11AC',
    instanceId: '742f6c3e-9a20-4662-8f19-8fb1adf49a2d',
    version: 'v1.0.1',
    boundAt: ago(95),
    expiresAt: iso(agoMs(-40)),
    stoppedAt: ago(2),
    stopReason: '客户确认暂停本期服务',
  },
]

export const PROVIDER_LICENSE_ACTIONS: ProviderLicenseAction[] = [
  { id: 'pla_1', instanceId: PROVIDER_INSTANCES[2].instanceId, at: ago(2), operatorName: '供应方管理员', action: 'stop', detail: '人工停用：客户确认暂停本期服务' },
  { id: 'pla_2', instanceId: PROVIDER_INSTANCES[0].instanceId, at: ago(16), operatorName: '供应方管理员', action: 'renew', detail: '续期 12 个月，到期日更新' },
  { id: 'pla_3', instanceId: PROVIDER_INSTANCES[1].instanceId, at: ago(403), operatorName: '供应方管理员', action: 'bind', detail: '绑定企业部署实例设备码' },
]

export const BACKUPS: Backup[] = [
  { id: 'bk_1', at: ago(0, 3), sizeMb: 412, status: 'done' },
  { id: 'bk_2', at: ago(1, 3), sizeMb: 409, status: 'done' },
  { id: 'bk_3', at: ago(2, 3), sizeMb: 405, status: 'done' },
  { id: 'bk_4', at: ago(3, 3), sizeMb: 401, status: 'done' },
  { id: 'bk_5', at: ago(7, 3), sizeMb: 388, status: 'done' },
]

export const HEALTH: HealthStatus = { db: 'ok', redis: 'ok', storage: 'ok', connections: 143, latencyMs: 38, checkedAt: ago(0, 0, 30) }

export const SENSITIVE_WORDS: SensitiveWord[] = [
  // 客户词库：客户在群里说的话
  { id: 'sw_1', word: '保本', scope: 'customer', action: 'block' },
  { id: 'sw_2', word: '稳赚', scope: 'customer', action: 'block' },
  { id: 'sw_3', word: '内幕', scope: 'customer', action: 'replace', replaceWith: '***' },
  { id: 'sw_4', word: '代客理财', scope: 'customer', action: 'log' },
  { id: 'sw_5', word: '转到我个人账户', scope: 'customer', action: 'block' },
  // 拉人引流用影子屏蔽而不是拦截：拦下来他立刻知道「加V」发不出去，换成「加威」再试，
  // 一路试到能过为止；影子屏蔽他每次都以为发成功了，反而不会换写法
  { id: 'sw_6', word: '加微信', scope: 'customer', action: 'shadow' },
  { id: 'sw_7', word: '私我', scope: 'customer', action: 'shadow', exact: true },
  // 坐席合规词库：顾问对客户说的话
  { id: 'sw_8', word: '稳赚不赔', scope: 'seat', action: 'block' },
  { id: 'sw_9', word: '保证收益', scope: 'seat', action: 'block' },
  { id: 'sw_10', word: '转我私人账户', scope: 'seat', action: 'block' },
  { id: 'sw_11', word: '包赚', scope: 'seat', action: 'block' },
  { id: 'sw_12', word: '一定涨', scope: 'seat', action: 'log' },
]

function buildDailyStats(customers: Customer[]): DailyStat[] {
  const list: DailyStat[] = []
  for (let d = 30; d >= 1; d -= 1) {
    const ms = agoMs(d)
    const date = dateStr(ms)
    const registrations = customers.filter((c) => c.registeredAt.slice(0, 10) === date).length + (chance(0.3) ? between(0, 2) : 0)
    const dau = between(9, 26)
    const messages = between(40, 170)
    list.push({ date, registrations, dau, messages, senders: Math.min(dau, between(6, 18)), pushes: between(20, 90) })
  }
  return list
}

// ---------- 依赖客户/消息的部分 ----------

export interface AdminSeedContext {
  customers: Customer[]
  conversations: Conversation[]
  messages: Message[]
}

export function buildAdminSeed(ctx: AdminSeedContext) {
  rand = mulberry32(20260916)
  seq = 0
  const { customers, conversations, messages } = ctx
  const funded = customers.filter((c) => c.purchases.length > 0)
  const community = conversations.find((c) => c.kind === 'group' && c.chatGroupId === 'cg_community')
  const communityMsgs = messages.filter((m) => m.convId === community?.id && m.senderKind === 'customer')

  // 群级 / 用户级覆盖（P1）：私享会员群里客户可看成员、可拉人；一个客户放开建群
  const policyOverrides: PolicyOverride[] = [
    { id: aid('po'), targetKind: 'group', targetId: 'cg_vip', caps: { 'group.view_members': true, 'group.invite': true, 'group.view_member_profile': true }, byStaffId: 'st_admin', createdAt: ago(40) },
    { id: aid('po'), targetKind: 'customer', targetId: funded[0]?.id ?? customers[0].id, caps: { 'group.create': true, 'group.invite': true }, byStaffId: 'st_admin', createdAt: ago(12) },
  ]

  // 举报（P1）
  const reports: Report[] = [
    { id: aid('rp'), at: ago(0, 4), reporterCustomerId: customers[3].id, targetKind: 'message', targetCustomerId: communityMsgs[0]?.senderId ?? customers[5].id, messageId: communityMsgs[0]?.id, reason: '疑似广告，反复发第三方理财链接', status: 'pending' },
    { id: aid('rp'), at: ago(1, 2), reporterCustomerId: customers[8].id, targetKind: 'user', targetCustomerId: customers[12].id, reason: '私聊骚扰，要求加微信', status: 'pending' },
    { id: aid('rp'), at: ago(6), reporterCustomerId: customers[2].id, targetKind: 'message', targetCustomerId: communityMsgs[1]?.senderId ?? customers[6].id, messageId: communityMsgs[1]?.id, reason: '言论不当', status: 'handled', resolution: 'ignored', handledBy: 'st_zhao', handledAt: ago(5, 20) },
  ]

  // 敏感词命中（P1）
  const sensitiveHits: SensitiveHit[] = [
    { id: aid('sh'), at: ago(0, 6), scope: 'customer', senderId: customers[4].id, convId: community?.id ?? '', word: '保本', original: '有没有保本的产品推荐一下', result: 'blocked' },
    // 变形写法：中间插了一个空格，直接子串匹配拦不住，变形匹配拦得住
    { id: aid('sh'), at: ago(0, 8), scope: 'customer', senderId: customers[6].id, convId: community?.id ?? '', word: '加微信', original: '想深入聊的加 微信 hx_888888，群里不方便说', result: 'shadowed' },
    { id: aid('sh'), at: ago(1, 5), scope: 'customer', senderId: customers[9].id, convId: community?.id ?? '', word: '内幕', original: '听说有内幕消息，下周要涨', result: 'replaced' },
    { id: aid('sh'), at: ago(3, 1), scope: 'customer', senderId: customers[14].id, convId: community?.id ?? '', word: '代客理财', original: '能不能帮我代客理财，我不想自己操作', result: 'logged' },
    // 坐席命中：合规追责要追到坐席背后的实操员工
    { id: aid('sh'), at: ago(2, 3), scope: 'seat', senderId: 'seat_lin', operatorStaffId: 'st_lin', convId: community?.id ?? '', word: '保证收益', original: '这只我可以给你保证收益，放心拿着', result: 'blocked' },
    { id: aid('sh'), at: ago(8, 9), scope: 'customer', senderId: customers[1].id, convId: community?.id ?? '', word: '稳赚', original: '这个组合是不是稳赚的', result: 'blocked' },
  ]

  // 安全日志（P1）
  const securityEvents: SecurityEvent[] = [
    { id: aid('se'), at: ago(0, 2), who: `客户 ${customers[7].nickname}（${customers[7].accountId}）`, ip: '203.0.113.42', type: 'policy_denied', detail: '尝试创建群，策略 group.create 对客户关闭' },
    { id: aid('se'), at: ago(0, 9), who: '员工 wangfang', ip: '198.51.100.8', type: 'abnormal_login', detail: '连续 5 次密码错误，账号锁定 15 分钟' },
    { id: aid('se'), at: ago(2, 4), who: `客户 ${customers[11].nickname}（${customers[11].accountId}）`, ip: '203.0.113.77', type: 'device', detail: '同一设备指纹登录 3 个不同客户账号' },
    { id: aid('se'), at: ago(4, 1), who: '员工 linwei', ip: '192.0.2.190', type: 'abnormal_login', detail: '异地登录：上次在香港，本次在新加坡' },
    { id: aid('se'), at: ago(9, 6), who: `客户 ${customers[16].nickname}（${customers[16].accountId}）`, ip: '203.0.113.10', type: 'policy_denied', detail: '尝试退出官方群「恒信财富社群」，策略 group.leave 对客户关闭' },
  ]

  // 签到记录：近 20 天，约 15 位客户
  const checkinRecords: CheckinRecord[] = []
  const walletTxs: WalletTx[] = []
  const balance: Record<string, number> = {}
  const push = (customerId: string, type: WalletTx['type'], amount: number, at: string, note: string) => {
    balance[customerId] = (balance[customerId] ?? 0) + amount
    walletTxs.push({ id: aid('wt'), at, customerId, type, amount, balanceAfter: balance[customerId], note })
  }
  const checkers = customers.filter((_, i) => i % 3 !== 1).slice(0, 15)
  checkers.forEach((c) => {
    let streak = 0
    for (let d = 20; d >= 0; d -= 1) {
      if (!chance(0.7)) {
        streak = 0
        continue
      }
      streak += 1
      const day = ((streak - 1) % 7) + 1
      const reward = CHECKIN_RULES.cycle[day - 1]
      const at = iso(agoMs(d, between(0, 14), between(0, 59)))
      checkinRecords.push({ id: aid('ck'), at, customerId: c.id, day, reward })
      push(c.id, 'checkin_reward', reward, at, `第 ${day} 天签到`)
    }
  })
  // 推荐奖励：有推荐人的客户，给推荐人发奖
  customers
    .filter((c) => c.referrerId)
    .forEach((c) => {
      const at = iso(new Date(c.registeredAt).getTime() + DAY)
      push(c.referrerId!, 'referral_reward', REFERRAL_RULES.referrerReward, at, `推荐 ${c.nickname} 完成首次签到`)
      push(c.id, 'referral_reward', REFERRAL_RULES.newcomerReward, at, '新人奖励')
    })
  // 手动加减
  if (funded[1]) push(funded[1].id, 'admin_adjust', 1000, ago(4, 2), '线下策略会到场补偿（周敏）')
  // 提现
  const withdrawals: Withdrawal[] = []
  const rich = Object.entries(balance)
    .filter(([, v]) => v >= 300)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
  rich.forEach(([cid], i) => {
    const pts = Math.min(balance[cid], 10000)
    const at = iso(agoMs(i * 2, 3))
    const status: Withdrawal['status'] = i === 0 ? 'pending' : i === 1 ? 'pending' : i === 2 ? 'approved' : 'paid'
    withdrawals.push({ id: aid('wd'), at, customerId: cid, points: pts, status, account: { 银行名称: '汇丰银行', 户名: customers.find((c) => c.id === cid)?.nickname ?? '', 账号: `HK${between(100000000, 999999999)}`, SWIFT: 'HSBCHKHH' } })
    push(cid, 'withdraw_freeze', -pts, at, `提现申请冻结 ${pts} 积分`)
  })
  walletTxs.sort((a, b) => b.at.localeCompare(a.at))

  const referralAnomalies: ReferralAnomaly[] = [
    { id: aid('ra'), customerId: customers[11].id, type: 'same_device', relatedIds: [customers[21]?.id, customers[29]?.id].filter(Boolean), cancelled: false },
    { id: aid('ra'), customerId: customers[18].id, type: 'burst_register', relatedIds: [customers[19]?.id, customers[20]?.id, customers[22]?.id].filter(Boolean), cancelled: true },
  ]

  return {
    policyItems: POLICY_ITEMS,
    policyPresets: POLICY_PRESETS,
    activePresetId: 'preset_cs',
    policyMatrix: POLICY_PRESETS[0].matrix,
    policyNumbers: POLICY_NUMBERS,
    policyOverrides,
    policyChanges: POLICY_CHANGES,
    reports,
    sensitiveWords: SENSITIVE_WORDS,
    sensitiveHits,
    securityEvents,
    walletSettings: WALLET_SETTINGS,
    payoutFields: PAYOUT_FIELDS,
    walletTxs,
    withdrawals,
    checkinRules: CHECKIN_RULES,
    checkinRecords,
    referralRules: REFERRAL_RULES,
    referralAnomalies,
    banners: BANNERS,
    announcements: ANNOUNCEMENTS,
    profileSync: PROFILE_SYNC,
    syncRecords: SYNC_RECORDS,
    customFields: CUSTOM_FIELDS,
    automationRules: AUTOMATION_RULES,
    dailyReport: DAILY_REPORT,
    dailyReportRecords: buildDailyReportRecords(),
    plugins: PLUGINS,
    apiKeys: API_KEYS,
    webhooks: WEBHOOKS,
    webhookLogs: buildWebhookLogs(),
    appVersions: APP_VERSIONS,
    license: LICENSE,
    providerInstances: PROVIDER_INSTANCES,
    providerLicenseActions: PROVIDER_LICENSE_ACTIONS,
    backups: BACKUPS,
    health: HEALTH,
    dailyStats: buildDailyStats(customers),
  }
}
