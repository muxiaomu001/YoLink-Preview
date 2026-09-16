import type { ProviderInstance, ProviderLicenseAction } from '@/domain/types'
import { newId } from '@/domain/ids'
import { iso } from '@/domain/time'
import { type Get, type Set, now } from './helpers'

export interface ProviderLicensingActions {
  bindProviderInstance: (input: {
    enterpriseName: string
    enterpriseCode: string
    deviceCode: string
    months: number
  }) => { ok: true; instance: ProviderInstance } | { ok: false; error: string }
  renewProviderInstance: (id: string, months: number) => void
  stopProviderInstance: (id: string, reason: string) => void
  resumeProviderInstance: (id: string) => void
}

const OPERATOR = '供应方管理员'

function addMonths(from: string, months: number) {
  const base = Math.max(Date.now(), new Date(from).getTime())
  const date = new Date(base)
  date.setMonth(date.getMonth() + months)
  return iso(date.getTime())
}

function action(instanceId: string, kind: ProviderLicenseAction['action'], detail: string): ProviderLicenseAction {
  return { id: newId('pla'), instanceId, at: now(), operatorName: OPERATOR, action: kind, detail }
}

export function providerLicensingActions(set: Set, get: Get): ProviderLicensingActions {
  return {
    bindProviderInstance: (input) => {
      const s = get()
      const deviceCode = input.deviceCode.trim().toUpperCase()
      if (s.providerInstances.some((x) => x.deviceCode.toUpperCase() === deviceCode)) return { ok: false, error: '这个设备码已经绑定' }
      const at = now()
      const instance: ProviderInstance = {
        id: newId('pi'),
        enterpriseName: input.enterpriseName.trim(),
        enterpriseCode: input.enterpriseCode.trim().toUpperCase(),
        deviceCode,
        instanceId: crypto.randomUUID(),
        version: 'v1.0.3',
        boundAt: at,
        expiresAt: addMonths(at, input.months),
        stoppedAt: null,
        stopReason: null,
      }
      set({
        providerInstances: [instance, ...s.providerInstances],
        providerLicenseActions: [action(instance.instanceId, 'bind', `绑定设备码 ${deviceCode}，授权 ${input.months} 个月`), ...s.providerLicenseActions],
      })
      return { ok: true, instance }
    },

    renewProviderInstance: (id, months) => {
      const s = get()
      const instance = s.providerInstances.find((x) => x.id === id)
      if (!instance) return
      const expiresAt = addMonths(instance.expiresAt, months)
      const license = instance.instanceId === s.license.instanceId
        ? { ...s.license, expiresAt, modules: s.license.modules.map((module) => ({ ...module, expiresAt })) }
        : s.license
      set({
        providerInstances: s.providerInstances.map((x) => (x.id === id ? { ...x, expiresAt } : x)),
        providerLicenseActions: [action(instance.instanceId, 'renew', `续期 ${months} 个月，到期日更新为 ${expiresAt.slice(0, 10)}${instance.stoppedAt ? '；停用状态保持不变' : ''}`), ...s.providerLicenseActions],
        license,
      })
    },

    stopProviderInstance: (id, reason) => {
      const s = get()
      const instance = s.providerInstances.find((x) => x.id === id)
      const cleanReason = reason.trim()
      if (!instance || !cleanReason || instance.stoppedAt) return
      set({
        providerInstances: s.providerInstances.map((x) => (x.id === id ? { ...x, stoppedAt: now(), stopReason: cleanReason } : x)),
        providerLicenseActions: [action(instance.instanceId, 'stop', `人工停用：${cleanReason}`), ...s.providerLicenseActions],
      })
    },

    resumeProviderInstance: (id) => {
      const s = get()
      const instance = s.providerInstances.find((x) => x.id === id)
      if (!instance || !instance.stoppedAt) return
      set({
        providerInstances: s.providerInstances.map((x) => (x.id === id ? { ...x, stoppedAt: null, stopReason: null } : x)),
        providerLicenseActions: [action(instance.instanceId, 'resume', '恢复实例授权；到期日保持不变'), ...s.providerLicenseActions],
      })
    },
  }
}
