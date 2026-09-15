import type { Customer } from '@/domain/types'
import type { DemoStore } from '@/store/store'
import { downloadCsv, fileStamp } from '@/domain/csv'
import { daysSince, fmtAgo, fmtDate } from '@/domain/time'
import { primarySeatOfCustomer } from '@/store/selectors'

export interface CustomerFilter {
  q: string
  tagIds: string[]
  titleIds: string[]
  bought: 'any' | 'yes' | 'no'
  product: string
  boughtWithinDays: string
  roleLabel: string
  inviteMin: string
  inviteMax: string
  regFrom: string
  regTo: string
  activeFrom: string
  activeTo: string
}

export const EMPTY_FILTER: CustomerFilter = { q: '', tagIds: [], titleIds: [], bought: 'any', product: '', boughtWithinDays: '', roleLabel: '', inviteMin: '', inviteMax: '', regFrom: '', regTo: '', activeFrom: '', activeTo: '' }

export function isFilterActive(f: CustomerFilter): boolean {
  return JSON.stringify(f) !== JSON.stringify(EMPTY_FILTER)
}

export function advancedFilterCount(f: CustomerFilter): number {
  const flags = [f.tagIds.length > 0, f.titleIds.length > 0, f.bought !== 'any' || !!f.product || !!f.boughtWithinDays, !!f.roleLabel, !!f.inviteMin || !!f.inviteMax, !!f.regFrom || !!f.regTo, !!f.activeFrom || !!f.activeTo]
  return flags.filter(Boolean).length
}

export function applyFilter(list: Customer[], f: CustomerFilter): Customer[] {
  const q = f.q.trim().toLowerCase()
  const within = f.boughtWithinDays ? Number(f.boughtWithinDays) : null
  const min = f.inviteMin ? Number(f.inviteMin) : null
  const max = f.inviteMax ? Number(f.inviteMax) : null
  return list.filter((c) => {
    if (q && !c.nickname.toLowerCase().includes(q) && !c.accountId.toLowerCase().includes(q)) return false
    if (f.tagIds.length && !f.tagIds.some((t) => c.tagIds.includes(t))) return false
    if (f.titleIds.length && !f.titleIds.some((t) => c.titleIds.includes(t))) return false
    const matched = c.purchases.filter((p) => (!f.product || p.product === f.product) && (within == null || daysSince(p.at) <= within))
    if (f.bought === 'yes' && matched.length === 0) return false
    if (f.bought === 'no' && matched.length > 0) return false
    if (f.roleLabel && c.roleLabel !== f.roleLabel) return false
    if (min != null && c.inviteCount < min) return false
    if (max != null && c.inviteCount > max) return false
    const reg = fmtDate(c.registeredAt)
    if (f.regFrom && reg < f.regFrom) return false
    if (f.regTo && reg > f.regTo) return false
    const act = fmtDate(c.lastActiveAt)
    if (f.activeFrom && act < f.activeFrom) return false
    if (f.activeTo && act > f.activeTo) return false
    return true
  })
}

export type SortKey = 'nickname' | 'registeredAt' | 'lastActiveAt'
export interface SortState {
  key: SortKey
  dir: 'asc' | 'desc'
}

export function sortCustomers(list: Customer[], sort: SortState): Customer[] {
  const sign = sort.dir === 'asc' ? 1 : -1
  return [...list].sort((a, b) => (sort.key === 'nickname' ? a.nickname.localeCompare(b.nickname, 'zh') : a[sort.key].localeCompare(b[sort.key])) * sign)
}

export function exportCustomersCsv(s: DemoStore, rows: Customer[], staffId: string): void {
  const header = ['昵称', '账号 ID', '手机号', '邮箱', '标签', '注册时间', '最近活跃', '主归属坐席']
  const data = rows.map((c) => [
    c.nickname,
    c.accountId,
    c.phone ?? '',
    c.email ?? '',
    c.tagIds.map((id) => s.tags.find((t) => t.id === id)?.name ?? '').filter(Boolean).join('、'),
    fmtDate(c.registeredAt),
    fmtAgo(c.lastActiveAt),
    primarySeatOfCustomer(s, c.id)?.displayName ?? '',
  ])
  downloadCsv(`客户列表-${fileStamp()}.csv`, header, data)
  s.recordExport('客户列表', staffId)
}
