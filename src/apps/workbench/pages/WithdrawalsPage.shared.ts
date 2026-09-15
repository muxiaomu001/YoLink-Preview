/**
 * 提现审核页共用：状态文案、脱敏、折算、审计反查。纯函数与常量，不含组件。
 */
import type { DemoState, WithdrawalStatus } from '@/domain/types'
import { WITHDRAWAL_AUDIT_TAG } from '@/store/actions/D-extra'

/** 04 文档表格的状态口径：待审核 / 待打款 / 已打款 / 已驳回（两级审核的"待复核"本轮模型未建） */
export const WD_STATUS_LABEL: Record<WithdrawalStatus, string> = { pending: '待审核', approved: '待打款', paid: '已打款', rejected: '已驳回' }
export const WD_STATUS_TONE: Record<WithdrawalStatus, 'amber' | 'blue' | 'green' | 'red'> = { pending: 'amber', approved: 'blue', paid: 'green', rejected: 'red' }
export const WD_STATUSES = Object.keys(WD_STATUS_LABEL) as WithdrawalStatus[]

/** 账号脱敏：保留前 2 后 4 */
export function maskAccountNo(v: string): string {
  if (v.length <= 6) return `${v.slice(0, 1)}****`
  return `${v.slice(0, 2)}${'*'.repeat(Math.min(8, v.length - 6))}${v.slice(-4)}`
}

/** 收款账户一行摘要：类型、户名、账号（脱敏） */
export function accountSummary(account: Record<string, string>): string {
  const bank = account['银行名称'] ?? Object.values(account)[0] ?? '-'
  const holder = account['户名'] ?? ''
  const no = account['账号'] ?? ''
  return [bank, holder, no ? maskAccountNo(no) : ''].filter(Boolean).join(' · ')
}

/** 折算金额：按当前折算率（演示模型未记录每笔当时折算率） */
export function moneyOf(s: DemoState, points: number): string {
  return `${(points / s.walletSettings.rate).toFixed(2)} ${s.walletSettings.currency}`
}

/** 从审计反查这笔提现的审核人与原因 / 凭证（审计不落 localStorage，刷新后只剩种子状态） */
export function reviewInfoOf(s: DemoState, id: string): { reviewer: string; note: string } {
  const entry = s.audit.find((a) => a.type === 'wallet.withdrawal' && a.detail.includes(`${WITHDRAWAL_AUDIT_TAG} ${id}`))
  if (!entry) return { reviewer: '', note: '' }
  const reviewer = /审核人 ([^；]+)/.exec(entry.detail)?.[1] ?? ''
  const note = /(?:原因|凭证)：([^；]+)/.exec(entry.detail)?.[1] ?? ''
  return { reviewer, note }
}

/** 客户冻结积分：待审核 + 待打款的申请之和 */
export function frozenOf(s: DemoState, customerId: string): number {
  return s.withdrawals.filter((w) => w.customerId === customerId && (w.status === 'pending' || w.status === 'approved')).reduce((sum, w) => sum + w.points, 0)
}
