/**
 * Webhook（P1）：列表、创建/编辑、日志（选中某个 webhook 后显示在下半区）。
 */
import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { Webhook } from '@/domain/types'
import { WEBHOOK_EVENT_LABEL } from '@/domain/labels'
import { fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { Button, Switch } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, Table, type Column } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { WebhookEditor, WebhookLogsCard } from './WebhooksPage.parts'

export function WebhooksPage() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [editing, setEditing] = useState<Webhook | null>(null)
  const [creating, setCreating] = useState(false)
  const [logsOf, setLogsOf] = useState<string | null>(null)
  const selected = s.webhooks.find((w) => w.id === logsOf)

  const setEnabled = (w: Webhook, on: boolean) => {
    s.saveWebhook({ ...w, enabled: on }, admin)
    toast(on ? `Webhook「${w.name}」已启用，开始推送订阅事件` : `Webhook「${w.name}」已停用，不再推送`)
  }
  const remove = async (w: Webhook) => {
    const ok = await confirm({ title: `删除 Webhook「${w.name}」？`, body: '删除后不再推送，历史日志一并删除。此操作不可撤销。', okText: '删除', danger: true })
    if (!ok) return
    s.deleteWebhook(w.id, admin)
    if (logsOf === w.id) setLogsOf(null)
    toast(`Webhook「${w.name}」已删除`)
  }

  const columns: Column<Webhook>[] = [
    { key: 'name', title: '名称', render: (w) => <span className="font-medium text-zinc-900">{w.name}</span> },
    { key: 'url', title: '目标地址', render: (w) => <span className="font-mono text-xs break-all text-zinc-600">{w.url}</span> },
    {
      key: 'events',
      title: '订阅事件',
      render: (w) => (
        <div className="flex flex-wrap gap-1">
          {w.events.map((e) => (
            <Pill key={e} tone="blue">
              {WEBHOOK_EVENT_LABEL[e]}
            </Pill>
          ))}
        </div>
      ),
    },
    {
      key: 'enabled',
      title: '状态',
      render: (w) => (
        <span className="inline-flex items-center gap-2">
          <Switch checked={w.enabled} onChange={(v) => setEnabled(w, v)} />
          <span className="text-xs text-zinc-500">{w.enabled ? '已启用' : '未启用'}</span>
        </span>
      ),
    },
    { key: 'last', title: '最后触发', render: (w) => <span className="tabular-nums text-zinc-600">{w.lastTriggeredAt ? fmtDateTime(w.lastTriggeredAt) : <span className="text-zinc-400">从未触发</span>}</span> },
    {
      key: 'ops',
      title: '操作',
      align: 'right',
      render: (w) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing(w)}>
            编辑
          </Button>
          <Button size="sm" variant={logsOf === w.id ? 'primary' : 'secondary'} onClick={() => setLogsOf(logsOf === w.id ? null : w.id)}>
            {logsOf === w.id ? '收起日志' : '查看日志'}
          </Button>
          <Button size="sm" variant="danger" onClick={() => void remove(w)}>
            删除
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Webhook（P1）"
        desc="事件发生时 YoLink 主动 POST 到你的地址：新客户注册、挂头衔、购买记录同步等。请求带签名头，用签名密钥校验来源。"
        extra={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={14} /> 创建 Webhook
          </Button>
        }
      />
      <Note>目标地址必须是 HTTPS。失败重试最多 3 次，间隔 1、5、15 分钟；三次都失败记一条失败日志，可在日志里手动重试。</Note>
      <Card className="mt-4" padded={false}>
        <Table rows={s.webhooks} columns={columns} rowKey={(w) => w.id} empty="还没有 Webhook" />
      </Card>

      {selected && <WebhookLogsCard webhook={selected} />}

      {creating && <WebhookEditor onClose={() => setCreating(false)} />}
      {editing && <WebhookEditor webhook={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
