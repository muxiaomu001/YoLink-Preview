import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { SensitiveAction, SensitiveHit, SensitiveWord } from '@/domain/types'
import { useStore } from '@/store/store'
import { customerById } from '@/store/selectors'
import { Button, Field, Input } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, Table, Tabs, type Column } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { convName, fmtDateTimeSec } from './audit-helpers'

type Tab = 'words' | 'hits'

const ACTION_META: Record<SensitiveAction, { label: string; tone: 'red' | 'amber' | 'zinc' }> = {
  block: { label: '拦截', tone: 'red' },
  replace: { label: '替换', tone: 'amber' },
  log: { label: '放行并记录', tone: 'zinc' },
}

const RESULT_META: Record<SensitiveHit['result'], { label: string; tone: 'red' | 'amber' | 'zinc' }> = {
  blocked: { label: '已拦截', tone: 'red' },
  replaced: { label: '已替换', tone: 'amber' },
  logged: { label: '已放行', tone: 'zinc' },
}

const WORD_MAX = 32

export function SensitiveWordsPage() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [tab, setTab] = useState<Tab>('words')
  const [editing, setEditing] = useState<SensitiveWord | null>(null)
  const [creating, setCreating] = useState(false)

  const hits = useMemo(() => [...s.sensitiveHits].sort((a, b) => b.at.localeCompare(a.at)), [s.sensitiveHits])

  const onDelete = async (w: SensitiveWord) => {
    const ok = await confirm({ title: `删除敏感词「${w.word}」？`, body: '删除后新消息不再检查这个词，历史命中记录保留。记审计日志。', okText: '删除', danger: true })
    if (!ok) return
    s.deleteSensitiveWord(w.id, admin)
    toast(`敏感词「${w.word}」已删除`)
  }

  const wordColumns: Column<SensitiveWord>[] = [
    { key: 'word', title: '关键词', render: (w) => <span className="font-medium text-zinc-900">{w.word}</span> },
    { key: 'action', title: '命中动作', render: (w) => <Pill tone={ACTION_META[w.action].tone}>{ACTION_META[w.action].label}</Pill> },
    { key: 'replace', title: '替换为', render: (w) => (w.action === 'replace' ? <span className="font-mono text-zinc-700">{w.replaceWith}</span> : <span className="text-zinc-300">-</span>) },
    {
      key: 'ops',
      title: '操作',
      align: 'right',
      render: (w) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing(w)}>
            <Pencil size={12} /> 编辑
          </Button>
          <Button size="sm" variant="danger" onClick={() => void onDelete(w)}>
            <Trash2 size={12} /> 删除
          </Button>
        </div>
      ),
    },
  ]

  const hitColumns: Column<SensitiveHit>[] = [
    { key: 'at', title: '时间', width: '150px', render: (h) => <span className="tabular-nums text-zinc-500">{fmtDateTimeSec(h.at)}</span> },
    {
      key: 'user',
      title: '用户',
      render: (h) => {
        const c = customerById(s, h.customerId)
        return (
          <div>
            <div className="text-zinc-900">{c?.nickname ?? '未知客户'}</div>
            <div className="text-[11px] tabular-nums text-zinc-500">{c?.accountId}</div>
          </div>
        )
      },
    },
    { key: 'conv', title: '会话', render: (h) => <span className="text-zinc-600">{convName(s, h.convId)}</span> },
    { key: 'word', title: '命中词', render: (h) => <span className="font-medium text-red-700">{h.word}</span> },
    { key: 'original', title: '原消息', render: (h) => <span className="line-clamp-2 max-w-md text-zinc-800">{h.original}</span> },
    { key: 'result', title: '处理结果', render: (h) => <Pill tone={RESULT_META[h.result].tone}>{RESULT_META[h.result].label}</Pill> },
  ]

  return (
    <div>
      <PageHeader
        title="敏感词"
        level="P1"
        desc="客户与坐席发出的消息先过词库。拦截：消息不落库，发送方看到提示；替换：命中部分改成替换文本；放行并记录：正常送达，但留一条命中记录。"
        extra={
          tab === 'words' && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus size={14} /> 添加敏感词
            </Button>
          )
        }
      />
      <Note>词库改动记审计日志。命中记录只读、不可删，是内容合规的证据。</Note>

      <Tabs
        className="mt-4"
        value={tab}
        onChange={setTab}
        items={[
          { key: 'words', label: '词库管理', count: s.sensitiveWords.length },
          { key: 'hits', label: '命中记录', count: hits.length },
        ]}
      />
      <Card className="mt-3" padded={false}>
        {tab === 'words' ? <Table rows={s.sensitiveWords} rowKey={(w) => w.id} dense columns={wordColumns} empty="词库为空，添加第一个敏感词" /> : <Table rows={hits} rowKey={(h) => h.id} dense columns={hitColumns} empty="暂无命中记录" />}
      </Card>

      {editing && <WordModal word={editing} onClose={() => setEditing(null)} />}
      {creating && <WordModal onClose={() => setCreating(false)} />}
    </div>
  )
}

function WordModal({ word, onClose }: { word?: SensitiveWord; onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [form, setForm] = useState({ word: word?.word ?? '', action: word?.action ?? ('block' as SensitiveAction), replaceWith: word?.replaceWith ?? '' })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const trimmed = form.word.trim()
  const duplicate = s.sensitiveWords.some((w) => w.word === trimmed && w.id !== word?.id)
  const error = !trimmed
    ? '关键词不能为空'
    : trimmed.length > WORD_MAX
      ? `关键词最多 ${WORD_MAX} 字`
      : duplicate
        ? '词库里已有这个词'
        : form.action === 'replace' && !form.replaceWith.trim()
          ? '选择「替换」时必须填写替换文本'
          : ''

  const submit = () => {
    if (error) return
    const input = { word: trimmed, action: form.action, replaceWith: form.action === 'replace' ? form.replaceWith.trim() : undefined }
    if (word) {
      s.updateSensitiveWord(word.id, input, admin)
      toast(`敏感词「${trimmed}」已更新`)
    } else {
      s.createSensitiveWord(input, admin)
      toast(`敏感词「${trimmed}」已添加，命中动作：${ACTION_META[form.action].label}`)
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={word ? `编辑敏感词：${word.word}` : '添加敏感词'}
      width={460}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!!error} onClick={submit}>
            {word ? '保存' : '添加'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="关键词" required hint={`1 到 ${WORD_MAX} 字`}>
          <Input value={form.word} maxLength={WORD_MAX} onChange={(e) => set({ word: e.target.value })} placeholder="如：保本" autoFocus />
        </Field>
        {/* 单选组不用 Field 包：Field 本身是 label，label 里再套 label 不合法 */}
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-600">
            命中动作<span className="ml-0.5 text-red-500">*</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {(Object.keys(ACTION_META) as SensitiveAction[]).map((k) => (
              <label key={k} className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-zinc-700">
                <input type="radio" name="sensitive-action" checked={form.action === k} onChange={() => set({ action: k })} className="accent-brand-700" />
                {ACTION_META[k].label}
                <span className="text-[11px] text-zinc-400">{k === 'block' ? '消息不落库，发送方看到提示' : k === 'replace' ? '命中部分改成替换文本' : '正常送达，留命中记录'}</span>
              </label>
            ))}
          </div>
        </div>
        {form.action === 'replace' && (
          <Field label="替换为" required hint="命中的词会被改成这段文本">
            <Input value={form.replaceWith} maxLength={WORD_MAX} onChange={(e) => set({ replaceWith: e.target.value })} placeholder="如：***" />
          </Field>
        )}
        {error && trimmed && <div className="text-xs text-red-600">{error}</div>}
      </div>
    </Modal>
  )
}
