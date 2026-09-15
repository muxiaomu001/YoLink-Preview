/**
 * 群与频道的管理数据（群内角色、设置、公告、限制、群邀请链接、管理员日志）
 * 与群活跃助手（机器人账号、剧本、规则、运行记录）的种子。所有数据均为虚构。
 */
import type { BotAccount, BotRule, BotRun, BotScript, ChatGroup, GroupLog, Message, StaffPrefs } from './types'
import { ago, iso } from './time'

export const DEFAULT_STAFF_PREFS: StaffPrefs = { theme: 'auto', desktopNotify: true, sound: false, language: 'zh', aiSuggest: false }

/** 新建群的默认管理字段 */
export function groupDefaults(): Pick<ChatGroup, 'memberBotIds' | 'admins' | 'settings' | 'announcement' | 'pinnedMessageIds' | 'restrictions' | 'inviteLinks'> {
  return {
    memberBotIds: [],
    admins: [],
    settings: { allMuted: false, membersVisible: false, slowModeSeconds: null, historyVisible: true },
    announcement: null,
    pinnedMessageIds: [],
    restrictions: [],
    inviteLinks: [],
  }
}

/** 三个种子群的管理字段 */
export const GROUP_EXTRAS: Record<string, Partial<ChatGroup>> = {
  cg_strategy: {
    admins: [
      { memberKind: 'seat', memberId: 'seat_lin', perms: ['can_post_messages', 'can_pin_messages'], promotedBySeatId: 'seat_notice', promotedAt: ago(100) },
      { memberKind: 'seat', memberId: 'seat_chen', perms: ['can_post_messages'], promotedBySeatId: 'seat_notice', promotedAt: ago(100) },
    ],
    settings: { allMuted: false, membersVisible: false, slowModeSeconds: null, historyVisible: true },
    inviteLinks: [{ id: 'gl_strategy_main', name: '主链接', code: 'CH-STRAT', main: true, expiresAt: null, maxUses: null, uses: 214, status: 'active', bySeatId: 'seat_notice', createdAt: ago(100) }],
  },
  cg_community: {
    memberBotIds: ['bot_1', 'bot_2'],
    admins: [
      { memberKind: 'seat', memberId: 'seat_chen', perms: ['can_manage_chat', 'can_delete_messages', 'can_restrict_members', 'can_change_info', 'can_invite_users', 'can_pin_messages'], promotedBySeatId: 'seat_lin', promotedAt: ago(100) },
      { memberKind: 'seat', memberId: 'seat_cs', perms: ['can_delete_messages', 'can_pin_messages', 'can_invite_users'], promotedBySeatId: 'seat_lin', promotedAt: ago(90) },
    ],
    settings: { allMuted: false, membersVisible: false, slowModeSeconds: null, historyVisible: true },
    announcement: {
      title: '群规与本周安排',
      content: '1. 群内只讨论资产配置与市场，不发第三方理财链接。\n2. 顾问答疑时段：工作日 10:00 到 18:00。\n3. 本周五晚 8 点三季度复盘直播，私享会员优先提问。',
      bySeatId: 'seat_lin',
      at: ago(6),
      notified: true,
    },
    inviteLinks: [
      { id: 'gl_comm_main', name: '主链接', code: 'GP-HXWM', main: true, expiresAt: null, maxUses: null, uses: 1080, status: 'active', bySeatId: 'seat_lin', createdAt: ago(100) },
      { id: 'gl_comm_live', name: '9 月直播间', code: 'GP-LV09', main: false, expiresAt: iso(Date.now() + 12 * 86400000), maxUses: 300, uses: 87, status: 'active', bySeatId: 'seat_lin', createdAt: ago(14) },
      { id: 'gl_comm_old', name: '8 月直播间', code: 'GP-LV08', main: false, expiresAt: ago(10), maxUses: 300, uses: 300, status: 'expired', bySeatId: 'seat_lin', createdAt: ago(45) },
    ],
  },
  cg_vip: {
    admins: [{ memberKind: 'seat', memberId: 'seat_chen', perms: ['can_delete_messages', 'can_pin_messages', 'can_invite_users', 'can_restrict_members'], promotedBySeatId: 'seat_lin', promotedAt: ago(80) }],
    settings: { allMuted: false, membersVisible: true, slowModeSeconds: null, historyVisible: false },
    announcement: { title: '三季度复盘', content: '复盘报告已放到 App「我的文件」，周五晚 8 点线上讲一遍。', bySeatId: 'seat_lin', at: ago(3), notified: false },
    inviteLinks: [{ id: 'gl_vip_main', name: '主链接', code: 'GP-VIP1', main: true, expiresAt: null, maxUses: null, uses: 46, status: 'active', bySeatId: 'seat_lin', createdAt: ago(80) }],
  },
}

// ---------- 群活跃助手 ----------

export const BOTS: BotAccount[] = [
  { id: 'bot_1', nickname: '老周说市', avatarColor: '#0f766e', persona: '55 岁退休工程师，稳健派，喜欢聊美元短债和黄金，口吻平和、爱举自己的例子', groupIds: ['cg_community'], enabled: true, operatorStaffId: 'st_zhao', createdAt: ago(40) },
  { id: 'bot_2', nickname: 'Cindy 在港', avatarColor: '#be123c', persona: '32 岁在港工作的白领，关注港股科技与换汇时点，语气活泼、爱提问', groupIds: ['cg_community'], enabled: true, operatorStaffId: 'st_zhao', createdAt: ago(40) },
  { id: 'bot_3', nickname: '阿杰', avatarColor: '#7e22ce', persona: '刚开户的新手，问基础问题，给顾问抛话头', groupIds: [], enabled: false, operatorStaffId: null, createdAt: ago(20) },
]

export const BOT_SCRIPTS: BotScript[] = [
  {
    id: 'bs_morning',
    name: '早间开场（固定台词）',
    source: 'fixed',
    groupId: null,
    lines: ['早上好各位，今天美元指数又到 104 了，换汇的朋友注意一下时点', '昨晚美股收高，港股今天应该有点反弹，各位怎么看', '周末看了研究部的周报，黄金区间 5% 到 12% 这个说法我觉得挺稳'],
  },
  { id: 'bs_topic', name: '市场话题（AI 生成）', source: 'ai', groupId: null, lines: [], topic: '围绕当天市场热点提一个开放式问题，不给结论，不 @ 任何人' },
  { id: 'bs_mixed', name: '直播预热（混合）', source: 'mixed', groupId: 'cg_community', lines: ['周五晚上的复盘直播大家报名了吗'], topic: '接着直播报名话题聊两句，鼓励大家提前把问题发出来' },
]

export const BOT_RULES: BotRule[] = [
  { id: 'br_silence', name: '沉默 90 分钟后暖场', trigger: 'silence', silenceMinutes: 90, hourlyLimit: 2, reviewMode: 'review', groupIds: ['cg_community'], scriptId: 'bs_topic', botIds: ['bot_1', 'bot_2'], enabled: true },
  { id: 'br_morning', name: '每天 09:30 开场', trigger: 'schedule', scheduleTimes: ['09:30'], hourlyLimit: 1, reviewMode: 'auto', groupIds: ['cg_community'], scriptId: 'bs_morning', botIds: ['bot_1'], enabled: true },
  { id: 'br_follow', name: '顾问发言后跟帖', trigger: 'after_staff', hourlyLimit: 1, reviewMode: 'review', groupIds: ['cg_community'], scriptId: 'bs_topic', botIds: ['bot_2'], enabled: false },
]

/** 运行记录 + 管理员日志，与 seed.ts 的群消息分开生成，避免循环依赖 */
export function buildBotRuns(): BotRun[] {
  return [
    { id: 'brun_01', at: ago(0, 1, 20), ruleId: 'br_silence', botId: 'bot_2', groupId: 'cg_community', text: '有人看今天港股的开盘吗，科技股好像又起来了，是修复还是反转', status: 'pending_review' },
    { id: 'brun_02', at: ago(0, 3), ruleId: 'br_morning', botId: 'bot_1', groupId: 'cg_community', text: '早上好各位，今天美元指数又到 104 了，换汇的朋友注意一下时点', status: 'sent' },
    { id: 'brun_03', at: ago(0, 6), ruleId: 'br_silence', botId: 'bot_1', groupId: 'cg_community', text: '周末看了研究部的周报，黄金区间 5% 到 12% 这个说法我觉得挺稳', status: 'sent', operatorStaffId: 'st_zhao' },
    { id: 'brun_04', at: ago(1, 3), ruleId: 'br_morning', botId: 'bot_1', groupId: 'cg_community', text: '昨晚美股收高，港股今天应该有点反弹，各位怎么看', status: 'sent' },
    { id: 'brun_05', at: ago(1, 9), ruleId: 'br_silence', botId: 'bot_2', groupId: 'cg_community', text: '', status: 'skipped', reason: '每小时上限已到（2/2）' },
    { id: 'brun_06', at: ago(2, 3), ruleId: 'br_morning', botId: 'bot_1', groupId: 'cg_community', text: '', status: 'skipped', reason: '群全员禁言中' },
    { id: 'brun_07', at: ago(2, 8), ruleId: 'br_silence', botId: 'bot_2', groupId: 'cg_community', text: '想问下大家，美元定存和短债到底差在哪，我一直没搞明白', status: 'sent', operatorStaffId: 'st_zhao' },
    { id: 'brun_08', at: ago(3, 2), ruleId: null, botId: 'bot_1', groupId: 'cg_community', text: '周五晚上的复盘直播大家报名了吗', status: 'sent', operatorStaffId: 'st_zhao' },
    { id: 'brun_09', at: ago(3, 10), ruleId: 'br_silence', botId: 'bot_2', groupId: 'cg_community', text: '这两天换汇的人多吗，我在犹豫要不要等一等', status: 'rejected', operatorStaffId: 'st_zhao', reason: '话题重复' },
  ]
}

/** 已发出的机器人消息进群会话：由 seed.ts 在生成社群消息时调用 */
export function botMessagesFor(convId: string): Message[] {
  return buildBotRuns()
    .filter((r) => r.status === 'sent' && r.groupId === 'cg_community')
    .map((r) => ({ id: `msg_${r.id}`, convId, senderKind: 'bot' as const, senderId: r.botId, kind: 'text' as const, text: r.text, at: r.at, botRuleId: r.ruleId, operatorId: r.operatorStaffId }))
}

export function buildGroupLogs(): GroupLog[] {
  return [
    { id: 'gl_01', groupId: 'cg_community', at: ago(0, 2), actorKind: 'seat', actorId: 'seat_chen', action: 'delete_message', detail: '删除了客户「刘先生」的一条消息（第三方理财链接）' },
    { id: 'gl_02', groupId: 'cg_community', at: ago(0, 9), actorKind: 'seat', actorId: 'seat_lin', action: 'pin', detail: '置顶了「10 月 12 日策略会报名」' },
    { id: 'gl_03', groupId: 'cg_community', at: ago(0, 20), actorKind: 'seat', actorId: 'seat_cs', action: 'restrict', detail: '禁言客户「刘先生」24 小时：反复发广告' },
    { id: 'gl_04', groupId: 'cg_community', at: ago(1, 4), actorKind: 'seat', actorId: 'seat_lin', action: 'setting', detail: '关闭全员禁言' },
    { id: 'gl_05', groupId: 'cg_community', at: ago(1, 6), actorKind: 'seat', actorId: 'seat_lin', action: 'setting', detail: '开启全员禁言：直播期间只看顾问讲解' },
    { id: 'gl_06', groupId: 'cg_vip', at: ago(1, 12), actorKind: 'seat', actorId: 'seat_lin', action: 'announcement', detail: '发布公告「三季度复盘」' },
  ]
}
