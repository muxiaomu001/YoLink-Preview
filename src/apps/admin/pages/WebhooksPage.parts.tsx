/**
 * Webhook 页的弹窗与日志区：创建/编辑表单、日志表、日志详情。
 */
import { useState } from 'react'
import type { Webhook, WebhookEvent, WebhookLog } from '@/domain/types'
import { WEBHOOK_EVENT_LABEL } from '@/domain/labels'
import { newId } from '@/domain/ids'
import { fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { Button, Checkbox, Field, Input } from '@/ui/primitives'
import { Card, KV, Note, Pill, Table, type Column } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'

const EVENTS = Object.keys(WEBHOOK_EVENT_LABEL) as WebhookEvent[]
const RETRY_PLAN = '最多 3 次，间隔 1、5、15 分钟'

/** 创建/编辑：名称 0-32、目标地址必须 https、签名密钥只写不读、订阅事件多选 */
export function WebhookEditor({ webhook, onClose }: { webhook?: Webhook; onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [name, setName] = useState(webhook?.name ?? '')
  const [url, setUrl] = useState(webhook?.url ?? '')
  const [secret, setSecret] = useState('')
  const [events, setEvents] = useState<WebhookEvent[]>(webhook?.events ?? ['user_registered'])
  const trimmedUrl = url.trim()
  const nameOk = name.trim().length <= 32
  const urlOk = /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(trimmedUrl)
  const secretOk = !!webhook?.secretConfigured || secret.trim().length > 0
  const error = trimmedUrl && !urlOk ? '目标地址必须是 https:// 开头的合法 URL。' : events.length === 0 ? '至少订阅一个事件。' : !secretOk ? '新建时必须填写签名密钥。' : ''
  const ok = nameOk && urlOk && events.length > 0 && secretOk
  const toggle = (e: WebhookEvent, on: boolean) => setEvents((list) => (on ? [...list, e] : list.filter((x) => x !== e)))

  const submit = () => {
    if (!ok) return
    const finalName = name.trim() || `Webhook ${s.webhooks.length + 1}`
    const next: Webhook = {
      id: webhook?.id ?? newId('wh'),
      name: finalName,
      url: trimmedUrl,
      secretConfigured: !!webhook?.secretConfigured || secret.trim().length > 0,
      events,
      enabled: webhook?.enabled ?? true,
      lastTriggeredAt: webhook?.lastTriggeredAt ?? null,
    }
    s.saveWebhook(next, admin)
    toast(webhook ? `Webhook「${finalName}」已保存${secret.trim() ? '，签名密钥已更换' : ''}` : `Webhook「${finalName}」已创建并启用`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={webhook ? `编辑 Webhook：${webhook.name}` : '创建 Webhook'}
      width={520}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!ok} onClick={submit}>
            {webhook ? '保存' : '创建'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="名称" hint="0 到 32 字，留空自动命名">
          <Input value={name} maxLength={32} onChange={(e) => setName(e.target.value)} placeholder="如：CRM 客户同步" />
        </Field>
        <Field label="目标地址" required hint="必须 HTTPS">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-system.example/hooks/yolink" />
        </Field>
        <Field label="签名密钥" required={!webhook?.secretConfigured} hint={webhook?.secretConfigured ? '已配置 ••••，留空表示不改' : '用于 X-YoLink-Signature 签名鉴权'}>
          <Input type="password" value={secret} autoComplete="new-password" placeholder={webhook?.secretConfigured ? '••••••••（留空不改）' : '输入密钥，只写不读'} onChange={(e) => setSecret(e.target.value)} />
        </Field>
        <Field label="订阅事件" required hint="至少一项">
          <div className="grid grid-cols-2 gap-2 rounded-md border border-zinc-200 p-3">
            {EVENTS.map((e) => (
              <Checkbox key={e} checked={events.includes(e)} onChange={(v) => toggle(e, v)} label={<span>{WEBHOOK_EVENT_LABEL[e]} <span className="font-mono text-[10px] text-zinc-400">{e}</span></span>} />
            ))}
          </div>
        </Field>
        {error && <div className="text-xs text-red-600">{error}</div>}
        <Note>失败重试{RETRY_PLAN}。密钥保存后不再显示，需要换就重新填。</Note>
      </div>
    </Modal>
  )
}

/** 选中某个 webhook 后显示的日志表 */
export function WebhookLogsCard({ webhook }: { webhook: Webhook }) {
  const s = useStore()
  const [detail, setDetail] = useState<WebhookLog | null>(null)
  const logs = s.webhookLogs.filter((l) => l.webhookId === webhook.id).sort((a, b) => b.at.localeCompare(a.at))
  const failed = logs.filter((l) => !isOk(l.httpStatus)).length

  const retry = (l: WebhookLog) => {
    s.retryWebhookLog(l.id)
    toast(`已重试「${WEBHOOK_EVENT_LABEL[l.event]}」推送，本次返回 200`)
  }

  const columns: Column<WebhookLog>[] = [
    { key: 'at', title: '时间', render: (l) => <span className="tabular-nums text-zinc-600">{fmtDateTime(l.at)}</span> },
    { key: 'event', title: '事件类型', render: (l) => <span>{WEBHOOK_EVENT_LABEL[l.event]} <span className="font-mono text-[10px] text-zinc-400">{l.event}</span></span> },
    { key: 'status', title: 'HTTP 状态', render: (l) => (isOk(l.httpStatus) ? <Pill tone="green">{l.httpStatus}</Pill> : <Pill tone="red">{l.httpStatus}</Pill>) },
    { key: 'ms', title: '响应时间', align: 'right', render: (l) => <span className={l.ms > 2000 ? 'tabular-nums text-amber-700' : 'tabular-nums text-zinc-600'}>{l.ms} ms</span> },
    { key: 'retries', title: '重试次数', align: 'right', render: (l) => <span className="tabular-nums">{l.retries}</span> },
    {
      key: 'ops',
      title: '操作',
      align: 'right',
      render: (l) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setDetail(l)}>
            查看详情
          </Button>
          <Button size="sm" variant={isOk(l.httpStatus) ? 'ghost' : 'secondary'} onClick={() => retry(l)}>
            重试
          </Button>
        </div>
      ),
    },
  ]

  return (
    <Card className="mt-4" title={`日志：${webhook.name}（${logs.length} 条，失败 ${failed} 条）`} extra={<span className="text-[11px] text-zinc-400">失败重试{RETRY_PLAN}</span>} padded={false}>
      <Table rows={logs} columns={columns} rowKey={(l) => l.id} dense empty="该 Webhook 还没有推送记录" />
      {detail && <WebhookLogDetail log={detail} webhook={webhook} onClose={() => setDetail(null)} />}
    </Card>
  )
}

function isOk(status: number): boolean {
  return status >= 200 && status < 300
}

/** 日志详情：请求头 + 假请求体 */
function WebhookLogDetail({ log, webhook, onClose }: { log: WebhookLog; webhook: Webhook; onClose: () => void }) {
  const body = {
    id: log.id,
    event: log.event,
    occurred_at: log.at,
    enterprise: 'hxwm',
    data: samplePayload(log.event),
  }
  return (
    <Modal open onClose={onClose} title={`推送详情：${WEBHOOK_EVENT_LABEL[log.event]}`} width={560} footer={<Button onClick={onClose}>关闭</Button>}>
      <div className="space-y-3">
        <KV
          items={[
            { k: '目标地址', v: <span className="font-mono">{webhook.url}</span> },
            { k: '时间', v: fmtDateTime(log.at) },
            { k: 'HTTP 状态', v: isOk(log.httpStatus) ? <Pill tone="green">{log.httpStatus}</Pill> : <Pill tone="red">{log.httpStatus}</Pill> },
            { k: '响应时间', v: `${log.ms} ms` },
            { k: '重试次数', v: `${log.retries}${log.retries >= 3 ? '（已达上限）' : ''}` },
            { k: '签名头', v: <span className="font-mono text-[11px]">X-YoLink-Signature: sha256=…</span> },
          ]}
        />
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-600">请求体</div>
          <pre className="thin-scroll max-h-64 overflow-auto rounded-md bg-zinc-900 p-3 font-mono text-[11px] leading-relaxed text-zinc-100">{JSON.stringify(body, null, 2)}</pre>
        </div>
      </div>
    </Modal>
  )
}

/** 各事件的示例数据 */
function samplePayload(event: WebhookEvent): Record<string, unknown> {
  switch (event) {
    case 'user_registered':
      return { customer_id: 'cus_1024', nickname: '王女士', invite_group: 'ig_default', seats: ['seat_lin', 'seat_cs'] }
    case 'title_assigned':
      return { customer_id: 'cus_1024', title_id: 't_vip', title_name: '私享会员', by_staff: 'st_admin' }
    case 'purchase_synced':
      return { customer_id: 'cus_1024', product: '稳健配置组合', amount: 200000, currency: 'CNY' }
    case 'conversation_created':
      return { conversation_id: 'conv_2048', kind: 'dm', customer_id: 'cus_1024', seat_id: 'seat_lin' }
    default:
      return { message_id: 'msg_4096', conversation_id: 'conv_2048', sender_kind: 'customer', text: '请问这个产品的风险等级是？' }
  }
}
