/**
 * 插件（P1）：列表 + 按插件声明的字段渲染配置表单。
 */
import { useState } from 'react'
import type { Plugin, PluginField } from '@/domain/types'
import { useStore } from '@/store/store'
import { Button, Field, Input, Select, Switch } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, Table, type Column } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'

type ConfigValue = string | boolean

export function PluginsPage() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [configuring, setConfiguring] = useState<Plugin | null>(null)

  const toggle = (p: Plugin) => {
    s.togglePlugin(p.id, !p.enabled, admin)
    toast(p.enabled ? `插件「${p.name}」已停用，配置保留` : `插件「${p.name}」已启用`)
  }
  const uninstall = async (p: Plugin) => {
    const ok = await confirm({ title: `卸载插件「${p.name}」？`, body: '卸载后配置一并删除，重新安装需要重新填写。此操作不可撤销。', okText: '卸载', danger: true })
    if (!ok) return
    s.uninstallPlugin(p.id, admin)
    toast(`插件「${p.name}」已卸载`)
  }

  const columns: Column<Plugin>[] = [
    {
      key: 'name',
      title: '插件名称',
      render: (p) => (
        <div>
          <div className="font-medium text-zinc-900">{p.name}</div>
          <div className="text-[11px] text-zinc-500">{p.desc}</div>
        </div>
      ),
    },
    { key: 'version', title: '版本', render: (p) => <span className="font-mono text-xs text-zinc-600">v{p.version}</span> },
    { key: 'fields', title: '配置项', align: 'right', render: (p) => <span className="tabular-nums text-zinc-500">{p.fields.length}</span> },
    { key: 'status', title: '状态', render: (p) => (p.enabled ? <Pill tone="green">已启用</Pill> : <Pill>未启用</Pill>) },
    {
      key: 'ops',
      title: '操作',
      align: 'right',
      render: (p) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="secondary" onClick={() => setConfiguring(p)}>
            配置
          </Button>
          <Button size="sm" variant="ghost" onClick={() => toggle(p)}>
            {p.enabled ? '停用' : '启用'}
          </Button>
          <Button size="sm" variant="danger" onClick={() => void uninstall(p)}>
            卸载
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="插件" level="P1" desc="用插件扩展 YoLink 的能力，例如同步 CRM、附加合规声明、消息翻译。每个插件的配置项由插件自身提供。" />
      <Note>插件声明 JSON Schema，后台按 schema 渲染配置表单（文本、下拉、开关、密钥）；配置保存后插件可通过 API 读取。停用不删配置，卸载才删。</Note>
      <Card className="mt-4" padded={false}>
        <Table rows={s.plugins} columns={columns} rowKey={(p) => p.id} empty="没有安装任何插件" />
      </Card>
      {configuring && <PluginConfigModal plugin={configuring} onClose={() => setConfiguring(null)} />}
    </div>
  )
}

/** 按 plugin.fields 的 type 渲染：text→Input、select→Select、switch→Switch、secret→密码框（留空表示不改） */
function PluginConfigModal({ plugin, onClose }: { plugin: Plugin; onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const initial = Object.fromEntries(plugin.fields.map((f) => [f.key, f.type === 'secret' ? '' : (plugin.config[f.key] ?? (f.type === 'switch' ? false : ''))])) as Record<string, ConfigValue>
  const [values, setValues] = useState<Record<string, ConfigValue>>(initial)
  const setValue = (key: string, v: ConfigValue) => setValues((prev) => ({ ...prev, [key]: v }))

  const save = () => {
    // 密钥留空表示不改，沿用原值
    const config = Object.fromEntries(
      plugin.fields.map((f) => {
        const v = values[f.key]
        if (f.type === 'secret') return [f.key, typeof v === 'string' && v.trim() ? v.trim() : (plugin.config[f.key] ?? '')]
        return [f.key, v]
      }),
    ) as Record<string, ConfigValue>
    s.updatePluginConfig(plugin.id, config, admin)
    toast(`插件「${plugin.name}」配置已保存，插件可通过 API 读取`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`配置插件：${plugin.name} v${plugin.version}`}
      width={480}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={save}>
            保存
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="text-xs text-zinc-500">{plugin.desc}</div>
        {plugin.fields.map((f) => (
          <PluginFieldInput key={f.key} field={f} value={values[f.key]} configured={typeof plugin.config[f.key] === 'string' && !!plugin.config[f.key]} onChange={(v) => setValue(f.key, v)} />
        ))}
        <Note>下面的表单由插件声明的 schema 自动渲染：{plugin.fields.map((f) => `${f.label}（${FIELD_TYPE_LABEL[f.type]}）`).join('、')}。</Note>
      </div>
    </Modal>
  )
}

const FIELD_TYPE_LABEL: Record<PluginField['type'], string> = { text: '文本', select: '下拉', switch: '开关', secret: '密钥' }

function PluginFieldInput({ field, value, configured, onChange }: { field: PluginField; value: ConfigValue; configured: boolean; onChange: (v: ConfigValue) => void }) {
  if (field.type === 'switch') {
    return (
      <div className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2">
        <span className="text-[13px] text-zinc-800">{field.label}</span>
        <Switch checked={value === true} onChange={onChange} />
      </div>
    )
  }
  if (field.type === 'select') {
    return (
      <Field label={field.label}>
        <Select value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      </Field>
    )
  }
  if (field.type === 'secret') {
    return (
      <Field label={field.label} hint={configured ? '已配置 ••••，留空表示不改' : '未配置'}>
        <Input type="password" value={String(value)} autoComplete="new-password" placeholder={configured ? '••••••••（留空不改）' : '输入密钥'} onChange={(e) => onChange(e.target.value)} />
      </Field>
    )
  }
  return (
    <Field label={field.label}>
      <Input value={String(value)} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}
