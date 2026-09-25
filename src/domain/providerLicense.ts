import type { DemoState, ProviderInstance } from './types'

export type ProviderInstanceStatus = 'active' | 'stopped'

export const PROVIDER_STATUS_LABEL: Record<ProviderInstanceStatus, string> = {
  active: '正常',
  stopped: '暂停服务',
}

export function providerInstanceStatus(instance: ProviderInstance): ProviderInstanceStatus {
  if (instance.stoppedAt) return 'stopped'
  return 'active'
}

export function staffServiceBlocker(state: Pick<DemoState, 'license' | 'providerInstances'>): string | null {
  return state.providerInstances.some((instance) => instance.instanceId === state.license.instanceId && !!instance.stoppedAt)
    ? '本企业服务已暂停，请联系管理员'
    : null
}
