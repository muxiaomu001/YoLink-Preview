import { runSensitiveGate } from '../sensitiveGate'
/**
 * 工作台动作：消息操作（回复、转发、坐席删群消息）、会话操作（已读、置顶、静音）、
 * 客户操作（重置密码、拉黑、全群禁言）、个人设置、客户手机端的社交动作。话术库见 quickReplies.ts。
 */
import type { MessageMedia, StaffPrefs } from '@/domain/types'
import { messageLimitSeconds, messageVisibleFor, mentionsIn, seatConversationAllowed, seatMessageSendAllowed } from '@/domain/messageRules'
import { customerCan } from '../policy'
import { seatCan } from '../policy'
import { DEFAULT_STAFF_PREFS } from '@/domain/seed-groups'
import { type Get, type Set, now, randomPassword, withAudit } from './helpers'

export interface WorkbenchActions {
  /** 坐席发消息（带回复 / @ / 群发标记之外的扩展参数） */
  seatSendRich: (input: { convId: string; seatId: string; operatorId: string; text: string; replyToId?: string; mentionAll?: boolean; selectedMentions?: { mentionSeatIds: string[]; mentionCustomerIds: string[] }; kind?: 'text' | 'image' | 'file'; media?: MessageMedia; aiDraftUsed?: boolean }) => void
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
  /** 强制下线：撤销客户全部登录 session，账号不停用，可重新登录 */
  forceLogoutCustomer: (customerId: string, byStaffId: string) => void
  /** 客户级影子模式：开了之后他发的每条群消息只有他自己和坐席看得见 */
  setCustomerShadowMode: (customerId: string, on: boolean, reason: string, byStaffId: string) => void
  updateStaffPrefs: (staffId: string, patch: Partial<StaffPrefs>) => void
  // 客户手机端
  customerEditMessage: (messageId: string, text: string, customerId: string, expectedText: string) => string | null
  customerRecall: (messageId: string, customerId: string) => boolean
  customerSendIn: (convId: string, customerId: string, text: string, replyToId?: string) => { ok: boolean; reason?: string }
}

export function workbenchActions(set: Set, get: Get): WorkbenchActions {
  return {
    seatSendRich: (input) => {
      get().queueChatMessage({ ...input, actor: {kind:'seat',id:input.seatId,staffId:input.operatorId} })
    },
    editMessage: (messageId, text, byStaffId, expectedText) => {
      const s = get()
      const m = s.messages.find((x) => x.id === messageId)
      if (!m || m.senderKind !== 'seat' || !m.seatId || !seatConversationAllowed(s, m.convId, m.seatId, byStaffId) || !seatCan(s, m.seatId, 'dm.edit')) return '当前身份不能编辑这条消息'
      if (m.deletedAt) return '消息已删除，不能编辑'
      if (m.text !== expectedText) return '消息已被其他窗口修改，请重新打开编辑'
      if (messageLimitSeconds(s, 'seat', 'edit') > 0 && Date.now() - new Date(m.at).getTime() > messageLimitSeconds(s, 'seat', 'edit') * 1000) return '已超过后台设置的编辑时限'
      const body = text.trim()
      if ((!body && !m.media) || body.length > (m.media ? 1024 : 4096)) return '内容不能为空或超过长度上限'
      if (body === m.text) return null
      const mentions = mentionsIn(s, m.convId, body, { mentionSeatIds: m.mentionSeatIds ?? [], mentionCustomerIds: m.mentionCustomerIds ?? [] })
      if (mentions.mentionAll && !seatCan(s, m.seatId, 'group.mention_all')) return '当前策略不允许 @所有人'
      const at = now()
      const scan = runSensitiveGate(s, { text: body, scope: 'seat', senderId: m.seatId, operatorStaffId: byStaffId, convId: m.convId, at })
      if (scan.blocked) {
        set({ sensitiveHits: [...s.sensitiveHits, ...scan.hits] })
        return scan.blocked
      }
      set({ sensitiveHits: [...s.sensitiveHits, ...scan.hits], messages: s.messages.map((x) => x.id === m.id ? { ...x, text: scan.text, shadowedAt: x.shadowedAt ?? (scan.shadowByWord ? at : undefined), shadowReason: x.shadowReason ?? (scan.shadowByWord ? 'word' : undefined), editedAt: at, editHistory: [...(x.editHistory ?? []), { text: x.text, at, operatorId: byStaffId }], ...mentionsIn(s, m.convId, scan.text, { mentionSeatIds: m.mentionSeatIds ?? [], mentionCustomerIds: m.mentionCustomerIds ?? [] }) } : x), audit: withAudit(s.audit, 'message.edit', `编辑消息 ${m.id}，修改前的内容已保留`, byStaffId) })
      return null
    },

    seatDeleteMessage: (id,seatId,staffId) => {
      get().deleteChatMessages([id],{kind:'seat',id:seatId,staffId},true)
    },

    forwardMessage: (messageId, toConvId, seatId, operatorId) => {
      const s = get()
      const m = s.messages.find((x) => x.id === messageId)
      if (!m || !messageVisibleFor(s,m,{kind:'seat',id:seatId,staffId:operatorId}) || (m.delivery&&m.delivery!=='sent') || m.kind === 'system' || !seatConversationAllowed(s, m.convId, seatId, operatorId) || !seatMessageSendAllowed(s, toConvId, seatId, operatorId, !!m.media)) return false
      const source = s.conversations.find((c) => c.id === m.convId)!
      if (!seatCan(s, seatId, source.kind === 'dm' ? 'dm.forward' : 'group.forward', source.chatGroupId)) return false
      return get().queueChatMessage({ convId: toConvId, actor: { kind: 'seat', id: seatId, staffId: operatorId }, text: m.text, kind: m.kind, media: m.media, forwardedFrom: { convId: m.convId, messageId: m.id } }).ok
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

    forceLogoutCustomer: (customerId, byStaffId) =>
      set((s) => {
        const c = s.customers.find((x) => x.id === customerId)
        if (!c) return {}
        return {
          customers: s.customers.map((x) => (x.id === customerId ? { ...x, sessionsRevokedAt: now() } : x)),
          audit: withAudit(s.audit, 'customer.force_logout', `强制下线客户「${c.nickname}」：撤销全部登录 session，账号未停用可重新登录`, byStaffId),
        }
      }),

    setCustomerShadowMode: (customerId, on, reason, byStaffId) =>
      set((s) => {
        const c = s.customers.find((x) => x.id === customerId)
        if (!c) return {}
        return {
          customers: s.customers.map((x) => (x.id === customerId ? { ...x, shadowModeAt: on ? now() : undefined, shadowModeReason: on ? reason.trim() || undefined : undefined } : x)),
          // 已经发出去的不回溯：开影子模式之前那些话群里已经有人看过了，
          // 这时候把它们抹掉，等于告诉所有人"这个人被处理了"，比不处理更显眼
          audit: withAudit(s.audit, 'customer.shadow', on ? `开启客户「${c.nickname}」（${c.accountId}）的影子模式：此后他发的群消息只有他自己和坐席看得见，客户端无任何提示。原因：${reason.trim() || '未填写'}` : `关闭客户「${c.nickname}」（${c.accountId}）的影子模式，此后他的群消息恢复正常可见；影子期间发的那些消息仍然不对其他客户显示`, byStaffId),
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
      if (m.deletedAt) return '消息已删除，不能编辑'
      if (m.text !== expectedText) return '消息已被其他窗口修改，请重新打开编辑'
      const limit = messageLimitSeconds(s, 'customer', 'edit')
      if (limit > 0 && Date.now() - new Date(m.at).getTime() > limit * 1000) return '已超过后台设置的编辑时限'
      const body = text.trim()
      if ((!body && !m.media) || body.length > (m.media ? 1024 : 4096)) return '内容不能为空或超过长度上限'
      if (body === m.text) return null
      const mentions = mentionsIn(s, m.convId, body, { mentionSeatIds: m.mentionSeatIds ?? [], mentionCustomerIds: m.mentionCustomerIds ?? [] })
      if (mentions.mentionAll && !customerCan(s, customerId, 'group.mention_all', conv?.chatGroupId)) return '当前策略不允许 @所有人'
      const at = now()
      const scan = runSensitiveGate(s, { text: body, scope: 'customer', senderId: customerId, operatorStaffId: undefined, convId: m.convId, at })
      if (scan.blocked) {
        set({ sensitiveHits: [...s.sensitiveHits, ...scan.hits] })
        return scan.blocked
      }
      set({ sensitiveHits: [...s.sensitiveHits, ...scan.hits], messages: s.messages.map((x) => x.id === m.id ? { ...x, text: scan.text, shadowedAt: x.shadowedAt ?? (scan.shadowByWord ? at : undefined), shadowReason: x.shadowReason ?? (scan.shadowByWord ? 'word' : undefined), editedAt: at, editHistory: [...(x.editHistory ?? []), { text: x.text, at, operatorId: customerId }], ...mentionsIn(s, m.convId, scan.text, { mentionSeatIds: m.mentionSeatIds ?? [], mentionCustomerIds: m.mentionCustomerIds ?? [] }) } : x), audit: withAudit(s.audit, 'message.edit', `客户编辑消息 ${m.id}，修改前的内容已保留`, null) })
      return null
    },

    customerRecall: (id,customerId) => get().deleteChatMessages([id],{kind:'customer',id:customerId},true).ok,

    customerSendIn: (convId,customerId,text,replyToId) => get().queueChatMessage({convId,actor:{kind:'customer',id:customerId},text,replyToId}),
  }
}
