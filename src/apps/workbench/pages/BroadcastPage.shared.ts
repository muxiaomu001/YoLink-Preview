import type { Broadcast, BroadcastTargetKind } from '@/domain/types'

export const TARGET_LABEL: Record<BroadcastTargetKind, string> = { friends: '全部好友', mine: '主归属客户', tag: '按标签', title: '按头衔', purchase: '按购买', role: '按角色', group: '指定群', coverage: '多坐席覆盖' }
export const CONTENT_KIND_LABEL: Record<Broadcast['contentKind'], string> = { text: '文本', image: '图片', file: '文件' }
export const PREVIEW_LEN = 50
export const DELIVERY_RULES = '名单在预览时锁定，之后新加的客户不在这次名单里；发送时仍自动跳过已注销、已封禁、全部禁言、屏蔽本坐席、当日已达频控的客户；每任务每客户最多一条；「指定群」是往群里发一条群消息。'

export function broadcastPreviewFingerprint(values: readonly unknown[]): string {
  return JSON.stringify(values)
}

export function isBroadcastPreviewStale(previewFingerprint: string, currentFingerprint: string): boolean {
  return previewFingerprint !== currentFingerprint
}
