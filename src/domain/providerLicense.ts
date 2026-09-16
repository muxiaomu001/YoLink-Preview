import type { ProviderInstance } from './types'

export type ProviderInstanceStatus = 'active' | 'expired' | 'stopped'

export const PROVIDER_STATUS_LABEL: Record<ProviderInstanceStatus, string> = {
  active: '授权中',
  expired: '已到期 · 仍在用',
  stopped: '人工停用',
}

export function providerInstanceStatus(instance: ProviderInstance, at = new Date().toISOString()): ProviderInstanceStatus {
  if (instance.stoppedAt) return 'stopped'
  if (instance.expiresAt < at) return 'expired'
  return 'active'
}
