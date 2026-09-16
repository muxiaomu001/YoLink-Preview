/**
 * 策略：预设（应用/复制/删除）、能力矩阵、数值型策略、用户级覆盖（P1）、变更记录。
 */
import type { PolicyChange, PolicyCol, PolicyNumbers, PolicyOverride, PolicyPreset } from '@/domain/types'
import { POLICY_COLS } from '@/domain/seed-admin'
import { newId } from '@/domain/ids'
import { type Get, type Set, now, withAudit } from './helpers'

export interface PolicyActions {
  applyPreset: (presetId: string, byStaffId: string) => void
  copyPreset: (presetId: string, byStaffId: string) => PolicyPreset | undefined
  deletePreset: (presetId: string, byStaffId: string) => boolean
  setPolicyCap: (key: string, col: PolicyCol, value: boolean, byStaffId: string) => void
  setPolicyNumbers: (patch: Partial<PolicyNumbers>, byStaffId: string) => void
  addPolicyOverride: (input: Omit<PolicyOverride, 'id' | 'createdAt' | 'byStaffId'>, byStaffId: string) => void
  updatePolicyOverride: (id: string, caps: Record<string, boolean>, byStaffId: string) => void
  removePolicyOverride: (id: string, byStaffId: string) => void
}

const NUMBER_LABEL: Record<keyof PolicyNumbers, string> = {
  seatRecallSeconds: '坐席「为所有人删除」时限',
  seatEditSeconds: '坐席编辑时限',
  customerRecallSeconds: '客户「为所有人删除」时限',
  customerEditSeconds: '客户编辑时限',
  recallSeconds: '旧版统一删除时限',
  editSeconds: '消息编辑时限',
  groupMaxMembers: '单群上限',
  slowModeSeconds: '发言限流默认间隔',
  retentionDays: '消息保留天数',
  fileMaxMb: '文件大小上限',
  imageMaxMb: '图片最大大小',
  videoMaxMb: '视频最大大小',
  voiceMaxSeconds: '语音最大时长',
  maxDevices: '最大同时在线设备数',
  idleDays: '长期未跟进天数',
}

function change(kind: PolicyChange['kind'], detail: string, byStaffId: string): PolicyChange {
  return { id: newId('pc'), at: now(), byStaffId, kind, detail }
}

export function policyActions(set: Set, get: Get): PolicyActions {
  return {
    applyPreset: (presetId, byStaffId) =>
      set((s) => {
        const p = s.policyPresets.find((x) => x.id === presetId)
        if (!p) return {}
        const detail = `应用预设「${p.name}」`
        return {
          activePresetId: presetId,
          policyMatrix: JSON.parse(JSON.stringify(p.matrix)),
          policyChanges: [change('preset', detail, byStaffId), ...s.policyChanges],
          audit: withAudit(s.audit, 'policy.preset', `${detail}，覆盖当前能力矩阵`, byStaffId),
        }
      }),

    copyPreset: (presetId, byStaffId) => {
      const s = get()
      const p = s.policyPresets.find((x) => x.id === presetId)
      if (!p) return undefined
      const copy: PolicyPreset = { id: newId('preset'), name: `${p.name} 副本`, desc: p.desc, builtin: false, matrix: JSON.parse(JSON.stringify(p.matrix)) }
      set({ policyPresets: [...s.policyPresets, copy], audit: withAudit(s.audit, 'policy.update', `复制预设「${p.name}」为「${copy.name}」`, byStaffId) })
      return copy
    },

    deletePreset: (presetId, byStaffId) => {
      const s = get()
      const p = s.policyPresets.find((x) => x.id === presetId)
      if (!p || p.builtin || s.activePresetId === presetId) return false
      set({ policyPresets: s.policyPresets.filter((x) => x.id !== presetId), audit: withAudit(s.audit, 'policy.update', `删除预设「${p.name}」`, byStaffId) })
      return true
    },

    setPolicyCap: (key, col, value, byStaffId) =>
      set((s) => {
        const item = s.policyItems.find((p) => p.key === key)
        const colLabel = POLICY_COLS.find((c) => c.key === col)?.label ?? col
        const detail = `${key}（${item?.label ?? ''}） ${colLabel}：${value ? '关 → 开' : '开 → 关'}`
        return {
          policyMatrix: { ...s.policyMatrix, [key]: { ...s.policyMatrix[key], [col]: value } },
          policyChanges: [change('cap', detail, byStaffId), ...s.policyChanges],
          audit: withAudit(s.audit, 'policy.cap', `修改能力 ${detail}；在线用户收到策略更新推送`, byStaffId),
        }
      }),

    setPolicyNumbers: (patch, byStaffId) =>
      set((s) => {
        const parts = (Object.keys(patch) as (keyof PolicyNumbers)[]).filter((k) => patch[k] !== s.policyNumbers[k]).map((k) => `${NUMBER_LABEL[k]} ${s.policyNumbers[k]} → ${patch[k]}`)
        if (!parts.length) return {}
        return {
          policyNumbers: { ...s.policyNumbers, ...patch },
          policyChanges: [change('number', parts.join('；'), byStaffId), ...s.policyChanges],
          audit: withAudit(s.audit, 'policy.number', `修改数值型策略：${parts.join('；')}`, byStaffId),
        }
      }),

    addPolicyOverride: (input, byStaffId) =>
      set((s) => {
        const o: PolicyOverride = { ...input, id: newId('po'), byStaffId, createdAt: now() }
        const name = input.targetKind === 'customer' ? s.customers.find((c) => c.id === input.targetId)?.nickname : s.seats.find((x) => x.id === input.targetId)?.displayName
        const detail = `给${input.targetKind === 'customer' ? '客户' : '坐席'}「${name}」添加覆盖：${Object.entries(input.caps)
          .map(([k, v]) => `${k}=${v ? '开' : '关'}`)
          .join('，')}`
        return {
          policyOverrides: [o, ...s.policyOverrides.filter((x) => !(x.targetKind === input.targetKind && x.targetId === input.targetId))],
          policyChanges: [change('override', detail, byStaffId), ...s.policyChanges],
          audit: withAudit(s.audit, 'policy.override', detail, byStaffId),
        }
      }),

    updatePolicyOverride: (id, caps, byStaffId) =>
      set((s) => {
        const detail = `修改用户级覆盖：${Object.entries(caps)
          .map(([k, v]) => `${k}=${v ? '开' : '关'}`)
          .join('，')}`
        return {
          policyOverrides: s.policyOverrides.map((x) => (x.id === id ? { ...x, caps } : x)),
          policyChanges: [change('override', detail, byStaffId), ...s.policyChanges],
          audit: withAudit(s.audit, 'policy.override', detail, byStaffId),
        }
      }),

    removePolicyOverride: (id, byStaffId) =>
      set((s) => ({
        policyOverrides: s.policyOverrides.filter((x) => x.id !== id),
        policyChanges: [change('override', '删除一条用户级覆盖', byStaffId), ...s.policyChanges],
        audit: withAudit(s.audit, 'policy.override', '删除用户级覆盖', byStaffId),
      })),
  }
}
