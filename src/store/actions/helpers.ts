/** 动作模块共用：set/get 类型、时间、审计条目 */
import type { AuditEvent, AuditType } from '@/domain/types'
import { newId } from '@/domain/ids'
import { iso } from '@/domain/time'
import type { DemoStore } from '../store'

export type Set = (partial: Partial<DemoStore> | ((s: DemoStore) => Partial<DemoStore>)) => void
export type Get = () => DemoStore

export const now = () => iso(Date.now())

/** 演示里所有后台操作的来源 IP */
export const DEMO_IP = '10.0.8.21'

export function auditEntry(type: AuditType, detail: string, actorStaffId: string | null): AuditEvent {
  return { id: newId('au'), at: now(), actorStaffId, type, detail, ip: DEMO_IP }
}

/** 把一条审计放到列表最前面 */
export function withAudit(list: AuditEvent[], type: AuditType, detail: string, actorStaffId: string | null): AuditEvent[] {
  return [auditEntry(type, detail, actorStaffId), ...list]
}

/** 随机密码：演示用，10 位 */
export function randomPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
  let s = ''
  for (let i = 0; i < 10; i += 1) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

/** 随机 hex 串 */
export function randomHex(len: number): string {
  let s = ''
  for (let i = 0; i < len; i += 1) s += Math.floor(Math.random() * 16).toString(16)
  return s
}
