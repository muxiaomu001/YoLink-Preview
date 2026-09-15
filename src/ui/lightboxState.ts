import type { MessageMedia } from '@/domain/types'

let openLightbox: ((media: MessageMedia) => void) | null = null

export function registerLightbox(handler: ((media: MessageMedia) => void) | null) {
  openLightbox = handler
}

export function showImage(media: MessageMedia) {
  openLightbox?.(media)
}
