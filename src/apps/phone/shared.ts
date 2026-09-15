import type { ChatGroup } from '@/domain/types'
import type { CapResult } from '@/store/policy'

/** resolveCap 的 source → 给看 demo 的人看的文字 */
export const PHONE_SOURCE_LABEL: Record<CapResult['source'], string> = {
  default: '企业默认',
  group: '群级覆盖',
  user: '用户级覆盖',
  module_off: '模块停用',
  official_group: '官方群',
  unknown: '未登记',
}

export const groupKindLabel = (g: ChatGroup) => (g.kind === 'channel' ? '频道' : '群')
