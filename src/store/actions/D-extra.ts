/**
 * 代号 D 补充动作：工作台提现审核需要"驳回必填原因""打款填凭证号""审核人记当前员工"，
 * 而 modules.ts 的 reviewWithdrawal 只接收动作与员工 ID。这里复用它做状态流转与积分解冻，
 * 再把审核人、原因 / 凭证与单号补进刚写的那条审计（单号用于导出时反查）。
 */
import { type Get, type Set } from './helpers'

export interface WithdrawalReviewInput {
  id: string
  action: 'approve' | 'reject' | 'paid'
  /** 驳回原因或打款凭证号 / 备注 */
  note?: string
}

export interface DExtraActions {
  /** 审核提现并记录审核人与原因 / 凭证 */
  reviewWithdrawalDetailed: (input: WithdrawalReviewInput, byStaffId: string) => void
}

/** 审计里的单号标记：导出 CSV 时用它找到审核人与驳回原因 */
export const WITHDRAWAL_AUDIT_TAG = '单号'

export function dExtraActions(set: Set, get: Get): DExtraActions {
  return {
    reviewWithdrawalDetailed: ({ id, action, note }, byStaffId) => {
      const before = get()
      const w = before.withdrawals.find((x) => x.id === id)
      if (!w) return
      const legal = (action === 'approve' && w.status === 'pending') || (action === 'reject' && w.status === 'pending') || (action === 'paid' && w.status === 'approved')
      if (!legal) return
      before.reviewWithdrawal(id, action, byStaffId)
      const reviewer = before.staff.find((x) => x.id === byStaffId)?.name ?? byStaffId
      const extra = note?.trim() ? `${action === 'reject' ? '原因' : '凭证'}：${note.trim()}` : ''
      set((s) => {
        const [head, ...rest] = s.audit
        if (!head || head.type !== 'wallet.withdrawal') return {}
        const detail = [head.detail, `审核人 ${reviewer}`, extra, `${WITHDRAWAL_AUDIT_TAG} ${id}`].filter(Boolean).join('；')
        return { audit: [{ ...head, detail }, ...rest] }
      })
    },
  }
}
