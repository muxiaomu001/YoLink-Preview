/**
 * 企业设置、模块启停、系统（App 版本、许可、备份、健康）、日报与演示数据。
 */
import type { AppPlatform, AppVersion, Backup, DailyReportSettings, DemoState, ModuleKey } from '@/domain/types'
import { MODULE_LABEL } from '@/domain/labels'
import { dailyReportRecipients } from '@/domain/dailyReport'
import { newId } from '@/domain/ids'
import { type Get, type Set, now, withAudit } from './helpers'

export interface SettingsActions {
  updateEnterprise: (patch: Partial<DemoState['enterprise']>, byStaffId: string) => void
  /** 对象存储「测试连接」：演示里总是成功，记录时间 */
  testStorageConnection: () => boolean
  toggleModule: (key: ModuleKey, on: boolean, byStaffId: string) => void
  updateAppVersion: (platform: AppPlatform, patch: Partial<AppVersion>, byStaffId: string) => void
  triggerBackup: (byStaffId: string) => Backup
  restoreBackup: (id: string, byStaffId: string) => void
  runHealthCheck: () => void
  updateDailyReportSettings: (patch: Partial<DailyReportSettings>, byStaffId: string) => void
  /** 立即发送一次日报：追加一条记录 */
  sendDailyReportNow: () => void
  /** 演示数据：清空客户与会话，保留配置 */
  clearDemoCustomers: (byStaffId: string) => void
}

const FIELD_LABEL: Record<string, string> = {
  name: '企业名称',
  slogan: '一句话介绍',
  logoText: 'Logo',
  defaultLanguage: '默认语言',
  brandColor: '品牌色',
  agreementUrl: '用户协议',
  privacyUrl: '隐私政策',
  faqUrl: 'FAQ',
  allowedThemes: '允许的主题',
  defaultTheme: '默认主题',
  registerMethods: '允许的注册方式',
  inviteCodeRequired: '邀请码必填',
  push: '推送配置',
  storage: '对象存储',
  webTabs: '网站栏目',
  modules: '模块',
}

export function settingsActions(set: Set, get: Get): SettingsActions {
  return {
    updateEnterprise: (patch, byStaffId) =>
      set((s) => ({
        enterprise: { ...s.enterprise, ...patch },
        audit: withAudit(s.audit, 'settings.update', `修改企业设置：${Object.keys(patch).map((k) => FIELD_LABEL[k] ?? k).join('、')}`, byStaffId),
      })),

    testStorageConnection: () => {
      const s = get()
      const ok = !!(s.enterprise.storage.bucket && s.enterprise.storage.endpoint && s.enterprise.storage.accessKeyConfigured && s.enterprise.storage.secretKeyConfigured)
      set({ enterprise: { ...s.enterprise, storage: { ...s.enterprise.storage, lastTestAt: now(), lastTestOk: ok } } })
      return ok
    },

    toggleModule: (key, on, byStaffId) =>
      set((s) => ({
        enterprise: { ...s.enterprise, modules: { ...s.enterprise.modules, [key]: on } },
        audit: withAudit(s.audit, 'module.toggle', `${on ? '启用' : '停用'}模块「${MODULE_LABEL[key].name}」${on ? '' : '（数据保留）'}`, byStaffId),
      })),

    updateAppVersion: (platform, patch, byStaffId) =>
      set((s) => ({
        appVersions: s.appVersions.map((v) => (v.platform === platform ? { ...v, ...patch } : v)),
        audit: withAudit(s.audit, 'app_version.update', `更新 ${platform} 版本信息：${Object.keys(patch).join('、')}`, byStaffId),
      })),

    triggerBackup: (byStaffId) => {
      const s = get()
      const last = s.backups[0]
      const b: Backup = { id: newId('bk'), at: now(), sizeMb: (last?.sizeMb ?? 400) + 2, status: 'done' }
      set({ backups: [b, ...s.backups], audit: withAudit(s.audit, 'backup.run', '触发立即备份（实际由部署脚本执行）', byStaffId) })
      return b
    },

    restoreBackup: (id, byStaffId) =>
      set((s) => {
        const b = s.backups.find((x) => x.id === id)
        return { audit: withAudit(s.audit, 'backup.restore', `从 ${b ? b.at.slice(0, 16).replace('T', ' ') : id} 的备份恢复（演示不真正覆盖数据）`, byStaffId) }
      }),

    runHealthCheck: () =>
      set((s) => ({ health: { ...s.health, db: 'ok', redis: 'ok', storage: s.enterprise.storage.lastTestOk === false ? 'error' : 'ok', connections: 120 + Math.floor(Math.random() * 60), latencyMs: 30 + Math.floor(Math.random() * 25), checkedAt: now() } })),

    updateDailyReportSettings: (patch, byStaffId) =>
      set((s) => {
        const dailyReport = { ...s.dailyReport, ...patch }
        const recipients = dailyReportRecipients({ ...s, dailyReport })
        if (recipients.length !== dailyReport.recipients.length || recipients.some((recipient, index) => recipient.channels.length !== dailyReport.recipients[index].channels.length)) return {}
        return {
          dailyReport: { ...dailyReport, recipients },
          audit: withAudit(s.audit, 'daily_report.settings', `修改日报设置：${Object.keys(patch).join('、')}`, byStaffId),
        }
      }),

    sendDailyReportNow: () =>
      set((s) => {
        const recipients = dailyReportRecipients(s)
        if (!recipients.length) return {}
        return {
          dailyReportRecords: [
            { id: newId('dr'), date: now().slice(0, 10), sentTo: recipients.map((recipient) => recipient.name), status: 'sent', summary: `手动触发 · 客户 ${s.customers.length} 位 · 7 日活跃 ${s.customers.filter((c) => Date.now() - new Date(c.lastActiveAt).getTime() < 7 * 86400000).length}` },
            ...s.dailyReportRecords,
          ],
        }
      }),

    clearDemoCustomers: (byStaffId) =>
      set((s) => ({
        customers: [],
        customerSeats: [],
        conversations: s.conversations.filter((c) => c.kind !== 'dm'),
        messages: s.messages.filter((m) => s.conversations.find((c) => c.id === m.convId)?.kind !== 'dm' && m.senderKind !== 'customer'),
        titleAssignments: [],
        walletTxs: [],
        withdrawals: [],
        checkinRecords: [],
        reports: [],
        chatGroups: s.chatGroups.map((g) => ({ ...g, memberCustomerIds: [] })),
        session: { ...s.session, phoneCustomerId: null },
        audit: withAudit(s.audit, 'settings.update', '清空演示客户数据（配置保留）', byStaffId),
      })),
  }
}
