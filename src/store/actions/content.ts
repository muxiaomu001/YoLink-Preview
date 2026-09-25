/**
 * 内容与审计（删消息、举报、敏感词、导出）、群与频道、内部标签库、客户管理（批量挂头衔、改主归属、注销）。
 */
import type { ChatGroup, Report, SensitiveWord, Tag } from '@/domain/types'
import { SENSITIVE_ACTION_LABEL, SENSITIVE_SCOPE_LABEL, scopeOf } from '@/domain/sensitive'
import { newId } from '@/domain/ids'
import { type Get, type Set, now, withAudit } from './helpers'

export interface ContentActions {
  deleteMessage: (id: string, byStaffId: string) => void
  handleReport: (id: string, resolution: NonNullable<Report['resolution']>, byStaffId: string) => void
  createSensitiveWord: (input: Omit<SensitiveWord, 'id'>, byStaffId: string) => void
  updateSensitiveWord: (id: string, patch: Partial<Omit<SensitiveWord, 'id'>>, byStaffId: string) => void
  deleteSensitiveWord: (id: string, byStaffId: string) => void
  /** 导出只记审计，演示里由页面自己生成 CSV 下载 */
  recordExport: (what: string, byStaffId: string) => void
  setGroupOfficial: (id: string, official: boolean, byStaffId: string) => void
  updateChatGroup: (id: string, patch: Partial<Pick<ChatGroup, 'name' | 'desc' | 'requiredTitleId' | 'maxMembers' | 'kind' | 'welcomeText'>>, byStaffId: string) => void
  removeGroupMember: (groupId: string, customerId: string, byStaffId: string) => void
  updateTag: (id: string, patch: Partial<Pick<Tag, 'name' | 'color'>>, byStaffId: string) => void
  /** 把 from 合并到 to：客户身上换成 to，from 删除 */
  mergeTag: (fromId: string, toId: string, byStaffId: string) => number
  deleteTag: (id: string, byStaffId?: string) => void
  bulkAssignTitle: (customerIds: string[], titleId: string, byStaffId: string) => number
  /** 纠错手段：客户会看到主联系人变了 */
  reassignPrimarySeat: (customerId: string, seatId: string, byStaffId: string) => void
  deleteCustomer: (customerId: string, byStaffId: string) => void
}

export function contentActions(set: Set, get: Get): ContentActions {
  return {
    deleteMessage: (id, byStaffId) =>
      set((s) => {
        const m = s.messages.find((x) => x.id === id)
        return {
          messages: s.messages.map((x) => (x.id === id ? { ...x, deletedAt: now() } : x)),
          audit: withAudit(s.audit, 'message.delete', `删除消息「${m?.text.slice(0, 30) ?? id}」，客户侧不可见，审计仍可查`, byStaffId),
        }
      }),

    handleReport: (id, resolution, byStaffId) =>
      set((s) => {
        const r = s.reports.find((x) => x.id === id)
        if (!r) return {}
        const target = s.customers.find((c) => c.id === r.targetCustomerId)
        const label = resolution === 'banned' ? '封禁被举报人' : resolution === 'deleted' ? '删除消息' : '忽略'
        const messages = resolution === 'deleted' && r.messageId ? s.messages.map((m) => (m.id === r.messageId ? { ...m, deletedAt: now() } : m)) : s.messages
        return {
          reports: s.reports.map((x) => (x.id === id ? { ...x, status: 'handled', resolution, handledBy: byStaffId, handledAt: now() } : x)),
          messages,
          customers: resolution === 'banned' ? s.customers.map((c) => (c.id === r.targetCustomerId ? { ...c, bannedAt: now(), sessionsRevokedAt: now() } : c)) : s.customers,
          audit: withAudit(s.audit, 'report.handle', `处理举报（${target?.nickname}）：${label}`, byStaffId),
        }
      }),

    createSensitiveWord: (input, byStaffId) =>
      set((s) => ({
        sensitiveWords: [...s.sensitiveWords, { ...input, id: newId('sw') }],
        audit: withAudit(s.audit, 'sensitive.update', `在${SENSITIVE_SCOPE_LABEL[scopeOf(input as SensitiveWord)]}添加敏感词「${input.word}」，命中动作：${SENSITIVE_ACTION_LABEL[input.action]}`, byStaffId),
      })),

    updateSensitiveWord: (id, patch, byStaffId) =>
      set((s) => {
        const w = s.sensitiveWords.find((x) => x.id === id)
        return {
          sensitiveWords: s.sensitiveWords.map((x) => (x.id === id ? { ...x, ...patch } : x)),
          audit: withAudit(s.audit, 'sensitive.update', `修改${w ? SENSITIVE_SCOPE_LABEL[scopeOf(w)] : '词库'}里的敏感词「${w?.word}」`, byStaffId),
        }
      }),

    deleteSensitiveWord: (id, byStaffId) =>
      set((s) => {
        const w = s.sensitiveWords.find((x) => x.id === id)
        return { sensitiveWords: s.sensitiveWords.filter((x) => x.id !== id), audit: withAudit(s.audit, 'sensitive.update', `删除${w ? SENSITIVE_SCOPE_LABEL[scopeOf(w)] : '词库'}里的敏感词「${w?.word}」`, byStaffId) }
      }),

    recordExport: (what, byStaffId) => set((s) => ({ audit: withAudit(s.audit, 'export', `导出：${what}`, byStaffId) })),

    setGroupOfficial: (id, official, byStaffId) =>
      set((s) => {
        const g = s.chatGroups.find((x) => x.id === id)
        return {
          chatGroups: s.chatGroups.map((x) => (x.id === id ? { ...x, official } : x)),
          audit: withAudit(s.audit, 'group.official', `${official ? '标记' : '取消标记'}官方群「${g?.name}」${official ? '，客户不可退出' : ''}`, byStaffId),
        }
      }),

    updateChatGroup: (id, patch, byStaffId) =>
      set((s) => {
        const g = s.chatGroups.find((x) => x.id === id)
        return {
          chatGroups: s.chatGroups.map((x) => (x.id === id ? { ...x, ...patch } : x)),
          audit: withAudit(s.audit, 'group.update', `修改群「${g?.name}」：${Object.keys(patch).join('、')}`, byStaffId),
        }
      }),

    removeGroupMember: (groupId, customerId, byStaffId) =>
      set((s) => {
        const g = s.chatGroups.find((x) => x.id === groupId)
        const c = s.customers.find((x) => x.id === customerId)
        return {
          chatGroups: s.chatGroups.map((x) => (x.id === groupId ? { ...x, memberCustomerIds: x.memberCustomerIds.filter((m) => m !== customerId) } : x)),
          audit: withAudit(s.audit, 'group.update', `把「${c?.nickname}」移出群「${g?.name}」`, byStaffId),
        }
      }),

    updateTag: (id, patch, byStaffId) =>
      set((s) => {
        const t = s.tags.find((x) => x.id === id)
        return { tags: s.tags.map((x) => (x.id === id ? { ...x, ...patch } : x)), audit: withAudit(s.audit, 'tag.library', `修改内部标签「${t?.name}」`, byStaffId) }
      }),

    mergeTag: (fromId, toId, byStaffId) => {
      const s = get()
      const from = s.tags.find((x) => x.id === fromId)
      const to = s.tags.find((x) => x.id === toId)
      if (!from || !to || fromId === toId) return 0
      const affected = s.customers.filter((c) => c.tagIds.includes(fromId)).length
      set({
        tags: s.tags.filter((x) => x.id !== fromId),
        customers: s.customers.map((c) => (c.tagIds.includes(fromId) ? { ...c, tagIds: Array.from(new Set(c.tagIds.map((t) => (t === fromId ? toId : t)))) } : c)),
        audit: withAudit(s.audit, 'tag.library', `内部标签「${from.name}」合并到「${to.name}」，${affected} 位客户`, byStaffId),
      })
      return affected
    },

    deleteTag: (id, byStaffId) =>
      set((s) => {
        const t = s.tags.find((x) => x.id === id)
        return {
          tags: s.tags.filter((x) => x.id !== id),
          customers: s.customers.map((c) => ({ ...c, tagIds: c.tagIds.filter((x) => x !== id) })),
          audit: withAudit(s.audit, 'tag.library', `删除内部标签「${t?.name}」，并从所有客户身上摘掉`, byStaffId ?? s.session.adminStaffId),
        }
      }),

    bulkAssignTitle: (customerIds, titleId, byStaffId) => {
      const s = get()
      const t = s.titles.find((x) => x.id === titleId)
      if (!t) return 0
      const targets = s.customers.filter((c) => customerIds.includes(c.id) && !c.titleIds.includes(titleId) && c.titleIds.length < 5)
      if (!targets.length) return 0
      const at = now()
      set({
        customers: s.customers.map((c) => (targets.some((x) => x.id === c.id) ? { ...c, titleIds: [...c.titleIds, titleId], primaryTitleId: c.primaryTitleId ?? titleId } : c)),
        titleAssignments: [...s.titleAssignments, ...targets.map((c) => ({ id: newId('ta'), customerId: c.id, titleId, action: 'assign' as const, byStaffId, at }))],
        audit: withAudit(s.audit, 'title.assign', `批量给 ${targets.length} 位客户挂头衔「${t.name}」`, byStaffId),
      })
      return targets.length
    },

    reassignPrimarySeat: (customerId, seatId, byStaffId) =>
      set((s) => {
        const c = s.customers.find((x) => x.id === customerId)
        const seat = s.seats.find((x) => x.id === seatId)
        if (!c || !seat) return {}
        const has = s.customerSeats.some((cs) => cs.customerId === customerId && cs.seatId === seatId)
        const old = s.customerSeats.find((cs) => cs.customerId === customerId && cs.primary)
        const customerSeats = s.customerSeats.map((cs) => (cs.customerId === customerId ? { ...cs, primary: cs.seatId === seatId } : cs))
        if (!has) customerSeats.push({ customerId, seatId, primary: true, addedAt: now(), source: 'reassign' })
        const conversations = has ? s.conversations : [...s.conversations, { id: newId('conv'), kind: 'dm' as const, customerId, seatId, lastMessageAt: now() }]
        return {
          customerSeats,
          conversations,
          audit: withAudit(s.audit, 'customer.reassign', `客户「${c.nickname}」主归属 ${s.seats.find((x) => x.id === old?.seatId)?.displayName ?? '无'} → ${seat.displayName}（客户会看到主联系人变了）`, byStaffId),
        }
      }),

    deleteCustomer: (customerId, byStaffId) =>
      set((s) => {
        const c = s.customers.find((x) => x.id === customerId)
        const detail = byStaffId === 'customer_self'
          ? `客户「${c?.nickname}」（${c?.accountId}）客户自助注销，数据保留、不再出现在工作台`
          : `注销客户「${c?.nickname}」（${c?.accountId}），数据保留、不再出现在工作台`
        return {
          customers: s.customers.map((x) => (x.id === customerId ? { ...x, deletedAt: now() } : x)),
          chatGroups: s.chatGroups.map((g) => {
            const customerJoinedAt = { ...(g.customerJoinedAt ?? {}) }
            delete customerJoinedAt[customerId]
            return { ...g, memberCustomerIds: g.memberCustomerIds.filter((m) => m !== customerId), customerJoinedAt }
          }),
          audit: withAudit(s.audit, 'customer.delete', detail, byStaffId),
        }
      }),
  }
}
