import type { ProviderInstance, ProviderLicenseAction } from '@/domain/types'
import { newId } from '@/domain/ids'
import { type Get, type Set, now } from './helpers'

export interface ProviderLicensingActions {
  bindProviderInstance: (input: {
    enterpriseName: string
    enterpriseCode: string
    deviceCode: string
    expiresOn: string
  }) => { ok: true; instance: ProviderInstance } | { ok: false; error: string }
  renewProviderInstance: (id: string, expiresOn: string) => void
  stopProviderInstance: (id: string, reason: string) => void
  resumeProviderInstance: (id: string) => void
}

const OPERATOR = '供应方管理员'

function expiryIso(date: string) {
  return new Date(`${date}T23:59:59`).toISOString()
}

function action(instanceId: string, kind: ProviderLicenseAction['action'], detail: string): ProviderLicenseAction {
  return { id: newId('pla'), instanceId, at: now(), operatorName: OPERATOR, action: kind, detail }
}

export function providerLicensingActions(set: Set, get: Get): ProviderLicensingActions {
  return {
    bindProviderInstance: (input) => {
      const s = get()
      const deviceCode = input.deviceCode.trim().toUpperCase()
      if (s.providerInstances.some((x) => x.deviceCode.toUpperCase() === deviceCode)) return { ok: false, error: '这个设备码已经绑定，请核对后在已有实例中操作' }
      const at = now()
      const instance: ProviderInstance = {
        id: newId('pi'),
        enterpriseName: input.enterpriseName.trim(),
        enterpriseCode: input.enterpriseCode.trim().toUpperCase(),
        deviceCode,
        instanceId: crypto.randomUUID(),
        version: 'v1.0.3',
        boundAt: at,
        expiresAt: expiryIso(input.expiresOn),
        stoppedAt: null,
        stopReason: null,
      }
      set({
        providerInstances: [instance, ...s.providerInstances],
        providerLicenseActions: [action(instance.instanceId, 'bind', `绑定设备码 ${deviceCode}，到期日 ${input.expiresOn}`), ...s.providerLicenseActions],
      })
      return { ok: true, instance }
    },

    renewProviderInstance: (id, expiresOn) => {
      const s = get()
      const instance = s.providerInstances.find((x) => x.id === id)
      if (!instance) return
      const expiresAt = expiryIso(expiresOn)
      const license = instance.instanceId === s.license.instanceId
        ? { ...s.license, expiresAt, modules: s.license.modules.map((module) => ({ ...module, expiresAt })) }
        : s.license
      set({
        providerInstances: s.providerInstances.map((x) => (x.id === id ? { ...x, expiresAt } : x)),
        providerLicenseActions: [action(instance.instanceId, 'renew', `到期日更新为 ${expiresOn}${instance.stoppedAt ? '；停用状态保持不变' : ''}`), ...s.providerLicenseActions],
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
