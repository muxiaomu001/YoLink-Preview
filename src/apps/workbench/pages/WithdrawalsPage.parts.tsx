/**
 * 提现审核页：状态 Pill、详情弹窗与填原因 / 凭证弹窗。
 */
import { useState } from 'react'
import type { DemoState, Withdrawal, WithdrawalStatus } from '@/domain/types'
import { fmtDateTime } from '@/domain/time'
import { walletBalance } from '@/store/actions/modules'
import { customerById } from '@/store/selectors'
import { Button, Field, Textarea } from '@/ui/primitives'
import { Avatar, KV, Note, Pill, Table } from '@/ui/display'
import { Modal } from '@/ui/overlay'
import { CustomerCell } from '@/apps/admin/pages/WalletPage.parts'
import { WD_STATUS_LABEL, WD_STATUS_TONE, frozenOf, moneyOf, reviewInfoOf } from './WithdrawalsPage.shared'

export function StatusPill({ status }: { status: WithdrawalStatus }) {
  return <Pill tone={WD_STATUS_TONE[status]}>{WD_STATUS_LABEL[status]}</Pill>
}

/** 查看详情：客户资料卡（钱包部分）、历史提现、收款账户 */
export function WithdrawalDetailModal({ s, w, onClose }: { s: DemoState; w: Withdrawal; onClose: () => void }) {
  const c = customerById(s, w.customerId)
  const ws = s.walletSettings
  const balance = walletBalance(s.walletTxs, w.customerId)
  const frozen = frozenOf(s, w.customerId)
  const paidTotal = s.withdrawals.filter((x) => x.customerId === w.customerId && x.status === 'paid').reduce((sum, x) => sum + x.points, 0)
  const txs = s.walletTxs.filter((t) => t.customerId === w.customerId).slice(0, 5)
  const history = s.withdrawals.filter((x) => x.customerId === w.customerId && x.id !== w.id).sort((a, b) => b.at.localeCompare(a.at))
  const info = reviewInfoOf(s, w.id)
  return (
    <Modal open onClose={onClose} title="提现详情" width={640} footer={<Button onClick={onClose}>关闭</Button>}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar text={c?.nickname ?? '?'} size={36} />
          <div>
            <CustomerCell c={c} />
            <div className="text-[11px] text-zinc-400">注册于 {c ? fmtDateTime(c.registeredAt) : '-'}</div>
          </div>
          <div className="ml-auto"><StatusPill status={w.status} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <KV
            items={[
              { k: '本次提现', v: <b className="tabular-nums">{w.points.toLocaleString('zh-CN')} {ws.unitName} ≈ {moneyOf(s, w.points)}</b> },
              { k: '手续费', v: ws.fee || '0' },
              { k: '提交时间', v: fmtDateTime(w.at) },
              { k: '审核人', v: info.reviewer || <span className="text-zinc-400">未审核</span> },
              ...(info.note ? [{ k: w.status === 'rejected' ? '驳回原因' : '打款凭证', v: info.note }] : []),
            ]}
          />
          <KV
            items={[
              { k: '可用余额', v: <span className="tabular-nums">{balance.toLocaleString('zh-CN')} {ws.unitName}</span> },
              { k: '冻结积分', v: <span className="tabular-nums">{frozen.toLocaleString('zh-CN')} {ws.unitName}</span> },
              { k: '累计提现', v: <span className="tabular-nums">{paidTotal.toLocaleString('zh-CN')} {ws.unitName}</span> },
            ]}
          />
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-700">收款账户（详情页显示全文，列表脱敏）</div>
          <div className="rounded-md bg-zinc-50 p-2">
            <KV items={Object.entries(w.account).map(([k, v]) => ({ k, v }))} />
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-700">最近流水</div>
          <Table
            rows={txs}
            rowKey={(t) => t.id}
            dense
            empty="没有流水"
            columns={[
              { key: 'at', title: '时间', render: (t) => <span className="tabular-nums text-zinc-500">{fmtDateTime(t.at)}</span> },
              { key: 'amount', title: '变动', align: 'right', render: (t) => <span className={`tabular-nums ${t.amount > 0 ? 'text-emerald-700' : t.amount < 0 ? 'text-red-600' : 'text-zinc-400'}`}>{t.amount > 0 ? `+${t.amount}` : t.amount}</span> },
              { key: 'bal', title: '余额', align: 'right', render: (t) => <span className="tabular-nums">{t.balanceAfter}</span> },
              { key: 'note', title: '备注', render: (t) => <span className="text-zinc-600">{t.note}</span> },
            ]}
          />
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-700">历史提现</div>
          <Table
            rows={history}
            rowKey={(x) => x.id}
            dense
            empty="没有其他提现记录"
            columns={[
              { key: 'at', title: '时间', render: (x) => <span className="tabular-nums text-zinc-500">{fmtDateTime(x.at)}</span> },
              { key: 'points', title: ws.unitName, align: 'right', render: (x) => <span className="tabular-nums">{x.points.toLocaleString('zh-CN')}</span> },
              { key: 'status', title: '状态', render: (x) => <StatusPill status={x.status} /> },
            ]}
          />
        </div>
      </div>
    </Modal>
  )
}

/** 驳回填原因 / 标记已打款填凭证号 */
export function NoteModal({ kind, w, s, onClose, onSubmit }: { kind: 'reject' | 'paid'; w: Withdrawal; s: DemoState; onClose: () => void; onSubmit: (note: string) => void }) {
  const [note, setNote] = useState('')
  const c = customerById(s, w.customerId)
  const isReject = kind === 'reject'
  const error = isReject && !note.trim() ? '驳回原因必填，客户会在系统通知里看到' : ''
  return (
    <Modal
      open
      onClose={onClose}
      title={isReject ? '驳回提现申请' : '标记已打款'}
      width={460}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant={isReject ? 'danger' : 'primary'} disabled={!!error} onClick={() => onSubmit(note.trim())}>{isReject ? '确认驳回' : '确认已打款'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Note tone={isReject ? 'amber' : 'blue'}>
          {c?.nickname} · {w.points.toLocaleString('zh-CN')} {s.walletSettings.unitName} ≈ {moneyOf(s, w.points)}。
          {isReject ? '驳回后冻结积分立即退回客户余额，客户收到系统通知。' : '打款在系统外完成；标记后冻结清零、写一条 withdraw_paid 流水，不可撤销。'}
        </Note>
        <Field label={isReject ? '驳回原因' : '打款凭证号 / 备注'} required={isReject} hint="记入审计日志">
          <Textarea rows={2} maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} placeholder={isReject ? '如：收款户名与实名不一致' : '如：HSBC 流水号 2026091500123'} />
        </Field>
        {error && note.length === 0 && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}
