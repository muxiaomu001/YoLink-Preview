/**
 * 群活跃助手（炒群）：机器人账号、剧本、规则、审核与手动发言、一键暂停。
 * 规则真正"触发"由服务端定时器做，演示里提供「模拟触发一次」走同一条判定链：
 * 模块停用 / 全部暂停 / 群全员禁言 / 每小时上限 → 跳过并记录；审核模式 → 待审；否则直接进群。
 */
import type { BotAccount, BotRule, BotRun, BotScript, Message } from '@/domain/types'
import { newId } from '@/domain/ids'
import { type Get, type Set, now, withAudit } from './helpers'

export interface BotActions {
  saveBot: (input: Partial<BotAccount> & { nickname: string; persona: string }, byStaffId: string) => BotAccount
  deleteBot: (id: string, byStaffId: string) => void
  saveBotScript: (input: Partial<BotScript> & { name: string; source: BotScript['source'] }, byStaffId: string) => void
  deleteBotScript: (id: string, byStaffId: string) => void
  saveBotRule: (input: Partial<BotRule> & { name: string; trigger: BotRule['trigger']; scriptId: string }, byStaffId: string) => void
  deleteBotRule: (id: string, byStaffId: string) => void
  setBotsPausedAll: (paused: boolean, byStaffId: string) => void
  /** 模拟规则触发一次：返回运行记录 */
  simulateBotRule: (ruleId: string, byStaffId: string) => BotRun | undefined
  /** 审核：放行进群或驳回 */
  reviewBotRun: (runId: string, approve: boolean, byStaffId: string, reason?: string) => void
  /** 员工用机器人身份手动发一条：记真实操作者 */
  botManualSend: (botId: string, groupId: string, text: string, byStaffId: string) => void
}

function pickLine(script: BotScript, seed: number): string {
  if (script.source === 'ai') return `（AI 按人设生成）${script.topic ?? '围绕当天市场提一个开放式问题'}`
  const line = script.lines[seed % Math.max(1, script.lines.length)] ?? ''
  return script.source === 'mixed' ? `${line}（AI 接话）` : line
}

export function botActions(set: Set, get: Get): BotActions {
  const deliver = (s: ReturnType<Get>, botId: string, groupId: string, text: string, ruleId: string | null, operatorStaffId?: string): { messages: Message[]; conversations: ReturnType<Get>['conversations'] } => {
    const conv = s.conversations.find((c) => c.chatGroupId === groupId)
    if (!conv) return { messages: s.messages, conversations: s.conversations }
    const at = now()
    return {
      messages: [...s.messages, { id: newId('msg'), convId: conv.id, senderKind: 'bot', senderId: botId, kind: 'text', text, at, botRuleId: ruleId, operatorId: operatorStaffId }],
      conversations: s.conversations.map((c) => (c.id === conv.id ? { ...c, lastMessageAt: at } : c)),
    }
  }

  return {
    saveBot: (input, byStaffId) => {
      const s = get()
      const existing = input.id ? s.bots.find((b) => b.id === input.id) : undefined
      const bot: BotAccount = existing
        ? { ...existing, ...input }
        : { id: newId('bot'), nickname: input.nickname, avatarColor: input.avatarColor ?? '#0f766e', persona: input.persona, groupIds: input.groupIds ?? [], enabled: input.enabled ?? true, operatorStaffId: input.operatorStaffId ?? null, createdAt: now() }
      // 机器人成员同步到群
      const chatGroups = s.chatGroups.map((g) => {
        const should = bot.groupIds.includes(g.id)
        const has = g.memberBotIds.includes(bot.id)
        if (should && !has) return { ...g, memberBotIds: [...g.memberBotIds, bot.id] }
        if (!should && has) return { ...g, memberBotIds: g.memberBotIds.filter((id) => id !== bot.id) }
        return g
      })
      set({
        bots: existing ? s.bots.map((b) => (b.id === bot.id ? bot : b)) : [...s.bots, bot],
        chatGroups,
        audit: withAudit(s.audit, 'bot.update', `${existing ? '修改' : '新建'}机器人账号「${bot.nickname}」，所属群：${bot.groupIds.map((id) => s.chatGroups.find((g) => g.id === id)?.name).join('、') || '无'}`, byStaffId),
      })
      return bot
    },

    deleteBot: (id, byStaffId) =>
      set((s) => {
        const b = s.bots.find((x) => x.id === id)
        return {
          bots: s.bots.filter((x) => x.id !== id),
          chatGroups: s.chatGroups.map((g) => ({ ...g, memberBotIds: g.memberBotIds.filter((x) => x !== id) })),
          botRules: s.botRules.map((r) => ({ ...r, botIds: r.botIds.filter((x) => x !== id) })),
          audit: withAudit(s.audit, 'bot.update', `删除机器人账号「${b?.nickname}」`, byStaffId),
        }
      }),

    saveBotScript: (input, byStaffId) =>
      set((s) => {
        const existing = input.id ? s.botScripts.find((x) => x.id === input.id) : undefined
        const script: BotScript = existing ? { ...existing, ...input } : { id: newId('bs'), name: input.name, source: input.source, lines: input.lines ?? [], groupId: input.groupId ?? null, topic: input.topic }
        return {
          botScripts: existing ? s.botScripts.map((x) => (x.id === script.id ? script : x)) : [...s.botScripts, script],
          audit: withAudit(s.audit, 'bot.update', `${existing ? '修改' : '新建'}剧本「${script.name}」`, byStaffId),
        }
      }),

    deleteBotScript: (id, byStaffId) =>
      set((s) => ({ botScripts: s.botScripts.filter((x) => x.id !== id), audit: withAudit(s.audit, 'bot.update', `删除剧本「${s.botScripts.find((x) => x.id === id)?.name}」`, byStaffId) })),

    saveBotRule: (input, byStaffId) =>
      set((s) => {
        const existing = input.id ? s.botRules.find((x) => x.id === input.id) : undefined
        const rule: BotRule = existing
          ? { ...existing, ...input }
          : { id: newId('br'), name: input.name, trigger: input.trigger, silenceMinutes: input.silenceMinutes, scheduleTimes: input.scheduleTimes, hourlyLimit: input.hourlyLimit ?? 2, reviewMode: input.reviewMode ?? 'review', groupIds: input.groupIds ?? [], scriptId: input.scriptId, botIds: input.botIds ?? [], enabled: input.enabled ?? true }
        return {
          botRules: existing ? s.botRules.map((x) => (x.id === rule.id ? rule : x)) : [...s.botRules, rule],
          audit: withAudit(s.audit, 'bot.update', `${existing ? '修改' : '新建'}规则「${rule.name}」`, byStaffId),
        }
      }),

    deleteBotRule: (id, byStaffId) =>
      set((s) => ({ botRules: s.botRules.filter((x) => x.id !== id), audit: withAudit(s.audit, 'bot.update', `删除规则「${s.botRules.find((x) => x.id === id)?.name}」`, byStaffId) })),

    setBotsPausedAll: (paused, byStaffId) =>
      set((s) => ({ botsPausedAll: paused, audit: withAudit(s.audit, 'bot.update', paused ? '一键暂停全部群活跃助手' : '恢复全部群活跃助手', byStaffId) })),

    simulateBotRule: (ruleId, byStaffId) => {
      const s = get()
      const rule = s.botRules.find((r) => r.id === ruleId)
      if (!rule) return undefined
      const script = s.botScripts.find((x) => x.id === rule.scriptId)
      const groupId = rule.groupIds[0]
      const botId = rule.botIds[0]
      const g = s.chatGroups.find((x) => x.id === groupId)
      const at = now()
      const base = { id: newId('brun'), at, ruleId, botId: botId ?? '', groupId: groupId ?? '', operatorStaffId: byStaffId }
      const skip = (reason: string): BotRun => ({ ...base, text: '', status: 'skipped', reason })
      let run: BotRun
      if (!g || !botId || !script) run = skip('规则缺少群、机器人或剧本')
      else if (s.botsPausedAll) run = skip('全部群活跃助手已暂停')
      else if (!rule.enabled) run = skip('规则已停用')
      else if (g.settings.allMuted) run = skip('群全员禁言中')
      else if (s.botRuns.filter((r) => r.ruleId === ruleId && r.status === 'sent' && Date.now() - new Date(r.at).getTime() < 3600000).length >= rule.hourlyLimit) run = skip(`每小时上限已到（${rule.hourlyLimit}/${rule.hourlyLimit}）`)
      else {
        const text = pickLine(script, s.botRuns.length)
        run = { ...base, text, status: rule.reviewMode === 'review' ? 'pending_review' : 'sent' }
      }
      const delivered = run.status === 'sent' ? deliver(s, run.botId, run.groupId, run.text, ruleId) : { messages: s.messages, conversations: s.conversations }
      set({
        botRuns: [run, ...s.botRuns],
        ...delivered,
        audit: withAudit(s.audit, 'bot.run', `模拟触发规则「${rule.name}」：${run.status === 'sent' ? '已进群' : run.status === 'pending_review' ? '进入待审' : `跳过，${run.reason}`}`, byStaffId),
      })
      return run
    },

    reviewBotRun: (runId, approve, byStaffId, reason) =>
      set((s) => {
        const run = s.botRuns.find((r) => r.id === runId)
        if (!run || run.status !== 'pending_review') return {}
        const delivered = approve ? deliver(s, run.botId, run.groupId, run.text, run.ruleId, byStaffId) : { messages: s.messages, conversations: s.conversations }
        return {
          botRuns: s.botRuns.map((r) => (r.id === runId ? { ...r, status: approve ? ('sent' as const) : ('rejected' as const), operatorStaffId: byStaffId, reason: approve ? undefined : reason } : r)),
          ...delivered,
          audit: withAudit(s.audit, 'bot.run', `${approve ? '放行' : '驳回'}机器人「${s.bots.find((b) => b.id === run.botId)?.nickname}」的待审发言${reason ? `：${reason}` : ''}`, byStaffId),
        }
      }),

    botManualSend: (botId, groupId, text, byStaffId) =>
      set((s) => {
        const bot = s.bots.find((b) => b.id === botId)
        const g = s.chatGroups.find((x) => x.id === groupId)
        if (!bot || !g) return {}
        const run: BotRun = { id: newId('brun'), at: now(), ruleId: null, botId, groupId, text, status: 'sent', operatorStaffId: byStaffId }
        return {
          botRuns: [run, ...s.botRuns],
          ...deliver(s, botId, groupId, text, null, byStaffId),
          audit: withAudit(s.audit, 'bot.run', `以机器人「${bot.nickname}」身份在群「${g.name}」手动发言（真实操作者记录在消息上）`, byStaffId),
        }
      }),
  }
}
