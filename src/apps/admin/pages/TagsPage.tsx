import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { Tag } from '@/domain/types'
import { useStore } from '@/store/store'
import { Button, Field, Input, Select } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, Table, TagChip } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'

/** 预设色板 8 色 */
const TAG_COLORS = ['#52525b', '#1d4ed8', '#15803d', '#b45309', '#be123c', '#7e22ce', '#0f766e', '#c2410c']

export function TagsPage() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Tag | null>(null)
  const [merging, setMerging] = useState<Tag | null>(null)
  const countOf = (t: Tag) => s.customers.filter((c) => c.tagIds.includes(t.id)).length

  const remove = async (t: Tag) => {
    const n = countOf(t)
    const ok = await confirm({ title: `删除内部标签「${t.name}」？`, body: `删除后会从 ${n} 位客户身上摘掉，客户本来也看不到它，不会有任何感知。`, okText: '删除', danger: true })
    if (!ok) return
    s.deleteTag(t.id, admin)
    toast(`已删除「${t.name}」，并从 ${n} 位客户身上摘掉`)
  }

  return (
    <div>
      <PageHeader
        title="内部标签库"
        desc="内部标签是员工自己用的（高意向、退款风险），客户永远看不到。用于筛选客户与群发定向。"
        extra={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={14} /> 新增标签
          </Button>
        }
      />
      <Note tone="amber">这里的标签绝不对客户显示。要让客户和群里的人看到的身份，用「头衔库」。两者分表，混成一个对象一次误操作就会把「退款风险」挂到客户头上让全群看见。员工在工作台新建的标签（策略允许时）自动进这里。</Note>
      <Card className="mt-4" padded={false}>
        <Table
          rows={s.tags}
          rowKey={(t) => t.id}
          columns={[
            { key: 'chip', title: '标签名', render: (t) => <TagChip tag={t} /> },
            { key: 'color', title: '颜色', render: (t) => <span className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-600"><span className="h-3.5 w-3.5 rounded-full" style={{ background: t.color }} />{t.color}</span> },
            { key: 'count', title: '客户数', align: 'right', render: (t) => <span className="tabular-nums">{countOf(t)}</span> },
            { key: 'source', title: '来源', render: (t) => (t.source === 'admin' ? <Pill>后台创建</Pill> : <Pill tone="purple">员工在工作台新建</Pill>) },
            {
              key: 'ops',
              title: '操作',
              align: 'right',
              render: (t) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                    编辑
                  </Button>
                  <Button size="sm" variant="ghost" disabled={s.tags.length < 2} onClick={() => setMerging(t)}>
                    合并到…
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => void remove(t)}>
                    删除
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {creating && <TagEditor onClose={() => setCreating(false)} />}
      {editing && <TagEditor tag={editing} onClose={() => setEditing(null)} />}
      {merging && <MergeModal tag={merging} onClose={() => setMerging(null)} />}
    </div>
  )
}

/** 新增 / 编辑：名 1-16 字企业内唯一，颜色预设色板 */
function TagEditor({ tag, onClose }: { tag?: Tag; onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [name, setName] = useState(tag?.name ?? '')
  const [color, setColor] = useState(tag?.color ?? TAG_COLORS[0])
  const trimmed = name.trim()
  const duplicate = s.tags.some((t) => t.id !== tag?.id && t.name === trimmed)
  const lengthOk = trimmed.length >= 1 && trimmed.length <= 16
  const error = duplicate ? '已有同名标签，企业内名称必须唯一。' : name.length > 0 && !lengthOk ? '标签名 1 到 16 字。' : ''
  const ok = lengthOk && !duplicate

  const submit = () => {
    if (!ok) return
    if (tag) {
      s.updateTag(tag.id, { name: trimmed, color }, admin)
      toast(`内部标签「${trimmed}」已更新`)
    } else {
      s.createTag(trimmed, color, 'admin')
      s.logAudit('tag.library', `内部标签库新增「${trimmed}」`, admin)
      toast(`内部标签「${trimmed}」已入库`)
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={tag ? `编辑标签：${tag.name}` : '新增内部标签'}
      width={440}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!ok} onClick={submit}>
            {tag ? '保存' : '入库'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="标签名" required hint="1 到 16 字，企业内唯一">
          <Input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} placeholder="如：高意向" />
        </Field>
        {error && <div className="text-xs text-red-600">{error}</div>}
        <Field label="颜色" hint="预设色板">
          <div className="flex gap-2">
            {TAG_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} className="h-6 w-6 rounded-full" style={{ background: c, boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined }} aria-label={c} />
            ))}
          </div>
        </Field>
        <div className="text-xs text-zinc-500">
          预览：<TagChip tag={{ id: 'x', name: trimmed || '标签', color, source: 'admin' }} />
        </div>
      </div>
    </Modal>
  )
}

/** 合并：客户身上的本标签换成目标标签，本标签删除 */
function MergeModal({ tag, onClose }: { tag: Tag; onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const targets = s.tags.filter((t) => t.id !== tag.id)
  const [toId, setToId] = useState(targets[0]?.id ?? '')
  const to = targets.find((t) => t.id === toId)
  const affected = s.customers.filter((c) => c.tagIds.includes(tag.id)).length

  const submit = async () => {
    if (!to) return
    const ok = await confirm({
      title: `把「${tag.name}」合并到「${to.name}」？`,
      body: `${affected} 位客户身上的「${tag.name}」会换成「${to.name}」（已有目标标签的不重复），然后「${tag.name}」被删除。此操作不可撤销。`,
      okText: '合并',
      danger: true,
    })
    if (!ok) return
    const n = s.mergeTag(tag.id, to.id, admin)
    toast(`已合并：${n} 位客户的「${tag.name}」换成「${to.name}」，「${tag.name}」已删除`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`合并标签：${tag.name}`}
      width={440}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!to} onClick={() => void submit()}>
            合并
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <TagChip tag={tag} /> <span>→</span> {to ? <TagChip tag={to} /> : <span className="text-zinc-400">选择目标</span>}
        </div>
        <Field label="目标标签" required>
          <Select value={toId} onChange={(e) => setToId(e.target.value)}>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Note tone="amber">影响 {affected} 位客户。合并后「{tag.name}」从库里删除，客户身上统一显示目标标签。</Note>
      </div>
    </Modal>
  )
}
