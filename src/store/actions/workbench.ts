/**
 * 工作台动作：消息操作（撤回、引用、转发、坐席删群消息）、会话操作（已读、置顶、静音）、
 * 客户操作（重置密码、拉黑、全群禁言）、个人设置、客户手机端的社交动作。话术库见 quickReplies.ts。
 */
import type { Message, MessageMedia, StaffPrefs } from '@/domain/types'
import { messageLimitSeconds, mentionsIn, seatConversationAllowed, seatMessageSendAllowed } from '@/domain/messageRules'
import { customerCan } from '../policy'
import { seatCan } from '../policy'
import { newId } from '@/domain/ids'
import { DEFAULT_STAFF_PREFS } from '@/domain/seed-groups'
import { type Get, type Set, now, randomPassword, withAudit } from './helpers'

export interface WorkbenchActions {
  /** 坐席发消息（带引用 / @ / 群发标记之外的扩展参数） */
  seatSendRich: (input: { convId: string; seatId: string; operatorId: string; text: string; replyToId?: string; mentionAll?: boolean; selectedMentions?: { mentionSeatIds: string[]; mentionCustomerIds: string[] }; kind?: 'text' | 'image' | 'file'; media?: MessageMedia; aiDraftUsed?: boolean }) => void
  /** 撤回自己的消息：时限内可用，返回是否成功 */
  recallMessage: (messageId: string, byStaffId: string) => boolean
  editMessage: (messageId: string, text: string, byStaffId: string, expectedText: string) => string | null
  /** 坐席（群主或有 can_delete_messages 的管理员）删除群里别人的消息 */
  seatDeleteMessage: (messageId: string, seatId: string, byStaffId: string) => void
  forwardMessage: (messageId: string, toConvId: string, seatId: string, operatorId: string) => boolean
  markRead: (convId: string, seatId: string, throughAt?: string) => void
  customerMarkRead: (convId: string, customerId: string, throughAt: string) => void
  markUnread: (convId: string, seatId: string) => void
  togglePinConversation: (convId: string, seatId: string) => void
  toggleMuteConversation: (convId: string, seatId: string) => void
  /** 客户忘记密码：主归属坐席的实操员工重置，返回一次性新密码 */
  resetCustomerPassword: (customerId: string, byStaffId: string) => string
  setCustomerBlacklist: (customerId: string, on: boolean, byStaffId: string) => void
  /** 所有群禁言；hours 为 null 表示永久，0 表示解除 */
  muteCustomerAll: (customerId: string, hours: number | null, byStaffId: string) => void
  updateStaffPrefs: (staffId: string, patch: Partial<StaffPrefs>) => void
  // 客户手机端
  customerEditMessage: (messageId: string, text: string, customerId: string, expectedText: string) => string | null
  customerRecall: (messageId: string, customerId: string) => boolean
  customerSendIn: (convId: string, customerId: string, text: string, replyToId?: string) => { ok: boolean; reason?: string }
}

export function workbenchActions(set: Set, get: Get): WorkbenchActions {
  return {
    seatSendRich: (input) => {
      const state = get()
      if (!seatMessageSendAllowed(state, input.convId, input.seatId, input.operatorId, !!input.media)) return
      const mentions = mentionsIn(state, input.convId, input.text, input.selectedMentions)
      if (mentions.mentionAll && !seatCan(state, input.seatId, 'group.mention_all')) return
      const group = state.chatGroups.find((g) => g.id === state.conversations.find((c) => c.id === input.convId)?.chatGroupId)
      const at = now()
      set((s) => ({
        messages: [...s.messages, { id: newId('msg'), convId: input.convId, senderKind: 'seat', senderId: input.seatId, seatId: input.seatId, operatorId: input.operatorId, kind: input.kind ?? 'text', text: input.text, media: input.media, at, replyToId: input.replyToId, ...mentions, receiptMemberSeatIds: group?.memberSeatIds, receiptMemberCustomerIds: group?.memberCustomerIds, aiDraftUsed: input.aiDraftUsed }],
        conversations: s.conversations.map((c) => (c.id === input.convId ? { ...c, lastMessageAt: at, readAtBySeat: { ...(c.readAtBySeat ?? {}), [input.seatId]: at }, unreadMarkBySeatIds: (c.unreadMarkBySeatIds ?? []).filter((id) => id !== input.seatId) } : c)),
      }))
    },

    recallMessage: (messageId, byStaffId) => {
      const s = get()
      const m = s.messages.find((x) => x.id === messageId)
      if (!m || m.senderKind !== 'seat' || !m.seatId || !seatConversationAllowed(s, m.convId, m.seatId, byStaffId) || !seatCan(s, m.seatId, 'dm.recall') || m.recalledAt || m.deletedAt) return false
      const limit = messageLimitSeconds(s, 'seat', 'recall')
      if (limit > 0 && Date.now() - new Date(m.at).getTime() > limit * 1000) return false
      set({
        messages: s.messages.map((x) => (x.id === messageId ? { ...x, recalledAt: now() } : x)),
        audit: withAudit(s.audit, 'message.recall', `撤回消息「${m.text.slice(0, 30)}」`, byStaffId),
      })
      return true
    },

    editMessage: (messageId, text, byStaffId, expectedText) => {
      const s = get()
      const m = s.messages.find((x) => x.id === messageId)
      if (!m || m.senderKind !== 'seat' || !m.seatId || !seatConversationAllowed(s, m.convId, m.seatId, byStaffId) || !seatCan(s, m.seatId, 'dm.edit')) return '当前身份不能编辑这条消息'
      if (m.recalledAt || m.deletedAt) return '消息已撤回或删除，不能编辑'
      if (m.text !== expectedText) return '消息已被其他窗口修改，请重新打开编辑'
      if (messageLimitSeconds(s, 'seat', 'edit') > 0 && Date.now() - new Date(m.at).getTime() > messageLimitSeconds(s, 'seat', 'edit') * 1000) return '已超过后台设置的编辑时限'
      const body = text.trim()
      if ((!body && !m.media) || body.length > (m.media ? 1024 : 4096)) return '内容不能为空或超过长度上限'
      if (body === m.text) return null
      const mentions = mentionsIn(s, m.convId, body)
      if (mentions.mentionAll && !seatCan(s, m.seatId, 'group.mention_all')) return '当前策略不允许 @所有人'
      const at = now()
      set({ messages: s.messages.map((x) => x.id === m.id ? { ...x, text: body, editedAt: at, editHistory: [...(x.editHistory ?? []), { text: x.text, at, operatorId: byStaffId }], ...mentionsIn(s, x.convId, body) } : x), audit: withAudit(s.audit, 'message.edit', `编辑消息 ${m.id}，修改前的内容已保留`, byStaffId) })
      return null
    },

    seatDeleteMessage: (messageId, seatId, byStaffId) =>
      set((s) => {
        const m = s.messages.find((x) => x.id === messageId)
        if (!m || m.deletedAt) return {}
        const conv = s.conversations.find((c) => c.id === m.convId)
        const g = s.chatGroups.find((x) => x.id === conv?.chatGroupId)
        const seat = s.seats.find((x) => x.id === seatId)
        return {
          messages: s.messages.map((x) => (x.id === messageId ? { ...x, deletedAt: now() } : x)),
          groupLogs: g ? [{ id: newId('glog'), groupId: g.id, at: now(), actorKind: 'seat' as const, actorId: seatId, action: 'delete_message', detail: `删除了一条消息：「${m.text.slice(0, 30)}」` }, ...s.groupLogs] : s.groupLogs,
          audit: withAudit(s.audit, 'message.delete', `以「${seat?.displayName}」身份删除${g ? `群「${g.name}」里` : ''}的消息「${m.text.slice(0, 30)}」`, byStaffId),
        }
      }),

    forwardMessage: (messageId, toConvId, seatId, operatorId) => {
      const s = get()
      const m = s.messages.find((x) => x.id === messageId)
      if (!m || m.recalledAt || m.deletedAt || m.kind === 'system' || !seatConversationAllowed(s, m.convId, seatId, operatorId) || !seatMessageSendAllowed(s, toConvId, seatId, operatorId, !!m.media)) return false
      const source = s.conversations.find((c) => c.id === m.convId)!
      if (!seatCan(s, seatId, source.kind === 'dm' ? 'dm.forward' : 'group.forward', source.chatGroupId)) return false
      const at = now()
      const group = s.chatGroups.find((g) => g.id === s.conversations.find((c) => c.id === toConvId)?.chatGroupId)
      const copy: Message = { id: newId('msg'), convId: toConvId, senderKind: 'seat', senderId: seatId, seatId, operatorId, kind: m.kind, text: m.text, media: m.media, at, receiptMemberSeatIds: group?.memberSeatIds, receiptMemberCustomerIds: group?.memberCustomerIds, forwardedFrom: { convId: m.convId, messageId: m.id } }
      set({ messages: [...s.messages, copy], conversations: s.conversations.map((c) => c.id === toConvId ? { ...c, lastMessageAt: at } : c) })
      return true
    },

    markRead: (convId, seatId, throughAt) => {
      const s = get()
      const c = s.conversations.find((x) => x.id === convId)
      const at = throughAt ?? s.messages.filter((m) => m.convId === convId).sort((a, b) => b.at.localeCompare(a.at))[0]?.at
      if (!c || !at || (c.readAtBySeat?.[seatId] ?? '') >= at && !c.unreadMarkBySeatIds?.includes(seatId)) return
      set({ conversations: s.conversations.map((x) => x.id === convId ? { ...x, readAtBySeat: { ...x.readAtBySeat, [seatId]: (x.readAtBySeat?.[seatId] ?? '') > at ? x.readAtBySeat![seatId] : at }, unreadMarkBySeatIds: (x.unreadMarkBySeatIds ?? []).filter((id) => id !== seatId) } : x) })
    },

    customerMarkRead: (convId, customerId, throughAt) => {
      const s = get()
      const c = s.conversations.find((x) => x.id === convId)
      const allowed = c?.kind === 'dm' ? c.customerId === customerId : s.chatGroups.some((g) => g.id === c?.chatGroupId && g.memberCustomerIds.includes(customerId))
      if (!c || !allowed || (c.readAtByCustomer?.[customerId] ?? '') >= throughAt) return
      set({ conversations: s.conversations.map((x) => x.id === convId ? { ...x, readAtByCustomer: { ...x.readAtByCustomer, [customerId]: throughAt } } : x) })
    },

    markUnread: (convId, seatId) =>
      set((s) => ({ conversations: s.conversations.map((c) => (c.id === convId ? { ...c, unreadMarkBySeatIds: Array.from(new Set([...(c.unreadMarkBySeatIds ?? []), seatId])) } : c)) })),

    togglePinConversation: (convId, seatId) =>
      set((s) => ({
        conversations: s.conversations.map((c) => {
          if (c.id !== convId) return c
          const list = c.pinnedBySeatIds ?? []
          return { ...c, pinnedBySeatIds: list.includes(seatId) ? list.filter((id) => id !== seatId) : [...list, seatId] }
        }),
      })),

    toggleMuteConversation: (convId, seatId) =>
      set((s) => ({
        conversations: s.conversations.map((c) => {
          if (c.id !== convId) return c
          const list = c.mutedBySeatIds ?? []
          return { ...c, mutedBySeatIds: list.includes(seatId) ? list.filter((id) => id !== seatId) : [...list, seatId] }
        }),
      })),

    resetCustomerPassword: (customerId, byStaffId) => {
      const s = get()
      const c = s.customers.find((x) => x.id === customerId)
      const pwd = randomPassword()
      if (!c) return pwd
      set({
        customers: s.customers.map((x) => (x.id === customerId ? { ...x, mustChangePassword: true } : x)),
        audit: withAudit(s.audit, 'customer.reset_password', `重置客户「${c.nickname}」的密码，一次性密码已告知，首次登录强制修改`, byStaffId),
      })
      return pwd
    },

    setCustomerBlacklist: (customerId, on, byStaffId) =>
      set((s) => {
        const c = s.customers.find((x) => x.id === customerId)
        if (!c) return {}
        return {
          customers: s.customers.map((x) => (x.id === customerId ? { ...x, blacklistedAt: on ? now() : null } : x)),
          audit: withAudit(s.audit, 'customer.block', `${on ? '拉黑' : '解除拉黑'}客户「${c.nickname}」${on ? '，客户无法发消息' : ''}`, byStaffId),
        }
      }),

    muteCustomerAll: (customerId, hours, byStaffId) =>
      set((s) => {
        const c = s.customers.find((x) => x.id === customerId)
        if (!c) return {}
        const until = hours === 0 ? null : hours == null ? '9999-12-31T00:00:00.000Z' : new Date(Date.now() + hours * 3600000).toISOString()
        return {
          customers: s.customers.map((x) => (x.id === customerId ? { ...x, mutedAllUntil: until } : x)),
          audit: withAudit(s.audit, 'customer.mute', hours === 0 ? `解除客户「${c.nickname}」的全群禁言` : `禁言客户「${c.nickname}」（所有群）${hours == null ? '永久' : `${hours} 小时`}`, byStaffId),
        }
      }),

    updateStaffPrefs: (staffId, patch) =>
      set((s) => ({
        staff: s.staff.map((st) => (st.id === staffId ? { ...st, prefs: { ...(st.prefs ?? DEFAULT_STAFF_PREFS), ...patch } } : st)),
        audit: withAudit(s.audit, 'staff.prefs', `修改个人设置：${Object.keys(patch).join('、')}`, staffId),
      })),

    customerEditMessage: (messageId, text, customerId, expectedText) => {
      const s = get()
      const m = s.messages.find((x) => x.id === messageId)
      const conv = s.conversations.find((c) => c.id === m?.convId)
      const member = conv?.kind === 'dm' ? conv.customerId === customerId : s.chatGroups.some((g) => g.id === conv?.chatGroupId && g.memberCustomerIds.includes(customerId))
      if (!m || m.senderKind !== 'customer' || m.senderId !== customerId || !member || !customerCan(s, customerId, 'dm.edit', conv?.chatGroupId)) return '当前身份不能编辑这条消息'
      if (m.recalledAt || m.deletedAt) return '消息已撤回或删除，不能编辑'
      if (m.text !== expectedText) return '消息已被其他窗口修改，请重新打开编辑'
      const limit = messageLimitSeconds(s, 'customer', 'edit')
      if (limit > 0 && Date.now() - new Date(m.at).getTime() > limit * 1000) return '已超过后台设置的编辑时限'
      const body = text.trim()
      if ((!body && !m.media) || body.length > (m.media ? 1024 : 4096)) return '内容不能为空或超过长度上限'
      if (body === m.text) return null
      const mentions = mentionsIn(s, m.convId, body)
      if (mentions.mentionAll && !customerCan(s, customerId, 'group.mention_all', conv?.chatGroupId)) return '当前策略不允许 @所有人'
      const at = now()
      set({ messages: s.messages.map((x) => x.id === m.id ? { ...x, text: body, editedAt: at, editHistory: [...(x.editHistory ?? []), { text: x.text, at, operatorId: customerId }], ...mentionsIn(s, x.convId, body) } : x), audit: withAudit(s.audit, 'message.edit', `客户编辑消息 ${m.id}，修改前的内容已保留`, null) })
      return null
    },

    customerRecall: (messageId, customerId) => {
      const s = get()
      const m = s.messages.find((x) => x.id === messageId)
      if (!m || m.senderKind !== 'customer' || m.senderId !== customerId || m.recalledAt || m.deletedAt || !customerCan(s, customerId, 'dm.recall')) return false
      const conv = s.conversations.find((c) => c.id === m.convId)
      const member = conv?.kind === 'dm' ? conv.customerId === customerId : s.chatGroups.some((g) => g.id === conv?.chatGroupId && g.memberCustomerIds.includes(customerId))
      if (!member) return false
      const limit = messageLimitSeconds(s, 'customer', 'recall')
      if (limit > 0 && Date.now() - new Date(m.at).getTime() > limit * 1000) return false
      set({ messages: s.messages.map((x) => (x.id === messageId ? { ...x, recalledAt: now() } : x)) })
      return true
    },

    customerSendIn: (convId, customerId, text, replyToId) => {
      const s = get()
      const conv = s.conversations.find((c) => c.id === convId)
      const c = s.customers.find((x) => x.id === customerId)
      if (!conv || !c) return { ok: false, reason: '会话不存在' }
      if (c.blacklistedAt) return { ok: false, reason: '你已被限制发送消息' }
      const at = now()
      if (conv.kind !== 'dm') {
        const g = s.chatGroups.find((x) => x.id === conv.chatGroupId)
        if (!g) return { ok: false, reason: '群不存在' }
        if (g.kind === 'channel') return { ok: false, reason: '频道只读' }
        if (c.mutedAllUntil && c.mutedAllUntil > at) return { ok: false, reason: '你已被禁言' }
        const isAdmin = g.admins.some((a) => a.memberKind === 'customer' && a.memberId === customerId)
        if (g.settings.allMuted && !isAdmin) return { ok: false, reason: '全员禁言中，仅管理员可发言' }
        const r = g.restrictions.find((x) => x.customerId === customerId && (x.until === null || x.until > at))
        if (r) return { ok: false, reason: r.kind === 'ban' ? '你已被移出该群' : '你已被禁言' }
      }
      const mentions = mentionsIn(s, convId, text)
      if (mentions.mentionAll && !customerCan(s, customerId, 'group.mention_all', conv.chatGroupId)) return { ok: false, reason: '当前策略不允许 @所有人' }
      const group = s.chatGroups.find((g) => g.id === conv.chatGroupId)
      set({
        messages: [...s.messages, { id: newId('msg'), convId, senderKind: 'customer', senderId: customerId, kind: 'text', text, at, ...mentions, receiptMemberSeatIds: group?.memberSeatIds, receiptMemberCustomerIds: group?.memberCustomerIds, replyToId }],
        conversations: s.conversations.map((x) => (x.id === convId ? { ...x, lastMessageAt: at } : x)),
        customers: s.customers.map((x) => (x.id === customerId ? { ...x, lastActiveAt: at } : x)),
      })
      return { ok: true }
    },
  }
}
