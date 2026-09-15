/**
 * 代号 A 补充动作：群级策略覆盖（policy.ts 的 addPolicyOverride 只会给客户 / 坐席写变更记录文案）。
 */
import type { PolicyOverride } from '@/domain/types'
import { newId } from '@/domain/ids'
import { type Get, type Set, now, withAudit } from './helpers'

export interface AExtraActions {
  /** 给某个群加一条群级覆盖：只作用于客户在该群里的能力；同一群已有覆盖则替换 */
  addGroupPolicyOverride: (groupId: string, caps: Record<string, boolean>, byStaffId: string) => void
}

export function aExtraActions(set: Set, _get: Get): AExtraActions {
  return {
    addGroupPolicyOverride: (groupId, caps, byStaffId) =>
      set((s) => {
        const g = s.chatGroups.find((x) => x.id === groupId)
        if (!g) return {}
        const o: PolicyOverride = { id: newId('po'), targetKind: 'group', targetId: groupId, caps, byStaffId, createdAt: now() }
        const detail = `给群「${g.name}」添加群级覆盖：${Object.entries(caps)
          .map(([k, v]) => `${k}=${v ? '开' : '关'}`)
          .join('，')}`
        return {
          policyOverrides: [o, ...s.policyOverrides.filter((x) => !(x.targetKind === 'group' && x.targetId === groupId))],
          policyChanges: [{ id: newId('pc'), at: now(), byStaffId, kind: 'override', detail }, ...s.policyChanges],
          audit: withAudit(s.audit, 'policy.override', detail, byStaffId),
        }
      }),
  }
}
