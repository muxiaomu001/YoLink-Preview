import type { Message } from '@/domain/types'
import { visibleText } from '@/store/policy'

/** 客户视角的一行预览：会话列表、引用条、置顶条、回复条共用；图片 / 文件消息显示占位 */
export function customerPreview(m: Message): string {
  if (m.senderKind === 'seat' && m.recalledAt) return ''
  if (m.recalledAt || m.deletedAt) return visibleText(m, 'customer')
  if(m.kind==='video')return '[视频] '+m.text
  if(m.kind==='voice')return '[语音] '+m.text
  if(m.media?.album)return `[图片 ${m.media.album.length} 张] ${m.text}`
  if (m.kind === 'image') return m.text ? `[图片] ${m.text}` : '[图片]'
  if (m.kind === 'file') return `[文件] ${m.media?.name ?? m.text}`
  return visibleText(m, 'customer')
}
