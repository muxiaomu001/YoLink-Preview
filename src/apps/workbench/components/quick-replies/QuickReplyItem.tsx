/**
 * 右栏话术面板的单个条目：
 * - 文字：标题 + 正文前两行，悬停出「发送」「填入」
 * - 图片：缩略图撑满，点缩略图直接发出，悬停出「预览」
 * - 文件：文件卡，点一下直接发出
 * 个人话术悬停另有「编辑」「删除」；企业话术只读。不能发时（没选会话 / 拉黑 / 无权限）按钮禁用并在 title 说明。
 */
import { clsx } from 'clsx'
import { Eye, Paperclip, Pencil, Trash2, Zap } from 'lucide-react'
import type { QuickReply } from '@/domain/types'
import { FileCard, ImageThumb, showImage } from '@/ui/media'
import { toast } from '@/ui/overlay'
import { KIND_META } from './shared'

const THUMB_MAX_HEIGHT = 120

export function QuickReplyItem({ item, reason, onSend, onFill, onEdit, onDelete }: { item: QuickReply; reason?: string; onSend: () => void; onFill: () => void; onEdit?: () => void; onDelete?: () => void }) {
  const Icon = KIND_META[item.kind].icon
  const ownActions = (
    <>
      {onEdit && <IconBtn label="编辑" onClick={onEdit}><Pencil size={12} /></IconBtn>}
      {onDelete && <IconBtn label="删除" danger onClick={onDelete}><Trash2 size={12} /></IconBtn>}
    </>
  )
  /** 点缩略图 / 文件卡：能发就发，不能发说明原因 */
  const clickSend = () => (reason ? toast(reason, 'warn') : onSend())

  if (item.kind === 'image' && item.media) {
    return (
      <div className="group relative rounded-md border border-zinc-100 p-2 hover:border-zinc-200 hover:bg-zinc-50">
        <div className={clsx(reason && 'opacity-70')} title={reason ?? '点击直接发送'}>
          <ImageThumb media={item.media} maxWidth="none" maxHeight={THUMB_MAX_HEIGHT} className="w-full" onClick={clickSend} />
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-zinc-700">
          <Icon size={12} className="shrink-0 text-zinc-400" />
          <span className="truncate font-medium">{item.title}</span>
          {item.text && <span className="min-w-0 truncate text-zinc-400">· {item.text}</span>}
        </div>
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
        <div className="mb-1.5 flex items-center gap-1.5 text-[12px] text-zinc-700">
          <Paperclip size={12} className="shrink-0 text-zinc-400" />
          <span className="truncate font-medium">{item.title}</span>
        </div>
        <FileCard media={item.media} full extra={reason ?? '点击直接发送'} onClick={clickSend} className={clsx(reason && 'opacity-70')} />
        {item.text && <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-zinc-500">{item.text}</div>}
        {(onEdit || onDelete) && <Hover>{ownActions}</Hover>}
      </div>
    )
  }

  return (
    <div className="group relative rounded-md border border-zinc-100 px-2.5 py-2 hover:border-zinc-200 hover:bg-zinc-50">
      <div className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-800">
        <Zap size={12} className="shrink-0 text-zinc-400" />
        <span className="truncate">{item.title}</span>
      </div>
      <div className="mt-0.5 line-clamp-2 text-[12px] leading-snug whitespace-pre-wrap text-zinc-500">{item.text}</div>
      <Hover>
        <TextBtn label="发送" title={reason ?? '以当前坐席身份直接发出，变量已替换'} disabled={!!reason} onClick={onSend} />
        <TextBtn label="填入" title="填进输入框，可改完再发" onClick={onFill} />
        {ownActions}
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
