/**
 * 群活跃助手页共用：文案、统计口径、内置模板。纯函数与常量，不含组件。
 */
import type { BotRun, BotRunStatus, BotScript, BotScriptSource, BotTrigger, DemoState } from '@/domain/types'

export const TRIGGER_LABEL: Record<BotTrigger, string> = {
  silence: '沉默 X 分钟',
  schedule: '指定时段',
  after_staff: '员工发言后',
  manual: '手动',
}

export const SOURCE_LABEL: Record<BotScriptSource, string> = {
  fixed: '固定台词',
  ai: 'AI 生成',
  mixed: '混合',
}

export const RUN_STATUS_LABEL: Record<BotRunStatus, string> = {
  sent: '已进群',
  pending_review: '待审核',
  skipped: '已跳过',
  rejected: '已驳回',
}

export const RUN_STATUS_TONE: Record<BotRunStatus, 'green' | 'amber' | 'zinc' | 'red'> = {
  sent: 'green',
  pending_review: 'amber',
  skipped: 'zinc',
  rejected: 'red',
}

/** 活跃角色头像可选色 */
export const BOT_AVATAR_COLORS = ['#0f766e', '#be123c', '#7e22ce', '#0369a1', '#b45309', '#4d7c0f', '#52525b']

/** 活跃角色发言后多少分钟内的客户发言算"带动" */
export const DRIVE_WINDOW_MS = 30 * 60 * 1000

/** 触发条件的一句话描述 */
export function describeTrigger(rule: { trigger: BotTrigger; silenceMinutes?: number; scheduleTimes?: string[] }): string {
  if (rule.trigger === 'silence') return `沉默 ${rule.silenceMinutes ?? 0} 分钟`
  if (rule.trigger === 'schedule') return `每天 ${(rule.scheduleTimes ?? []).join('、') || '未设置'}`
  return TRIGGER_LABEL[rule.trigger]
}

/** 活跃角色发言数：运行记录里真正进群的 */
export function botSentCount(runs: BotRun[]): number {
  return runs.filter((r) => r.status === 'sent').length
}

/** 带动率：每次活跃角色发言后 30 分钟内群里客户发言数 ÷ 活跃角色发言数，按消息表算 */
export function driveRate(s: DemoState): { rate: number; botMsgs: number; driven: number } {
  const botMsgs = s.messages.filter((m) => m.senderKind === 'bot')
  const driven = botMsgs.reduce((sum, bm) => {
    const from = new Date(bm.at).getTime()
    const n = s.messages.filter((m) => m.convId === bm.convId && m.senderKind === 'customer' && new Date(m.at).getTime() > from && new Date(m.at).getTime() - from <= DRIVE_WINDOW_MS).length
    return sum + n
  }, 0)
  return { rate: botMsgs.length ? driven / botMsgs.length : 0, botMsgs: botMsgs.length, driven }
}

export function isToday(isoAt: string): boolean {
  return new Date(isoAt).toDateString() === new Date().toDateString()
}

/** 按行业内置的剧本模板：金融投顾 */
export const SCRIPT_TEMPLATES: { industry: string; name: string; desc: string; script: Omit<BotScript, 'id'> }[] = [
  {
    industry: '金融投顾',
    name: '盘前暖场',
    desc: '固定台词 3 条，开盘前抛市场话头，不给结论',
    script: {
      name: '盘前暖场（模板）',
      source: 'fixed',
      groupId: null,
      lines: ['各位早，昨晚美股收得还行，今天港股开盘大家有关注哪个板块吗', '最近美元定存利率又变了，有换汇打算的朋友可以留意一下', '上周的研究部周报里提到黄金区间配置，我觉得这个思路挺稳的，大家怎么看'],
    },
  },
  {
    industry: '金融投顾',
    name: '直播答疑引导',
    desc: '混合：固定开场 + AI 接话，把大家的问题引到直播前',
    script: {
      name: '直播答疑引导（模板）',
      source: 'mixed',
      groupId: null,
      lines: ['这周的复盘直播各位都报名了吗，我准备了两个关于资产配置的问题想问顾问'],
      topic: '接着直播报名话题聊两句，鼓励大家提前把问题发出来，不给投资结论，不 @ 任何人',
    },
  },
]
