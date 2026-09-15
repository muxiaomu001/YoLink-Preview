import { useMemo, useState } from 'react'
import { Download, Plus } from 'lucide-react'
import type { AiEvent, KnowledgeItem } from '@/domain/types'
import { knowledgeStatus } from '@/domain/ai'
import { newId } from '@/domain/ids'
import { useStore } from '@/store/store'
import { staffById } from '@/store/selectors'
import { confirm } from '@/ui/confirm'
import { Button, Field, Input, Select, Textarea } from '@/ui/primitives'
import { Card, Note, Pill, Stat, Table } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'

/** 知识库 */
export function KnowledgeTab() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [editing, setEditing] = useState<KnowledgeItem | null>(null)
  const [creating, setCreating] = useState(false)
  const remove = async (k: KnowledgeItem) => {
    const ok = await confirm({ title: `删除知识库条目「${k.title}」`, body: '删除后 AI 草稿不再引用这条内容。', okText: '删除', danger: true })
    if (!ok) return
    s.deleteKnowledge(k.id, admin)
    toast(`已删除「${k.title}」`)
  }
  return (
    <div className="space-y-4">
      <Note>当前用表单演示知识发布：草稿不参与推荐，发布后生效，修改后使用新版本，下线后停止引用。正式产品的对话式知识整理尚未在此演示。</Note>
      <Card
        title="知识库条目"
        padded={false}
        extra={
          <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
            <Plus size={13} /> 新增条目
          </Button>
        }
      >
        <Table
          rows={s.knowledge}
          rowKey={(k) => k.id}
          columns={[
            { key: 'title', title: '标题', render: (k) => <span className="font-medium text-zinc-900">{k.title}</span> },
            { key: 'body', title: '正文摘要', render: (k) => <span className="block max-w-lg truncate text-zinc-600">{k.body}</span> },
            {
              key: 'tags',
              title: '标签',
              render: (k) => (
                <div className="flex flex-wrap gap-1">
                  {k.tags.map((t) => (
                    <Pill key={t}>{t}</Pill>
                  ))}
                </div>
              ),
            },
            { key: 'enabled', title: '状态', render: (k) => <Select aria-label={`${k.title}发布状态`} value={knowledgeStatus(k)} onChange={(e) => { const status = e.target.value as 'draft' | 'published' | 'offline'; s.saveKnowledge({ ...k, status, enabled: status === 'published' }, admin) }}><option value="draft">草稿</option><option value="published">已发布</option><option value="offline">已下线</option></Select> },
            {
              key: 'ops',
              title: '操作',
              align: 'right',
              render: (k) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(k)}>编辑</Button>
                  <Button size="sm" variant="danger" onClick={() => void remove(k)}>删除</Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      {editing && <KnowledgeModal item={editing} onClose={() => setEditing(null)} />}
      {creating && <KnowledgeModal onClose={() => setCreating(false)} />}
    </div>
  )
}

function KnowledgeModal({ item, onClose }: { item?: KnowledgeItem; onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [title, setTitle] = useState(item?.title ?? '')
  const [body, setBody] = useState(item?.body ?? '')
  const [tags, setTags] = useState(item?.tags.join(', ') ?? '')
  const [status, setStatus] = useState<'draft' | 'published' | 'offline'>(item ? knowledgeStatus(item) : 'draft')
  const error = !title.trim() ? '标题不能为空' : title.length > 64 ? '标题最多 64 字' : !body.trim() ? '正文不能为空' : body.length > 2000 ? '正文最多 2000 字' : ''
  const submit = () => {
    if (error) return
    const next: KnowledgeItem = {
      id: item?.id ?? newId('kb'),
      title: title.trim(),
      body: body.trim(),
      tags: tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
      status,
      enabled: status === 'published',
    }
    s.saveKnowledge(next, admin)
    toast(item ? `条目「${next.title}」已更新` : `条目「${next.title}」已加入知识库`)
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={item ? `编辑条目：${item.title}` : '新增知识库条目'}
      width={560}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!!error} onClick={submit}>{item ? '保存' : '新增'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="标题" required hint={`${title.length}/64`}>
          <Input value={title} maxLength={64} onChange={(e) => setTitle(e.target.value)} placeholder="如：赎回到账时间" />
        </Field>
        <Field label="正文" required hint={`${body.length}/2000`}>
          <Textarea rows={5} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="给 AI 引用的标准口径" />
        </Field>
        <Field label="标签" hint="逗号分隔">
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="如：赎回, 到账, 常见问题" />
        </Field>
        <div className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-xs">
          <span className="font-medium text-zinc-800">发布状态</span>
          <Select aria-label="发布状态" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="draft">草稿</option><option value="published">已发布</option><option value="offline">已下线</option></Select>
        </div>
        {error && title && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}

const MODULE_LABEL: Record<NonNullable<AiEvent['module']>, string> = { reply: '回复推荐', group: '群活跃助手', knowledge: '知识库' }

interface UsageRow {
  key: string
  name: string
  count: number
  tokens: number
  adopted: number
}

function groupUsage(events: AiEvent[], keyOf: (e: AiEvent) => string, nameOf: (k: string) => string): UsageRow[] {
  const map = new Map<string, UsageRow>()
  events.forEach((e) => {
    const k = keyOf(e)
    const row = map.get(k) ?? { key: k, name: nameOf(k), count: 0, tokens: 0, adopted: 0 }
    map.set(k, { ...row, count: row.count + 1, tokens: row.tokens + e.tokens, adopted: row.adopted + (e.result !== 'ignored' ? 1 : 0) })
  })
  return [...map.values()].sort((a, b) => b.tokens - a.tokens)
}

/** 用量 */
export function UsageTab() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const month = new Date().toISOString().slice(0, 7)
  const events = useMemo(() => s.aiEvents.filter((e) => e.at.slice(0, 7) === month), [s.aiEvents, month])
  const tokens = events.reduce((sum, e) => sum + e.tokens, 0)
  const adopted = events.filter((e) => e.result !== 'ignored').length
  const byModule = useMemo(() => groupUsage(events, (e) => e.module ?? 'reply', (k) => MODULE_LABEL[k as NonNullable<AiEvent['module']>] ?? k), [events])
  const byStaff = useMemo(() => groupUsage(events, (e) => e.staffId, (k) => staffById(s, k)?.name ?? k), [events, s])

  const columns = [
    { key: 'name', title: '名称', render: (r: UsageRow) => <span className="font-medium text-zinc-900">{r.name}</span> },
    { key: 'count', title: '次数', align: 'right' as const, render: (r: UsageRow) => <span className="tabular-nums">{r.count}</span> },
    { key: 'tokens', title: 'Token', align: 'right' as const, render: (r: UsageRow) => <span className="tabular-nums">{r.tokens.toLocaleString('zh-CN')}</span> },
    { key: 'rate', title: '采纳率', align: 'right' as const, render: (r: UsageRow) => <span className="tabular-nums">{r.count ? Math.round((r.adopted / r.count) * 100) : 0}%</span> },
  ]

  const exportCsv = async () => {
    const ok = await confirm({ title: '导出本月用量', body: `导出 ${month} 按模块与按员工的用量明细（CSV），记审计。`, okText: '导出' })
    if (!ok) return
    s.recordExport(`AI 用量 ${month}`, admin)
    toast(`已导出 ${month} 用量明细，审计日志已记录`)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <Stat label={`本月 Token 用量（${month}）`} value={tokens.toLocaleString('zh-CN')} sub={`${events.length} 次调用`} />
        <Stat label="本月采纳率" value={`${events.length ? Math.round((adopted / events.length) * 100) : 0}%`} sub="直接采纳 + 修改后发送" />
        <Stat label="AI 平台余额" value={<span className="text-base text-zinc-400">接口未提供</span>} sub="若模型平台开放余额接口则显示" />
        <div className="flex items-center justify-center rounded-lg border border-dashed border-zinc-200">
          <Button onClick={() => void exportCsv()}>
            <Download size={13} /> 导出
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Card title="按模块" padded={false}>
          <Table rows={byModule} rowKey={(r) => r.key} dense columns={columns} />
        </Card>
        <Card title="按员工" padded={false}>
          <Table rows={byStaff} rowKey={(r) => r.key} dense columns={columns} />
        </Card>
      </div>
      <Note>采纳率 = （直接采纳 + 修改后发送）÷ 生成次数。群活跃助手的「采纳」指先审后发模式下员工点了发送。</Note>
    </div>
  )
}
