import type { QuickReplyCategory, QuickReplyKind } from '@/domain/types'
import { confirm } from '@/ui/confirm'

export const KIND_LABEL: Record<QuickReplyKind, string> = { text: '文字', image: '图片', file: '文件' }
export const CAT_ALL = 'all'
export const CAT_NONE = 'none'

/** 删除分类的确认：其下话术转未分类 */
export async function confirmDeleteCategory(cat: QuickReplyCategory, count: number): Promise<boolean> {
  return confirm({ title: `删除分类「${cat.name}」？`, body: `分类下的 ${count} 条话术不会删除，会转为「未分类」。`, okText: '删除', danger: true })
}
