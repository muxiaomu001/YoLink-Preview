/**
 * 模块：钱包（P2）、签到（P2）、推荐奖励（P2）、横幅与公告。
 */
import type { Announcement, Banner, CheckinRules, PayoutField, ReferralRules, WalletSettings, WalletTx, Withdrawal } from '@/domain/types'
import { newId } from '@/domain/ids'
import { type Get, type Set, now, withAudit } from './helpers'

export interface ModuleActions {
  updateWalletSettings: (patch: Partial<WalletSettings>, byStaffId: string) => void
  savePayoutField: (field: PayoutField, byStaffId: string) => void
  deletePayoutField: (id: string, byStaffId: string) => void
  adjustPoints: (input: { customerId: string; delta: number; reason: string }, byStaffId: string) => void
  reviewWithdrawal: (id: string, action: 'approve' | 'reject' | 'paid', byStaffId: string) => void
  updateCheckinRules: (patch: Partial<CheckinRules>, byStaffId: string) => void
  updateReferralRules: (patch: Partial<ReferralRules>, byStaffId: string) => void
  cancelReferralReward: (anomalyId: string, byStaffId: string) => void
  saveBanner: (banner: Banner, byStaffId: string) => void
  deleteBanner: (id: string, byStaffId: string) => void
  saveAnnouncement: (a: Announcement, byStaffId: string) => void
  deleteAnnouncement: (id: string, byStaffId: string) => void
}

/** 某客户当前积分余额：最近一条流水的 balanceAfter */
export function walletBalance(txs: WalletTx[], customerId: string): number {
  const last = txs.find((t) => t.customerId === customerId)
  return last?.balanceAfter ?? 0
}

export function moduleActions(set: Set, get: Get): ModuleActions {
  return {
    updateWalletSettings: (patch, byStaffId) =>
      set((s) => ({ walletSettings: { ...s.walletSettings, ...patch }, audit: withAudit(s.audit, 'wallet.settings', `修改钱包设置：${Object.keys(patch).join('、')}`, byStaffId) })),

    savePayoutField: (field, byStaffId) =>
      set((s) => {
        const exists = s.payoutFields.some((f) => f.id === field.id)
        return {
          payoutFields: exists ? s.payoutFields.map((f) => (f.id === field.id ? field : f)) : [...s.payoutFields, field],
          audit: withAudit(s.audit, 'wallet.settings', `${exists ? '修改' : '新增'}收款账户字段「${field.name}」`, byStaffId),
        }
      }),

    deletePayoutField: (id, byStaffId) =>
      set((s) => {
        const f = s.payoutFields.find((x) => x.id === id)
        return { payoutFields: s.payoutFields.filter((x) => x.id !== id), audit: withAudit(s.audit, 'wallet.settings', `删除收款账户字段「${f?.name}」`, byStaffId) }
      }),

    adjustPoints: (input, byStaffId) => {
      const s = get()
      const c = s.customers.find((x) => x.id === input.customerId)
      if (!c || !input.delta) return
      const by = s.staff.find((x) => x.id === byStaffId)?.name ?? ''
      const bal = walletBalance(s.walletTxs, input.customerId) + input.delta
      const tx: WalletTx = { id: newId('wt'), at: now(), customerId: input.customerId, type: 'admin_adjust', amount: input.delta, balanceAfter: bal, note: `${input.reason}（${by}）` }
      set({
        walletTxs: [tx, ...s.walletTxs],
        audit: withAudit(s.audit, 'wallet.adjust', `给客户「${c.nickname}」${input.delta > 0 ? '增加' : '减少'} ${Math.abs(input.delta)} ${s.walletSettings.unitName}，原因：${input.reason}；客户收到系统通知`, byStaffId),
      })
    },

    reviewWithdrawal: (id, action, byStaffId) => {
      const s = get()
      const w = s.withdrawals.find((x) => x.id === id)
      if (!w) return
      const c = s.customers.find((x) => x.id === w.customerId)
      const status: Withdrawal['status'] = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'paid'
      let walletTxs = s.walletTxs
      if (action === 'reject') {
        const bal = walletBalance(s.walletTxs, w.customerId) + w.points
        walletTxs = [{ id: newId('wt'), at: now(), customerId: w.customerId, type: 'withdraw_refund', amount: w.points, balanceAfter: bal, note: '提现驳回，积分解冻' }, ...s.walletTxs]
      }
      if (action === 'paid') {
        const bal = walletBalance(s.walletTxs, w.customerId)
        walletTxs = [{ id: newId('wt'), at: now(), customerId: w.customerId, type: 'withdraw_paid', amount: 0, balanceAfter: bal, note: `已打款 ${(w.points / s.walletSettings.rate).toFixed(2)} ${s.walletSettings.currency}` }, ...s.walletTxs]
      }
      const label = action === 'approve' ? '审核通过' : action === 'reject' ? '驳回' : '标记已打款'
      set({
        withdrawals: s.withdrawals.map((x) => (x.id === id ? { ...x, status } : x)),
        walletTxs,
        audit: withAudit(s.audit, 'wallet.withdrawal', `提现 ${w.points} ${s.walletSettings.unitName}（${c?.nickname}）：${label}`, byStaffId),
      })
    },

    updateCheckinRules: (patch, byStaffId) =>
      set((s) => ({ checkinRules: { ...s.checkinRules, ...patch }, audit: withAudit(s.audit, 'checkin.settings', `修改签到规则：${Object.keys(patch).join('、')}`, byStaffId) })),

    updateReferralRules: (patch, byStaffId) =>
      set((s) => ({ referralRules: { ...s.referralRules, ...patch }, audit: withAudit(s.audit, 'referral.settings', `修改推荐奖励规则：${Object.keys(patch).join('、')}`, byStaffId) })),

    cancelReferralReward: (anomalyId, byStaffId) =>
      set((s) => {
        const a = s.referralAnomalies.find((x) => x.id === anomalyId)
        const c = s.customers.find((x) => x.id === a?.customerId)
        return {
          referralAnomalies: s.referralAnomalies.map((x) => (x.id === anomalyId ? { ...x, cancelled: true } : x)),
          audit: withAudit(s.audit, 'referral.cancel', `取消客户「${c?.nickname}」的推荐奖励（${a?.type === 'same_device' ? '同设备多账号' : '短时间大量注册'}）`, byStaffId),
        }
      }),

    saveBanner: (banner, byStaffId) =>
      set((s) => {
        const exists = s.banners.some((b) => b.id === banner.id)
        return {
          banners: (exists ? s.banners.map((b) => (b.id === banner.id ? banner : b)) : [...s.banners, banner]).sort((a, b) => a.order - b.order),
          audit: withAudit(s.audit, 'banner.update', `${exists ? '修改' : '创建'}横幅「${banner.title}」`, byStaffId),
        }
      }),

    deleteBanner: (id, byStaffId) =>
      set((s) => {
        const b = s.banners.find((x) => x.id === id)
        return { banners: s.banners.filter((x) => x.id !== id), audit: withAudit(s.audit, 'banner.update', `删除横幅「${b?.title}」`, byStaffId) }
      }),

    saveAnnouncement: (a, byStaffId) =>
      set((s) => {
        const exists = s.announcements.some((x) => x.id === a.id)
        return {
          announcements: exists ? s.announcements.map((x) => (x.id === a.id ? a : x)) : [a, ...s.announcements],
          audit: withAudit(s.audit, 'announcement.update', `${exists ? '修改' : '创建'}公告「${a.title}」`, byStaffId),
        }
      }),

    deleteAnnouncement: (id, byStaffId) =>
      set((s) => {
        const a = s.announcements.find((x) => x.id === id)
        return { announcements: s.announcements.filter((x) => x.id !== id), audit: withAudit(s.audit, 'announcement.update', `删除公告「${a?.title}」`, byStaffId) }
      }),
  }
}
