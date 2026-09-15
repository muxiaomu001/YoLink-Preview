import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { PayoutField, WalletSettings } from '@/domain/types'
import { newId } from '@/domain/ids'
import { useStore } from '@/store/store'
import { confirm } from '@/ui/confirm'
import { Button, Checkbox, Field, Input, Select } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, Stat, Table, Tabs } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { AdjustTab, TxsTab, WithdrawalsTab } from './WalletPage.parts'

type TabKey = 'summary' | 'settings' | 'payout' | 'adjust' | 'txs' | 'withdrawals'

/** 钱包（P2）：汇总、基本设置、收款账户字段、手动加减积分、流水查询、提现审核 */
export function WalletPage() {
  const s = useStore()
  const [tab, setTab] = useState<TabKey>('summary')
  const pendingCount = s.withdrawals.filter((w) => w.status === 'pending' || w.status === 'approved').length

  return (
    <div>
      <PageHeader
        title="钱包"
        desc={
          <>
            <Pill tone="amber" className="mr-1.5">
              P2，模块启用时显示
            </Pill>
            客户在 App 里攒{s.walletSettings.unitName}、申请提现；后台负责规则、加减与审核。所有加减与审核都记审计。
          </>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: 'summary', label: '汇总' },
          { key: 'settings', label: '基本设置' },
          { key: 'payout', label: '收款账户字段', count: s.payoutFields.length },
          { key: 'adjust', label: '手动加减积分' },
          { key: 'txs', label: '流水查询', count: s.walletTxs.length },
          { key: 'withdrawals', label: '提现审核', count: pendingCount },
        ]}
      />
      <div className="mt-4">
        {tab === 'summary' && <SummaryTab />}
        {tab === 'settings' && <SettingsTab />}
        {tab === 'payout' && <PayoutTab />}
        {tab === 'adjust' && <AdjustTab />}
        {tab === 'txs' && <TxsTab />}
        {tab === 'withdrawals' && <WithdrawalsTab />}
      </div>
    </div>
  )
}

function SummaryTab() {
  const s = useStore()
  const ws = s.walletSettings
  const issued = s.walletTxs.filter((t) => t.amount > 0 && t.type !== 'withdraw_refund').reduce((sum, t) => sum + t.amount, 0)
  const withdrawn = s.withdrawals.filter((w) => w.status === 'paid').reduce((sum, w) => sum + w.points, 0)
  const approved = s.withdrawals.filter((w) => w.status === 'approved')
  const pendingPoints = approved.reduce((sum, w) => sum + w.points, 0)
  const fmt = (n: number) => n.toLocaleString('zh-CN')
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label={`${ws.unitName}总发放`} value={fmt(issued)} sub="签到、推荐、手动增加等正向流水之和（不含驳回解冻）" />
        <Stat label={`${ws.unitName}总提现`} value={fmt(withdrawn)} sub={`已打款 ${s.withdrawals.filter((w) => w.status === 'paid').length} 笔 ≈ ${(withdrawn / ws.rate).toFixed(2)} ${ws.currency}`} />
        <Stat label="待打款金额" value={`${(pendingPoints / ws.rate).toFixed(2)} ${ws.currency}`} sub={`审核已通过、等待财务打款 ${approved.length} 笔，共 ${fmt(pendingPoints)} ${ws.unitName}`} tone={approved.length ? 'warn' : 'default'} />
      </div>
      <Note>
        折算口径：{fmt(ws.rate)} {ws.unitName} = 1 {ws.currency}，手续费 {ws.fee}。「待打款」只统计审核通过但未标记打款的申请，标记打款后进入「总提现」。
      </Note>
    </div>
  )
}

function SettingsTab() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [form, setForm] = useState<WalletSettings>(s.walletSettings)
  const set = <K extends keyof WalletSettings>(k: K, v: WalletSettings[K]) => setForm((f) => ({ ...f, [k]: v }))
  const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0))
  const error = !form.unitName.trim() ? '单位名称不能为空' : form.rate <= 0 ? '折算率必须大于 0' : form.minWithdraw <= 0 ? '最低提现积分必须大于 0' : form.dailyWithdrawCount <= 0 ? '每日提现次数至少 1 次' : ''
  const save = () => {
    if (error) return
    s.updateWalletSettings(form, admin)
    toast('钱包基本设置已保存，客户端下次打开钱包页即生效')
  }
  return (
    <Card title="基本设置" extra={<Button variant="primary" size="sm" disabled={!!error} onClick={save}>保存</Button>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="币种" hint="提现折算与打款用">
          <Select value={form.currency} onChange={(e) => set('currency', e.target.value as WalletSettings['currency'])}>
            <option value="USD">USD 美元</option>
            <option value="USDT">USDT</option>
            <option value="CNY">CNY 人民币</option>
            <option value="HKD">HKD 港币</option>
          </Select>
        </Field>
        <Field label="单位名称" required hint="客户端显示，如“积分”“金币”">
          <Input value={form.unitName} maxLength={8} onChange={(e) => set('unitName', e.target.value)} />
        </Field>
        <Field label="折算率" required hint={`${form.rate.toLocaleString('zh-CN')} ${form.unitName || '积分'} = 1 ${form.currency}`}>
          <Input type="number" min={1} value={form.rate} onChange={(e) => set('rate', num(e.target.value))} />
        </Field>
        <Field label="最低提现积分" required hint="默认 10000">
          <Input type="number" min={1} value={form.minWithdraw} onChange={(e) => set('minWithdraw', num(e.target.value))} />
        </Field>
        <Field label="单笔最高积分" hint="0 表示不限">
          <Input type="number" min={0} value={form.maxPerWithdraw} onChange={(e) => set('maxPerWithdraw', num(e.target.value))} />
        </Field>
        <Field label="每日提现次数" required hint="默认 1">
          <Input type="number" min={1} value={form.dailyWithdrawCount} onChange={(e) => set('dailyWithdrawCount', num(e.target.value))} />
        </Field>
        <Field label="手续费" hint="固定值（如 5）或百分比（如 2%）">
          <Input value={form.fee} maxLength={16} onChange={(e) => set('fee', e.target.value)} placeholder="2%" />
        </Field>
        <Field label="审核层级" hint="两级：先审核通过，再由财务标记打款">
          <div className="flex h-8 items-center gap-4 text-[13px] text-zinc-700">
            <label className="flex items-center gap-1.5">
              <input type="radio" className="accent-brand-700" checked={form.reviewLevels === 1} onChange={() => set('reviewLevels', 1)} /> 单级
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" className="accent-brand-700" checked={form.reviewLevels === 2} onChange={() => set('reviewLevels', 2)} /> 两级
            </label>
          </div>
        </Field>
      </div>
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </Card>
  )
}

function PayoutTab() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [editing, setEditing] = useState<PayoutField | null>(null)
  const [creating, setCreating] = useState(false)
  const remove = async (f: PayoutField) => {
    const ok = await confirm({ title: `删除字段「${f.name}」`, body: '客户已填写的收款账户里这个字段会保留历史值，但新申请不再要求填写。', okText: '删除', danger: true })
    if (!ok) return
    s.deletePayoutField(f.id, admin)
    toast(`已删除收款账户字段「${f.name}」`)
  }
  return (
    <div className="space-y-4">
      <Note>
        客户申请提现时按这里的字段填收款账户。默认字段：银行名称、户名、账号、SWIFT；企业可增删。
      </Note>
      <Card
        title="收款账户字段"
        padded={false}
        extra={
          <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
            <Plus size={13} /> 新增字段
          </Button>
        }
      >
        <Table
          rows={s.payoutFields}
          rowKey={(f) => f.id}
          columns={[
            { key: 'name', title: '字段名称', render: (f) => <span className="font-medium text-zinc-900">{f.name}</span> },
            { key: 'type', title: '字段类型', render: (f) => (f.type === 'text' ? '文本' : '数字') },
            { key: 'required', title: '是否必填', render: (f) => (f.required ? <Pill tone="blue">是</Pill> : <Pill>否</Pill>) },
            {
              key: 'ops',
              title: '操作',
              align: 'right',
              render: (f) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(f)}>编辑</Button>
                  <Button size="sm" variant="danger" onClick={() => void remove(f)}>删除</Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      {editing && <PayoutFieldModal field={editing} onClose={() => setEditing(null)} />}
      {creating && <PayoutFieldModal onClose={() => setCreating(false)} />}
    </div>
  )
}

function PayoutFieldModal({ field, onClose }: { field?: PayoutField; onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [form, setForm] = useState<PayoutField>(field ?? { id: newId('pf'), name: '', type: 'text', required: true })
  const dup = s.payoutFields.some((f) => f.id !== form.id && f.name.trim() === form.name.trim())
  const error = !form.name.trim() ? '字段名称不能为空' : dup ? '已有同名字段' : ''
  const submit = () => {
    if (error) return
    s.savePayoutField({ ...form, name: form.name.trim() }, admin)
    toast(field ? `字段「${form.name.trim()}」已更新` : `已新增收款账户字段「${form.name.trim()}」`)
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={field ? `编辑字段：${field.name}` : '新增收款账户字段'}
      width={440}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!!error} onClick={submit}>{field ? '保存' : '新增'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="字段名称" required hint="1 到 16 字">
          <Input value={form.name} maxLength={16} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="如：开户行地址" />
        </Field>
        <Field label="字段类型">
          <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as PayoutField['type'] }))}>
            <option value="text">文本</option>
            <option value="number">数字</option>
          </Select>
        </Field>
        <Checkbox checked={form.required} onChange={(v) => setForm((f) => ({ ...f, required: v }))} label="必填" />
        {error && form.name && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}
