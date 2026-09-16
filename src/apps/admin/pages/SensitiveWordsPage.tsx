/**
 * 敏感词后台：两套词库（客户 / 坐席合规）+ 命中记录。
 *
 * 分两套是因为同一个词在两边意思完全不同——顾问说「保本」是合规事故，客户问「保本」
 * 只是提问。共用一套词库，要么放过顾问，要么天天误伤客户，没有第三种结果。
 */
import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { SensitiveAction, SensitiveHit, SensitiveScope, SensitiveWord } from '@/domain/types'
import { SENSITIVE_ACTION_LABEL, SENSITIVE_SCOPE_LABEL, scanSensitive, scopeOf, wordsOfScope } from '@/domain/sensitive'
import { useStore } from '@/store/store'
import { customerById } from '@/store/selectors'
import { Button, Field, Input } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, Table, Tabs, type Column } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { convName, fmtDateTimeSec } from './audit-helpers'

type Tab = SensitiveScope | 'hits'

type Tone = 'red' | 'purple' | 'amber' | 'zinc'

const ACTION_TONE: Record<SensitiveAction, Tone> = { block: 'red', shadow: 'purple', replace: 'amber', log: 'zinc' }

/** 动作在添加词弹窗里的一句话说明 */
const ACTION_DESC: Record<SensitiveAction, string> = {
  block: '消息不落库，发送方看到提示',
  shadow: '发送方以为发出去了，其他客户看不见',
  replace: '命中部分改成替换文本',
  log: '正常送达，留命中记录',
}

const RESULT_META: Record<SensitiveHit['result'], { label: string; tone: Tone }> = {
  blocked: { label: '已拦截', tone: 'red' },
  shadowed: { label: '已影子屏蔽', tone: 'purple' },
  replaced: { label: '已替换', tone: 'amber' },
  logged: { label: '已放行', tone: 'zinc' },
}

const WORD_MAX = 32

export function SensitiveWordsPage() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [tab, setTab] = useState<Tab>('customer')
  const [editing, setEditing] = useState<SensitiveWord | null>(null)
  const [creating, setCreating] = useState<SensitiveScope | null>(null)

  const hits = useMemo(() => [...s.sensitiveHits].sort((a, b) => b.at.localeCompare(a.at)), [s.sensitiveHits])
  const customerWords = useMemo(() => wordsOfScope(s.sensitiveWords, 'customer'), [s.sensitiveWords])
  const seatWords = useMemo(() => wordsOfScope(s.sensitiveWords, 'seat'), [s.sensitiveWords])
  const wordTab = tab === 'hits' ? null : tab

  const onDelete = async (w: SensitiveWord) => {
    const ok = await confirm({ title: `删除敏感词「${w.word}」？`, body: '删除后新消息不再检查这个词，历史命中记录保留。记审计日志。', okText: '删除', danger: true })
    if (!ok) return
    s.deleteSensitiveWord(w.id, admin)
    toast(`敏感词「${w.word}」已删除`)
  }

  const wordColumns: Column<SensitiveWord>[] = [
    { key: 'word', title: '关键词', render: (w) => <span className="font-medium text-zinc-900">{w.word}</span> },
    { key: 'action', title: '命中动作', render: (w) => <Pill tone={ACTION_TONE[w.action]}>{SENSITIVE_ACTION_LABEL[w.action]}</Pill> },
    {
      key: 'fuzzy',
      title: '变形匹配',
      width: '84px',
      render: (w) =>
        w.exact ? (
          <span className="text-zinc-400" title="只认原样写法；给那些一模糊就误伤的短词用">
            关
          </span>
        ) : (
          <span className="text-zinc-700" title="中间插空格、换符号、全角、常见形近字与繁体，都算命中">
            开
          </span>
        ),
    },
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
      title: '发言人',
      render: (h) => {
        // 坐席命中要显示到背后的实操员工：合规追责追不到人，这条记录就没用
        if (h.scope === 'seat') {
          const seat = s.seats.find((x) => x.id === h.senderId)
          const staff = s.staff.find((x) => x.id === h.operatorStaffId)
          return (
            <div>
              <div className="text-zinc-900">{seat?.displayName ?? '未知坐席'}</div>
              <div className="text-[11px] text-zinc-500">{staff ? `实操：${staff.name}` : '坐席'}</div>
            </div>
          )
        }
        const c = customerById(s, h.senderId)
        return (
          <div>
            <div className="text-zinc-900">{c?.nickname ?? '未知客户'}</div>
            <div className="text-[11px] tabular-nums text-zinc-500">{c?.accountId}</div>
          </div>
        )
      },
    },
    { key: 'scope', title: '词库', width: '110px', render: (h) => <Pill tone={h.scope === 'seat' ? 'blue' : 'zinc'}>{SENSITIVE_SCOPE_LABEL[h.scope]}</Pill> },
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
        desc="客户和坐席发出的消息各过各的词库。拦截：发不出去，发送方看到提示；影子屏蔽：发送方以为发出去了，坐席看得见，群里其他客户看不见；替换：命中部分改成替换文本再送达；放行并记录：正常送达，只留记录。一条消息踩中多个词按最重的动作处理，每个词各记一条。"
        extra={
          wordTab && (
            <Button variant="primary" onClick={() => setCreating(wordTab)}>
              <Plus size={14} /> 添加{SENSITIVE_SCOPE_LABEL[wordTab].replace('词库', '')}词
            </Button>
          )
        }
      />
      <Note>
        词库改动记审计日志。命中记录只读、不可删，是内容合规的证据。<b>变形匹配默认开着</b>：「保 本」「保_本」「褓夲」和「保本」会被当成同一个词，真要绕的人第一次就会这么写。
      </Note>

      <Tabs
        className="mt-4"
        value={tab}
        onChange={setTab}
        items={[
          { key: 'customer', label: '客户词库', count: customerWords.length },
          { key: 'seat', label: '坐席合规词库', count: seatWords.length },
          { key: 'hits', label: '命中记录', count: hits.length },
        ]}
      />
      {tab === 'seat' && (
        <Note className="mt-3">
          查的是<b>坐席发给客户的话</b>，拦的是合规风险：承诺收益、私下转账、绕开平台。坐席被拦下时提示里会写明是合规词库，顾问知道该改哪一句。坐席词库不提供影子屏蔽——屏蔽坐席等于客户收不到回复，那是事故不是风控。
        </Note>
      )}
      <Card className="mt-3" padded={false}>
        {tab === 'hits' ? (
          <Table rows={hits} rowKey={(h) => h.id} dense columns={hitColumns} empty="暂无命中记录" />
        ) : (
          <Table rows={tab === 'seat' ? seatWords : customerWords} rowKey={(w) => w.id} dense columns={wordColumns} empty="这套词库还是空的，添加第一个词" />
        )}
      </Card>

      {editing && <WordModal word={editing} scope={scopeOf(editing)} onClose={() => setEditing(null)} />}
      {creating && <WordModal scope={creating} onClose={() => setCreating(null)} />}
    </div>
  )
}

function WordModal({ word, scope, onClose }: { word?: SensitiveWord; scope: SensitiveScope; onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [form, setForm] = useState({ word: word?.word ?? '', action: word?.action ?? ('block' as SensitiveAction), replaceWith: word?.replaceWith ?? '', exact: !!word?.exact })
  const [probe, setProbe] = useState('')
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  // 影子屏蔽只给客户词库：屏蔽坐席等于客户收不到客服回复
  const actions: SensitiveAction[] = scope === 'seat' ? ['block', 'replace', 'log'] : ['block', 'shadow', 'replace', 'log']
  const trimmed = form.word.trim()
  const duplicate = s.sensitiveWords.some((w) => w.word === trimmed && scopeOf(w) === scope && w.id !== word?.id)
  const error = !trimmed
    ? '关键词不能为空'
    : trimmed.length > WORD_MAX
      ? `关键词最多 ${WORD_MAX} 字`
      : duplicate
        ? '这套词库里已有这个词'
        : form.action === 'replace' && !form.replaceWith.trim()
          ? '选择「替换」时必须填写替换文本'
          : ''

  // 「试一句」：拿当前这一条（还没保存的）规则去扫一句话，变形匹配到底管不管用当场就看得到
  const draft: SensitiveWord = { id: word?.id ?? 'sw_preview', word: trimmed, scope, action: form.action, replaceWith: form.replaceWith.trim() || undefined, exact: form.exact }
  const probeScan = probe.trim() && trimmed ? scanSensitive([draft], probe, scope) : undefined

  const submit = () => {
    if (error) return
    const input = { word: trimmed, scope, action: form.action, replaceWith: form.action === 'replace' ? form.replaceWith.trim() : undefined, exact: form.exact || undefined }
    if (word) {
      s.updateSensitiveWord(word.id, input, admin)
      toast(`敏感词「${trimmed}」已更新`)
    } else {
      s.createSensitiveWord(input, admin)
      toast(`已添加到${SENSITIVE_SCOPE_LABEL[scope]}：「${trimmed}」，命中动作：${SENSITIVE_ACTION_LABEL[form.action]}`)
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={word ? `编辑敏感词：${word.word}` : `添加到${SENSITIVE_SCOPE_LABEL[scope]}`}
      width={480}
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
        <Field label="关键词" required hint={`1 到 ${WORD_MAX} 字；这个词只在${SENSITIVE_SCOPE_LABEL[scope]}生效`}>
          <Input value={form.word} maxLength={WORD_MAX} onChange={(e) => set({ word: e.target.value })} placeholder={scope === 'seat' ? '如：稳赚不赔' : '如：保本'} autoFocus />
        </Field>
        {/* 单选组不用 Field 包：Field 本身是 label，label 里再套 label 不合法 */}
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-600">
            命中动作<span className="ml-0.5 text-red-500">*</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {actions.map((k) => (
              <label key={k} className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-zinc-700">
                <input type="radio" name="sensitive-action" checked={form.action === k} onChange={() => set({ action: k })} className="accent-brand-700" />
                {SENSITIVE_ACTION_LABEL[k]}
                <span className="text-[11px] text-zinc-400">{ACTION_DESC[k]}</span>
              </label>
            ))}
          </div>
        </div>
        {form.action === 'replace' && (
          <Field label="替换为" required hint="命中的词会被改成这段文本">
            <Input value={form.replaceWith} maxLength={WORD_MAX} onChange={(e) => set({ replaceWith: e.target.value })} placeholder="如：***" />
          </Field>
        )}
        <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-2.5">
          <label className="flex cursor-pointer items-start gap-2 text-[13px] text-zinc-700">
            <input type="checkbox" checked={!form.exact} onChange={(e) => set({ exact: !e.target.checked })} className="mt-0.5 accent-brand-700" />
            <span>
              变形匹配
              <span className="ml-1 text-[11px] text-zinc-500">忽略中间的空格与符号，全角转半角，常见形近字与繁体换回本字</span>
            </span>
          </label>
          {/* 词库最容易翻车的地方是「我以为它能拦」。这里直接给一行输入框，当场验 */}
          <div className="mt-2">
            <Input value={probe} onChange={(e) => setProbe(e.target.value)} placeholder="试一句话，看这条规则拦不拦得住" />
            {probeScan && (
              <div className="mt-1.5 text-[11px]">
                {probeScan.action ? (
                  <span className="text-zinc-600">
                    命中 <b className="text-red-700">{trimmed}</b> → <b>{SENSITIVE_ACTION_LABEL[probeScan.action]}</b>
                    {probeScan.action === 'replace' && <span className="ml-1 font-mono text-zinc-700">{probeScan.text}</span>}
                  </span>
                ) : (
                  <span className="text-zinc-400">没命中</span>
                )}
              </div>
            )}
          </div>
        </div>
        {error && trimmed && <div className="text-xs text-red-600">{error}</div>}
      </div>
    </Modal>
  )
}
