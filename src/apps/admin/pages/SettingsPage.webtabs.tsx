/**
 * 企业设置分页：网站栏目。客户 App 底部标签里嵌一个 WebView，最多 3 个。
 */
import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { WebTab } from '@/domain/types'
import { newId } from '@/domain/ids'
import { useStore } from '@/store/store'
import { Button, Field, Input, Switch } from '@/ui/primitives'
import { Card, Note, Pill, Table } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { DemoLevelTag, DemoNote } from '@/ui/DemoNote'

const MAX_TABS = 3
const PLACEHOLDERS = ['{user_id}', '{external_id}', '{ts}', '{sig}']
const isHttps = (u: string) => /^https:\/\/\S+$/.test(u)

export function WebTabsPane() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const tabs = s.enterprise.webTabs
  const [editing, setEditing] = useState<WebTab | null>(null)
  const [creating, setCreating] = useState(false)

  const commit = (next: WebTab[], msg: string) => {
    s.updateEnterprise({ webTabs: next }, admin)
    toast(msg)
  }
  const remove = async (t: WebTab) => {
    const ok = await confirm({ title: `删除栏目「${t.title}」`, body: '删除后客户 App 底部立即不再显示该标签。', okText: '删除', danger: true })
    if (!ok) return
    commit(
      tabs.filter((x) => x.id !== t.id),
      `已删除栏目「${t.title}」`,
    )
  }

  return (
    <div className="space-y-4">
      <Note>
        网址用应用内 WebView 打开，必须 HTTPS。可带占位符 {PLACEHOLDERS.join('、')}：sig 是用共享密钥对前三者的签名，客户系统验签后免登录，等同简单的可信单点登录。
      </Note>
      {tabs.length > 1 && (
        <DemoNote>
          超过 1 个栏目时，标签进入客户 App「发现」页作为入口卡片，不再各占一个底部标签<DemoLevelTag level="P1" />。
        </DemoNote>
      )}
      <Card
        title={`网站栏目 · ${tabs.length}/${MAX_TABS}`}
        level="P0"
        padded={false}
        extra={
          <Button size="sm" variant="primary" disabled={tabs.length >= MAX_TABS} onClick={() => setCreating(true)}>
            <Plus size={12} /> 新增栏目
          </Button>
        }
      >
        <Table
          rows={tabs}
          rowKey={(t) => t.id}
          empty="还没有网站栏目。客户 App 底部只有会话与通讯录"
          columns={[
            {
              key: 'enabled',
              title: '启用',
              width: '80px',
              render: (t) => (
                <Switch
                  checked={t.enabled}
                  onChange={(v) =>
                    commit(
                      tabs.map((x) => (x.id === t.id ? { ...x, enabled: v } : x)),
                      v ? `「${t.title}」已启用，客户 App 显示该标签` : `「${t.title}」已关闭，客户 App 不显示该标签`,
                    )
                  }
                />
              ),
            },
            {
              key: 'icon',
              title: '图标',
              width: '60px',
              render: (t) => <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-sm font-medium text-zinc-700">{t.iconText}</span>,
            },
            { key: 'title', title: '标题', render: (t) => <span className="font-medium text-zinc-900">{t.title}</span> },
            {
              key: 'url',
              title: '网址',
              render: (t) => (
                <div className="max-w-md">
                  <div className="truncate font-mono text-[12px] text-zinc-600" title={t.url}>
                    {t.url}
                  </div>
                  {PLACEHOLDERS.some((p) => t.url.includes(p)) && <Pill tone="blue">带签名占位符，免登录</Pill>}
                </div>
              ),
            },
            {
              key: 'ops',
              title: '操作',
              align: 'right',
              render: (t) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                    编辑
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => void remove(t)}>
                    删除
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      {(editing || creating) && (
        <WebTabEditor
          tab={editing ?? undefined}
          onClose={() => {
            setEditing(null)
            setCreating(false)
          }}
          onSave={(t) => {
            const exists = tabs.some((x) => x.id === t.id)
            commit(exists ? tabs.map((x) => (x.id === t.id ? t : x)) : [...tabs, t], exists ? `栏目「${t.title}」已更新` : `栏目「${t.title}」已添加`)
          }}
        />
      )}
    </div>
  )
}

function WebTabEditor({ tab, onClose, onSave }: { tab?: WebTab; onClose: () => void; onSave: (t: WebTab) => void }) {
  const [form, setForm] = useState<WebTab>(tab ?? { id: newId('wt'), enabled: true, title: '', iconText: '', url: 'https://' })
  const patch = (p: Partial<WebTab>) => setForm((f) => ({ ...f, ...p }))
  const errors: string[] = []
  if (!form.title.trim() || form.title.trim().length > 8) errors.push('标题 1 到 8 字')
  if (form.iconText.trim().length !== 1) errors.push('图标取一个字')
  if (!isHttps(form.url.trim())) errors.push('网址必须以 https:// 开头')
  const submit = () => {
    if (errors.length) return
    onSave({ ...form, title: form.title.trim(), iconText: form.iconText.trim(), url: form.url.trim() })
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={tab ? `编辑栏目：${tab.title}` : '新增网站栏目'}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={errors.length > 0} onClick={submit}>
            {tab ? '保存' : '添加'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="标题" required hint="底部标签文字，中英文，1 到 8 字">
            <Input value={form.title} maxLength={8} onChange={(e) => patch({ title: e.target.value })} placeholder="如：我的账户" />
          </Field>
          <Field label="图标" required hint="推荐 96×96 PNG" demoHint="演示里取一个字代替上传的图标">
            <Input value={form.iconText} maxLength={1} onChange={(e) => patch({ iconText: e.target.value })} className="w-16 text-center" placeholder="账" />
          </Field>
        </div>
        <Field label="网址" required hint="HTTPS，应用内 WebView 打开">
          <Input value={form.url} onChange={(e) => patch({ url: e.target.value })} className="font-mono" placeholder="https://portal.example.com/account?uid={user_id}&ts={ts}&sig={sig}" />
        </Field>
        <div className="rounded-md bg-zinc-50 px-3 py-2 text-[11px] leading-relaxed text-zinc-600">
          可用占位符：
          {PLACEHOLDERS.map((p) => (
            <code key={p} className="mx-0.5 rounded bg-white px-1 py-0.5 font-mono text-zinc-800 ring-1 ring-zinc-200">
              {p}
            </code>
          ))}
          。客户端打开时替换成真实值；{'{sig}'} 为共享密钥对 user_id、external_id、ts 的签名，客户系统验签后免登录。
        </div>
        <div className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2">
          <div className="text-xs">
            <div className="font-medium text-zinc-800">启用</div>
            <div className="text-zinc-500">关闭时客户 App 不显示该标签</div>
          </div>
          <Switch checked={form.enabled} onChange={(v) => patch({ enabled: v })} />
        </div>
        {errors.length > 0 && <div className="text-[11px] text-red-600">{errors.join('；')}</div>}
      </div>
    </Modal>
  )
}
