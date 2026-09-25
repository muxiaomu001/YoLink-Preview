import { messageShadow } from '@/domain/messageRules'
/**
 * 群管理（工作台群信息卡与管理后台群管理页共用）：
 * 建群、群设置、公告、置顶、成员增删、管理员任免、禁言与移出并禁止再进、群邀请链接、批量拉人。
 * 所有动作记管理员日志（groupLogs，48 小时）与审计。
 */
import { groupWelcomeMessages } from '@/domain/groupWelcome'
import type { ChatGroup, ChatGroupKind, Conversation, GroupAdminPerm, GroupInviteLink, GroupLog, GroupMemberKind, GroupSettings, Message } from '@/domain/types'
import { newId } from '@/domain/ids'
import { groupDefaults } from '@/domain/seed-groups'
import { groupCapacity } from '../policy'
import { type Get, type Set, now, withAudit } from './helpers'

/** 谁在操作：坐席身份 + 实操员工（审计记员工） */
export interface Actor {
  seatId: string
  staffId: string
}

export interface GroupActions {
  createChatGroup: (input: { name: string; desc: string; kind: ChatGroupKind; ownerSeatId: string; requiredTitleId?: string | null; maxMembers?: number | null }, by: Actor) => ChatGroup
  updateGroupSettings: (groupId: string, patch: Partial<GroupSettings>, by: Actor) => void
  setGroupAnnouncement: (groupId: string, input: { title: string; content: string; notify: boolean } | null, by: Actor) => void
  pinMessage: (groupId: string, messageId: string, notify: boolean, by: Actor) => void
  unpinMessage: (groupId: string, messageId: string, by: Actor) => void
  /** 拉客户入群：返回实际拉入数（已在群、已满、需要头衔的跳过） */
  addGroupMembers: (groupId: string, customerIds: string[], by: Actor) => { added: number; skipped: string[] }
  kickGroupMember: (groupId: string, customerId: string, deleteMessages: boolean, by: Actor) => void
  addGroupSeat: (groupId: string, seatId: string, by: Actor) => void
  promoteGroupAdmin: (groupId: string, memberKind: GroupMemberKind, memberId: string, perms: GroupAdminPerm[], by: Actor) => void
  demoteGroupAdmin: (groupId: string, memberKind: GroupMemberKind, memberId: string, by: Actor) => void
  /** 禁言或移出并禁止再进；hours 为 null 表示永久 */
  restrictGroupMember: (groupId: string, customerId: string, kind: 'mute' | 'ban', hours: number | null, reason: string, by: Actor) => void
  liftGroupRestriction: (groupId: string, customerId: string, by: Actor) => void
  createGroupInviteLink: (groupId: string, input: { name: string; expiresAt: string | null; maxUses: number | null }, by: Actor) => GroupInviteLink
  revokeGroupInviteLink: (groupId: string, linkId: string, by: Actor) => void
  /** 主链接撤销后重新生成 */
  regenerateGroupMainLink: (groupId: string, by: Actor) => void
  /** 客户在手机上主动退群或退频道 */
  customerLeaveGroup: (groupId: string, customerId: string) => void
}

function log(groupId: string, by: Actor, action: string, detail: string): GroupLog {
  return { id: newId('glog'), groupId, at: now(), actorKind: 'seat', actorId: by.seatId, action, detail }
}

const PERM_LABEL: Record<GroupAdminPerm, string> = {
  can_manage_chat: '管理员日志',
  can_delete_messages: '删他人消息',
  can_restrict_members: '禁言与移出并禁止再进',
  can_promote_members: '任免管理员',
  can_change_info: '改群信息',
  can_invite_users: '邀请用户',
  can_pin_messages: '置顶',
  can_post_messages: '频道发布',
}

function groupCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 4; i += 1) out += chars[Math.floor(Math.random() * chars.length)]
  return `GP-${out}`
}

export function groupActions(set: Set, get: Get): GroupActions {
  const patchGroup = (groupId: string, fn: (g: ChatGroup) => ChatGroup) => (list: ChatGroup[]) => list.map((g) => (g.id === groupId ? fn(g) : g))

  return {
    createChatGroup: (input, by) => {
      const s = get()
      const at = now()
      const g: ChatGroup = {
        ...groupDefaults(),
        id: newId('cg'),
        name: input.name,
        desc: input.desc,
        kind: input.kind,
        official: false,
        ownerSeatId: input.ownerSeatId,
        memberSeatIds: [input.ownerSeatId],
        memberCustomerIds: [],
        requiredTitleId: input.requiredTitleId ?? null,
        maxMembers: input.maxMembers ?? null,
        createdAt: at,
      }
      g.inviteLinks = [{ id: newId('glink'), name: '主链接', code: groupCode(), main: true, expiresAt: null, maxUses: null, uses: 0, status: 'active', bySeatId: by.seatId, createdAt: at }]
      const conv: Conversation = { id: newId('conv'), kind: input.kind === 'channel' ? 'channel' : 'group', chatGroupId: g.id, lastMessageAt: at }
      const owner = s.seats.find((x) => x.id === input.ownerSeatId)
      set({
        chatGroups: [...s.chatGroups, g],
        conversations: [...s.conversations, conv],
        groupLogs: [log(g.id, by, 'create', `创建${input.kind === 'channel' ? '频道' : '群'}「${input.name}」`), ...s.groupLogs],
        audit: withAudit(s.audit, 'group.create', `以「${owner?.displayName}」身份创建${input.kind === 'channel' ? '频道' : '群'}「${input.name}」`, by.staffId),
      })
      return g
    },

    updateGroupSettings: (groupId, patch, by) =>
      set((s) => {
        const g = s.chatGroups.find((x) => x.id === groupId)
        if (!g) return {}
        const parts: string[] = []
        if (patch.allMuted !== undefined && patch.allMuted !== g.settings.allMuted) parts.push(patch.allMuted ? '开启全员禁言' : '关闭全员禁言')
        if (patch.membersVisible !== undefined && patch.membersVisible !== g.settings.membersVisible) parts.push(patch.membersVisible ? '客户可见成员列表' : '客户不可见成员列表')
        if (patch.slowModeSeconds !== undefined && patch.slowModeSeconds !== g.settings.slowModeSeconds) parts.push(`慢速模式 ${patch.slowModeSeconds == null ? '跟随企业策略' : patch.slowModeSeconds === 0 ? '关闭' : `${patch.slowModeSeconds} 秒`}`)
        if (patch.historyVisible !== undefined && patch.historyVisible !== g.settings.historyVisible) parts.push(patch.historyVisible ? '新成员可见历史消息' : '新成员不可见历史消息')
        if (!parts.length) return {}
        return {
          chatGroups: patchGroup(groupId, (x) => ({ ...x, settings: { ...x.settings, ...patch } }))(s.chatGroups),
          groupLogs: [log(groupId, by, 'setting', parts.join('；')), ...s.groupLogs],
          audit: withAudit(s.audit, 'group.setting', `群「${g.name}」：${parts.join('；')}`, by.staffId),
        }
      }),

    setGroupAnnouncement: (groupId, input, by) =>
      set((s) => {
        const g = s.chatGroups.find((x) => x.id === groupId)
        if (!g) return {}
        const conv = s.conversations.find((c) => c.chatGroupId === groupId)
        const at = now()
        const sys: Message[] = input && input.notify && conv ? [{ id: newId('msg'), convId: conv.id, senderKind: 'system', senderId: '', kind: 'system', text: `群公告已更新：${input.title}`, at, mentionAll: true }] : []
        return {
          chatGroups: patchGroup(groupId, (x) => ({ ...x, announcement: input ? { title: input.title, content: input.content, bySeatId: by.seatId, at, notified: input.notify } : null }))(s.chatGroups),
          messages: sys.length ? [...s.messages, ...sys] : s.messages,
          conversations: sys.length ? s.conversations.map((c) => (c.id === conv!.id ? { ...c, lastMessageAt: at } : c)) : s.conversations,
          groupLogs: [log(groupId, by, 'announcement', input ? `发布公告「${input.title}」${input.notify ? '，已通知全体成员' : ''}` : '删除公告'), ...s.groupLogs],
          audit: withAudit(s.audit, 'group.announcement', `群「${g.name}」${input ? `发布公告「${input.title}」` : '删除公告'}`, by.staffId),
        }
      }),

    pinMessage: (groupId, messageId, notify, by) =>
      set((s) => {
        const g = s.chatGroups.find((x) => x.id === groupId)
        const m = s.messages.find((x) => x.id === messageId)
        if (!g || !m || g.pinnedMessageIds.includes(messageId)) return {}
        const at = now()
        const sys: Message[] = notify && !messageShadow(s, m).shadowedAt ? [{ id: newId('msg'), convId: m.convId, senderKind: 'system', senderId: '', kind: 'system', text: `置顶了一条消息：${m.text.slice(0, 30)}`, at, shadowSourceIds: [m.id] }] : []
        return {
          chatGroups: patchGroup(groupId, (x) => ({ ...x, pinnedMessageIds: [messageId, ...x.pinnedMessageIds] }))(s.chatGroups),
          messages: sys.length ? [...s.messages, ...sys] : s.messages,
          groupLogs: [log(groupId, by, 'pin', `置顶了「${m.text.slice(0, 30)}」`), ...s.groupLogs],
          audit: withAudit(s.audit, 'group.pin', `群「${g.name}」置顶消息「${m.text.slice(0, 30)}」`, by.staffId),
        }
      }),

    unpinMessage: (groupId, messageId, by) =>
      set((s) => {
        const g = s.chatGroups.find((x) => x.id === groupId)
        const m = s.messages.find((x) => x.id === messageId)
        if (!g) return {}
        return {
          chatGroups: patchGroup(groupId, (x) => ({ ...x, pinnedMessageIds: x.pinnedMessageIds.filter((id) => id !== messageId) }))(s.chatGroups),
          groupLogs: [log(groupId, by, 'pin', `取消置顶「${m?.text.slice(0, 30) ?? ''}」`), ...s.groupLogs],
          audit: withAudit(s.audit, 'group.pin', `群「${g.name}」取消置顶`, by.staffId),
        }
      }),

    addGroupMembers: (groupId, customerIds, by) => {
      const s = get()
      const g = s.chatGroups.find((x) => x.id === groupId)
      if (!g) return { added: 0, skipped: customerIds }
      const cap = groupCapacity(s, g)
      const skipped: string[] = []
      const toAdd: string[] = []
      customerIds.forEach((cid) => {
        const c = s.customers.find((x) => x.id === cid)
        const banned = g.restrictions.some((r) => r.customerId === cid && r.kind === 'ban' && (r.until === null || r.until > now()))
        const needTitle = g.requiredTitleId && !c?.titleIds.includes(g.requiredTitleId)
        if (!c || c.deletedAt || g.memberCustomerIds.includes(cid) || banned || needTitle || g.memberCustomerIds.length + toAdd.length >= cap) skipped.push(cid)
        else toAdd.push(cid)
      })
      if (!toAdd.length) return { added: 0, skipped }
      const conv = s.conversations.find((c) => c.chatGroupId === groupId)
      const at = now()
      const names = toAdd.map((cid) => s.customers.find((x) => x.id === cid)?.nickname).filter(Boolean)
      const sys: Message[] = conv ? [{ id: newId('msg'), convId: conv.id, senderKind: 'system', senderId: '', kind: 'system', text: `${names.slice(0, 3).join('、')}${names.length > 3 ? ` 等 ${names.length} 人` : ''} 加入了群聊`, at }] : []
      set({
        chatGroups: patchGroup(groupId, (x) => ({ ...x, memberCustomerIds: [...x.memberCustomerIds, ...toAdd] }))(s.chatGroups),
        messages: [...s.messages, ...sys, ...(conv?groupWelcomeMessages(g,conv.id,s.customers.filter((c)=>toAdd.includes(c.id)),at):[])],
        groupLogs: [log(groupId, by, 'member', `拉入 ${toAdd.length} 位客户${skipped.length ? `，跳过 ${skipped.length} 位（已在群、已满、被禁止再进或不满足头衔条件）` : ''}`), ...s.groupLogs],
        audit: withAudit(s.audit, 'group.member', `往群「${g.name}」拉入 ${toAdd.length} 位客户`, by.staffId),
      })
      return { added: toAdd.length, skipped }
    },

    kickGroupMember: (groupId, customerId, deleteMessages, by) =>
      set((s) => {
        const g = s.chatGroups.find((x) => x.id === groupId)
        const c = s.customers.find((x) => x.id === customerId)
        if (!g || !c) return {}
        const conv = s.conversations.find((x) => x.chatGroupId === groupId)
        const at = now()
        return {
          chatGroups: patchGroup(groupId, (x) => ({ ...x, memberCustomerIds: x.memberCustomerIds.filter((id) => id !== customerId), admins: x.admins.filter((a) => !(a.memberKind === 'customer' && a.memberId === customerId)) }))(s.chatGroups),
          messages: deleteMessages && conv ? s.messages.map((m) => (m.convId === conv.id && m.senderKind === 'customer' && m.senderId === customerId && !m.deletedAt ? { ...m, deletedAt: at } : m)) : s.messages,
          groupLogs: [log(groupId, by, 'member', `移出客户「${c.nickname}」${deleteMessages ? '，并删除其全部消息' : ''}`), ...s.groupLogs],
          audit: withAudit(s.audit, 'group.member', `把「${c.nickname}」移出群「${g.name}」${deleteMessages ? '，删除其全部消息' : ''}`, by.staffId),
        }
      }),

    addGroupSeat: (groupId, seatId, by) =>
      set((s) => {
        const g = s.chatGroups.find((x) => x.id === groupId)
        const seat = s.seats.find((x) => x.id === seatId)
        if (!g || !seat || g.memberSeatIds.includes(seatId)) return {}
        return {
          chatGroups: patchGroup(groupId, (x) => ({ ...x, memberSeatIds: [...x.memberSeatIds, seatId] }))(s.chatGroups),
          groupLogs: [log(groupId, by, 'member', `加入坐席「${seat.displayName}」`), ...s.groupLogs],
          audit: withAudit(s.audit, 'group.member', `坐席「${seat.displayName}」加入群「${g.name}」`, by.staffId),
        }
      }),

    promoteGroupAdmin: (groupId, memberKind, memberId, perms, by) =>
      set((s) => {
        const g = s.chatGroups.find((x) => x.id === groupId)
        if (!g || (memberKind === 'seat' && g.ownerSeatId === memberId)) return {}
        if (g.admins.length >= 50 && !g.admins.some((a) => a.memberKind === memberKind && a.memberId === memberId)) return {}
        const name = memberKind === 'seat' ? s.seats.find((x) => x.id === memberId)?.displayName : s.customers.find((x) => x.id === memberId)?.nickname
        const existed = g.admins.some((a) => a.memberKind === memberKind && a.memberId === memberId)
        const entry = { memberKind, memberId, perms, promotedBySeatId: by.seatId, promotedAt: now() }
        const detail = `${existed ? '修改管理员' : '设为管理员'}「${name}」：${perms.map((p) => PERM_LABEL[p]).join('、') || '无权限项'}`
        return {
          chatGroups: patchGroup(groupId, (x) => ({ ...x, admins: existed ? x.admins.map((a) => (a.memberKind === memberKind && a.memberId === memberId ? { ...a, perms } : a)) : [...x.admins, entry] }))(s.chatGroups),
          groupLogs: [log(groupId, by, 'admin', detail), ...s.groupLogs],
          audit: withAudit(s.audit, 'group.admin', `群「${g.name}」${detail}`, by.staffId),
        }
      }),

    demoteGroupAdmin: (groupId, memberKind, memberId, by) =>
      set((s) => {
        const g = s.chatGroups.find((x) => x.id === groupId)
        if (!g) return {}
        const name = memberKind === 'seat' ? s.seats.find((x) => x.id === memberId)?.displayName : s.customers.find((x) => x.id === memberId)?.nickname
        return {
          chatGroups: patchGroup(groupId, (x) => ({ ...x, admins: x.admins.filter((a) => !(a.memberKind === memberKind && a.memberId === memberId)) }))(s.chatGroups),
          groupLogs: [log(groupId, by, 'admin', `撤销管理员「${name}」`), ...s.groupLogs],
          audit: withAudit(s.audit, 'group.admin', `群「${g.name}」撤销管理员「${name}」`, by.staffId),
        }
      }),

    restrictGroupMember: (groupId, customerId, kind, hours, reason, by) =>
      set((s) => {
        const g = s.chatGroups.find((x) => x.id === groupId)
        const c = s.customers.find((x) => x.id === customerId)
        if (!g || !c) return {}
        const at = now()
        const until = hours == null ? null : new Date(Date.now() + hours * 3600000).toISOString()
        const detail = `${kind === 'ban' ? '移出并禁止再进' : '禁言'}客户「${c.nickname}」${hours == null ? '（永久）' : `${hours} 小时`}${reason ? `：${reason}` : ''}`
        return {
          chatGroups: patchGroup(groupId, (x) => ({
            ...x,
            restrictions: [{ customerId, kind, until, bySeatId: by.seatId, at, reason }, ...x.restrictions.filter((r) => r.customerId !== customerId)],
            // 移出并禁止再进
            memberCustomerIds: kind === 'ban' ? x.memberCustomerIds.filter((id) => id !== customerId) : x.memberCustomerIds,
          }))(s.chatGroups),
          groupLogs: [log(groupId, by, 'restrict', detail), ...s.groupLogs],
          audit: withAudit(s.audit, 'group.restrict', `群「${g.name}」${detail}`, by.staffId),
        }
      }),

    liftGroupRestriction: (groupId, customerId, by) =>
      set((s) => {
        const g = s.chatGroups.find((x) => x.id === groupId)
        const c = s.customers.find((x) => x.id === customerId)
        if (!g || !c) return {}
        const r = g.restrictions.find((x) => x.customerId === customerId)
        return {
          chatGroups: patchGroup(groupId, (x) => ({ ...x, restrictions: x.restrictions.filter((y) => y.customerId !== customerId) }))(s.chatGroups),
          groupLogs: [log(groupId, by, 'restrict', `${r?.kind === 'ban' ? '解除禁止' : '解除禁言'}：客户「${c.nickname}」${r?.kind === 'ban' ? '（不会自动回群，可通过链接加入）' : ''}`), ...s.groupLogs],
          audit: withAudit(s.audit, 'group.restrict', `群「${g.name}」${r?.kind === 'ban' ? '解除禁止' : '解除禁言'}：客户「${c.nickname}」`, by.staffId),
        }
      }),

    createGroupInviteLink: (groupId, input, by) => {
      const s = get()
      const g = s.chatGroups.find((x) => x.id === groupId)
      const link: GroupInviteLink = { id: newId('glink'), name: input.name, code: groupCode(), main: false, expiresAt: input.expiresAt, maxUses: input.maxUses, uses: 0, status: 'active', bySeatId: by.seatId, createdAt: now() }
      if (!g) return link
      set({
        chatGroups: patchGroup(groupId, (x) => ({ ...x, inviteLinks: [...x.inviteLinks, link] }))(s.chatGroups),
        groupLogs: [log(groupId, by, 'invite_link', `生成附加链接「${input.name}」`), ...s.groupLogs],
        audit: withAudit(s.audit, 'group.invite_link', `群「${g.name}」生成附加链接「${input.name}」`, by.staffId),
      })
      return link
    },

    revokeGroupInviteLink: (groupId, linkId, by) =>
      set((s) => {
        const g = s.chatGroups.find((x) => x.id === groupId)
        const l = g?.inviteLinks.find((x) => x.id === linkId)
        if (!g || !l) return {}
        return {
          chatGroups: patchGroup(groupId, (x) => ({ ...x, inviteLinks: x.inviteLinks.map((y) => (y.id === linkId ? { ...y, status: 'revoked' as const } : y)) }))(s.chatGroups),
          groupLogs: [log(groupId, by, 'invite_link', `撤销链接「${l.name}」`), ...s.groupLogs],
          audit: withAudit(s.audit, 'group.invite_link', `群「${g.name}」撤销链接「${l.name}」`, by.staffId),
        }
      }),

    regenerateGroupMainLink: (groupId, by) =>
      set((s) => {
        const g = s.chatGroups.find((x) => x.id === groupId)
        if (!g) return {}
        const fresh: GroupInviteLink = { id: newId('glink'), name: '主链接', code: groupCode(), main: true, expiresAt: null, maxUses: null, uses: 0, status: 'active', bySeatId: by.seatId, createdAt: now() }
        return {
          chatGroups: patchGroup(groupId, (x) => ({ ...x, inviteLinks: [fresh, ...x.inviteLinks.map((y) => (y.main ? { ...y, status: 'revoked' as const, main: false } : y))] }))(s.chatGroups),
          groupLogs: [log(groupId, by, 'invite_link', '撤销并重新生成主链接'), ...s.groupLogs],
          audit: withAudit(s.audit, 'group.invite_link', `群「${g.name}」重新生成主链接`, by.staffId),
        }
      }),

    customerLeaveGroup: (groupId, customerId) =>
      set((s) => {
        const g = s.chatGroups.find((x) => x.id === groupId)
        const c = s.customers.find((x) => x.id === customerId)
        if (!g || !c || g.official) return {}
        const conv = s.conversations.find((x) => x.chatGroupId === groupId)
        const at = now()
        return {
          chatGroups: patchGroup(groupId, (x) => ({ ...x, memberCustomerIds: x.memberCustomerIds.filter((id) => id !== customerId) }))(s.chatGroups),
          messages: conv ? [...s.messages, { id: newId('msg'), convId: conv.id, senderKind: 'system', senderId: '', kind: 'system', text: `${c.nickname} 退出了${g.kind === 'channel' ? '频道' : '群聊'}`, at }] : s.messages,
          groupLogs: [{ id: newId('glog'), groupId, at, actorKind: 'customer', actorId: customerId, action: 'member', detail: `客户「${c.nickname}」主动退出` }, ...s.groupLogs],
        }
      }),
  }
}
