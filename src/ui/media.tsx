/**
 * 图片 / 文件附件的共用展示与读取：消息气泡、话术面板、群发预览都用这里的组件。
 * - ImageThumb：缩略图，点开大图（Lightbox）
 * - FileCard：文件卡片（名称 + 大小 + 打开）
 * - readFileAsMedia：本机选文件 → data URL 的 MessageMedia（演示存 localStorage，限制大小）
 */
import { mediaUrl } from '@/domain/mediaUrl'
import { useEffect, useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import { FileText, X } from 'lucide-react'
import type { MessageMedia } from '@/domain/types'

/** 演示里上传附件的上限：存浏览器 localStorage，太大会撑爆 */
export const UPLOAD_MAX_BYTES = 500 * 1024

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function isImageMedia(m: MessageMedia): boolean {
  return !!m.mime?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(m.name)
}

/** 读本机文件为 MessageMedia；超限返回错误文案 */
export function readFileAsMedia(file: File, maxBytes = UPLOAD_MAX_BYTES): Promise<{ ok: true; media: MessageMedia } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    if (file.size > maxBytes) return resolve({ ok: false, error: `文件超过 ${formatBytes(maxBytes)}（演示存在浏览器里，正式版按策略上限）` })
    const reader = new FileReader()
    reader.onerror = () => resolve({ ok: false, error: '读取文件失败' })
    reader.onload = () => {
      const url = String(reader.result)
      const base: MessageMedia = { url, name: file.name, size: file.size, mime: file.type || undefined }
      if (!file.type.startsWith('image/')) return resolve({ ok: true, media: base })
      const img = new Image()
      img.onload = () => resolve({ ok: true, media: { ...base, width: img.naturalWidth, height: img.naturalHeight } })
      img.onerror = () => resolve({ ok: true, media: base })
      img.src = url
    }
    reader.readAsDataURL(file)
  })
}

// ---------- 大图 ----------

let openLightbox: ((m: MessageMedia) => void) | null = null

/** 放在应用根部一次；任何地方调 showImage 打开 */
export function Lightbox() {
  const [media, setMedia] = useState<MessageMedia | null>(null)
  useEffect(() => {
    openLightbox = setMedia
    return () => {
      openLightbox = null
    }
  }, [])
  useEffect(() => {
    if (!media) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMedia(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [media])
  if (!media) return null
  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-zinc-900/80 p-6" onMouseDown={() => setMedia(null)}>
      <button type="button" className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="关闭" onClick={() => setMedia(null)}>
        <X size={18} />
      </button>
      <img src={mediaUrl(media.url)} alt={media.name} className="max-h-[85vh] max-w-[90vw] rounded-md bg-white object-contain shadow-2xl" onMouseDown={(e) => e.stopPropagation()} />
      <div className="mt-3 text-[12px] text-zinc-300">
        {media.name}
        {media.width && media.height ? ` · ${media.width}×${media.height}` : ''} · {formatBytes(media.size)}
      </div>
    </div>
  )
}

export function showImage(m: MessageMedia) {
  openLightbox?.(m)
}

// ---------- 缩略图与文件卡 ----------

/** 缩略图；maxHeight 内按 object-cover 裁切（顶部对齐），高图在面板里只露上半截，点「预览」看全图 */
export function ImageThumb({ media, className, maxWidth = 240, maxHeight = 220, onClick }: { media: MessageMedia; className?: string; maxWidth?: number | 'none'; maxHeight?: number; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick ?? (() => showImage(media))} className={clsx('block overflow-hidden rounded-md border border-zinc-200 bg-white', className)} style={{ maxWidth: maxWidth === 'none' ? undefined : maxWidth }} title={media.name}>
      <img src={mediaUrl(media.url)} alt={media.name} className="block h-auto w-full object-cover object-top" style={{ maxHeight }} loading="lazy" />
    </button>
  )
}

/** 文件卡；full 时撑满容器宽度（话术面板用） */
export function FileCard({ media, className, extra, onClick, full }: { media: MessageMedia; className?: string; extra?: ReactNode; onClick?: () => void; full?: boolean }) {
  const inner = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
        <FileText size={18} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[13px] font-medium text-zinc-800">{media.name}</span>
        <span className="block text-[11px] text-zinc-400">{formatBytes(media.size)}{extra ? <> · {extra}</> : null}</span>
      </span>
    </>
  )
  const cls = clsx('flex w-full items-center gap-2.5 rounded-md border border-zinc-200 bg-white px-2.5 py-2 hover:bg-zinc-50', !full && 'max-w-[260px]', className)
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>
  return <a href={mediaUrl(media.url)} target="_blank" rel="noreferrer" className={cls} download={media.url.startsWith('data:') ? media.name : undefined}>{inner}</a>
}
