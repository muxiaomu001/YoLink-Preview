/**
 * 开放 API 凭据（P1）：API Key 列表、创建（完整 Key 只显示一次）、删除。
 */
import { useState } from 'react'
import { Copy, Plus } from 'lucide-react'
import type { ApiKey, ApiScope } from '@/domain/types'
import { API_SCOPE_LABEL } from '@/domain/labels'
import { fmtDate, fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { Button, Checkbox, Field, Input } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, Table, type Column } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'

const SCOPES = Object.keys(API_SCOPE_LABEL) as ApiScope[]

export function ApiKeysPage() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [creating, setCreating] = useState(false)
  const [revealed, setRevealed] = useState<{ name: string; key: string } | null>(null)

  const copyPrefix = (k: ApiKey) => {
    void navigator.clipboard?.writeText(k.prefix)
    toast(`已复制前缀 ${k.prefix}。完整 Key 只在创建时显示过一次，服务端不保存明文`, 'info')
  }
  const remove = async (k: ApiKey) => {
    const ok = await confirm({ title: `删除 API Key「${k.name}」？`, body: '删除后该 Key 立即失效，正在用它的对接程序会收到 401。此操作不可撤销。', okText: '删除', danger: true })
    if (!ok) return
    s.deleteApiKey(k.id, admin)
    toast(`API Key「${k.name}」已删除，立即失效`)
  }

  const columns: Column<ApiKey>[] = [
    { key: 'name', title: '名称', render: (k) => <span className="font-medium text-zinc-900">{k.name}</span> },
    { key: 'key', title: 'Key', render: (k) => <span className="font-mono text-xs text-zinc-700">{k.prefix}••••••••</span> },
    {
      key: 'scopes',
      title: '权限范围',
      render: (k) => (
        <div className="flex flex-wrap gap-1">
          {k.scopes.map((sc) => (
            <Pill key={sc} tone={sc.startsWith('read') ? 'blue' : 'amber'}>
              {API_SCOPE_LABEL[sc]}
            </Pill>
          ))}
        </div>
      ),
    },
    { key: 'createdAt', title: '创建时间', render: (k) => <span className="tabular-nums text-zinc-600">{fmtDate(k.createdAt)}</span> },
    { key: 'lastUsedAt', title: '最后使用', render: (k) => <span className="tabular-nums text-zinc-600">{k.lastUsedAt ? fmtDateTime(k.lastUsedAt) : <span className="text-zinc-400">从未使用</span>}</span> },
    {
      key: 'ops',
      title: '操作',
      align: 'right',
      render: (k) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => copyPrefix(k)}>
            <Copy size={12} /> 复制
          </Button>
          <Button size="sm" variant="danger" onClick={() => void remove(k)}>
            删除
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="开放 API 凭据（P1）"
        desc="给 CRM、数据仓库等外部系统调 YoLink 开放 API 用的 Key。每个 Key 单独限定权限范围，泄露了删这一个就行。"
        extra={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={14} /> 创建 API Key
          </Button>
        }
      />
      <Note>完整 Key 只在创建时显示一次，服务端只存哈希；列表里只看得到前缀。权限范围按最小够用给：只读对接不要勾「写客户」「发消息」。</Note>
      <Card className="mt-4" padded={false}>
        <Table rows={s.apiKeys} columns={columns} rowKey={(k) => k.id} empty="还没有 API Key" />
      </Card>

      {creating && (
        <CreateApiKeyModal
          onClose={() => setCreating(false)}
          onCreated={(name, key) => {
            setCreating(false)
            setRevealed({ name, key })
          }}
        />
      )}
      {revealed && <RevealKeyModal name={revealed.name} fullKey={revealed.key} onClose={() => setRevealed(null)} />}
    </div>
  )
}

/** 创建：名称 0-32、权限范围多选（至少一项） */
function CreateApiKeyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (name: string, key: string) => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<ApiScope[]>(['read_customers'])
  const trimmed = name.trim()
  const nameOk = trimmed.length <= 32
  const ok = nameOk && scopes.length > 0
  const toggle = (sc: ApiScope, on: boolean) => setScopes((list) => (on ? [...list, sc] : list.filter((x) => x !== sc)))

  const submit = () => {
    if (!ok) return
    const finalName = trimmed || `API Key ${s.apiKeys.length + 1}`
    const full = s.createApiKey({ name: finalName, scopes }, admin)
    toast(`API Key「${finalName}」已创建`)
    onCreated(finalName, full)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="创建 API Key"
      width={480}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!ok} onClick={submit}>
            创建
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="名称" hint="0 到 32 字，留空自动命名">
          <Input value={name} maxLength={32} onChange={(e) => setName(e.target.value)} placeholder="如：CRM 对接" />
        </Field>
        <Field label="权限范围" required hint="至少一项">
          <div className="grid grid-cols-2 gap-2 rounded-md border border-zinc-200 p-3">
            {SCOPES.map((sc) => (
              <Checkbox key={sc} checked={scopes.includes(sc)} onChange={(v) => toggle(sc, v)} label={<span>{API_SCOPE_LABEL[sc]} <span className="font-mono text-[10px] text-zinc-400">{sc}</span></span>} />
            ))}
          </div>
        </Field>
        {scopes.length === 0 && <div className="text-xs text-red-600">至少勾选一个权限范围。</div>}
      </div>
    </Modal>
  )
}

/** 创建成功后只显示一次的完整 Key */
function RevealKeyModal({ name, fullKey, onClose }: { name: string; fullKey: string; onClose: () => void }) {
  const copy = () => {
    void navigator.clipboard?.writeText(fullKey)
    toast('完整 Key 已复制到剪贴板')
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`API Key「${name}」已创建`}
      width={520}
      footer={
        <>
          <Button variant="primary" onClick={copy}>
            <Copy size={13} /> 复制
          </Button>
          <Button onClick={onClose}>我已保存，关闭</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-md bg-zinc-900 px-3 py-2.5 font-mono text-[13px] break-all text-emerald-300 select-all">{fullKey}</div>
        <div className="text-xs font-medium text-red-600">请复制保存，关闭后无法再次查看。服务端只保存哈希，丢了只能删掉重建。</div>
      </div>
    </Modal>
  )
}
