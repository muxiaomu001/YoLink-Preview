/**
 * 提现审核页（P2，07 文档提现流程 + 04 文档提现审核页）：钱包模块启用且员工有 review_withdrawal 才可进。
 * 状态流转复用管理后台的 reviewWithdrawal；审核人与原因 / 凭证由 D-extra 的 reviewWithdrawalDetailed 补进审计。
 */
import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import type { Withdrawal, WithdrawalStatus } from '@/domain/types'
import { downloadCsv, fileStamp } from '@/domain/csv'
import { fmtDateTime } from '@/domain/time'
import { customerById } from '@/store/selectors'
import { confirm } from '@/ui/confirm'
import { Button, Checkbox, Input, Select } from '@/ui/primitives'
import { Card, Note, PageHeader, Stat, Table } from '@/ui/display'
import { HelpTip } from '@/ui/help'
import { toast } from '@/ui/overlay'
import { CustomerCell } from '@/apps/admin/pages/WalletPage.parts'
import { useWorkbench } from '../useWorkbench'
import { NoteModal, StatusPill, WithdrawalDetailModal } from './WithdrawalsPage.parts'
import { WD_STATUSES, WD_STATUS_LABEL, accountSummary, moneyOf, reviewInfoOf } from './WithdrawalsPage.shared'

type StatusFilter = '' | WithdrawalStatus

export function WithdrawalsPage() {
  const { s, staff, can } = useWorkbench()
  const ws = s.walletSettings
  const [status, setStatus] = useState<StatusFilter>('')
  const [minMoney, setMinMoney] = useState('')
  const [maxMoney, setMaxMoney] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [detail, setDetail] = useState<Withdrawal | null>(null)
  const [noteFor, setNoteFor] = useState<{ kind: 'reject' | 'paid'; w: Withdrawal } | null>(null)

  const rows = useMemo(
    () =>
      [...s.withdrawals]
        .sort((a, b) => b.at.localeCompare(a.at))
        .filter((w) => {
          const money = w.points / ws.rate
          if (status && w.status !== status) return false
          if (minMoney && money < Number(minMoney)) return false
          if (maxMoney && money > Number(maxMoney)) return false
          if (from && w.at < new Date(`${from}T00:00:00`).toISOString()) return false
          if (to && w.at > new Date(`${to}T23:59:59`).toISOString()) return false
          return true
        }),
    [s.withdrawals, ws.rate, status, minMoney, maxMoney, from, to],
  )
  const pendingRows = rows.filter((w) => w.status === 'pending')
  const selectedIds = pendingRows.filter((w) => selected[w.id]).map((w) => w.id)
  const canMarkPaid = can('mark_paid')
  const twoLevel = ws.reviewLevels === 2

  if (!s.enterprise.modules.wallet) return <div className="p-5"><Note tone="amber">钱包模块已停用，提现审核不可用。管理后台 → 模块启停 里开启。</Note></div>
  if (!can('review_withdrawal')) return <div className="p-5"><Note tone="amber">当前员工角色没有 review_withdrawal 能力。管理后台 → 角色 里给角色勾上「审核提现」。</Note></div>
  const staffId = staff?.id ?? ''

  const approve = async (w: Withdrawal) => {
    const c = customerById(s, w.customerId)
    const ok = await confirm({ title: `通过：${c?.nickname} · ${w.points.toLocaleString('zh-CN')} ${ws.unitName}`, body: twoLevel ? '两级审核：通过后进入管理员复核，再进待打款。' : '单级审核：通过后状态变"待打款"，财务标记打款后才算完成。', okText: '通过' })
    if (!ok) return
    s.reviewWithdrawalDetailed({ id: w.id, action: 'approve' }, staffId)
    toast(`已通过「${c?.nickname}」的提现，等待打款 ${moneyOf(s, w.points)}；审核人 ${staff?.name}`)
  }
  const batchApprove = async () => {
    const ok = await confirm({ title: `批量通过 ${selectedIds.length} 条`, body: `合计 ${selectedIds.reduce((sum, id) => sum + (s.withdrawals.find((w) => w.id === id)?.points ?? 0), 0).toLocaleString('zh-CN')} ${ws.unitName}，全部进入待打款。`, okText: '批量通过' })
    if (!ok) return
    selectedIds.forEach((id) => s.reviewWithdrawalDetailed({ id, action: 'approve' }, staffId))
    setSelected({})
    toast(`已批量通过 ${selectedIds.length} 条，审核人 ${staff?.name}`)
  }
  const submitNote = (note: string) => {
    if (!noteFor) return
    const c = customerById(s, noteFor.w.customerId)
    s.reviewWithdrawalDetailed({ id: noteFor.w.id, action: noteFor.kind, note }, staffId)
    toast(noteFor.kind === 'reject' ? `已驳回，${noteFor.w.points.toLocaleString('zh-CN')} ${ws.unitName}已退回「${c?.nickname}」余额，客户收到系统通知` : `已标记打款 ${moneyOf(s, noteFor.w.points)}，冻结清零，客户收到通知`)
    setNoteFor(null)
  }
  const exportCsv = () => {
    downloadCsv(
      `提现记录-${fileStamp()}.csv`,
      ['客户昵称', '账号 ID', ws.unitName, `金额（${ws.currency}）`, '收款账户', '提交时间', '状态', '审核人', '驳回原因'],
      rows.map((w) => {
        const c = customerById(s, w.customerId)
        const info = reviewInfoOf(s, w.id)
        return [c?.nickname ?? '', c?.accountId ?? '', w.points, (w.points / ws.rate).toFixed(2), accountSummary(w.account), fmtDateTime(w.at), WD_STATUS_LABEL[w.status], info.reviewer, w.status === 'rejected' ? info.note : '']
      }),
    )
    toast(`已导出 ${rows.length} 条`)
  }

  const counts = (st: WithdrawalStatus) => s.withdrawals.filter((w) => w.status === st).length

  return (
    <div className="thin-scroll h-full overflow-y-auto p-5">
      <PageHeader
        title="提现审核"
        desc={
          <span className="inline-flex items-center gap-1.5">
            客户提交后积分冻结；通过后待财务打款，驳回须填原因且积分退回。
            <HelpTip text={<span>两级审核对应两个员工能力：review_withdrawal（通过 / 驳回）与 mark_paid（财务确认已打款）。当前审核层级：{twoLevel ? '两级（批量通过不可用）' : '单级'}。折算口径 {ws.rate.toLocaleString('zh-CN')} {ws.unitName} = 1 {ws.currency}，手续费 {ws.fee || '0'}。每一步记审计、客户收系统通知。</span>} />
          </span>
        }
        extra={<Button size="sm" onClick={exportCsv} disabled={rows.length === 0}><Download size={13} /> 导出 CSV</Button>}
      />
      <div className="mb-4 grid grid-cols-4 gap-3">
        <Stat label="待审核" value={counts('pending')} tone={counts('pending') ? 'warn' : 'default'} sub="等我处理" />
        <Stat label="待打款" value={counts('approved')} sub={canMarkPaid ? '我可以标记已打款' : '需要 mark_paid 能力'} />
        <Stat label="已打款" value={counts('paid')} />
        <Stat label="已驳回" value={counts('rejected')} />
      </div>
      <Card
        title={`提现申请（${rows.length} 条）`}
        padded={false}
        extra={
          <div className="flex items-center gap-2">
            <Select className="w-28" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
              <option value="">全部状态</option>
              {WD_STATUSES.map((k) => (
                <option key={k} value={k}>{WD_STATUS_LABEL[k]}</option>
              ))}
            </Select>
            <Input type="number" min={0} className="w-24" value={minMoney} onChange={(e) => setMinMoney(e.target.value)} placeholder={`最小 ${ws.currency}`} />
            <span className="text-[12px] text-zinc-400">到</span>
            <Input type="number" min={0} className="w-24" value={maxMoney} onChange={(e) => setMaxMoney(e.target.value)} placeholder={`最大 ${ws.currency}`} />
            <Input type="date" className="w-36" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-[12px] text-zinc-400">至</span>
            <Input type="date" className="w-36" value={to} onChange={(e) => setTo(e.target.value)} />
            <Button size="sm" variant="primary" disabled={selectedIds.length === 0 || twoLevel} title={twoLevel ? '批量通过限单级审核' : undefined} onClick={() => void batchApprove()}>
              批量通过{selectedIds.length ? `（${selectedIds.length}）` : ''}
            </Button>
          </div>
        }
      >
        <Table
          rows={rows}
          rowKey={(w) => w.id}
          empty="没有符合筛选的提现申请"
          columns={[
            {
              key: 'sel',
              title: <Checkbox checked={pendingRows.length > 0 && selectedIds.length === pendingRows.length} disabled={pendingRows.length === 0} onChange={(v) => setSelected(v ? Object.fromEntries(pendingRows.map((w) => [w.id, true])) : {})} />,
              width: '32px',
              render: (w) => (w.status === 'pending' ? <Checkbox checked={!!selected[w.id]} onChange={(v) => setSelected((m) => ({ ...m, [w.id]: v }))} /> : null),
            },
            { key: 'user', title: '客户', render: (w) => <CustomerCell c={customerById(s, w.customerId)} /> },
            { key: 'points', title: `积分数量（${ws.unitName}）`, align: 'right', render: (w) => <span className="tabular-nums font-medium">{w.points.toLocaleString('zh-CN')}</span> },
            { key: 'money', title: '折算金额', align: 'right', render: (w) => <span className="tabular-nums">{moneyOf(s, w.points)}</span> },
            { key: 'account', title: '收款账户', render: (w) => <span className="text-[12px] text-zinc-600">{accountSummary(w.account)}</span> },
            { key: 'at', title: '提交时间', render: (w) => <span className="tabular-nums text-zinc-600">{fmtDateTime(w.at)}</span> },
            { key: 'status', title: '状态', render: (w) => <StatusPill status={w.status} /> },
            {
              key: 'ops',
              title: '操作',
              align: 'right',
              render: (w) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setDetail(w)}>查看详情</Button>
                  {w.status === 'pending' && (
                    <>
                      <Button size="sm" variant="primary" onClick={() => void approve(w)}>通过</Button>
                      <Button size="sm" variant="danger" onClick={() => setNoteFor({ kind: 'reject', w })}>驳回</Button>
                    </>
                  )}
                  {w.status === 'approved' && (
                    <Button size="sm" variant="primary" disabled={!canMarkPaid} title={canMarkPaid ? undefined : '需要 mark_paid 能力（财务）'} onClick={() => setNoteFor({ kind: 'paid', w })}>
                      标记已打款
                    </Button>
                  )}
                  {(w.status === 'paid' || w.status === 'rejected') && <span className="self-center text-[11px] text-zinc-400">{reviewInfoOf(s, w.id).reviewer ? `审核人 ${reviewInfoOf(s, w.id).reviewer}` : '已结束'}</span>}
                </div>
              ),
            },
          ]}
        />
      </Card>
      {detail && <WithdrawalDetailModal s={s} w={detail} onClose={() => setDetail(null)} />}
      {noteFor && <NoteModal kind={noteFor.kind} w={noteFor.w} s={s} onClose={() => setNoteFor(null)} onSubmit={submitNote} />}
    </div>
  )
}
