/**
 * 右栏话术面板的条目，三种形态：
 * - 文字：标题 + 一行预览，悬停出「发送」「填入」
 * - 图片（单列形态，搜索结果用）：缩略图 + 标题，点缩略图直接发出
 * - 文件：文件卡 + 标题，点一下直接发出
 * 另外导出 QuickReplyImageCell：分类页两列网格里的正方形图片格子。
 * 个人话术悬停另有「编辑」「删除」；企业话术只读。不能发时（没选会话 / 拉黑 / 无权限）按钮禁用并在 title 说明。
 * 搜索场景可传 snippet + hit，命中的那一行用 Highlight 渲染。
 */
import { clsx } from 'clsx'
import { Eye, Paperclip, Pencil, Trash2, Zap } from 'lucide-react'
import type { QuickReply } from '@/domain/types'
import type { QuickReplySnippet } from '@/store/selectors'
import { FileCard, ImageThumb, showImage } from '@/ui/media'
import { toast } from '@/ui/overlay'
import { Highlight, KIND_META, previewLine } from './shared'

const THUMB_MAX_HEIGHT = 120

/** 命中字段：标题 / 正文 / 附件文件名，决定哪一行走高亮 */
type Hit = 'title' | 'text' | 'file'

interface ItemProps {
  item: QuickReply
  reason?: string
  /** 搜索命中的片段；没有就照常渲染 */
  snippet?: QuickReplySnippet | null
  hit?: Hit
  onSend: () => void
  onFill: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export function QuickReplyItem({ item, reason, snippet, hit, onSend, onFill, onEdit, onDelete }: ItemProps) {
  const Icon = KIND_META[item.kind].icon
  const mark = (field: Hit) => (hit === field && snippet ? snippet : null)
  const ownActions = (
    <>
      {onEdit && <IconBtn label="编辑" onClick={onEdit}><Pencil size={12} /></IconBtn>}
      {onDelete && <IconBtn label="删除" danger onClick={onDelete}><Trash2 size={12} /></IconBtn>}
    </>
  )
  /** 点缩略图 / 文件卡：能发就发，不能发说明原因 */
  const clickSend = () => (reason ? toast(reason, 'warn') : onSend())
  /** 正文预览收成一行；命中正文时换成高亮版 */
  const preview = item.text.trim() ? <Highlight snippet={mark('text')} fallback={previewLine(item, 60)} className="block truncate" /> : null
  /** 命中附件文件名时补一行说明，让人知道为什么搜出来 */
  const fileHitLine = mark('file') && (
    <div className="mt-1 flex min-w-0 items-center gap-1 text-[11px] text-zinc-400">
      <Paperclip size={11} className="shrink-0" />
      <Highlight snippet={mark('file')} className="min-w-0 truncate" />
    </div>
  )

  if (item.kind === 'image' && item.media) {
    return (
      <div className="group relative rounded-md border border-zinc-100 p-2 hover:border-zinc-200 hover:bg-zinc-50">
        <div className={clsx(reason && 'opacity-70')} title={reason ?? '点击直接发送'}>
          <ImageThumb media={item.media} maxWidth="none" maxHeight={THUMB_MAX_HEIGHT} className="w-full" onClick={clickSend} />
        </div>
        <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[12px] text-zinc-700">
          <Icon size={12} className="shrink-0 text-zinc-400" />
          <Highlight snippet={mark('title')} fallback={item.title} className="min-w-0 truncate font-medium" />
        </div>
        {preview && <div className="mt-0.5 min-w-0 text-[11px] leading-snug text-zinc-500">{preview}</div>}
        {fileHitLine}
        <Hover>
          <IconBtn label="预览大图" onClick={() => showImage(item.media!)}><Eye size={12} /></IconBtn>
          {ownActions}
        </Hover>
      </div>
    )
  }

  if (item.kind === 'file' && item.media) {
    return (
      <div className="group relative rounded-md border border-zinc-100 p-2 hover:border-zinc-200 hover:bg-zinc-50">
        <div className="mb-1.5 flex min-w-0 items-center gap-1.5 text-[12px] text-zinc-700">
          <Paperclip size={12} className="shrink-0 text-zinc-400" />
          <Highlight snippet={mark('title')} fallback={item.title} className="min-w-0 truncate font-medium" />
        </div>
        <FileCard media={item.media} full extra={reason ?? '点击直接发送'} onClick={clickSend} className={clsx(reason && 'opacity-70')} />
        {preview && <div className="mt-1 min-w-0 text-[11px] leading-snug text-zinc-500">{preview}</div>}
        {fileHitLine}
        {(onEdit || onDelete) && <Hover>{ownActions}</Hover>}
      </div>
    )
  }

  return (
    <div className="group relative rounded-md border border-zinc-100 px-2.5 py-2 hover:border-zinc-200 hover:bg-zinc-50">
      <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-zinc-800">
        <Zap size={12} className="shrink-0 text-zinc-400" />
        <Highlight snippet={mark('title')} fallback={item.title} className="min-w-0 truncate" />
      </div>
      {preview && <div className="mt-0.5 min-w-0 text-[12px] leading-snug text-zinc-500">{preview}</div>}
      <Hover>
        <TextBtn label="发送" title={reason ?? '以当前坐席身份直接发出，变量已替换'} disabled={!!reason} onClick={onSend} />
        <TextBtn label="填入" title="填进输入框，可改完再发" onClick={onFill} />
        {ownActions}
      </Hover>
    </div>
  )
}

/**
 * 分类页两列网格里的图片格子：正方形缩略图 + 一行标题。
 * 点图直接发送，悬停右上角出预览 / 编辑 / 删除。
 */
export function QuickReplyImageCell({ item, reason, onSend, onEdit, onDelete }: { item: QuickReply; reason?: string; onSend: () => void; onEdit?: () => void; onDelete?: () => void }) {
  const media = item.media
  if (!media) return null
  const clickSend = () => (reason ? toast(reason, 'warn') : onSend())
  return (
    <div className="group relative min-w-0">
      <button
        type="button"
        onClick={clickSend}
        title={reason ?? `${item.title}：点击直接发送`}
        className={clsx('block w-full overflow-hidden rounded-md border border-zinc-200 bg-white hover:border-brand-300', reason && 'opacity-60')}
      >
        <span className="block aspect-square w-full">
          <img src={media.url} alt={item.title} className="h-full w-full object-cover object-top" loading="lazy" />
        </span>
      </button>
      <div className="mt-1 truncate text-[11px] text-zinc-600" title={item.title}>
        {item.title}
      </div>
      <Hover>
        <IconBtn label="预览大图" onClick={() => showImage(media)}><Eye size={12} /></IconBtn>
        {onEdit && <IconBtn label="编辑" onClick={onEdit}><Pencil size={12} /></IconBtn>}
        {onDelete && <IconBtn label="删除" danger onClick={onDelete}><Trash2 size={12} /></IconBtn>}
      </Hover>
    </div>
  )
}

/** 悬停才出现的操作条 */
function Hover({ children }: { children: React.ReactNode }) {
  return <div className="absolute top-1 right-1 hidden items-center gap-0.5 rounded-md border border-zinc-200 bg-white p-0.5 shadow-sm group-hover:flex">{children}</div>
}

function TextBtn({ label, title, onClick, disabled }: { label: string; title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} className="h-5 rounded px-1.5 text-[11px] font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-transparent">
      {label}
    </button>
  )
}

function IconBtn({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={label} onClick={onClick} className={clsx('flex h-5 w-5 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100', danger ? 'hover:text-red-700' : 'hover:text-brand-700')}>
      {children}
    </button>
  )
}
