import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { Customer, WalletTxType, Withdrawal } from '@/domain/types'
import { fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { walletBalance } from '@/store/actions/modules'
import { customerById } from '@/store/selectors'
import { confirm } from '@/ui/confirm'
import { Button, Field, Input, Select, Textarea } from '@/ui/primitives'
import { Card, KV, Note, Pill, Table } from '@/ui/display'
import { toast } from '@/ui/overlay'

/** 流水类型：原样显示 key 并加中文 */
const TX_TYPE_LABEL: Record<WalletTxType, string> = {
  checkin_reward: '签到奖励',
  referral_reward: '推荐奖励',
  admin_adjust: '手动加减',
  withdraw_freeze: '提现冻结',
  withdraw_paid: '提现打款',
  withdraw_refund: '驳回解冻',
}

const TX_TYPES = Object.keys(TX_TYPE_LABEL) as WalletTxType[]

/** 客户显示：昵称 + 账号 ID */
export function CustomerCell({ c }: { c?: Customer }) {
  if (!c) return <span className="text-zinc-400">未知客户</span>
  return (
    <span>
      <span className="font-medium text-zinc-900">{c.nickname}</span>
      <span className="ml-1 font-mono text-[11px] text-zinc-400">{c.accountId}</span>
    </span>
  )
}

function matchCustomer(c: Customer, q: string) {
  const k = q.trim().toLowerCase()
  return !k || c.nickname.toLowerCase().includes(k) || c.accountId.toLowerCase().includes(k)
}

/** 手动加减积分 */
export function AdjustTab() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const ws = s.walletSettings
  const [query, setQuery] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [kind, setKind] = useState<'add' | 'sub'>('add')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const matches = useMemo(() => s.customers.filter((c) => !c.deletedAt && matchCustomer(c, query)).slice(0, 30), [s.customers, query])
  const target = customerById(s, customerId)
  const balance = target ? walletBalance(s.walletTxs, target.id) : 0
  const n = Number(amount)
  const isInt = /^\d+$/.test(amount) && n > 0
  const error = !target ? '请先选择用户' : !isInt ? '积分数量必须是正整数' : kind === 'sub' && n > balance ? `减少数量超过当前余额 ${balance}` : !reason.trim() ? '原因必填，会记入审计' : ''

  const submit = async () => {
    if (error || !target) return
    const delta = kind === 'add' ? n : -n
    const ok = await confirm({
      title: `确认${kind === 'add' ? '增加' : '减少'} ${n} ${ws.unitName}`,
      body: `客户「${target.nickname}」当前余额 ${balance}，操作后 ${balance + delta}。原因：${reason.trim()}`,
      okText: '确认',
    })
    if (!ok) return
    s.adjustPoints({ customerId: target.id, delta, reason: reason.trim() }, admin)
    toast(`已给「${target.nickname}」${kind === 'add' ? '增加' : '减少'} ${n} ${ws.unitName}，客户收到系统通知`)
    setAmount('')
    setReason('')
  }

  return (
    <div className="grid grid-cols-[1fr_300px] gap-4">
      <Card title="手动加减积分">
        <div className="space-y-3">
          <Field label="用户" required hint="输入昵称或账号 ID 过滤后选择">
            <div className="grid grid-cols-2 gap-2">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索昵称 / 账号 ID" />
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">{matches.length ? `请选择（${matches.length} 位匹配）` : '无匹配客户'}</option>
                {matches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nickname}（{c.accountId}）
                  </option>
                ))}
              </Select>
            </div>
          </Field>
          <Field label="类型">
            <div className="flex h-8 items-center gap-4 text-[13px] text-zinc-700">
              <label className="flex items-center gap-1.5">
                <input type="radio" className="accent-brand-700" checked={kind === 'add'} onChange={() => setKind('add')} /> 增加
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" className="accent-brand-700" checked={kind === 'sub'} onChange={() => setKind('sub')} /> 减少
              </label>
            </div>
          </Field>
          <Field label={`${ws.unitName}数量`} required hint="正整数">
            <Input type="number" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="如：500" />
          </Field>
          <Field label="原因" required hint="必填，记入审计日志">
            <Textarea rows={2} maxLength={128} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="如：线下策略会到场补偿" />
          </Field>
          {error && (amount || reason || customerId) && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end">
            <Button variant="primary" disabled={!!error} onClick={() => void submit()}>
              确认
            </Button>
          </div>
        </div>
      </Card>
      <div className="space-y-3">
        <Card title="所选客户">
          {target ? (
            <KV
              items={[
                { k: '客户', v: <CustomerCell c={target} /> },
                { k: '当前余额', v: <span className="text-lg font-semibold tabular-nums">{balance.toLocaleString('zh-CN')} {ws.unitName}</span> },
                { k: '操作后', v: isInt ? <span className="tabular-nums">{(balance + (kind === 'add' ? n : -n)).toLocaleString('zh-CN')} {ws.unitName}</span> : '-' },
              ]}
            />
          ) : (
            <p className="text-xs text-zinc-400">先在左侧选择用户</p>
          )}
        </Card>
        <Note>点击「确认」后立即入账，客户 App 收到一条系统通知，审计日志记录操作人、数量与原因。对应权限：adjust。</Note>
      </div>
    </div>
  )
}

/** 流水查询 */
export function TxsTab() {
  const s = useStore()
  const [query, setQuery] = useState('')
  const [type, setType] = useState<'' | WalletTxType>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const rows = useMemo(
    () =>
      s.walletTxs.filter((t) => {
        const c = customerById(s, t.customerId)
        if (query && !(c && matchCustomer(c, query))) return false
        if (type && t.type !== type) return false
        if (from && t.at < new Date(`${from}T00:00:00`).toISOString()) return false
        if (to && t.at > new Date(`${to}T23:59:59`).toISOString()) return false
        return true
      }),
    [s, query, type, from, to],
  )

  return (
    <Card
      title={`流水（${rows.length} 条）`}
      padded={false}
      extra={
        <div className="flex items-center gap-2">
          <Input className="w-40" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="用户昵称 / 账号 ID" />
          <Select className="w-36" value={type} onChange={(e) => setType(e.target.value as '' | WalletTxType)}>
            <option value="">全部类型</option>
            {TX_TYPES.map((k) => (
              <option key={k} value={k}>
                {TX_TYPE_LABEL[k]}
              </option>
            ))}
          </Select>
          <Input type="date" className="w-36" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-xs text-zinc-400">至</span>
          <Input type="date" className="w-36" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      }
    >
      <Table
        rows={rows.slice(0, 200)}
        rowKey={(t) => t.id}
        dense
        columns={[
          { key: 'at', title: '时间', render: (t) => <span className="tabular-nums text-zinc-600">{fmtDateTime(t.at)}</span> },
          { key: 'user', title: '用户', render: (t) => <CustomerCell c={customerById(s, t.customerId)} /> },
          {
            key: 'type',
            title: '类型',
            render: (t) => (
              <span>
                <span className="font-mono text-[11px] text-zinc-500">{t.type}</span>
                <span className="ml-1.5 text-xs text-zinc-700">{TX_TYPE_LABEL[t.type]}</span>
              </span>
            ),
          },
          {
            key: 'amount',
            title: '数量',
            align: 'right',
            render: (t) => <span className={`font-medium tabular-nums ${t.amount > 0 ? 'text-emerald-700' : t.amount < 0 ? 'text-red-600' : 'text-zinc-400'}`}>{t.amount > 0 ? `+${t.amount}` : t.amount}</span>,
          },
          { key: 'balance', title: '变动后余额', align: 'right', render: (t) => <span className="tabular-nums">{t.balanceAfter.toLocaleString('zh-CN')}</span> },
          { key: 'note', title: '备注', render: (t) => <span className="text-zinc-600">{t.note}</span> },
        ]}
      />
      {rows.length > 200 && <p className="px-3 py-2 text-[11px] text-zinc-400">只显示前 200 条，请缩小筛选范围。</p>}
    </Card>
  )
}

/** 提现审核 */
export function WithdrawalsTab() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const ws = s.walletSettings
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const toggle = (id: string) => setExpanded((m) => ({ ...m, [id]: !m[id] }))

  const act = async (w: Withdrawal, action: 'approve' | 'reject' | 'paid') => {
    const c = customerById(s, w.customerId)
    const money = `${(w.points / ws.rate).toFixed(2)} ${ws.currency}`
    const text = action === 'approve' ? { title: '审核通过', body: `通过后进入待打款，财务标记打款后才算完成。` } : action === 'reject' ? { title: '驳回申请', body: `驳回后冻结的 ${w.points} ${ws.unitName}立即解冻回到客户余额。` } : { title: '标记已打款', body: `确认已向客户收款账户打款 ${money}？标记后不可撤销。` }
    const ok = await confirm({ title: `${text.title}：${c?.nickname} · ${w.points} ${ws.unitName}`, body: text.body, okText: text.title, danger: action === 'reject' })
    if (!ok) return
    s.reviewWithdrawal(w.id, action, admin)
    toast(action === 'approve' ? `已通过「${c?.nickname}」的提现，等待打款 ${money}` : action === 'reject' ? `已驳回，${w.points} ${ws.unitName}已解冻` : `已标记打款 ${money}，客户收到通知`)
  }

  const statusPill = (st: Withdrawal['status']) =>
    st === 'pending' ? <Pill tone="amber">待处理</Pill> : st === 'approved' ? <Pill tone="blue">已通过，待打款</Pill> : st === 'paid' ? <Pill tone="green">已打款</Pill> : <Pill tone="red">已驳回</Pill>

  const rows = [...s.withdrawals].sort((a, b) => b.at.localeCompare(a.at))

  return (
    <div className="space-y-4">
      <Note>
        两级审核对应两个权限：<b>review_withdrawal</b>（审核通过 / 驳回）与 <b>mark_paid</b>（财务确认已打款）。当前审核层级：{ws.reviewLevels === 2 ? '两级' : '单级'}。驳回自动解冻积分，标记打款后写一条 withdraw_paid 流水。
      </Note>
      <Card title="提现申请" padded={false}>
        <Table
          rows={rows}
          rowKey={(w) => w.id}
          columns={[
            { key: 'at', title: '时间', render: (w) => <span className="tabular-nums text-zinc-600">{fmtDateTime(w.at)}</span> },
            { key: 'user', title: '用户', render: (w) => <CustomerCell c={customerById(s, w.customerId)} /> },
            { key: 'points', title: ws.unitName, align: 'right', render: (w) => <span className="tabular-nums font-medium">{w.points.toLocaleString('zh-CN')}</span> },
            { key: 'money', title: '折算金额', align: 'right', render: (w) => <span className="tabular-nums">{(w.points / ws.rate).toFixed(2)} {ws.currency}</span> },
            {
              key: 'account',
              title: '收款账户',
              render: (w) => (
                <div>
                  <button type="button" className="flex items-center gap-1 text-xs text-brand-700 hover:underline" onClick={() => toggle(w.id)}>
                    {expanded[w.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {w.account['银行名称'] ?? Object.values(w.account)[0] ?? '-'}
                  </button>
                  {expanded[w.id] && (
                    <div className="mt-1.5 rounded-md bg-zinc-50 p-2">
                      <KV items={Object.entries(w.account).map(([k, v]) => ({ k, v }))} />
                    </div>
                  )}
                </div>
              ),
            },
            { key: 'status', title: '状态', render: (w) => statusPill(w.status) },
            {
              key: 'ops',
              title: '操作',
              align: 'right',
              render: (w) => (
                <div className="flex justify-end gap-1">
                  {w.status === 'pending' && (
                    <>
                      <Button size="sm" variant="primary" onClick={() => void act(w, 'approve')}>审核通过</Button>
                      <Button size="sm" variant="danger" onClick={() => void act(w, 'reject')}>驳回</Button>
                    </>
                  )}
                  {w.status === 'approved' && (
                    <Button size="sm" variant="primary" onClick={() => void act(w, 'paid')}>标记已打款</Button>
                  )}
                  {(w.status === 'paid' || w.status === 'rejected') && <span className="text-[11px] text-zinc-400">已结束</span>}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
