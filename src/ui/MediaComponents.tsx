import { mediaUrl } from '@/domain/mediaUrl'
import { useEffect, useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import { FileText, X } from 'lucide-react'
import type { MessageMedia } from '@/domain/types'
import { registerLightbox, showImage } from './lightboxState'
import { formatBytes } from './mediaUtils'

export function Lightbox() {
  const [media, setMedia] = useState<MessageMedia | null>(null)
  useEffect(() => {
    registerLightbox(setMedia)
    return () => registerLightbox(null)
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

export function ImageThumb({ media, className, maxWidth = 240, maxHeight = 220, onClick }: { media: MessageMedia; className?: string; maxWidth?: number | 'none'; maxHeight?: number; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick ?? (() => showImage(media))} className={clsx('block overflow-hidden rounded-md border border-zinc-200 bg-white', className)} style={{ maxWidth: maxWidth === 'none' ? undefined : maxWidth }} title={media.name}>
      <img src={mediaUrl(media.url)} alt={media.name} className="block h-auto w-full object-cover object-top" style={{ maxHeight }} loading="lazy" />
    </button>
  )
}

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
