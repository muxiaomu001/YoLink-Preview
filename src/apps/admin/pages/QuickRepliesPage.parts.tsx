/**
 * 话术库页（管理后台）的零件：分类栏、分类编辑弹窗、话术新建 / 编辑弹窗、类型单元格、关键词解析。
 */
import { useRef, useState } from 'react'
import { clsx } from 'clsx'
import { FolderPlus, Pencil, Trash2, Upload } from 'lucide-react'
import type { MessageMedia, QuickReply, QuickReplyCategory, QuickReplyKind } from '@/domain/types'
import { useStore } from '@/store/store'
import { Button, Field, Input, Select, Textarea } from '@/ui/primitives'
import { Pill } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { FileCard, ImageThumb, UPLOAD_MAX_BYTES, formatBytes, readFileAsMedia } from '@/ui/media'

export const KIND_LABEL: Record<QuickReplyKind, string> = { text: '文字', image: '图片', file: '文件' }
const KINDS: QuickReplyKind[] = ['text', 'image', 'file']

/** 固定的两个分类筛选项 */
export const CAT_ALL = 'all'
export const CAT_NONE = 'none'

/** 关键词输入：逗号（中英文）或空白分隔，去重去空 */
export function parseKeywords(raw: string): string[] {
  return Array.from(new Set(raw.split(/[,，\s]+/).map((k) => k.trim()).filter(Boolean)))
}

/** 表格「类型」列：文字用 Pill，图片 40px 缩略图，文件用文件图标 */
export function KindCell({ q }: { q: QuickReply }) {
  if (q.kind === 'image' && q.media) return <ImageThumb media={q.media} maxWidth={40} className="h-10 w-10" />
  if (q.kind === 'file') return <Pill tone="purple">文件</Pill>
  return <Pill>文字</Pill>
}

// ---------- 分类栏 ----------

export function CategorySidebar({
  cats,
  countOf,
  total,
  uncategorized,
  active,
  onPick,
  onCreate,
  onRename,
  onDelete,
}: {
  cats: QuickReplyCategory[]
  countOf: (id: string) => number
  total: number
  uncategorized: number
  active: string
  onPick: (id: string) => void
  onCreate: () => void
  onRename: (c: QuickReplyCategory) => void
  onDelete: (c: QuickReplyCategory) => void
}) {
  const fixed = [
    { id: CAT_ALL, name: '全部', count: total },
    { id: CAT_NONE, name: '未分类', count: uncategorized },
  ]
  const rowCls = (on: boolean) => clsx('group flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-[13px]', on ? 'bg-brand-50 font-medium text-brand-800' : 'text-zinc-700 hover:bg-zinc-50')
  return (
    <div className="space-y-0.5">
      {fixed.map((f) => (
        <button key={f.id} type="button" className={rowCls(active === f.id)} onClick={() => onPick(f.id)}>
          <span className="flex-1 truncate text-left">{f.name}</span>
          <span className="text-[11px] tabular-nums text-zinc-400">{f.count}</span>
        </button>
      ))}
      <div className="my-2 border-t border-zinc-100" />
      {cats.map((c) => (
        <div key={c.id} className={rowCls(active === c.id)}>
          <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => onPick(c.id)} title={c.name}>
            {c.name}
          </button>
          <span className="text-[11px] tabular-nums text-zinc-400 group-hover:hidden">{countOf(c.id)}</span>
          <span className="hidden items-center gap-0.5 group-hover:inline-flex">
            <button type="button" className="rounded p-0.5 text-zinc-400 hover:bg-white hover:text-zinc-700" title="重命名" onClick={() => onRename(c)}>
              <Pencil size={12} />
            </button>
            <button type="button" className="rounded p-0.5 text-zinc-400 hover:bg-white hover:text-red-600" title="删除分类" onClick={() => onDelete(c)}>
              <Trash2 size={12} />
            </button>
          </span>
        </div>
      ))}
      {cats.length === 0 && <div className="px-2.5 py-2 text-[11px] text-zinc-400">还没有企业分类</div>}
      <Button size="sm" variant="ghost" className="mt-2 w-full justify-start" onClick={onCreate}>
        <FolderPlus size={13} /> 新建分类
      </Button>
    </div>
  )
}

/** 新建 / 重命名分类 */
export function CategoryEditor({ cat, onClose }: { cat?: QuickReplyCategory; onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [name, setName] = useState(cat?.name ?? '')
  const trimmed = name.trim()
  const duplicate = s.quickReplyCategories.some((c) => c.scope === 'enterprise' && c.id !== cat?.id && c.name === trimmed)
  const error = duplicate ? '已有同名分类' : trimmed.length > 16 ? '分类名最多 16 字' : ''
  const ok = trimmed.length > 0 && !error
  const submit = () => {
    if (!ok) return
    const r = s.saveQuickReplyCategory('enterprise', { id: cat?.id, name: trimmed }, admin)
    if (!r) return toast('分类保存失败', 'warn')
    toast(cat ? `分类已重命名为「${trimmed}」` : `分类「${trimmed}」已创建`)
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={cat ? `重命名分类：${cat.name}` : '新建分类'}
      width={400}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!ok} onClick={submit}>
            {cat ? '保存' : '创建'}
          </Button>
        </>
      }
    >
      <Field label="分类名" required hint="1 到 16 字，企业内唯一">
        <Input autoFocus value={name} maxLength={16} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      </Field>
      {error && <div className="mt-1 text-[11px] text-red-600">{error}</div>}
    </Modal>
  )
}

/** 删除分类的确认：其下话术转未分类 */
export async function confirmDeleteCategory(cat: QuickReplyCategory, count: number): Promise<boolean> {
  return confirm({ title: `删除分类「${cat.name}」？`, body: `分类下的 ${count} 条话术不会删除，会转为「未分类」。`, okText: '删除', danger: true })
}

// ---------- 话术编辑弹窗 ----------

export function QuickReplyEditor({ item, cats, defaultCategoryId, onClose }: { item?: QuickReply; cats: QuickReplyCategory[]; defaultCategoryId?: string | null; onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [kind, setKind] = useState<QuickReplyKind>(item?.kind ?? 'text')
  const [title, setTitle] = useState(item?.title ?? '')
  const [categoryId, setCategoryId] = useState<string>(item?.categoryId ?? defaultCategoryId ?? '')
  const [keywordsRaw, setKeywordsRaw] = useState(item?.keywords.join(', ') ?? '')
  const [text, setText] = useState(item?.text ?? '')
  const [media, setMedia] = useState<MessageMedia | undefined>(item?.media)
  const [reading, setReading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const keywords = parseKeywords(keywordsRaw)

  const needMedia = kind !== 'text'
  const reason = !title.trim() ? '填标题' : kind === 'text' && !text.trim() ? '填正文' : needMedia && !media ? (kind === 'image' ? '选一张图片' : '选一个文件') : ''

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    setReading(true)
    const r = await readFileAsMedia(file)
    setReading(false)
    if (!r.ok) return toast(r.error, 'warn')
    if (kind === 'image' && !r.media.mime?.startsWith('image/')) return toast('请选择图片文件', 'warn')
    setMedia(r.media)
  }

  const submit = () => {
    if (reason) return
    const r = s.saveQuickReply('enterprise', { id: item?.id, categoryId: categoryId || null, kind, title, text, keywords, media: needMedia ? media : undefined }, admin)
    if (!r) return toast('标题和内容必填', 'warn')
    toast(item ? `话术「${r.title}」已保存` : `${KIND_LABEL[kind]}话术「${r.title}」已入库，员工在工作台立即可用`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={item ? `编辑话术：${item.title}` : '新建话术'}
      width={600}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!!reason || reading} title={reason || undefined} onClick={submit}>
            {item ? '保存' : '入库'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="类型" hint={item ? '改类型后需重新选附件或正文' : undefined}>
            <Select
              value={kind}
              onChange={(e) => {
                const k = e.target.value as QuickReplyKind
                setKind(k)
                if (k === 'text' || (media && k === 'image' && !media.mime?.startsWith('image/'))) setMedia(undefined)
              }}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="分类">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">未分类</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="标题" required hint="员工在话术面板和自动匹配里看到的名字">
          <Input autoFocus value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} placeholder="如：开户材料" />
        </Field>
        <Field label="关键词" hint="逗号或空格分隔；员工打字满 2 个字时按标题、关键词、正文自动匹配">
          <Input value={keywordsRaw} onChange={(e) => setKeywordsRaw(e.target.value)} placeholder="开户, 材料, 身份证" />
          {keywords.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {keywords.map((k) => (
                <Pill key={k} tone="blue">
                  {k}
                </Pill>
              ))}
            </div>
          )}
        </Field>
        {needMedia && (
          <Field label={kind === 'image' ? '图片' : '文件'} required hint={`本机选择，最大 ${formatBytes(UPLOAD_MAX_BYTES)}（演示存在浏览器里）`}>
            <input ref={fileRef} type="file" className="hidden" accept={kind === 'image' ? 'image/*' : undefined} onChange={(e) => void pickFile(e.target.files?.[0])} />
            <div className="flex items-start gap-3">
              {media && (kind === 'image' ? <ImageThumb media={media} maxWidth={160} /> : <FileCard media={media} />)}
              <Button size="sm" disabled={reading} onClick={() => fileRef.current?.click()}>
                <Upload size={13} /> {reading ? '读取中…' : media ? '换一个' : kind === 'image' ? '选择图片' : '选择文件'}
              </Button>
            </div>
          </Field>
        )}
        <Field label={needMedia ? '随附说明' : '正文'} required={!needMedia} hint={needMedia ? '可空；和附件一起发出' : '支持 {{customer.nickname}} {{staff.name}} {{company.name}}，发送时替换'}>
          <Textarea rows={needMedia ? 2 : 5} value={text} onChange={(e) => setText(e.target.value)} placeholder={needMedia ? '如：清单在附件里，按上面准备就行' : ''} />
        </Field>
        {reason && <div className="text-[11px] text-zinc-400">{reason}</div>}
      </div>
    </Modal>
  )
}
