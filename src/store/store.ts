/**
 * 演示状态仓库：全部数据在浏览器里，持久化到 localStorage，
 * 多个窗口（管理后台 / 工作台 / 客户屏）通过 storage 事件同步。
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  AuditType,
  Broadcast,
  BroadcastTargetKind,
  Capability,
  Conversation,
  Customer,
  CustomerSeat,
  DemoState,
  InviteGroup,
  InviteLink,
  Message,
  MessageMedia,
  Seat,
  Staff,
  Tag,
  Title,
} from '@/domain/types'
import { groupWelcomeMessages } from '@/domain/groupWelcome'
import { buildSeed } from '@/domain/seed'
import { newId, newInviteCode } from '@/domain/ids'
import { iso } from '@/domain/time'
import { DEMO_IP } from './actions/helpers'
import { settingsActions, type SettingsActions } from './actions/settings'
import { peopleActions, type PeopleActions } from './actions/people'
import { policyActions, type PolicyActions } from './actions/policy'
import { contentActions, type ContentActions } from './actions/content'
import { moduleActions, type ModuleActions } from './actions/modules'
import { integrationActions, type IntegrationActions } from './actions/integrations'
import { groupActions, type GroupActions } from './actions/groups'
import { chatExperienceActions, type ChatExperienceActions } from './actions/chatExperience'
import { workbenchActions, type WorkbenchActions } from './actions/workbench'
import { botActions, type BotActions } from './actions/bots'
import { aExtraActions, type AExtraActions } from './actions/A-extra'
import { dExtraActions, type DExtraActions } from './actions/D-extra'
import { quickReplyActions, type QuickReplyActions } from './actions/quickReplies'

/** localStorage 键；模型变了就升版本号，旧数据直接作废 */
export const STORAGE_KEY = 'yolink-demo-v6'

const now = () => iso(Date.now())

function renderWelcome(tpl: string, nickname: string, seatName: string): string {
  return tpl.replace('{{customer.nickname}}', nickname).replace('{{seat.name}}', seatName)
}

export interface RegisterInput {
  nickname: string
  inviteCode: string
  phone?: string
}

export interface RegisterResult {
  ok: boolean
  error?: string
  customerId?: string
  addedSeatIds?: string[]
  /** 注册时自动加入的群与频道 */
  addedGroupIds?: string[]
}

export interface CoreActions {
  resetDemo: () => void
  logAudit: (type: AuditType, detail: string, actorStaffId?: string | null) => void
  // 会话
  setSession: (patch: Partial<DemoState['session']>) => void
  // 客户端
  registerCustomer: (input: RegisterInput) => RegisterResult
  customerSend: (convId: string, text: string) => void
  customerBlockSeat: (customerId: string, seatId: string, block: boolean) => void
  // 工作台
  seatSend: (convId: string, seatId: string, operatorId: string, text: string, aiDraftUsed?: boolean) => void
  recordAi: (staffId: string, convId: string, result: 'adopted' | 'edited' | 'ignored') => void
  assignTitle: (customerId: string, titleId: string, byStaffId: string) => void
  removeTitle: (customerId: string, titleId: string, byStaffId: string) => void
  setPrimaryTitle: (customerId: string, titleId: string) => void
  addTag: (customerId: string, tagId: string) => void
  removeTag: (customerId: string, tagId: string) => void
  createTag: (name: string, color: string, source: Tag['source']) => Tag
  setNote: (customerId: string, note: string) => void
  updateSeatWelcome: (seatId: string, welcome: string) => void
  /** 群发：返回实际发送数与因频控/拉黑/注销跳过数；频控超限返回 null（按钮应禁用） */
  sendBroadcast: (input: { name: string; seatId: string; operatorId: string; targetKind: BroadcastTargetKind; targetDesc: string; contentKind?: 'text' | 'image' | 'file'; media?: MessageMedia; text: string; customerIds: string[]; chatGroupId?: string; scheduledAt?: string | null }) => { sent: number; skipped: number } | null
  createInviteLink: (input: { name: string; inviteGroupId: string; creatorStaffId: string; expiresAt: string | null; maxUses: number | null; chatGroupIds?: string[] }) => InviteLink
  revokeInviteLink: (id: string, byStaffId: string) => void
  // 管理后台
  createSeat: (input: Omit<Seat, 'id' | 'createdAt' | 'avatarText' | 'avatarColor'> & { avatarColor?: string }, byStaffId: string) => Seat
  updateSeat: (id: string, patch: Partial<Seat>, byStaffId: string) => void
  handoverSeat: (seatId: string, toStaffId: string, reason: string, byStaffId: string) => void
  createStaff: (input: { name: string; username: string; email?: string; roleId: string; withSeat: boolean; roleDesc?: string; assignSeatIds?: string[]; mustChangePassword?: boolean }, byStaffId: string) => Staff
  setStaffStatus: (id: string, status: Staff['status'], byStaffId: string) => void
  updateRoleCaps: (roleId: string, caps: Capability[]) => void
  createInviteGroup: (input: { name: string; seatIds: string[]; primarySeatId: string; chatGroupIds: string[] }, byStaffId: string) => InviteGroup
  updateInviteGroup: (id: string, patch: Partial<InviteGroup>, byStaffId: string) => void
  resetInviteCode: (id: string, byStaffId: string) => void
  backfillSeat: (inviteGroupId: string, seatId: string, byStaffId: string) => number
  setDefaultInviteGroup: (id: string) => void
  createTitle: (input: Omit<Title, 'id'>, byStaffId: string) => Title
  updateTitle: (id: string, patch: Partial<Title>, byStaffId: string) => void
}

export type DemoActions = ChatExperienceActions & CoreActions & SettingsActions & PeopleActions & PolicyActions & ContentActions & ModuleActions & IntegrationActions & GroupActions & WorkbenchActions & BotActions & AExtraActions & DExtraActions & QuickReplyActions

export type DemoStore = DemoState & DemoActions

export const useStore = create<DemoStore>()(
  persist(
    (set, get) => ({
      ...buildSeed(),

      resetDemo: () => set({ ...buildSeed() }),

      logAudit: (type, detail, actorStaffId) =>
        set((s) => ({
          audit: [{ id: newId('au'), at: now(), actorStaffId: actorStaffId ?? s.session.adminStaffId, type, detail, ip: DEMO_IP }, ...s.audit],
        })),

      setSession: (patch) => set((s) => ({ session: { ...s.session, ...patch } })),

      registerCustomer: (input) => {
        const s = get()
        const code = input.inviteCode.trim().toUpperCase()
        let group: InviteGroup | undefined
        let link: InviteLink | undefined
        if (code) {
          group = s.inviteGroups.find((g) => g.code === code && g.enabled)
          if (!group) {
            link = s.inviteLinks.find((l) => l.code === code && l.status === 'active')
            if (link) group = s.inviteGroups.find((g) => g.id === link!.inviteGroupId && g.enabled)
          }
          if (!group) return { ok: false, error: '邀请码无效或已失效' }
        } else {
          if (s.enterprise.inviteCodeRequired) return { ok: false, error: '本企业注册需要邀请码' }
          group = s.inviteGroups.find((g) => g.isDefault)
          if (!group) return { ok: false, error: '企业未配置默认邀请组' }
        }
        if (s.customers.some((c) => c.nickname === input.nickname.trim())) return { ok: false, error: '该昵称已被使用' }

        const at = now()
        const customer: Customer = {
          id: newId('cus'),
          nickname: input.nickname.trim(),
          accountId: `HX${String(90000 + s.customers.length).padStart(6, '0')}`,
          phone: input.phone,
          registeredAt: at,
          lastActiveAt: at,
          device: 'iPhone 15 · iOS 18（演示）',
          inviteGroupId: group.id,
          inviteLinkId: link?.id,
          tagIds: ['tag_new'],
          titleIds: [],
          primaryTitleId: null,
          note: '',
          purchases: [],
          referrerId: null,
          inviteCount: 0,
          teamCount: 0,
          blockedSeatIds: [],
        }
        const seatById = Object.fromEntries(s.seats.map((x) => [x.id, x]))
        // 放几个加几个：停用或暂停接新的坐席跳过；主归属被跳过时落到下一个
        const usable = group.seatIds.filter((id) => seatById[id] && seatById[id].status === 'accepting')
        const skipped = group.seatIds.filter((id) => !usable.includes(id))
        const primarySeatId = usable.includes(group.primarySeatId) ? group.primarySeatId : usable[0]
        const customerSeats: CustomerSeat[] = []
        const conversations: Conversation[] = []
        const messages: Message[] = []
        usable.forEach((seatId) => {
          const seat = seatById[seatId]
          customerSeats.push({ customerId: customer.id, seatId, primary: seatId === primarySeatId, addedAt: at, source: 'register' })
          const conv: Conversation = { id: newId('conv'), kind: 'dm', customerId: customer.id, seatId, lastMessageAt: at }
          // 欢迎语在注册时已产生，不能标成未来时间压过客户随后的提问。
          const welcomeAt = at
          conv.lastMessageAt = welcomeAt
          conversations.push(conv)
          messages.push({
            id: newId('msg'),
            convId: conv.id,
            senderKind: 'seat',
            senderId: seatId,
            seatId,
            operatorId: seat.operatorStaffId ?? undefined,
            kind: 'text',
            text: renderWelcome(seat.welcome || s.enterprise.defaultWelcome, customer.nickname, seat.displayName),
            at: welcomeAt,
            isWelcome: true,
          })
        })
        const joinGroupIds = Array.from(new Set([...s.enterprise.defaultChatGroupIds, ...group.chatGroupIds, ...(link?.chatGroupIds ?? [])])).filter((gid) => s.chatGroups.some((g) => g.id === gid))
        const chatGroups = s.chatGroups.map((g) => (joinGroupIds.includes(g.id) ? { ...g, memberCustomerIds: [...g.memberCustomerIds, customer.id] } : g))
        for(const gid of joinGroupIds){const g=s.chatGroups.find((x)=>x.id===gid),conv=s.conversations.find((x)=>x.chatGroupId===gid);if(g&&conv)messages.push(...groupWelcomeMessages(g,conv.id,[customer],at))}
        const inviteLinks = link ? s.inviteLinks.map((l) => (l.id === link!.id ? { ...l, uses: l.uses + 1 } : l)) : s.inviteLinks
        const auditEntries = [
          { id: newId('au'), at, actorStaffId: null, type: 'customer.register' as AuditType, detail: `客户「${customer.nickname}」通过${link ? `邀请链接「${link.name}」（${group.name}）` : `邀请组「${group.name}」`}注册，自动添加：${usable.map((id) => seatById[id].displayName).join('、')}${skipped.length ? `；跳过：${skipped.map((id) => seatById[id]?.displayName).join('、')}` : ''}${joinGroupIds.length ? `；自动入群：${joinGroupIds.map((gid) => s.chatGroups.find((g) => g.id === gid)?.name).join('、')}` : ''}` },
        ]
        set({
          customers: [customer, ...s.customers],
          customerSeats: [...s.customerSeats, ...customerSeats],
          conversations: [...s.conversations, ...conversations],
          messages: [...s.messages, ...messages],
          chatGroups,
          inviteLinks,
          audit: [...auditEntries, ...s.audit],
          session: { ...s.session, phoneCustomerId: customer.id },
        })
        return { ok: true, customerId: customer.id, addedSeatIds: usable, addedGroupIds: joinGroupIds }
      },

      customerSend: (convId, text) => {
        const s = get()
        const conv = s.conversations.find((c) => c.id === convId)
        if (!conv) return
        const customerId = conv.customerId ?? s.session.phoneCustomerId
        if (!customerId) return
        const at = now()
        const seatNames = s.seats.map((x) => x.displayName)
        const mentions = s.seats.filter((x) => text.includes(`@${x.displayName}`)).map((x) => x.id)
        void seatNames
        set({
          messages: [...s.messages, { id: newId('msg'), convId, senderKind: 'customer', senderId: customerId, kind: 'text', text, at, mentionSeatIds: mentions.length ? mentions : undefined }],
          conversations: s.conversations.map((c) => (c.id === convId ? { ...c, lastMessageAt: at } : c)),
          customers: s.customers.map((c) => (c.id === customerId ? { ...c, lastActiveAt: at } : c)),
        })
      },

      customerBlockSeat: (customerId, seatId, block) =>
        set((s) => ({
          customers: s.customers.map((c) =>
            c.id === customerId ? { ...c, blockedSeatIds: block ? Array.from(new Set([...c.blockedSeatIds, seatId])) : c.blockedSeatIds.filter((x) => x !== seatId) } : c,
          ),
        })),

      seatSend: (convId, seatId, operatorId, text, aiDraftUsed) => {
        const at = now()
        set((s) => ({
          messages: [...s.messages, { id: newId('msg'), convId, senderKind: 'seat', senderId: seatId, seatId, operatorId, kind: 'text', text, at, aiDraftUsed }],
          conversations: s.conversations.map((c) => (c.id === convId ? { ...c, lastMessageAt: at } : c)),
        }))
      },

      recordAi: (staffId, convId, result) =>
        set((s) => ({ aiEvents: [{ id: newId('ai'), at: now(), staffId, convId, result, tokens: 900 }, ...s.aiEvents] })),

      assignTitle: (customerId, titleId, byStaffId) => {
        const s = get()
        const c = s.customers.find((x) => x.id === customerId)
        const t = s.titles.find((x) => x.id === titleId)
        if (!c || !t || c.titleIds.includes(titleId) || c.titleIds.length >= 5) return
        set({
          customers: s.customers.map((x) => (x.id === customerId ? { ...x, titleIds: [...x.titleIds, titleId], primaryTitleId: x.primaryTitleId ?? titleId } : x)),
          titleAssignments: [...s.titleAssignments, { id: newId('ta'), customerId, titleId, action: 'assign', byStaffId, at: now() }],
          audit: [{ id: newId('au'), at: now(), actorStaffId: byStaffId, type: 'title.assign', detail: `给客户「${c.nickname}」挂头衔「${t.name}」` }, ...s.audit],
        })
      },

      removeTitle: (customerId, titleId, byStaffId) => {
        const s = get()
        const c = s.customers.find((x) => x.id === customerId)
        const t = s.titles.find((x) => x.id === titleId)
        if (!c || !t) return
        const rest = c.titleIds.filter((x) => x !== titleId)
        set({
          customers: s.customers.map((x) => (x.id === customerId ? { ...x, titleIds: rest, primaryTitleId: x.primaryTitleId === titleId ? (rest[0] ?? null) : x.primaryTitleId } : x)),
          titleAssignments: [...s.titleAssignments, { id: newId('ta'), customerId, titleId, action: 'remove', byStaffId, at: now() }],
          audit: [{ id: newId('au'), at: now(), actorStaffId: byStaffId, type: 'title.remove', detail: `摘掉客户「${c.nickname}」的头衔「${t.name}」` }, ...s.audit],
        })
      },

      setPrimaryTitle: (customerId, titleId) =>
        set((s) => ({ customers: s.customers.map((x) => (x.id === customerId && x.titleIds.includes(titleId) ? { ...x, primaryTitleId: titleId } : x)) })),

      addTag: (customerId, tagId) =>
        set((s) => ({ customers: s.customers.map((x) => (x.id === customerId && !x.tagIds.includes(tagId) ? { ...x, tagIds: [...x.tagIds, tagId] } : x)) })),

      removeTag: (customerId, tagId) =>
        set((s) => ({ customers: s.customers.map((x) => (x.id === customerId ? { ...x, tagIds: x.tagIds.filter((t) => t !== tagId) } : x)) })),

      createTag: (name, color, source) => {
        const tag: Tag = { id: newId('tag'), name, color, source }
        set((s) => ({ tags: [...s.tags, tag] }))
        return tag
      },

      setNote: (customerId, note) => set((s) => ({ customers: s.customers.map((x) => (x.id === customerId ? { ...x, note } : x)) })),

      updateSeatWelcome: (seatId, welcome) => set((s) => ({ seats: s.seats.map((x) => (x.id === seatId ? { ...x, welcome } : x)) })),

      sendBroadcast: (input) => {
        const s = get()
        const at = now()
        const today = at.slice(0, 10)
        const seat = s.seats.find((x) => x.id === input.seatId)
        // 频控一：每个实操员工每天任务数，跨其持有的坐席合并
        const myToday = s.broadcasts.filter((b) => b.operatorId === input.operatorId && b.sentAt.slice(0, 10) === today).length
        if (myToday >= s.enterprise.broadcastPerStaffPerDay) return null
        const newMsgs: Message[] = []
        const convs = s.conversations.map((c) => ({ ...c }))
        let skipped = 0
        if (input.targetKind === 'group' && input.chatGroupId) {
          // 指定群：往该群发一条群消息，不是私发群成员
          const conv = convs.find((c) => c.kind !== 'dm' && c.chatGroupId === input.chatGroupId)
          if (conv) {
            conv.lastMessageAt = at
            newMsgs.push({ id: newId('msg'), convId: conv.id, senderKind: 'seat', senderId: input.seatId, seatId: input.seatId, operatorId: input.operatorId, kind: input.contentKind ?? 'text', text: input.text, media: input.media, at })
          }
        } else {
          // 频控二：每客户每天最多收到的群发条数，跨坐席、跨任务合并
          const seatName = s.seats.find((x) => x.id === input.seatId)?.displayName ?? ''
          input.customerIds.forEach((cid) => {
            const c = s.customers.find((x) => x.id === cid)
            if (!c || c.deletedAt || c.blacklistedAt || c.blockedSeatIds.includes(input.seatId)) {
              skipped += 1
              return
            }
            const conv = convs.find((x) => x.kind === 'dm' && x.customerId === cid && x.seatId === input.seatId)
            if (!conv) {
              skipped += 1
              return
            }
            const receivedToday = s.messages.filter((m) => m.senderKind === 'seat' && m.at.slice(0, 10) === today && m.isBroadcast && s.conversations.find((x) => x.id === m.convId)?.customerId === cid).length
            if (receivedToday >= s.enterprise.broadcastPerCustomerPerDay) {
              skipped += 1
              return
            }
            conv.lastMessageAt = at
            // 变量逐人替换：客户收到的是带自己昵称的私聊
            const text = input.text.replaceAll('{{customer.nickname}}', c.nickname).replaceAll('{{staff.name}}', seatName).replaceAll('{{company.name}}', s.enterprise.name)
            newMsgs.push({ id: newId('msg'), convId: conv.id, senderKind: 'seat', senderId: input.seatId, seatId: input.seatId, operatorId: input.operatorId, kind: input.contentKind ?? 'text', text, media: input.media, at, isBroadcast: true })
          })
        }
        const record: Broadcast = {
          id: newId('bc'),
          name: input.name,
          seatId: input.seatId,
          operatorId: input.operatorId,
          targetKind: input.targetKind,
          targetDesc: input.targetDesc,
          contentKind: input.contentKind ?? 'text',
          text: input.text,
          media: input.media,
          sentAt: at,
          scheduledAt: input.scheduledAt ?? null,
          status: input.scheduledAt ? 'scheduled' : 'done',
          sentCount: input.scheduledAt ? 0 : newMsgs.length,
          skippedCount: skipped,
          readCount: 0,
        }
        set({
          messages: input.scheduledAt ? s.messages : [...s.messages, ...newMsgs],
          conversations: input.scheduledAt ? s.conversations : convs,
          broadcasts: [record, ...s.broadcasts],
          audit: [{ id: newId('au'), at, actorStaffId: input.operatorId, type: 'broadcast.send', detail: `以「${seat?.displayName}」身份群发「${input.name}」，目标：${input.targetDesc}，${input.scheduledAt ? `定时 ${input.scheduledAt.slice(0, 16).replace('T', ' ')}` : `${newMsgs.length} 人，跳过 ${skipped} 人`}`, ip: DEMO_IP }, ...s.audit],
        })
        return { sent: newMsgs.length, skipped }
      },

      createInviteLink: (input) => {
        const s = get()
        const group = s.inviteGroups.find((g) => g.id === input.inviteGroupId)
        const link: InviteLink = { id: newId('il'), name: input.name, inviteGroupId: input.inviteGroupId, code: newInviteCode(), creatorStaffId: input.creatorStaffId, expiresAt: input.expiresAt, maxUses: input.maxUses, uses: 0, clicks: 0, status: 'active', chatGroupIds: input.chatGroupIds ?? [], createdAt: now() }
        set({
          inviteLinks: [link, ...s.inviteLinks],
          audit: [{ id: newId('au'), at: now(), actorStaffId: input.creatorStaffId, type: 'invite_link.create', detail: `在「${group?.name}」下创建邀请链接「${input.name}」，码 ${link.code}` }, ...s.audit],
        })
        return link
      },

      revokeInviteLink: (id, byStaffId) => {
        const s = get()
        const l = s.inviteLinks.find((x) => x.id === id)
        set({
          inviteLinks: s.inviteLinks.map((x) => (x.id === id ? { ...x, status: 'revoked' } : x)),
          audit: [{ id: newId('au'), at: now(), actorStaffId: byStaffId, type: 'invite_link.revoke', detail: `失效邀请链接「${l?.name}」` }, ...s.audit],
        })
      },

      createSeat: (input, byStaffId) => {
        const colors = ['#1f3b73', '#2f56ad', '#0f766e', '#b45309', '#7e22ce', '#be123c', '#0369a1']
        const seat: Seat = { ...input, id: newId('seat'), avatarText: input.displayName.slice(0, 1), avatarColor: input.avatarColor ?? colors[get().seats.length % colors.length], createdAt: now() }
        set((s) => ({ seats: [...s.seats, seat], audit: [{ id: newId('au'), at: now(), actorStaffId: byStaffId, type: 'seat.create', detail: `创建坐席「${seat.displayName}」（${seat.type === 'notice' ? '通知型' : '分配型'}），实操员工：${s.staff.find((x) => x.id === seat.operatorStaffId)?.name ?? '无'}` }, ...s.audit] }))
        return seat
      },

      updateSeat: (id, patch, byStaffId) => {
        const s = get()
        const seat = s.seats.find((x) => x.id === id)
        if (!seat) return
        const type: AuditType = patch.status === 'paused' ? 'seat.pause' : 'seat.update'
        set({
          seats: s.seats.map((x) => (x.id === id ? { ...x, ...patch } : x)),
          audit: [{ id: newId('au'), at: now(), actorStaffId: byStaffId, type, detail: `修改坐席「${seat.displayName}」：${Object.keys(patch).join('、')}` }, ...s.audit],
        })
      },

      handoverSeat: (seatId, toStaffId, reason, byStaffId) => {
        const s = get()
        const seat = s.seats.find((x) => x.id === seatId)
        if (!seat) return
        const from = s.staff.find((x) => x.id === seat.operatorStaffId)
        const to = s.staff.find((x) => x.id === toStaffId)
        const at = now()
        const workbenchStaffId = s.session.workbenchStaffId
        // 旧人正在以该坐席身份工作时，工作台立即失去该坐席
        const loseSeat = workbenchStaffId === seat.operatorStaffId && s.session.workbenchSeatId === seatId
        const otherSeat = loseSeat ? s.seats.find((x) => x.id !== seatId && x.operatorStaffId === workbenchStaffId) : undefined
        set({
          seats: s.seats.map((x) => (x.id === seatId ? { ...x, operatorStaffId: toStaffId, status: x.status === 'paused' && x.operatorStaffId === null ? 'accepting' : x.status } : x)),
          handovers: [...s.handovers, { id: newId('ho'), seatId, fromStaffId: seat.operatorStaffId, toStaffId, at, byStaffId, reason }],
          audit: [{ id: newId('au'), at, actorStaffId: byStaffId, type: 'seat.handover', detail: `坐席「${seat.displayName}」由 ${from?.name ?? '无'} 交接给 ${to?.name}；原因：${reason}` }, ...s.audit],
          session: loseSeat ? { ...s.session, workbenchSeatId: otherSeat?.id ?? null } : s.session,
        })
      },

      createStaff: (input, byStaffId) => {
        const s = get()
        const staff: Staff = { id: newId('st'), name: input.name, username: input.username, email: input.email, roleId: input.roleId, status: 'active', createdAt: now(), mustChangePassword: input.mustChangePassword }
        let seats = s.seats
        const notes: string[] = []
        if (input.withSeat) {
          const colors = ['#1f3b73', '#2f56ad', '#0f766e', '#b45309', '#7e22ce', '#be123c', '#0369a1']
          const seat: Seat = { id: newId('seat'), displayName: input.name, avatarText: input.name.slice(0, 1), avatarColor: colors[s.seats.length % colors.length], roleDesc: input.roleDesc ?? '投资顾问', type: 'assign', operatorStaffId: staff.id, status: 'accepting', welcome: '', customerDeletable: false, seatGroupId: null, maxCustomers: null, createdAt: now() }
          seats = [...seats, seat]
          notes.push(`同时创建同名坐席「${seat.displayName}」并指派`)
        }
        // 指派已有坐席：等同一次交接，记入交接记录
        const assign = (input.assignSeatIds ?? []).filter((id) => seats.some((x) => x.id === id))
        const handovers = assign.map((seatId) => {
          const seat = seats.find((x) => x.id === seatId)!
          return { id: newId('ho'), seatId, fromStaffId: seat.operatorStaffId, toStaffId: staff.id, at: now(), byStaffId, reason: `创建员工 ${staff.name} 时指派` }
        })
        if (assign.length) {
          seats = seats.map((x) => (assign.includes(x.id) ? { ...x, operatorStaffId: staff.id, status: x.status === 'paused' && x.operatorStaffId === null ? 'accepting' : x.status } : x))
          notes.push(`指派已有坐席：${assign.map((id) => seats.find((x) => x.id === id)?.displayName).join('、')}`)
        }
        if (!notes.length) notes.push('未创建同名坐席')
        set({
          staff: [...s.staff, staff],
          seats,
          handovers: [...s.handovers, ...handovers],
          audit: [{ id: newId('au'), at: now(), actorStaffId: byStaffId, type: 'staff.create', detail: `创建员工 ${staff.name}（角色：${s.roles.find((r) => r.id === input.roleId)?.name}），${notes.join('；')}`, ip: DEMO_IP }, ...s.audit],
        })
        return staff
      },

      setStaffStatus: (id, status, byStaffId) => {
        const s = get()
        const st = s.staff.find((x) => x.id === id)
        set({
          staff: s.staff.map((x) => (x.id === id ? { ...x, status } : x)),
          audit: [{ id: newId('au'), at: now(), actorStaffId: byStaffId, type: 'staff.disable', detail: `${status === 'disabled' ? '停用' : '激活'}员工 ${st?.name}${status === 'disabled' ? '，撤销全部登录会话' : ''}` }, ...s.audit],
        })
      },

      updateRoleCaps: (roleId, caps) => set((s) => ({ roles: s.roles.map((r) => (r.id === roleId ? { ...r, caps } : r)) })),

      createInviteGroup: (input, byStaffId) => {
        const s = get()
        const group: InviteGroup = { id: newId('ig'), name: input.name, code: newInviteCode(), seatIds: input.seatIds, primarySeatId: input.primarySeatId, chatGroupIds: input.chatGroupIds, isDefault: false, enabled: true, createdAt: now() }
        const names = input.seatIds.map((id) => s.seats.find((x) => x.id === id)?.displayName).join('、')
        set({
          inviteGroups: [...s.inviteGroups, group],
          audit: [{ id: newId('au'), at: now(), actorStaffId: byStaffId, type: 'invite_group.create', detail: `创建邀请组「${group.name}」，码 ${group.code}，成员：${names}；主归属：${s.seats.find((x) => x.id === input.primarySeatId)?.displayName}` }, ...s.audit],
        })
        return group
      },

      updateInviteGroup: (id, patch, byStaffId) => {
        const s = get()
        const g = s.inviteGroups.find((x) => x.id === id)
        if (!g) return
        set({
          inviteGroups: s.inviteGroups.map((x) => (x.id === id ? { ...x, ...patch } : x)),
          audit: [{ id: newId('au'), at: now(), actorStaffId: byStaffId, type: 'invite_group.update', detail: `修改邀请组「${g.name}」：${Object.keys(patch).join('、')}（老客户不追溯）` }, ...s.audit],
        })
      },

      resetInviteCode: (id, byStaffId) => {
        const s = get()
        const g = s.inviteGroups.find((x) => x.id === id)
        if (!g) return
        const code = newInviteCode()
        set({
          inviteGroups: s.inviteGroups.map((x) => (x.id === id ? { ...x, code } : x)),
          audit: [{ id: newId('au'), at: now(), actorStaffId: byStaffId, type: 'invite_group.reset_code', detail: `重置邀请组「${g.name}」的邀请码：${g.code} → ${code}` }, ...s.audit],
        })
      },

      backfillSeat: (inviteGroupId, seatId, byStaffId) => {
        const s = get()
        const g = s.inviteGroups.find((x) => x.id === inviteGroupId)
        const seat = s.seats.find((x) => x.id === seatId)
        if (!g || !seat) return 0
        const targets = s.customers.filter((c) => c.inviteGroupId === inviteGroupId && !s.customerSeats.some((cs) => cs.customerId === c.id && cs.seatId === seatId))
        const at = now()
        const cs: CustomerSeat[] = []
        const convs: Conversation[] = []
        const msgs: Message[] = []
        targets.forEach((c) => {
          cs.push({ customerId: c.id, seatId, primary: false, addedAt: at, source: 'backfill' })
          const conv: Conversation = { id: newId('conv'), kind: 'dm', customerId: c.id, seatId, lastMessageAt: at }
          convs.push(conv)
          msgs.push({ id: newId('msg'), convId: conv.id, senderKind: 'seat', senderId: seatId, seatId, operatorId: seat.operatorStaffId ?? undefined, kind: 'text', text: renderWelcome(seat.welcome || s.enterprise.defaultWelcome, c.nickname, seat.displayName), at, isWelcome: true })
        })
        set({
          customerSeats: [...s.customerSeats, ...cs],
          conversations: [...s.conversations, ...convs],
          messages: [...s.messages, ...msgs],
          audit: [{ id: newId('au'), at, actorStaffId: byStaffId, type: 'invite_group.backfill', detail: `把坐席「${seat.displayName}」补加到邀请组「${g.name}」的 ${targets.length} 位已有客户` }, ...s.audit],
        })
        return targets.length
      },

      setDefaultInviteGroup: (id) => set((s) => ({ inviteGroups: s.inviteGroups.map((g) => ({ ...g, isDefault: g.id === id })) })),

      createTitle: (input, byStaffId) => {
        const t: Title = { ...input, id: newId('t') }
        set((s) => ({ titles: [...s.titles, t], audit: [{ id: newId('au'), at: now(), actorStaffId: byStaffId, type: 'title.library', detail: `头衔库新增「${t.name}」` }, ...s.audit] }))
        return t
      },

      updateTitle: (id, patch, byStaffId) =>
        set((s) => {
          const t = s.titles.find((x) => x.id === id)
          return { titles: s.titles.map((x) => (x.id === id ? { ...x, ...patch } : x)), audit: [{ id: newId('au'), at: now(), actorStaffId: byStaffId, type: 'title.library', detail: `修改头衔「${t?.name}」：${Object.keys(patch).join('、')}` }, ...s.audit] }
        }),

      ...settingsActions(set, get),
      ...peopleActions(set, get),
      ...policyActions(set, get),
      ...contentActions(set, get),
      ...moduleActions(set, get),
      ...integrationActions(set, get),
      ...groupActions(set, get),
      ...workbenchActions(set, get),
      ...chatExperienceActions(set, get),
      ...botActions(set, get),
      ...aExtraActions(set, get),
      ...dExtraActions(set, get),
      ...quickReplyActions(set, get),
    }),
    {
      name: STORAGE_KEY,
      // 补齐本轮新增的配置，并更新产品分层标记；保留已有客户、会话和设置。
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<DemoStore>
        return {
          ...current,
          ...saved,
          roles: (saved.roles??current.roles).map((role)=>role.id==='role_admin'?{...role,caps:[...role.caps.filter((c)=>c!=='manage_messages'),'manage_messages' as const]}:role),
          chatRulesVersion: 1,
          policyMatrix: saved.chatRulesVersion ? (saved.policyMatrix ?? current.policyMatrix) : { ...(saved.policyMatrix ?? current.policyMatrix), 'dm.recall': { staff: (saved.policyMatrix ?? current.policyMatrix)['dm.recall']?.staff ?? true, customer: false } },
          policyNumbers: { ...current.policyNumbers, ...saved.policyNumbers },
          policyItems: (saved.policyItems ?? current.policyItems).map((item) => item.key === 'dm.edit' ? { ...item, level: 'P0' as const } : item.key === 'dm.recall' ? { ...item, label: '撤回自己发出的消息', desc: '撤回即为所有人删除，会留下「已撤回」痕迹；按客户 / 坐席独立开关，时限见数值型策略' } : item),
        }
      },
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => {
        // 只持久化数据，不持久化函数
        const { audit: _a, ...rest } = s
        void _a
        const data: Record<string, unknown> = {}
        Object.entries(rest).forEach(([k, v]) => {
          if (typeof v !== 'function') data[k] = v
        })
        data.audit = s.audit
        return data as unknown as DemoStore
      },
    },
  ),
)

/** 多窗口同步：另一个窗口写了 localStorage，本窗口重新水合 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) void useStore.persist.rehydrate()
  })
}
