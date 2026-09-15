/**
 * AI 模块、客户画像同步、自动化规则（P1）、插件、开放 API 凭据、Webhook（P1）。
 */
import type { AiSettings, ApiKey, ApiScope, AutomationRule, CustomField, KnowledgeItem, ProfileSyncSettings, SyncRecord, Webhook, WebhookLog } from '@/domain/types'
import { newId } from '@/domain/ids'
import { type Get, type Set, now, randomHex, withAudit } from './helpers'

export interface CsvPurchaseRow {
  phone: string
  product: string
  amount: number
  at: string
}

export interface CsvReferralRow {
  phone: string
  referrerPhone: string
}

export interface IntegrationActions {
  updateAiSettings: (patch: Partial<AiSettings>, byStaffId: string) => void
  testAiConnection: () => boolean
  saveKnowledge: (item: KnowledgeItem, byStaffId: string) => void
  deleteKnowledge: (id: string, byStaffId: string) => void
  updateProfileSync: (patch: Partial<ProfileSyncSettings>, byStaffId: string) => void
  /** 重新生成画像 API Key，返回完整 Key 一次 */
  regenerateProfileApiKey: (byStaffId: string) => string
  /** CSV 导入：按手机号匹配客户，返回结果记录 */
  importPurchasesCsv: (rows: CsvPurchaseRow[], byStaffId: string) => SyncRecord
  importReferralsCsv: (rows: CsvReferralRow[], byStaffId: string) => SyncRecord
  saveCustomField: (field: CustomField, byStaffId: string) => void
  deleteCustomField: (id: string, byStaffId: string) => void
  saveAutomationRule: (rule: AutomationRule, byStaffId: string) => void
  deleteAutomationRule: (id: string, byStaffId: string) => void
  togglePlugin: (id: string, on: boolean, byStaffId: string) => void
  updatePluginConfig: (id: string, config: Record<string, string | boolean>, byStaffId: string) => void
  uninstallPlugin: (id: string, byStaffId: string) => void
  /** 返回完整 Key，只显示一次 */
  createApiKey: (input: { name: string; scopes: ApiScope[] }, byStaffId: string) => string
  deleteApiKey: (id: string, byStaffId: string) => void
  saveWebhook: (hook: Webhook, byStaffId: string) => void
  deleteWebhook: (id: string, byStaffId: string) => void
  retryWebhookLog: (logId: string) => void
}

export function integrationActions(set: Set, get: Get): IntegrationActions {
  return {
    updateAiSettings: (patch, byStaffId) =>
      set((s) => ({ aiSettings: { ...s.aiSettings, ...patch }, audit: withAudit(s.audit, 'ai.settings', `修改 AI 设置：${Object.keys(patch).join('、')}`, byStaffId) })),

    testAiConnection: () => {
      const s = get()
      const ok = !!(s.aiSettings.endpoint && s.aiSettings.keyConfigured)
      set({ aiSettings: { ...s.aiSettings, lastTestAt: now(), lastTestOk: ok } })
      return ok
    },

    saveKnowledge: (item, byStaffId) =>
      set((s) => {
        const exists = s.knowledge.some((k) => k.id === item.id)
        return {
          knowledge: exists ? s.knowledge.map((k) => (k.id === item.id ? item : k)) : [...s.knowledge, item],
          audit: withAudit(s.audit, 'knowledge.update', `${exists ? '修改' : '新增'}知识库条目「${item.title}」`, byStaffId),
        }
      }),

    deleteKnowledge: (id, byStaffId) =>
      set((s) => {
        const k = s.knowledge.find((x) => x.id === id)
        return { knowledge: s.knowledge.filter((x) => x.id !== id), audit: withAudit(s.audit, 'knowledge.update', `删除知识库条目「${k?.title}」`, byStaffId) }
      }),

    updateProfileSync: (patch, byStaffId) =>
      set((s) => ({ profileSync: { ...s.profileSync, ...patch }, audit: withAudit(s.audit, 'profile.sync', `修改画像同步设置：${Object.keys(patch).join('、')}`, byStaffId) })),

    regenerateProfileApiKey: (byStaffId) => {
      const full = `hxp_${randomHex(32)}`
      set((s) => ({
        profileSync: { ...s.profileSync, apiKeyConfigured: true, apiKeyPrefix: full.slice(0, 8) },
        audit: withAudit(s.audit, 'profile.sync', '重新生成画像同步 API Key（只写画像权限），旧 Key 立即失效', byStaffId),
      }))
      return full
    },

    importPurchasesCsv: (rows, byStaffId) => {
      const s = get()
      let matched = 0
      let unmatched = 0
      const customers = s.customers.map((c) => ({ ...c, purchases: [...c.purchases] }))
      rows.forEach((r) => {
        const c = customers.find((x) => x.phone && x.phone.replace(/\s/g, '') === r.phone.replace(/\s/g, ''))
        if (!c) {
          unmatched += 1
          return
        }
        c.purchases.push({ product: r.product, amount: r.amount, at: r.at })
        if (!c.tagIds.includes('tag_funded')) c.tagIds = [...c.tagIds, 'tag_funded']
        matched += 1
      })
      const rec: SyncRecord = { id: newId('sr'), at: now(), kind: 'purchase', source: 'csv', count: matched, failed: 0, unmatched }
      set({ customers, syncRecords: [rec, ...s.syncRecords], audit: withAudit(s.audit, 'profile.import', `CSV 导入购买记录：匹配 ${matched} 条，未匹配 ${unmatched} 条`, byStaffId) })
      return rec
    },

    importReferralsCsv: (rows, byStaffId) => {
      const s = get()
      let matched = 0
      let unmatched = 0
      let failed = 0
      const norm = (p?: string) => (p ?? '').replace(/\s/g, '')
      let customers = s.customers
      rows.forEach((r) => {
        const c = customers.find((x) => norm(x.phone) === norm(r.phone))
        const ref = customers.find((x) => norm(x.phone) === norm(r.referrerPhone))
        if (!c) {
          unmatched += 1
          return
        }
        if (!ref || ref.id === c.id) {
          failed += 1
          return
        }
        customers = customers.map((x) => (x.id === c.id ? { ...x, referrerId: ref.id } : x.id === ref.id ? { ...x, inviteCount: x.inviteCount + 1, teamCount: x.teamCount + 1 } : x))
        matched += 1
      })
      const rec: SyncRecord = { id: newId('sr'), at: now(), kind: 'referral', source: 'csv', count: matched, failed, failReason: failed ? '推荐人手机号在客户库中不存在' : undefined, unmatched }
      set({ customers, syncRecords: [rec, ...s.syncRecords], audit: withAudit(s.audit, 'profile.import', `CSV 导入邀请关系：匹配 ${matched} 条，失败 ${failed} 条，未匹配 ${unmatched} 条`, byStaffId) })
      return rec
    },

    saveCustomField: (field, byStaffId) =>
      set((s) => {
        const exists = s.customFields.some((f) => f.id === field.id)
        return {
          customFields: exists ? s.customFields.map((f) => (f.id === field.id ? field : f)) : [...s.customFields, field],
          audit: withAudit(s.audit, 'profile.sync', `${exists ? '修改' : '新增'}通用字段「${field.name}」`, byStaffId),
        }
      }),

    deleteCustomField: (id, byStaffId) =>
      set((s) => {
        const f = s.customFields.find((x) => x.id === id)
        return { customFields: s.customFields.filter((x) => x.id !== id), audit: withAudit(s.audit, 'profile.sync', `删除通用字段「${f?.name}」`, byStaffId) }
      }),

    saveAutomationRule: (rule, byStaffId) =>
      set((s) => {
        const exists = s.automationRules.some((r) => r.id === rule.id)
        return {
          automationRules: exists ? s.automationRules.map((r) => (r.id === rule.id ? rule : r)) : [...s.automationRules, rule],
          audit: withAudit(s.audit, 'automation.update', `${exists ? '修改' : '新建'}自动化规则「${rule.name}」${rule.enabled ? '' : '（未启用）'}`, byStaffId),
        }
      }),

    deleteAutomationRule: (id, byStaffId) =>
      set((s) => {
        const r = s.automationRules.find((x) => x.id === id)
        return { automationRules: s.automationRules.filter((x) => x.id !== id), audit: withAudit(s.audit, 'automation.update', `删除自动化规则「${r?.name}」`, byStaffId) }
      }),

    togglePlugin: (id, on, byStaffId) =>
      set((s) => {
        const p = s.plugins.find((x) => x.id === id)
        return { plugins: s.plugins.map((x) => (x.id === id ? { ...x, enabled: on } : x)), audit: withAudit(s.audit, 'plugin.update', `${on ? '启用' : '停用'}插件「${p?.name}」`, byStaffId) }
      }),

    updatePluginConfig: (id, config, byStaffId) =>
      set((s) => {
        const p = s.plugins.find((x) => x.id === id)
        return { plugins: s.plugins.map((x) => (x.id === id ? { ...x, config } : x)), audit: withAudit(s.audit, 'plugin.update', `保存插件「${p?.name}」配置`, byStaffId) }
      }),

    uninstallPlugin: (id, byStaffId) =>
      set((s) => {
        const p = s.plugins.find((x) => x.id === id)
        return { plugins: s.plugins.filter((x) => x.id !== id), audit: withAudit(s.audit, 'plugin.update', `卸载插件「${p?.name}」`, byStaffId) }
      }),

    createApiKey: (input, byStaffId) => {
      const full = `yk_live_${randomHex(32)}`
      const key: ApiKey = { id: newId('ak'), name: input.name, prefix: full.slice(0, 16), scopes: input.scopes, createdAt: now(), lastUsedAt: null }
      set((s) => ({ apiKeys: [...s.apiKeys, key], audit: withAudit(s.audit, 'api_key.create', `创建 API Key「${key.name}」，权限：${key.scopes.join('、')}`, byStaffId) }))
      return full
    },

    deleteApiKey: (id, byStaffId) =>
      set((s) => {
        const k = s.apiKeys.find((x) => x.id === id)
        return { apiKeys: s.apiKeys.filter((x) => x.id !== id), audit: withAudit(s.audit, 'api_key.delete', `删除 API Key「${k?.name}」，立即失效`, byStaffId) }
      }),

    saveWebhook: (hook, byStaffId) =>
      set((s) => {
        const exists = s.webhooks.some((w) => w.id === hook.id)
        return {
          webhooks: exists ? s.webhooks.map((w) => (w.id === hook.id ? hook : w)) : [...s.webhooks, hook],
          audit: withAudit(s.audit, 'webhook.update', `${exists ? '修改' : '创建'} Webhook「${hook.name}」`, byStaffId),
        }
      }),

    deleteWebhook: (id, byStaffId) =>
      set((s) => {
        const w = s.webhooks.find((x) => x.id === id)
        return { webhooks: s.webhooks.filter((x) => x.id !== id), webhookLogs: s.webhookLogs.filter((l) => l.webhookId !== id), audit: withAudit(s.audit, 'webhook.update', `删除 Webhook「${w?.name}」`, byStaffId) }
      }),

    retryWebhookLog: (logId) =>
      set((s) => {
        const l = s.webhookLogs.find((x) => x.id === logId)
        if (!l) return {}
        const retry: WebhookLog = { id: newId('wl'), webhookId: l.webhookId, at: now(), event: l.event, httpStatus: 200, ms: 120 + Math.floor(Math.random() * 200), retries: l.retries + 1 }
        return { webhookLogs: [retry, ...s.webhookLogs], webhooks: s.webhooks.map((w) => (w.id === l.webhookId ? { ...w, lastTriggeredAt: now() } : w)) }
      }),
  }
}
