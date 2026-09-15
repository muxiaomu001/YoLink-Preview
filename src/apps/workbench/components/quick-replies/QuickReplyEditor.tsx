/**
 * 新建 / 编辑个人话术的弹窗：类型（文字 / 图片 / 文件，新建时选）、标题、分类（个人分类 + 新建分类）、附件（本机选文件）、正文 / 说明。
 * 没有关键词字段：搜索走全文匹配，标题和正文都能被搜到。
 * 只管个人话术；企业话术在管理后台维护。父级用 key 区分新建与编辑，初始值在挂载时读一次。
 */
import { useRef, useState } from 'react'
import { clsx } from 'clsx'
import { Upload } from 'lucide-react'
import type { MessageMedia, QuickReply, QuickReplyKind } from '@/domain/types'
import { Button, Field, Input, Select, Textarea } from '@/ui/primitives'
import { FileCard, formatBytes, ImageThumb, readFileAsMedia, UPLOAD_MAX_BYTES } from '@/ui/media'
import { Modal, toast } from '@/ui/overlay'
import { useWorkbench } from '../../useWorkbench'
import { KIND_META } from './quickReplyRules'

/** 分类下拉里「新建分类…」的占位值 */
const NEW_CATEGORY = '__new__'
const KINDS: QuickReplyKind[] = ['text', 'image', 'file']

interface Form {
  kind: QuickReplyKind
  title: string
  categoryId: string
  newCategory: string
  text: string
  media?: MessageMedia
}

function initForm(initial?: QuickReply): Form {
  return {
    kind: initial?.kind ?? 'text',
    title: initial?.title ?? '',
    categoryId: initial?.categoryId ?? '',
    newCategory: '',
    text: initial?.text ?? '',
    media: initial?.media,
  }
}

export function QuickReplyEditor({ initial, onClose }: { initial?: QuickReply; onClose: () => void }) {
  const { s, staff } = useWorkbench()
  const [form, setForm] = useState<Form>(() => initForm(initial))
  const fileInput = useRef<HTMLInputElement>(null)
  const patch = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }))
  const myCategories = s.quickReplyCategories.filter((c) => c.scope === 'personal' && c.staffId === staff?.id)
  const isText = form.kind === 'text'
  const valid = !!form.title.trim() && (isText ? !!form.text.trim() : !!form.media) && (form.categoryId !== NEW_CATEGORY || !!form.newCategory.trim())

  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const r = await readFileAsMedia(file)
    if (!r.ok) return toast(r.error, 'warn')
    if (form.kind === 'image' && !r.media.mime?.startsWith('image/')) return toast('图片话术只能选图片文件', 'warn')
    patch({ media: r.media })
  }

  const save = () => {
    if (!staff || !valid) return
    // 选了「新建分类…」先建分类再存话术
    const categoryId = form.categoryId === NEW_CATEGORY ? (s.saveQuickReplyCategory('personal', { name: form.newCategory }, staff.id)?.id ?? null) : form.categoryId || null
    if (form.categoryId === NEW_CATEGORY && !categoryId) return toast('新建分类失败：分类名不能为空', 'warn')
    const saved = s.saveQuickReply('personal', { id: initial?.id, categoryId, kind: form.kind, title: form.title, text: form.text, media: isText ? undefined : form.media }, staff.id)
    if (!saved) return toast('保存失败：请检查标题、正文或附件', 'warn')
    toast(initial ? '已更新话术' : '已新建个人话术')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? '编辑我的话术' : '新建我的话术'}
      width={480}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!valid} onClick={save}>保存</Button>
        </>
      }
    >
      <div className="space-y-3">
        {!initial && (
          <Field label="类型" required>
            <div className="flex gap-1">
              {KINDS.map((k) => {
                const Icon = KIND_META[k].icon
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => patch({ kind: k, media: undefined })}
                    className={clsx('flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border text-[13px]', form.kind === k ? 'border-brand-300 bg-brand-50 font-medium text-brand-800' : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50')}
                  >
                    <Icon size={13} />
                    {KIND_META[k].label}
                  </button>
                )
              })}
            </div>
          </Field>
        )}
        <Field label="标题" required hint="1 到 20 字，打字匹配时优先按标题命中">
          <Input value={form.title} maxLength={20} onChange={(e) => patch({ title: e.target.value })} placeholder={isText ? '如：约时间' : '如：开户流程图'} />
          <div className="mt-1 text-[11px] text-zinc-400">标题和正文都会被搜索到，不用单独填关键词</div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="分类">
            <Select value={form.categoryId} onChange={(e) => patch({ categoryId: e.target.value })}>
              <option value="">未分类</option>
              {myCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value={NEW_CATEGORY}>新建分类…</option>
            </Select>
          </Field>
          {form.categoryId === NEW_CATEGORY && (
            <Field label="新分类名" required>
              <Input value={form.newCategory} maxLength={12} autoFocus onChange={(e) => patch({ newCategory: e.target.value })} placeholder="如：日常跟进" />
            </Field>
          )}
        </div>
        {!isText && (
          <Field label={form.kind === 'image' ? '图片' : '文件'} required hint={`本机选择，演示上限 ${formatBytes(UPLOAD_MAX_BYTES)}`}>
            <input ref={fileInput} type="file" accept={form.kind === 'image' ? 'image/*' : undefined} className="hidden" onChange={(e) => void pickFile(e)} />
            <div className="flex items-start gap-3">
              {form.media && (form.kind === 'image' ? <ImageThumb media={form.media} maxWidth={160} /> : <FileCard media={form.media} />)}
              <Button size="sm" onClick={() => fileInput.current?.click()}>
                <Upload size={12} /> {form.media ? '换一个' : '选择文件'}
              </Button>
            </div>
          </Field>
        )}
        <Field label={isText ? '正文' : '说明'} required={isText} hint={isText ? '支持 {{customer.nickname}} {{staff.name}} {{company.name}}，发送时替换' : '随附件一起发出的文字，可留空'}>
          <Textarea rows={isText ? 5 : 2} value={form.text} maxLength={500} onChange={(e) => patch({ text: e.target.value })} />
        </Field>
      </div>
    </Modal>
  )
}
