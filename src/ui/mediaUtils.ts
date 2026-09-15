import type { MessageMedia } from '@/domain/types'

export const UPLOAD_MAX_BYTES = 500 * 1024

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function isImageMedia(m: MessageMedia): boolean {
  return !!m.mime?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(m.name)
}

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
