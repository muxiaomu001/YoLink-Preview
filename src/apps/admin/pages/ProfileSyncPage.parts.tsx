import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { AutomationRule, CustomField } from '@/domain/types'
import { newId } from '@/domain/ids'
import { fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { confirm } from '@/ui/confirm'
import { Button, Field, Input, Select, Switch } from '@/ui/primitives'
import { Card, Note, Pill, Table } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'

const FIELD_TYPE_LABEL: Record<CustomField['type'], string> = { text: '文本', number: '数字', date: '日期', select: '单选' }

/** 通用字段（P1） */
export function CustomFieldsTab() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [editing, setEditing] = useState<CustomField | null>(null)
  const [creating, setCreating] = useState(false)
  const remove = async (f: CustomField) => {
    const ok = await confirm({ title: `删除通用字段「${f.name}」`, body: '客户身上已填的值一并删除，不可恢复。', okText: '删除', danger: true })
    if (!ok) return
    s.deleteCustomField(f.id, admin)
    toast(`已删除通用字段「${f.name}」`)
  }
  return (
    <div className="space-y-4">
      <Note>
        <b>P1</b>：企业自定义的客户字段，坐席在客户资料卡上填写或由接口同步写入；可作为自动化规则的条件。
      </Note>
      <Card
        title="通用字段"
        padded={false}
        extra={
          <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
            <Plus size={13} /> 新增字段
          </Button>
        }
      >
        <Table
          rows={s.customFields}
          rowKey={(f) => f.id}
          columns={[
            { key: 'name', title: '字段名', render: (f) => <span className="font-medium text-zinc-900">{f.name}</span> },
            { key: 'type', title: '类型', render: (f) => <Pill tone="blue">{FIELD_TYPE_LABEL[f.type]}</Pill> },
            { key: 'options', title: '选项', render: (f) => (f.type === 'select' ? (f.options ?? []).join(' / ') : <span className="text-zinc-400">-</span>) },
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
      {editing && <CustomFieldModal field={editing} onClose={() => setEditing(null)} />}
      {creating && <CustomFieldModal onClose={() => setCreating(false)} />}
    </div>
  )
}

function CustomFieldModal({ field, onClose }: { field?: CustomField; onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [name, setName] = useState(field?.name ?? '')
  const [type, setType] = useState<CustomField['type']>(field?.type ?? 'text')
  const [options, setOptions] = useState((field?.options ?? []).join(', '))
  const opts = options.split(/[,，]/).map((o) => o.trim()).filter(Boolean)
  const dup = s.customFields.some((f) => f.id !== field?.id && f.name.trim() === name.trim())
  const error = !name.trim() ? '字段名不能为空' : name.length > 32 ? '字段名最多 32 字' : dup ? '已有同名字段' : type === 'select' && opts.length < 2 ? '单选至少 2 个选项' : ''
  const submit = () => {
    if (error) return
    const next: CustomField = { id: field?.id ?? newId('cf'), name: name.trim(), type, options: type === 'select' ? opts : undefined }
    s.saveCustomField(next, admin)
    toast(field ? `字段「${next.name}」已更新` : `已新增通用字段「${next.name}」`)
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={field ? `编辑字段：${field.name}` : '新增通用字段'}
      width={460}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!!error} onClick={submit}>{field ? '保存' : '新增'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="字段名" required hint="1 到 32 字">
          <Input value={name} maxLength={32} onChange={(e) => setName(e.target.value)} placeholder="如：风险等级" />
        </Field>
        <Field label="类型">
          <Select value={type} onChange={(e) => setType(e.target.value as CustomField['type'])}>
            <option value="text">文本</option>
            <option value="number">数字</option>
            <option value="date">日期</option>
            <option value="select">单选</option>
          </Select>
        </Field>
        {type === 'select' && (
          <Field label="选项" required hint="逗号分隔，至少 2 个">
            <Input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="保守型, 稳健型, 平衡型, 进取型" />
          </Field>
        )}
        {error && name && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}

/** 自动化规则（P1） */
export function AutomationTab() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [editing, setEditing] = useState<AutomationRule | null>(null)
  const [creating, setCreating] = useState(false)
  const remove = async (r: AutomationRule) => {
    const ok = await confirm({ title: `删除规则「${r.name}」`, body: `已执行 ${r.runs} 次，删除后不再触发；已挂的头衔与标签不回滚。`, okText: '删除', danger: true })
    if (!ok) return
    s.deleteAutomationRule(r.id, admin)
    toast(`已删除规则「${r.name}」`)
  }
  return (
    <div className="space-y-4">
      <Note>
        <b>P1</b>：触发（同步到账、定时）→ 条件（画像字段）→ 动作（挂头衔、打内部标签、提醒员工）。规则命中一次记一次执行，执行记录进审计日志。
      </Note>
      <Card
        title="自动化规则"
        padded={false}
        extra={
          <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
            <Plus size={13} /> 新建规则
          </Button>
        }
      >
        <Table
          rows={s.automationRules}
          rowKey={(r) => r.id}
          columns={[
            { key: 'name', title: '规则名', render: (r) => <span className="font-medium text-zinc-900">{r.name}</span> },
            { key: 'trigger', title: '触发', render: (r) => <span className="text-zinc-700">{r.trigger}</span> },
            { key: 'condition', title: '条件', render: (r) => <span className="text-zinc-700">{r.condition}</span> },
            { key: 'action', title: '动作', render: (r) => <span className="text-zinc-700">{r.action}</span> },
            {
              key: 'enabled',
              title: '启用',
              render: (r) => (
                <Switch
                  checked={r.enabled}
                  onChange={(v) => {
                    s.saveAutomationRule({ ...r, enabled: v }, admin)
                    toast(v ? `规则「${r.name}」已启用` : `规则「${r.name}」已停用`)
                  }}
                />
              ),
            },
            { key: 'runs', title: '执行次数', align: 'right', render: (r) => <span className="tabular-nums">{r.runs}</span> },
            { key: 'last', title: '最近执行', render: (r) => <span className="tabular-nums text-zinc-500">{r.lastRunAt ? fmtDateTime(r.lastRunAt) : '从未'}</span> },
            {
              key: 'ops',
              title: '操作',
              align: 'right',
              render: (r) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>编辑</Button>
                  <Button size="sm" variant="danger" onClick={() => void remove(r)}>删除</Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      {editing && <AutomationModal rule={editing} onClose={() => setEditing(null)} />}
      {creating && <AutomationModal onClose={() => setCreating(false)} />}
    </div>
  )
}

function AutomationModal({ rule, onClose }: { rule?: AutomationRule; onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [form, setForm] = useState({ name: rule?.name ?? '', trigger: rule?.trigger ?? '', condition: rule?.condition ?? '', action: rule?.action ?? '', enabled: rule?.enabled ?? true })
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))
  const error = !form.name.trim() ? '规则名不能为空' : !form.trigger.trim() ? '触发不能为空' : !form.condition.trim() ? '条件不能为空' : !form.action.trim() ? '动作不能为空' : ''
  const submit = () => {
    if (error) return
    const next: AutomationRule = {
      id: rule?.id ?? newId('ar'),
      name: form.name.trim(),
      trigger: form.trigger.trim(),
      condition: form.condition.trim(),
      action: form.action.trim(),
      enabled: form.enabled,
      runs: rule?.runs ?? 0,
      lastRunAt: rule?.lastRunAt ?? null,
    }
    s.saveAutomationRule(next, admin)
    toast(rule ? `规则「${next.name}」已更新` : `规则「${next.name}」已创建${next.enabled ? '并启用' : '（未启用）'}`)
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={rule ? `编辑规则：${rule.name}` : '新建自动化规则'}
      width={560}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!!error} onClick={submit}>{rule ? '保存' : '创建'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="规则名" required>
          <Input value={form.name} maxLength={48} onChange={(e) => set('name', e.target.value)} placeholder="如：入金后挂「认证投资者」" />
        </Field>
        <Field label="触发" required hint="示例：购买记录同步 / 每日 10:00 / 客户注册">
          <Input value={form.trigger} maxLength={64} onChange={(e) => set('trigger', e.target.value)} placeholder="购买记录同步" />
        </Field>
        <Field label="条件" required hint="示例：单笔金额 ≥ 10,000 美元 / 风险等级 = 进取型">
          <Input value={form.condition} maxLength={128} onChange={(e) => set('condition', e.target.value)} placeholder="单笔金额 ≥ 10,000 美元" />
        </Field>
        <Field label="动作" required hint="示例：挂头衔：认证投资者 / 打内部标签：需回访 / 提醒主归属坐席的实操员工">
          <Input value={form.action} maxLength={128} onChange={(e) => set('action', e.target.value)} placeholder="挂头衔：认证投资者" />
        </Field>
        <div className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-xs">
          <span className="font-medium text-zinc-800">创建后立即启用</span>
          <Switch checked={form.enabled} onChange={(v) => set('enabled', v)} />
        </div>
        {error && form.name && <p className="text-xs text-red-600">{error}</p>}
        <Note>正式版触发 / 条件 / 动作是结构化选择器，演示用文本描述。</Note>
      </div>
    </Modal>
  )
}
