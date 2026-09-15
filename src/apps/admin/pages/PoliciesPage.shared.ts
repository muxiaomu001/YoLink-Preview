import type { CapResult } from '@/store/policy'

/** resolveCap 的 source → 给人看的文字 */
export const SOURCE_LABEL: Record<CapResult['source'], string> = {
  default: '企业默认',
  group: '群级覆盖',
  user: '用户级覆盖',
  module_off: '模块停用',
  official_group: '官方群',
  unknown: '未登记',
}

/** 分组锚点 id */
export const groupAnchorId = (group: string) => `policy-group-${group.replace(/[^\w一-龥]/g, '-')}`
