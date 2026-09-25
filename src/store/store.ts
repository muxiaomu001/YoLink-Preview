import { runSensitiveGate } from './sensitiveGate'
/**
 * 演示状态仓库：全部数据在浏览器里，持久化到 localStorage，
 * 多个窗口（管理后台 / 工作台 / 客户屏）通过 storage 事件同步。
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { staffServiceBlocker } from '@/domain/providerLicense'
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
  LastSeenVisibility,
  Message,
  MessageMedia,
  Seat,
  Staff,
  Tag,
  Title,
  CustomerPrefs,
} from '@/domain/types'
import { groupWelcomeMessages } from '@/domain/groupWelcome'
import { buildSeed } from '@/domain/seed'
import { newId } from '@/domain/ids'
import { allocateSeats } from '@/domain/allocation'
import { NICKNAME_MAX, NICKNAME_MIN, deviceRegisterCount, resolveRegisterNickname, watchUntilOf } from '@/domain/register'
import { checkCustomerGroupJoin } from '@/domain/groupMembership'
import { planCoverage, type SkipReason } from '@/domain/broadcastCoverage'
import { inviteCodeError, newInviteCode, normalizeInviteCode } from '@/domain/inviteCode'
import { iso } from '@/domain/time'
import { seatBroadcastSkipReason } from '@/domain/messageRules'
import { customerCan } from './policy'
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
import { aExtraActions, type AExtraActions } from './actions/A-extra'
import { dExtraActions, type DExtraActions } from './actions/D-extra'
import { quickReplyActions, type QuickReplyActions } from './actions/quickReplies'
import { providerLicensingActions, type ProviderLicensingActions } from './actions/providerLicensing'
import { clearStartupSeen } from '@/domain/startupSeen'
import { defaultCustomerPrefs } from '@/domain/seed-groups'

/** localStorage 键；模型变了就升版本号，旧数据直接作废 */
export const STORAGE_KEY = 'yolink-demo-v17'

const now = () => iso(Date.now())


function renderWelcome(tpl: string, nickname: string, seatName: string): string {
  return tpl.replace('{{customer.nickname}}', nickname).replace('{{seat.name}}', seatName)
}

export interface RegisterInput {
  /** 「不问」档下客户端传空串，由 resolveRegisterNickname 发默认昵称 */
  nickname: string
  inviteCode: string
  phone?: string
  /** 设备指纹；演示里手机屏固定传 DEMO_DEVICE_ID，所以连着注册几次就能看到风控拦人 */
  deviceId?: string
}

export interface RegisterResult {
  ok: boolean
  error?: string
  customerId?: string
  addedSeatIds?: string[]
  /** 注册时自动加入的群与频道 */
  addedGroupIds?: string[]
  /** 昵称是系统发的默认名，注册成功页要提示客户改 */
  nicknameAuto?: boolean
  /** 新号观察期到期时间，没有观察期时为空 */
  watchUntil?: string
}

/** 演示里手机屏只有一台设备，同设备注册风控才演示得出来 */
export const DEMO_DEVICE_ID = 'dev_demo_iphone15'

export interface CoreActions {
  resetDemo: () => void
  logAudit: (type: AuditType, detail: string, actorStaffId?: string | null) => void
  // 会话
  setSession: (patch: Partial<DemoState['session']>) => string | null
  // 客户端
  registerCustomer: (input: RegisterInput) => RegisterResult
  customerBlockSeat: (customerId: string, seatId: string, block: boolean) => { ok: boolean; reason?: string }
  /** 客户关掉注册后的完善资料引导；软引导只提醒一次，关了就不再出现 */
  dismissProfileGuide: (customerId: string) => void
  /** 客户自己改昵称。改完就不再是系统发的默认名，软引导里那一条随之消失 */
  renameCustomer: (customerId: string, nickname: string) => { ok: boolean; error?: string }
  /** 演示中的头像更新；资料引导只关心头像是否仍为默认 */
  updateCustomerAvatar: (customerId: string) => void
  /** 最后上线时间只控制对外可见范围，不影响企业侧已读数据 */
  setCustomerLastSeenVisibility: (customerId: string, visibility: LastSeenVisibility) => void
  updateCustomerPrefs: (customerId: string, patch: Partial<Omit<CustomerPrefs, 'notifications'>> & { notifications?: Partial<CustomerPrefs['notifications']> }) => void
  // 工作台
  assignTitle: (customerId: string, titleId: string, byStaffId: string) => void
  removeTitle: (customerId: string, titleId: string, byStaffId: string) => void
  setPrimaryTitle: (customerId: string, titleId: string) => void
  addTag: (customerId: string, tagId: string) => void
  removeTag: (customerId: string, tagId: string) => void
  createTag: (name: string, color: string, source: Tag['source']) => Tag
  setNote: (customerId: string, note: string) => void
  updateSeatWelcome: (seatId: string, welcome: string) => void
  /** 群发：返回实际发送数与因频控/封禁/注销跳过数；频控超限返回 null（按钮应禁用） */
  sendBroadcast: (input: { name: string; seatId: string; operatorId: string; targetKind: BroadcastTargetKind; targetDesc: string; contentKind?: 'text' | 'image' | 'file'; media?: MessageMedia; text: string; customerIds: string[]; chatGroupId?: string; scheduledAt?: string | null }) => { sent: number; skipped: number; reason?: string } | null
  /** 多坐席全覆盖群发：每个客户只收一条，发送身份优先用他的主归属坐席。频控超限返回 null */
  sendCoverageBroadcast: (input: { name: string; seatIds: string[]; operatorId: string; text: string; customerIds?: string[]; scheduledAt?: string | null }) => { sent: number; skipped: number; reason?: string } | null
  cancelBroadcast: (id: string, byStaffId: string) => { ok: true } | { ok: false; error: string }
  /** code 留空则随机生成；自定义码重复或不合法时返回 error */
  createInviteLink: (input: { name: string; inviteGroupId: string; creatorStaffId: string; expiresAt: string | null; maxUses: number | null; chatGroupIds?: string[]; code?: string }) => { ok: true; link: InviteLink } | { ok: false; error: string }
  revokeInviteLink: (id: string, byStaffId: string) => void
  // 管理后台
  createSeat: (input: Omit<Seat, 'id' | 'createdAt' | 'avatarText' | 'avatarColor'> & { avatarColor?: string }, byStaffId: string) => Seat | null
  updateSeat: (id: string, patch: Partial<Seat>, byStaffId: string) => string | null
  handoverSeat: (seatId: string, toStaffId: string, reason: string, byStaffId: string) => string | null
  createStaff: (input: { name: string; username: string; email?: string; roleId: string; withSeat: boolean; roleDesc?: string; assignSeatIds?: string[]; mustChangePassword?: boolean }, byStaffId: string) => Staff
  updateRoleCaps: (roleId: string, caps: Capability[]) => void
  /** code 留空则随机生成 */
  createInviteGroup: (input: { name: string; fixedSeatIds: string[]; rotatingSeatIds: string[]; chatGroupIds: string[]; code?: string }, byStaffId: string) => { ok: true; group: InviteGroup } | { ok: false; error: string }
  updateInviteGroup: (id: string, patch: Partial<InviteGroup>, byStaffId: string) => { ok: true } | { ok: false; error: string }
  /** 邀请组与邀请链接共用的已占用码，改码时排除自己 */
  takenInviteCodes: (exceptId?: string) => string[]
  resetInviteCode: (id: string, byStaffId: string) => void
  backfillSeat: (inviteGroupId: string, seatId: string, byStaffId: string) => number
  setDefaultInviteGroup: (id: string) => void
  createTitle: (input: Omit<Title, 'id'>, byStaffId: string) => Title
  updateTitle: (id: string, patch: Partial<Title>, byStaffId: string) => void
}

export type DemoActions = ChatExperienceActions & CoreActions & SettingsActions & PeopleActions & PolicyActions & ContentActions & ModuleActions & IntegrationActions & GroupActions & WorkbenchActions & AExtraActions & DExtraActions & QuickReplyActions & ProviderLicensingActions

export type DemoStore = DemoState & DemoActions

export const useStore = create<DemoStore>()(
  persist(
    (set, get) => ({
      ...buildSeed(),

      resetDemo: () => {
        clearStartupSeen()
        set({ ...buildSeed() })
      },

      logAudit: (type, detail, actorStaffId) =>
        set((s) => ({
          audit: [{ id: newId('au'), at: now(), actorStaffId: actorStaffId ?? s.session.adminStaffId, type, detail, ip: DEMO_IP }, ...s.audit],
        })),

      setSession: (patch) => {
        const blocker = staffServiceBlocker(get())
        if (blocker && (patch.adminStaffId || patch.workbenchStaffId || patch.workbenchSeatId)) return blocker
        set((s) => ({
          session: {
            ...s.session,
            ...patch,
            ...(patch.phoneCustomerId !== undefined ? { phoneSessionStartedAt: patch.phoneCustomerId ? now() : null } : {}),
          },
        }))
        return null
      },

      registerCustomer: (input) => {
        const s = get()
        const at = now()
        const code = input.inviteCode.trim().toUpperCase()
        let group: InviteGroup | undefined
        let link: InviteLink | undefined
        if (code) {
          group = s.inviteGroups.find((g) => g.code === code)
          if (group) {
            if (!group.enabled) return { ok: false, error: '邀请码无效或已失效' }
          } else {
            link = s.inviteLinks.find((l) => l.code === code)
            if (!link) return { ok: false, error: '邀请码无效或已失效' }
            if (link.status === 'expired' || (link.status === 'active' && link.expiresAt !== null && link.expiresAt <= at)) {
              return { ok: false, error: '这个邀请链接已过期' }
            }
            if (link.status === 'revoked') return { ok: false, error: '这个邀请链接已停用' }
            if (link.status !== 'active') return { ok: false, error: '这个邀请链接已停用' }
            if (link.maxUses !== null && link.uses >= link.maxUses) return { ok: false, error: '这个邀请链接的名额已用完' }
            group = s.inviteGroups.find((g) => g.id === link!.inviteGroupId && g.enabled)
          }
          if (!group) return { ok: false, error: '邀请码无效或已失效' }
        } else {
          if (s.enterprise.inviteCodeRequired) return { ok: false, error: '本企业注册需要邀请码' }
          group = s.inviteGroups.find((g) => g.isDefault)
          if (!group) return { ok: false, error: '企业未配置默认邀请组' }
        }
        const deviceId = input.deviceId ?? DEMO_DEVICE_ID
        // 同设备注册风控：先拦，再看别的。批量注册的号进来之后每一步都要占资源
        // （轮询坐席被吃掉、群人数被撑满），所以这一刀必须落在建号之前。
        const perDevice = s.enterprise.registerPerDevicePerDay
        if (perDevice > 0) {
          const used = deviceRegisterCount(s.customers, deviceId, at)
          if (used >= perDevice) {
            set({
              audit: [{ id: newId('au'), at, actorStaffId: null, type: 'customer.register_blocked' as AuditType, detail: `同设备注册风控拦截：设备 ${deviceId} 24 小时内已注册 ${used} 个账号，上限 ${perDevice} 个`, ip: DEMO_IP }, ...s.audit],
            })
            return { ok: false, error: `这台设备 24 小时内已注册 ${used} 个账号（上限 ${perDevice} 个），请稍后再试或联系客服` }
          }
        }
        // 昵称不做全企业唯一：客户之间本来就互不相干，撞名是常态，注册时因为别人先叫了「张先生」而被拦下没有道理。
        // 同名带来的歧义只发生在同一个会话里，由 @ 提及那边处理（同名时不自动识别，必须从列表点选）。
        const accountId = `HX${String(90000 + s.customers.length).padStart(6, '0')}`
        const nick = resolveRegisterNickname(s.enterprise.nicknamePolicy, s.enterprise.defaultNicknameTemplate, input.nickname, accountId)
        if (!nick.ok) return { ok: false, error: nick.error }
        const nickname = nick.nickname
        const watchUntil = watchUntilOf(at, s.enterprise.newAccountWatchHours)

        const customer: Customer = {
          id: newId('cus'),
          nickname,
          accountId,
          phone: input.phone,
          registeredAt: at,
          lastActiveAt: at,
          device: 'iPhone 15 · iOS 18（演示）',
          deviceId,
          nicknameAuto: nick.auto || undefined,
          watchUntil,
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
        // 固定坐席全加，轮询坐席按队列轮一个；暂停接新的跳过
        const { seatIds: usable, primarySeatId, rotationIndex, skippedSeatIds: skipped } = allocateSeats(group, seatById)
        if (!usable.length) return { ok: false, error: '该邀请组当前没有可接客的坐席，请联系管理员' }
        const customerSeats: CustomerSeat[] = []
        const conversations: Conversation[] = []
        const messages: Message[] = []
        usable.forEach((seatId) => {
          const seat = seatById[seatId]
          customerSeats.push({ customerId: customer.id, seatId, primary: seatId === primarySeatId, addedAt: at, source: 'register' })
          const conv: Conversation = { id: newId('conv'), kind: 'dm', customerId: customer.id, seatId, lastMessageAt: at }
          conversations.push(conv)
          if (seat.welcome.trim()) {
            messages.push({
              id: newId('msg'),
              convId: conv.id,
              senderKind: 'seat',
              senderId: seatId,
              seatId,
              operatorId: seat.operatorStaffId,
              kind: 'text',
              text: renderWelcome(seat.welcome, customer.nickname, seat.displayName),
              at,
              isWelcome: true,
            })
          }
        })
        const fullGroupNames: string[] = []
        const missingTitleGroupNames: string[] = []
        const joinGroupIds = Array.from(new Set([...group.chatGroupIds, ...(link?.chatGroupIds ?? [])])).filter((groupId) => {
          const chatGroup = s.chatGroups.find((item) => item.id === groupId)
          const check = checkCustomerGroupJoin(chatGroup, customer, s.policyNumbers.groupMaxMembers)
          if (check.allowed) return true
          if (chatGroup && check.reason === 'full') fullGroupNames.push(chatGroup.name)
          if (chatGroup && check.reason === 'missing_title') missingTitleGroupNames.push(chatGroup.name)
          return false
        })
        const chatGroups = s.chatGroups.map((g) => (joinGroupIds.includes(g.id) ? { ...g, memberCustomerIds: [...g.memberCustomerIds, customer.id], customerJoinedAt: { ...(g.customerJoinedAt ?? {}), [customer.id]: at } } : g))
        for(const gid of joinGroupIds){const g=s.chatGroups.find((x)=>x.id===gid),conv=s.conversations.find((x)=>x.chatGroupId===gid);if(g&&conv)messages.push(...groupWelcomeMessages(g,conv.id,[customer],at))}
        const inviteLinks = link ? s.inviteLinks.map((l) => (l.id === link!.id ? { ...l, uses: l.uses + 1 } : l)) : s.inviteLinks
        const auditEntries = [
          { id: newId('au'), at, actorStaffId: null, type: 'customer.register' as AuditType, detail: `客户「${customer.nickname}」通过${link ? `邀请链接「${link.name}」（${group.name}）` : `邀请组「${group.name}」`}注册，轮询分配轮询坐席：${primarySeatId ? seatById[primarySeatId]?.displayName : '无'}；自动添加：${usable.map((id) => seatById[id]?.displayName).join('、')}${skipped.length ? `；跳过（暂停接新）：${skipped.map((id) => seatById[id]?.displayName).join('、')}` : ''}${joinGroupIds.length ? `；自动入群：${joinGroupIds.map((gid) => s.chatGroups.find((g) => g.id === gid)?.name).join('、')}` : ''}${nick.auto ? '；昵称未填，发默认昵称' : ''}${watchUntil ? `；新号观察期至 ${watchUntil.slice(0, 16).replace('T', ' ')}` : ''}${fullGroupNames.length ? `；因满员未加入：${fullGroupNames.join('、')}` : ''}${missingTitleGroupNames.length ? `；缺少头衔未加入：${missingTitleGroupNames.join('、')}` : ''}` },
        ]
        set({
          customers: [customer, ...s.customers],
          customerSeats: [...s.customerSeats, ...customerSeats],
          conversations: [...s.conversations, ...conversations],
          messages: [...s.messages, ...messages],
          chatGroups,
          inviteLinks,
          // 轮询游标推进一位，下一个客户接着往下分
          inviteGroups: s.inviteGroups.map((g) => (g.id === group!.id ? { ...g, rotationIndex } : g)),
          audit: [...auditEntries, ...s.audit],
          session: { ...s.session, phoneCustomerId: customer.id, phoneSessionStartedAt: at },
        })
        return { ok: true, customerId: customer.id, addedSeatIds: usable, addedGroupIds: joinGroupIds, nicknameAuto: nick.auto, watchUntil }
      },

      customerBlockSeat: (customerId, seatId, block) => {
        const s = get()
        const customer = s.customers.find((c) => c.id === customerId)
        if (!customer || !s.seats.some((seat) => seat.id === seatId)) return { ok: false, reason: '联系人不存在' }
        if (block && !customerCan(s, customerId, 'friend.block')) return { ok: false, reason: '当前策略不允许拉黑联系人' }
        set({ customers: s.customers.map((c) => c.id === customerId ? { ...c, blockedSeatIds: block ? Array.from(new Set([...c.blockedSeatIds, seatId])) : c.blockedSeatIds.filter((id) => id !== seatId) } : c) })
        return { ok: true }
      },

      renameCustomer: (customerId, nickname) => {
        const v = nickname.trim()
        if (v.length < NICKNAME_MIN || v.length > NICKNAME_MAX) return { ok: false, error: `昵称 ${NICKNAME_MIN} 到 ${NICKNAME_MAX} 字` }
        set((s) => ({ customers: s.customers.map((c) => (c.id === customerId ? { ...c, nickname: v, nicknameAuto: undefined } : c)) }))
        return { ok: true }
      },

      updateCustomerAvatar: (customerId) =>
        set((s) => ({ customers: s.customers.map((c) => (c.id === customerId ? { ...c, avatarUpdatedAt: now() } : c)) })),

      setCustomerLastSeenVisibility: (customerId, visibility) =>
        set((s) => ({ customers: s.customers.map((c) => (c.id === customerId ? { ...c, lastSeenVisibility: visibility } : c)) })),

      updateCustomerPrefs: (customerId, patch) =>
        set((s) => ({
          customers: s.customers.map((c) => {
            if (c.id !== customerId) return c
            const current = c.preferences ?? defaultCustomerPrefs(s.enterprise.defaultTheme)
            return { ...c, preferences: { ...current, ...patch, notifications: { ...current.notifications, ...(patch.notifications ?? {}) } } }
          }),
        })),

      dismissProfileGuide: (customerId) =>
        set((s) => ({ customers: s.customers.map((c) => (c.id === customerId ? { ...c, profileGuideDismissedAt: now() } : c)) })),

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
        // 第一版群发只发送填写的正文，不展开昵称、坐席或企业变量。
        if (/\{\{[^}]+\}\}/.test(input.text)) return { sent: 0, skipped: 0, reason: '群发不支持变量，请填写完整正文后再发送' }
        const gate = runSensitiveGate(s, { text: input.text, scope: 'seat', senderId: input.seatId, operatorStaffId: input.operatorId, convId: '', at })
        if (gate.blocked) {
          set({ sensitiveHits: [...s.sensitiveHits, ...gate.hits] })
          return { sent: 0, skipped: 0, reason: gate.blocked }
        }
        const seat = s.seats.find((x) => x.id === input.seatId)
        // 频控一：每个实操员工每天任务数，跨其持有的坐席合并
        const myToday = s.broadcasts.filter((b) => b.operatorId === input.operatorId && b.status === 'done' && b.sentAt.slice(0, 10) === today).length
        if (myToday >= s.enterprise.broadcastPerStaffPerDay) return null
        const newMsgs: Message[] = []
        const convs = s.conversations.map((c) => ({ ...c }))
        let skipped = 0
        const skipReasons: Partial<Record<SkipReason, number>> = {}
        const skip = (reason: SkipReason) => {
          skipped += 1
          skipReasons[reason] = (skipReasons[reason] ?? 0) + 1
        }
        if (input.targetKind === 'group' && input.chatGroupId) {
          // 指定群：往该群发一条群消息，不是私发群成员
          const conv = convs.find((c) => c.kind !== 'dm' && c.chatGroupId === input.chatGroupId)
          if (!conv) {
            skip('left')
          } else {
            const block = seatBroadcastSkipReason(s, conv.id, input.seatId, input.operatorId, (input.contentKind ?? 'text') !== 'text', at)
            if (block) {
              skip(block)
            } else {
              conv.lastMessageAt = at
              newMsgs.push({ id: newId('msg'), convId: conv.id, senderKind: 'seat', senderId: input.seatId, seatId: input.seatId, operatorId: input.operatorId, kind: input.contentKind ?? 'text', text: gate.text, media: input.media, at, isBroadcast: true })
            }
          }
        } else {
          // 频控二：每客户每天最多收到的群发条数，跨坐席、跨任务合并
          input.customerIds.forEach((cid) => {
            const conv = convs.find((x) => x.kind === 'dm' && x.customerId === cid && x.seatId === input.seatId)
            const block = seatBroadcastSkipReason(s, conv?.id ?? '', input.seatId, input.operatorId, (input.contentKind ?? 'text') !== 'text', at)
            if (block || !conv) {
              skip(block ?? 'left')
              return
            }
            const receivedToday = s.messages.filter((m) => m.senderKind === 'seat' && m.at.slice(0, 10) === today && m.isBroadcast && s.conversations.find((x) => x.id === m.convId)?.customerId === cid).length
            if (receivedToday >= s.enterprise.broadcastPerCustomerPerDay) {
              skip('rateLimited')
              return
            }
            conv.lastMessageAt = at
            const text = gate.text
            newMsgs.push({ id: newId('msg'), convId: conv.id, senderKind: 'seat', senderId: input.seatId, seatId: input.seatId, operatorId: input.operatorId, kind: input.contentKind ?? 'text', text, media: input.media, at, isBroadcast: true })
          })
        }
        const recipientCustomerIds = [...input.customerIds]
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
          skipReasons,
          recipientCustomerIds,
        }
        set({
          sensitiveHits: input.scheduledAt ? s.sensitiveHits : [...s.sensitiveHits, ...newMsgs.flatMap((m) => gate.hits.map((h) => ({ ...h, id: newId('sh'), senderId: m.senderId, convId: m.convId })))],
          messages: input.scheduledAt ? s.messages : [...s.messages, ...newMsgs],
          conversations: input.scheduledAt ? s.conversations : convs,
          broadcasts: [record, ...s.broadcasts],
          audit: [{ id: newId('au'), at, actorStaffId: input.operatorId, type: 'broadcast.send', detail: `以「${seat?.displayName}」身份群发「${input.name}」，目标：${input.targetDesc}，${input.scheduledAt ? `定时 ${input.scheduledAt.slice(0, 16).replace('T', ' ')}` : `${newMsgs.length} 人，跳过 ${skipped} 人`}`, ip: DEMO_IP }, ...s.audit],
        })
        return { sent: newMsgs.length, skipped }
      },

      sendCoverageBroadcast: (input) => {
        const s = get()
        const at = now()
        const today = at.slice(0, 10)
        // 第一版群发只发送填写的正文，不展开昵称、坐席或企业变量。
        if (/\{\{[^}]+\}\}/.test(input.text)) return { sent: 0, skipped: 0, reason: '群发不支持变量，请填写完整正文后再发送' }
        const gate = runSensitiveGate(s, { text: input.text, scope: 'seat', senderId: input.seatIds[0] ?? '', operatorStaffId: input.operatorId, convId: '', at })
        if (gate.blocked) {
          set({ sensitiveHits: [...s.sensitiveHits, ...gate.hits] })
          return { sent: 0, skipped: 0, reason: gate.blocked }
        }
        // 频控归属：全覆盖只算发起人（后台管理员）的一个任务。
        // 若按投递坐席去扣各自实操员工的额度，管理员发一条全员通知就会把所有坐席当天的
        // 群发额度吃光，他们自己的营销群发全发不出去——那是运营事故，不是风控。
        const myToday = s.broadcasts.filter((b) => b.operatorId === input.operatorId && b.status === 'done' && b.sentAt.slice(0, 10) === today).length
        if (myToday >= s.enterprise.broadcastPerStaffPerDay) return null
        const plan = planCoverage(s, input.seatIds, at, input.customerIds)
        const convIds = new Set(plan.deliveries.map((d) => d.convId))
        const newMsgs: Message[] = plan.deliveries.map((d) => ({
          id: newId('msg'),
          convId: d.convId,
          senderKind: 'seat',
          senderId: d.seatId,
          seatId: d.seatId,
          operatorId: input.operatorId,
          kind: 'text',
          text: gate.text,
          at,
          isBroadcast: true,
        }))
        const seatNames = input.seatIds.map((id) => s.seats.find((x) => x.id === id)?.displayName ?? '?').join('、')
        const record: Broadcast = {
          id: newId('bc'),
          name: input.name,
          seatId: [...plan.bySeat].sort((a, b) => b.count - a.count)[0]?.seatId ?? input.seatIds[0],
          operatorId: input.operatorId,
          targetKind: 'coverage',
          targetDesc: `多坐席覆盖 · ${input.seatIds.length} 个坐席（${seatNames}）`,
          contentKind: 'text',
          text: input.text,
          sentAt: at,
          scheduledAt: input.scheduledAt ?? null,
          status: input.scheduledAt ? 'scheduled' : 'done',
          sentCount: input.scheduledAt ? 0 : newMsgs.length,
          skippedCount: plan.skips.length,
          readCount: 0,
          coverage: plan.bySeat,
          skipReasons: plan.skipReasons,
          recipientCustomerIds: input.customerIds ? [...input.customerIds] : plan.deliveries.map((delivery) => delivery.customer.id),
        }
        set({
          sensitiveHits: input.scheduledAt ? s.sensitiveHits : [...s.sensitiveHits, ...newMsgs.flatMap((m) => gate.hits.map((h) => ({ ...h, id: newId('sh'), senderId: m.senderId, convId: m.convId })))],
          messages: input.scheduledAt ? s.messages : [...s.messages, ...newMsgs],
          conversations: input.scheduledAt ? s.conversations : s.conversations.map((c) => (convIds.has(c.id) ? { ...c, lastMessageAt: at } : c)),
          broadcasts: [record, ...s.broadcasts],
          audit: [{ id: newId('au'), at, actorStaffId: input.operatorId, type: 'broadcast.send', detail: `多坐席覆盖群发「${input.name}」，坐席：${seatNames}，${input.scheduledAt ? `定时 ${input.scheduledAt.slice(0, 16).replace('T', ' ')}` : `${newMsgs.length} 人，跳过 ${plan.skips.length} 人`}`, ip: DEMO_IP }, ...s.audit],
        })
        return { sent: newMsgs.length, skipped: plan.skips.length }
      },

      cancelBroadcast: (id, byStaffId) => {
        const s = get()
        const broadcast = s.broadcasts.find((item) => item.id === id)
        if (!broadcast) return { ok: false, error: '群发记录不存在' }
        if (broadcast.status !== 'scheduled') return { ok: false, error: '只有待发送的定时群发可以取消' }
        set({
          broadcasts: s.broadcasts.map((item) => (item.id === id ? { ...item, status: 'cancelled' } : item)),
          audit: [{ id: newId('au'), at: now(), actorStaffId: byStaffId, type: 'broadcast.cancel', detail: `取消定时群发「${broadcast.name}」`, ip: DEMO_IP }, ...s.audit],
        })
        return { ok: true }
      },

      createInviteLink: (input) => {
        const s = get()
        const group = s.inviteGroups.find((g) => g.id === input.inviteGroupId)
        const taken = get().takenInviteCodes()
        if (input.code) {
          const err = inviteCodeError(input.code, taken)
          if (err) return { ok: false, error: err }
        }
        let code = input.code ? normalizeInviteCode(input.code) : newInviteCode()
        while (!input.code && taken.includes(code)) code = newInviteCode()
        const link: InviteLink = { id: newId('il'), name: input.name, inviteGroupId: input.inviteGroupId, code, creatorStaffId: input.creatorStaffId, expiresAt: input.expiresAt, maxUses: input.maxUses, uses: 0, clicks: 0, status: 'active', chatGroupIds: input.chatGroupIds ?? [], createdAt: now() }
        set({
          inviteLinks: [link, ...s.inviteLinks],
          audit: [{ id: newId('au'), at: now(), actorStaffId: input.creatorStaffId, type: 'invite_link.create', detail: `在「${group?.name}」下创建邀请链接「${input.name}」，码 ${link.code}${input.code ? '（自定义）' : ''}` }, ...s.audit],
        })
        return { ok: true, link }
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
        if (input.status !== 'accepting' && input.status !== 'paused') return null
        if (!get().staff.some((x) => x.id === input.operatorStaffId && x.status === 'active')) return null
        const colors = ['#1f3b73', '#2f56ad', '#0f766e', '#b45309', '#7e22ce', '#be123c', '#0369a1']
        const seat: Seat = { ...input, id: newId('seat'), avatarText: input.displayName.slice(0, 1), avatarColor: input.avatarColor ?? colors[get().seats.length % colors.length], createdAt: now() }
        set((s) => ({ seats: [...s.seats, seat], audit: [{ id: newId('au'), at: now(), actorStaffId: byStaffId, type: 'seat.create', detail: `创建坐席「${seat.displayName}」，实操员工：${s.staff.find((x) => x.id === seat.operatorStaffId)?.name ?? '无'}` }, ...s.audit] }))
        return seat
      },

      updateSeat: (id, patch, byStaffId) => {
        const s = get()
        const seat = s.seats.find((x) => x.id === id)
        if (!seat) return '坐席不存在'
        if (Object.hasOwn(patch, 'operatorStaffId')) return '实操员工只能通过交接改变'
        if (patch.status !== undefined && patch.status !== 'accepting' && patch.status !== 'paused') return '坐席状态只能是接新中或暂停接新'
        const type: AuditType = patch.status === 'paused' ? 'seat.pause' : 'seat.update'
        set({
          seats: s.seats.map((x) => (x.id === id ? { ...x, ...patch } : x)),
          audit: [{ id: newId('au'), at: now(), actorStaffId: byStaffId, type, detail: `修改坐席「${seat.displayName}」：${Object.keys(patch).join('、')}` }, ...s.audit],
        })
        return null
      },

      handoverSeat: (seatId, toStaffId, reason, byStaffId) => {
        const s = get()
        const seat = s.seats.find((x) => x.id === seatId)
        if (!seat) return '坐席不存在'
        if (seat.operatorStaffId === toStaffId) return '不能交接给当前实操员工'
        const from = s.staff.find((x) => x.id === seat.operatorStaffId)
        const to = s.staff.find((x) => x.id === toStaffId)
        if (!to) return '目标员工不存在'
        if (to.status !== 'active') return '目标员工已停用，不能接手'
        const at = now()
        const workbenchStaffId = s.session.workbenchStaffId
        // 旧人正在以该坐席身份工作时，工作台立即失去该坐席
        const loseSeat = workbenchStaffId === seat.operatorStaffId && s.session.workbenchSeatId === seatId
        const otherSeat = loseSeat ? s.seats.find((x) => x.id !== seatId && x.operatorStaffId === workbenchStaffId) : undefined
        set({
          seats: s.seats.map((x) => (x.id === seatId ? { ...x, operatorStaffId: toStaffId } : x)),
          handovers: [...s.handovers, { id: newId('ho'), seatId, fromStaffId: seat.operatorStaffId, toStaffId, at, byStaffId, reason }],
          audit: [{ id: newId('au'), at, actorStaffId: byStaffId, type: 'seat.handover', detail: `坐席「${seat.displayName}」由 ${from?.name ?? '无'} 交接给 ${to?.name}；原因：${reason}` }, ...s.audit],
          session: loseSeat ? { ...s.session, workbenchSeatId: otherSeat?.id ?? null } : s.session,
        })
        return null
      },

      createStaff: (input, byStaffId) => {
        const s = get()
        const staff: Staff = { id: newId('st'), name: input.name, username: input.username, email: input.email, roleId: input.roleId, status: 'active', createdAt: now(), mustChangePassword: input.mustChangePassword }
        let seats = s.seats
        const notes: string[] = []
        if (input.withSeat) {
          const colors = ['#1f3b73', '#2f56ad', '#0f766e', '#b45309', '#7e22ce', '#be123c', '#0369a1']
          const seat: Seat = { id: newId('seat'), displayName: input.name, avatarText: input.name.slice(0, 1), avatarColor: colors[s.seats.length % colors.length], roleDesc: input.roleDesc ?? '客户服务', operatorStaffId: staff.id, status: 'accepting', welcome: '', customerDeletable: false, createdAt: now() }
          seats = [...seats, seat]
          notes.push(`同时创建同名坐席「${seat.displayName}」并指派`)
        }
        const assign = (input.assignSeatIds ?? []).filter((id) => seats.some((x) => x.id === id && x.operatorStaffId !== staff.id))
        if (assign.length) notes.push(`指派已有坐席：${assign.map((id) => seats.find((x) => x.id === id)?.displayName).join('、')}`)
        if (!notes.length) notes.push('未创建同名坐席')
        set({
          staff: [...s.staff, staff],
          seats,
          audit: [{ id: newId('au'), at: now(), actorStaffId: byStaffId, type: 'staff.create', detail: `创建员工 ${staff.name}（角色：${s.roles.find((r) => r.id === input.roleId)?.name}），${notes.join('；')}`, ip: DEMO_IP }, ...s.audit],
        })
        assign.forEach((seatId) => {
          get().handoverSeat(seatId, staff.id, `创建员工 ${staff.name} 时指派`, byStaffId)
        })
        return staff
      },

      updateRoleCaps: (roleId, caps) => get().updateRole(roleId, { caps }, get().session.adminStaffId!),

      takenInviteCodes: (exceptId) => {
        const s = get()
        return [...s.inviteGroups.filter((g) => g.id !== exceptId).map((g) => g.code), ...s.inviteLinks.filter((l) => l.id !== exceptId).map((l) => l.code)]
      },

      createInviteGroup: (input, byStaffId) => {
        const s = get()
        if (!input.fixedSeatIds.length && !input.rotatingSeatIds.length) return { ok: false, error: '至少配一个坐席' }
        const taken = get().takenInviteCodes()
        if (input.code) {
          const err = inviteCodeError(input.code, taken)
          if (err) return { ok: false, error: err }
        }
        let code = input.code ? normalizeInviteCode(input.code) : newInviteCode()
        while (!input.code && taken.includes(code)) code = newInviteCode()
        const group: InviteGroup = { id: newId('ig'), name: input.name, code, fixedSeatIds: input.fixedSeatIds, rotatingSeatIds: input.rotatingSeatIds, rotationIndex: 0, chatGroupIds: input.chatGroupIds, isDefault: false, enabled: true, createdAt: now() }
        const nameOf = (id: string) => s.seats.find((x) => x.id === id)?.displayName ?? id
        set({
          inviteGroups: [...s.inviteGroups, group],
          audit: [{ id: newId('au'), at: now(), actorStaffId: byStaffId, type: 'invite_group.create', detail: `创建邀请组「${group.name}」，码 ${group.code}${input.code ? '（自定义）' : ''}；轮询坐席：${group.rotatingSeatIds.map(nameOf).join(' → ') || '无'}；固定坐席：${group.fixedSeatIds.map(nameOf).join('、') || '无'}` }, ...s.audit],
        })
        return { ok: true, group }
      },

      updateInviteGroup: (id, patch, byStaffId) => {
        const s = get()
        const g = s.inviteGroups.find((x) => x.id === id)
        if (!g) return { ok: false, error: '邀请组不存在' }
        const next = { ...g, ...patch }
        if (!next.fixedSeatIds.length && !next.rotatingSeatIds.length) return { ok: false, error: '至少配一个坐席' }
        if (patch.code !== undefined && normalizeInviteCode(patch.code) !== g.code) {
          const err = inviteCodeError(patch.code, get().takenInviteCodes(id))
          if (err) return { ok: false, error: err }
          next.code = normalizeInviteCode(patch.code)
        }
        // 队列改了游标就可能越界，收回到队首而不是静默取模
        if (patch.rotatingSeatIds && next.rotationIndex >= next.rotatingSeatIds.length) next.rotationIndex = 0
        set({
          inviteGroups: s.inviteGroups.map((x) => (x.id === id ? next : x)),
          audit: [{ id: newId('au'), at: now(), actorStaffId: byStaffId, type: 'invite_group.update', detail: `修改邀请组「${g.name}」：${Object.keys(patch).join('、')}（老客户不追溯）${next.code !== g.code ? `；邀请码 ${g.code} → ${next.code}` : ''}` }, ...s.audit],
        })
        return { ok: true }
      },

      resetInviteCode: (id, byStaffId) => {
        const s = get()
        const g = s.inviteGroups.find((x) => x.id === id)
        if (!g) return
        const taken = get().takenInviteCodes(id)
        let code = newInviteCode()
        while (taken.includes(code)) code = newInviteCode()
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
          if (seat.welcome.trim()) {
            msgs.push({ id: newId('msg'), convId: conv.id, senderKind: 'seat', senderId: seatId, seatId, operatorId: seat.operatorStaffId ?? undefined, kind: 'text', text: renderWelcome(seat.welcome, c.nickname, seat.displayName), at, isWelcome: true })
          }
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
      ...aExtraActions(set, get),
      ...dExtraActions(set, get),
      ...quickReplyActions(set, get),
      ...providerLicensingActions(set, get),
    }),
    {
      name: STORAGE_KEY,
      // 补齐本轮新增的配置，并更新产品分层标记；保留已有客户、会话和设置。
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<DemoStore>
        return {
          ...current,
          ...saved,
          customerModerationVersion: 1,
          roles: (saved.roles ?? current.roles).map((role) => !saved.customerModerationVersion && (role.id === 'role_super' || role.id === 'role_admin') && !role.caps.includes('moderate_customers') ? { ...role, caps: [...role.caps, 'moderate_customers' as const] } : role),
          enterprise: {
            ...current.enterprise,
            ...saved.enterprise,
            startupBrand: { ...current.enterprise.startupBrand, ...saved.enterprise?.startupBrand },
          },
          // 公告的起止时间是相对种子生成时刻算的，旧浏览器里存的那份一定是过期的。
          // 种子里已有的公告只把时间窗刷成当前种子的值，标题正文等用户改过的内容照旧保留。
          announcements: (saved.announcements ?? current.announcements).map((a) => {
            const seeded = current.announcements.find((x) => x.id === a.id)
            return seeded ? { ...a, startAt: seeded.startAt, endAt: seeded.endAt } : a
          }),
          providerInstances: saved.providerInstances ?? current.providerInstances,
          providerLicenseActions: saved.providerLicenseActions ?? current.providerLicenseActions,
          chatRulesVersion: 1,
          policyMatrix: saved.chatRulesVersion ? (saved.policyMatrix ?? current.policyMatrix) : { ...(saved.policyMatrix ?? current.policyMatrix), 'dm.recall': { staff: (saved.policyMatrix ?? current.policyMatrix)['dm.recall']?.staff ?? true, customer: false } },
          policyNumbers: { ...current.policyNumbers, ...saved.policyNumbers },
          policyItems: (saved.policyItems ?? current.policyItems).map((item) => item.key === 'dm.edit' ? { ...item, level: 'P0' as const } : item.key === 'dm.recall' ? { ...item, label: '为所有人删除自己发出的消息', desc: '两端普通聊天里直接消失、不留占位，原文保留审计；按客户 / 坐席独立开关，时限见数值型策略' } : item),
          // 旧数据里「撤回」是独立状态，现在统一成删除：已撤回的一律按已删除处理，免得刷新后重新冒出来
          messages: (saved.messages ?? current.messages).map((m) => {
            const legacy = m as typeof m & { recalledAt?: string }
            if (!legacy.recalledAt) return m
            const { recalledAt: _r, ...rest } = legacy
            void _r
            return { ...rest, deletedAt: legacy.deletedAt ?? legacy.recalledAt }
          }),
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
