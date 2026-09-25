const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { reset, flush, store, rules, customerStatus, policy, loadSource } = require('./source-store.cjs')
const current = () => store.getState()
const seat = { kind: 'seat', id: 'seat_lin', staffId: 'st_lin' }
beforeEach(reset)

test('第十批：三档内置角色、坐席显示名与存储版本对齐', () => {
  const state = current()
  const { CAPABILITIES } = loadSource('src/domain/labels.ts')
  const { STORAGE_KEY } = loadSource('src/store/store.ts')
  const superRole = state.roles.find(role => role.id === 'role_super')
  const adminRole = state.roles.find(role => role.id === 'role_admin')
  assert.equal(superRole.name, '超级管理员')
  assert.deepEqual([...superRole.caps].sort(), Array.from(CAPABILITIES, capability => capability.key).sort())
  assert.deepEqual([...adminRole.caps].sort(), [...superRole.caps].filter(capability => capability !== 'manage_roles').sort())
  assert.equal(state.roles.find(role => role.id === 'role_cs').name, '客服')
  assert.deepEqual(state.roles.filter(role => role.builtin).map(role => role.id).sort(), ['role_admin', 'role_cs', 'role_super'])
  assert.equal(state.staff.find(staff => staff.id === 'st_admin').roleId, 'role_super')
  assert.equal(state.staff.find(staff => staff.id === 'st_lin').name, '林薇')
  assert.equal(state.staff.find(staff => staff.id === 'st_chen').name, '陈默')
  assert.deepEqual(state.seats.map(seatRecord => seatRecord.displayName), ['林晓明', '陈二宝', '客户服务'])
  assert.equal(STORAGE_KEY, 'yolink-demo-v17')
})

test('第十批：超级管理员不能删除或修改权限，自定义角色仍可编辑删除', () => {
  const protectedRole = current().roles.find(role => role.id === 'role_super')
  const auditCount = current().audit.length
  assert.equal(current().deleteRole('role_super', 'st_admin'), false)
  assert.equal(current().updateRole('role_super', { caps: [], name: '已改名' }, 'st_admin'), false)
  current().updateRoleCaps('role_super', [])
  assert.deepEqual(current().roles.find(role => role.id === 'role_super'), protectedRole)
  assert.equal(current().audit.length, auditCount)
  const custom = current().createRole({ name: '临时角色', desc: '', caps: [] }, 'st_admin')
  assert.ok(custom)
  assert.equal(current().updateRole(custom.id, { caps: ['broadcast'] }, 'st_admin'), true)
  assert.deepEqual([...current().roles.find(role => role.id === custom.id).caps], ['broadcast'])
  current().updateRoleCaps(custom.id, ['create_invite'])
  assert.deepEqual([...current().roles.find(role => role.id === custom.id).caps], ['create_invite'])
  assert.equal(current().deleteRole(custom.id, 'st_admin'), true)
})

test('第十批：管理员不能管理员工角色，也不能用另一入口改内置权限', () => {
  const custom = current().createRole({ name: '可删除角色', desc: '', caps: [] }, 'st_admin')
  current().updateStaff('st_zhao', { roleId: 'role_admin' }, 'st_admin')
  current().setSession({ adminStaffId: 'st_zhao' })
  const roles = structuredClone(current().roles)
  const auditCount = current().audit.length
  assert.equal(current().createRole({ name: '越权角色', desc: '', caps: ['manage_roles'] }, 'st_zhao'), null)
  assert.equal(current().updateRole(custom.id, { caps: ['manage_roles'] }, 'st_zhao'), false)
  assert.equal(current().deleteRole(custom.id, 'st_zhao'), false)
  current().updateRoleCaps(custom.id, ['manage_roles'])
  assert.deepEqual(structuredClone(current().roles), roles)
  assert.equal(current().audit.length, auditCount)
  current().setSession({ adminStaffId: 'st_admin' })
  assert.equal(current().updateRole('role_admin', { caps: ['manage_roles'] }, 'st_admin'), false)
  current().updateRoleCaps('role_admin', [])
  assert.deepEqual(structuredClone(current().roles), roles)
})

test('第十批：超级管理员不能停用，普通无坐席员工仍可停用和恢复', () => {
  const auditCount = current().audit.length
  assert.match(current().staffDisableBlocker('st_admin'), /超级管理员不能停用/)
  const denied = current().disableStaff('st_admin', 'st_zhao')
  assert.equal(denied.ok, false)
  assert.match(denied.error, /超级管理员不能停用/)
  assert.equal(current().staff.find(staff => staff.id === 'st_admin').status, 'active')
  assert.equal(current().audit.length, auditCount)
  assert.equal(current().disableStaff('st_wang', 'st_admin').ok, true)
  assert.equal(current().staff.find(staff => staff.id === 'st_wang').status, 'disabled')
  current().activateStaff('st_wang', 'st_admin')
  assert.equal(current().staff.find(staff => staff.id === 'st_wang').status, 'active')
})

test('第十批：最后一位超级管理员不能降级，普通员工可改角色', () => {
  const auditCount = current().audit.length
  assert.match(current().updateStaff('st_admin', { roleId: 'role_cs' }, 'st_zhao'), /最后一位超级管理员/)
  assert.equal(current().staff.find(staff => staff.id === 'st_admin').roleId, 'role_super')
  assert.equal(current().audit.length, auditCount)
  assert.equal(current().updateStaff('st_wang', { roleId: 'role_admin' }, 'st_admin'), null)
  assert.equal(current().staff.find(staff => staff.id === 'st_wang').roleId, 'role_admin')
  assert.equal(current().updateStaff('st_admin', { name: '周敏更新', roleId: 'role_super' }, 'st_admin'), null)
  assert.equal(current().staff.find(staff => staff.id === 'st_admin').name, '周敏更新')
  assert.match(current().updateStaff('st_admin', { roleId: '' }, 'st_zhao'), /最后一位超级管理员/)
  assert.match(current().updateStaff('st_admin', { status: 'disabled', id: 'replaced' }, 'st_zhao'), /只能修改员工姓名、邮箱与角色/)
  assert.equal(current().staff.find(staff => staff.id === 'st_admin').status, 'active')
})

test('第十批：有多位超级管理员时也不能替他人降级或停用', () => {
  assert.equal(current().updateStaff('st_wang', { roleId: 'role_super' }, 'st_admin'), null)
  const auditCount = current().audit.length
  assert.match(current().updateStaff('st_wang', { roleId: 'role_cs' }, 'st_admin'), /超级管理员不能改成其他角色/)
  assert.equal(current().disableStaff('st_wang', 'st_admin').ok, false)
  assert.equal(current().staff.find(staff => staff.id === 'st_wang').roleId, 'role_super')
  assert.equal(current().audit.length, auditCount)
})

test('第十批：坐席只接受接新中和暂停接新，拒绝旧停用状态', () => {
  assert.ok(current().seats.every(seatRecord => ['accepting', 'paused'].includes(seatRecord.status)))
  const auditCount = current().audit.length
  current().updateSeat('seat_lin', { status: 'disabled' }, 'st_admin')
  assert.equal(current().seats.find(seatRecord => seatRecord.id === 'seat_lin').status, 'accepting')
  assert.equal(current().audit.length, auditCount)
  current().updateSeat('seat_lin', { status: 'paused' }, 'st_admin')
  assert.equal(current().seats.find(seatRecord => seatRecord.id === 'seat_lin').status, 'paused')
  current().updateSeat('seat_lin', { status: 'accepting' }, 'st_admin')
  assert.equal(current().seats.find(seatRecord => seatRecord.id === 'seat_lin').status, 'accepting')
  const template = { ...current().seats[0], displayName: '新建测试' }
  const seatCount = current().seats.length
  assert.equal(current().createSeat({ ...template, status: 'disabled' }, 'st_admin'), null)
  assert.equal(current().seats.length, seatCount)
  assert.equal(current().createSeat({ ...template, status: 'paused' }, 'st_admin').status, 'paused')
})

test('第十批：暂停接新仅跳过新客分配，不影响已有会话与交接', () => {
  const { allocateSeats } = loadSource('src/domain/allocation.ts')
  const { seatsOfStaff } = loadSource('src/store/selectors.ts')
  const group = current().inviteGroups.find(inviteGroup => inviteGroup.rotatingSeatIds.includes('seat_lin') && inviteGroup.rotatingSeatIds.includes('seat_chen'))
  const configured = { ...group, rotationIndex: group.rotatingSeatIds.indexOf('seat_lin') }
  const seatMap = () => Object.fromEntries(current().seats.map(seatRecord => [seatRecord.id, seatRecord]))
  assert.equal(allocateSeats(configured, seatMap()).primarySeatId, 'seat_lin')
  current().updateSeat('seat_lin', { status: 'paused' }, 'st_admin')
  const allocation = allocateSeats(configured, seatMap())
  assert.equal(allocation.primarySeatId, 'seat_chen')
  assert.ok(allocation.skippedSeatIds.includes('seat_lin'))
  assert.equal(seatsOfStaff(current(), 'st_lin').some(seatRecord => seatRecord.id === 'seat_lin'), true)
  assert.match(current().staffDisableBlocker('st_lin'), /请先交接/)
  assert.equal(current().disableStaff('st_lin', 'st_admin').ok, false)
  send(dm().id, seat, '暂停接新仍可回复已有客户')
  current().handoverSeat('seat_lin', 'st_wang', '休假交接', 'st_admin')
  assert.equal(current().seats.find(seatRecord => seatRecord.id === 'seat_lin').operatorStaffId, 'st_wang')
})

test('第十批：许可只有系统到期日，模块只由企业启停', () => {
  assert.equal(Object.hasOwn(current().license, 'modules'), false)
  const instance = current().providerInstances.find(item => item.instanceId === current().license.instanceId)
  const expiry = new Date(instance.expiresAt)
  expiry.setFullYear(expiry.getFullYear() + 1)
  current().renewProviderInstance(instance.id, expiry.toISOString().slice(0, 10))
  assert.equal(Object.hasOwn(current().license, 'modules'), false)
  assert.notEqual(current().license.expiresAt, instance.expiresAt)
  current().toggleModule('wallet', false, 'st_admin')
  assert.equal(current().enterprise.modules.wallet, false)
  current().toggleModule('wallet', true, 'st_admin')
  assert.equal(current().enterprise.modules.wallet, true)
})

test('第十批：暂停服务拦截员工入口，恢复允许进入，到期不会自动暂停', () => {
  const { providerInstanceStatus, staffServiceBlocker } = loadSource('src/domain/providerLicense.ts')
  const instance = current().providerInstances.find(item => item.instanceId === current().license.instanceId)
  assert.equal(providerInstanceStatus({ ...instance, expiresAt: '2000-01-01T00:00:00.000Z' }), 'active')
  assert.equal(staffServiceBlocker(current()), null)
  current().stopProviderInstance(instance.id, '企业申请暂停')
  assert.equal(providerInstanceStatus(current().providerInstances.find(item => item.id === instance.id)), 'stopped')
  const before = structuredClone(current().session)
  assert.equal(current().setSession({ workbenchStaffId: 'st_chen', workbenchSeatId: 'seat_chen' }), '本企业服务已暂停，请联系管理员')
  assert.equal(current().setSession({ adminStaffId: 'st_zhao' }), '本企业服务已暂停，请联系管理员')
  assert.deepEqual(current().session, before)
  assert.equal(current().setSession({ phoneCustomerId: current().customers[0].id }), null)
  current().resumeProviderInstance(instance.id)
  assert.equal(staffServiceBlocker(current()), null)
  assert.equal(current().setSession({ workbenchStaffId: 'st_chen', workbenchSeatId: 'seat_chen' }), null)
  assert.equal(current().session.workbenchStaffId, 'st_chen')
})

test('第十批：日报只选超级管理员且无 App 渠道，拒绝无关接收人', () => {
  const { REPORT_CHANNEL_LABEL } = loadSource('src/domain/labels.ts')
  assert.equal(Object.hasOwn(REPORT_CHANNEL_LABEL, 'app'), false)
  const settings = structuredClone(current().dailyReport)
  for (const invalid of [
    { id: 'invalid', name: '无员工账号', channels: ['feishu'] },
    { id: 'invalid', name: '普通员工', staffId: 'st_lin', channels: ['feishu'] },
    { id: 'invalid', name: '周敏', staffId: 'st_admin', channels: ['app'] },
  ]) {
    current().updateDailyReportSettings({ recipients: [invalid] }, 'st_admin')
    assert.deepEqual(current().dailyReport, settings)
  }
  current().updateDailyReportSettings({ recipients: [{ id: 'valid', name: '不会采用的姓名', staffId: 'st_admin', channels: ['wecom', 'feishu'] }] }, 'st_admin')
  assert.equal(current().dailyReport.recipients[0].name, '周敏')
  current().sendDailyReportNow()
  assert.deepEqual([...current().dailyReportRecords[0].sentTo], ['周敏'])
  current().updateStaff('st_admin', { name: '周敏新姓名' }, 'st_admin')
  current().sendDailyReportNow()
  assert.deepEqual([...current().dailyReportRecords[0].sentTo], ['周敏新姓名'])
})

test('第十批：日报发送时重新核对超级管理员，不向失效接收人写成功记录', () => {
  store.setState({ dailyReport: { ...current().dailyReport, recipients: [{ id: 'invalid', name: '林薇', staffId: 'st_lin', channels: ['feishu'] }] } })
  const count = current().dailyReportRecords.length
  current().sendDailyReportNow()
  assert.equal(current().dailyReportRecords.length, count)
})

test('第十批：两类禁言及解除分别写入四个明确的审计事件', () => {
  const { AUDIT_LABEL } = loadSource('src/domain/labels.ts')
  const customerId = current().customers[0].id
  for (const [action, hours, event] of [
    ['muteCustomerAllGroups', 1, 'customer.group_mute'],
    ['muteCustomerAllGroups', 0, 'customer.group_unmute'],
    ['muteCustomerGlobally', 1, 'customer.mute'],
    ['muteCustomerGlobally', 0, 'customer.unmute'],
  ]) {
    current()[action](customerId, hours, 'st_admin')
    assert.equal(current().audit[0].type, event)
    assert.ok(AUDIT_LABEL[event])
  }
  assert.equal(current().customers[0].mutedAllUntil, null)
  assert.equal(current().customers[0].globalMutedUntil, null)
})

function renderPage(relative, component, props = {}) {
  const { createElement } = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  return renderToStaticMarkup(createElement(loadSource(relative)[component], props))
}

test('第十批界面：超级管理员编辑删除灰掉，普通角色编辑仍可用', () => {
  const html = renderPage('src/apps/admin/pages/RolesPage.tsx', 'RolesPage')
  const rows = html.match(/<tr\b[\s\S]*?<\/tr>/g)
  const superRow = rows.find(row => row.includes('全部权限，系统内置，不可删除'))
  assert.match(superRow, /<button[^>]*disabled=""[^>]*>编辑<\/button>/)
  assert.match(superRow, /<button[^>]*disabled=""[^>]*>删除<\/button>/)
  assert.match(html, /超级管理员权限固定为全部，不能修改/)
  const customRow = rows.find(row => row.includes('运营主管') && row.includes('编辑'))
  const editButton = customRow.match(/<button[^>]*>编辑<\/button>/)[0]
  assert.doesNotMatch(editButton, / disabled=/)
})

test('第十批界面：超级管理员停用与角色下拉灰掉并给出原因', () => {
  const listHtml = renderPage('src/apps/admin/pages/StaffPage.tsx', 'StaffPage')
  const superRow = listHtml.match(/<tr\b[\s\S]*?<\/tr>/g).find(row => row.includes('周敏'))
  assert.match(superRow, /<button[^>]*disabled=""[^>]*title="超级管理员不能停用"[^>]*>停用<\/button>/)
  const modalProps = { onClose() {}, staff: current().staff.find(staff => staff.id === 'st_admin') }
  const superHtml = renderPage('src/apps/admin/pages/StaffPage.parts.tsx', 'EditStaffModal', modalProps)
  assert.match(superHtml, /最后一位超级管理员不能改成其他角色/)
  assert.match(superHtml, /<select[^>]*disabled=""/)
  const ordinaryHtml = renderPage('src/apps/admin/pages/StaffPage.parts.tsx', 'EditStaffModal', { ...modalProps, staff: current().staff.find(staff => staff.id === 'st_lin') })
  assert.doesNotMatch(ordinaryHtml.match(/<select[^>]*>/)[0], / disabled=/)
  const createHtml = renderPage('src/apps/admin/pages/StaffPage.parts.tsx', 'CreateStaffModal', { onClose() {} })
  for (const roleId of ['role_super', 'role_admin', 'role_cs']) assert.ok(createHtml.includes(`value="${roleId}"`))
  assert.doesNotMatch(createHtml, /role_seat/)
})

test('第十批界面：坐席不再有停用，许可不再有逐模块开关和日期', () => {
  const seatsHtml = renderPage('src/apps/admin/pages/SeatsPage.tsx', 'SeatsPage')
  assert.match(seatsHtml, /暂停接新/)
  assert.doesNotMatch(seatsHtml, />停用<|停用坐席/)
  const licenseHtml = renderPage('src/apps/admin/pages/LicensePage.tsx', 'LicensePage')
  assert.match(licenseHtml, /许可到期时间/)
  assert.doesNotMatch(licenseHtml, /模块授权表|本期到期日|未授权/)
  const reportHtml = renderPage('src/apps/admin/pages/DailyReportPage.tsx', 'DailyReportPage')
  assert.match(reportHtml, /超级管理员/)
  assert.doesNotMatch(reportHtml, /App 推送|关联员工|不登录后台/)
})

test('第十批界面：客户只看到显示名与官方小标', () => {
  const customerId = current().customers.find(customer => current().customerSeats.some(link => link.customerId === customer.id && link.seatId === 'seat_lin')).id
  const html = renderPage('src/apps/phone/screens/ContactsScreen.tsx', 'ContactsScreen', { customerId, onOpen() {} })
  assert.match(html, /林晓明/)
  assert.match(html, />官方</)
  assert.doesNotMatch(html, /坐席|官方联系人|官方账号/)
})

test('第十批：群成员限制与解除使用新文案，账号封禁保持不变', () => {
  const { g: group, actor: customerActor } = groupContext()
  const actor = { seatId: group.ownerSeatId, staffId: current().seats.find(seatRecord => seatRecord.id === group.ownerSeatId).operatorStaffId }
  const customer = current().customers.find(item => item.id === customerActor.id)
  const html = renderPage('src/apps/workbench/components/group/GroupMemberModals.tsx', 'RestrictModal', { group, actor, customer, kind: 'ban', onClose() {} })
  assert.match(html, /移出并禁止再进/)
  assert.match(html, /解除禁止/)
  assert.doesNotMatch(html, /封禁|解封/)
  current().restrictGroupMember(group.id, customer.id, 'ban', 1, '测试群限制', actor)
  assert.match(current().audit[0].detail, /移出并禁止再进/)
  current().liftGroupRestriction(group.id, customer.id, actor)
  assert.match(current().audit[0].detail, /解除禁止/)
  assert.equal(current().customers.find(item => item.id === customer.id).bannedAt, customer.bannedAt)
})
test('AI 与群活跃助手只保留占位，不生成业务数据或群成员', () => {
  const state = current()
  for (const field of ['bots', 'botScripts', 'botRules', 'botRuns', 'botsPausedAll', 'knowledge', 'aiSettings', 'aiEvents']) {
    assert.equal(Object.hasOwn(state, field), false, `不应保留 ${field}`)
  }
  for (const group of state.chatGroups) {
    assert.equal(Object.hasOwn(group, 'memberBotIds'), false)
    assert.ok(group.memberSeatIds.every(memberId => state.seats.some(member => member.id === memberId)))
    assert.ok(group.memberCustomerIds.every(memberId => state.customers.some(member => member.id === memberId)))
  }
  assert.ok(state.messages.every(message => message.senderKind !== 'bot'))
  assert.ok(state.messages.every(message => !Object.hasOwn(message, 'aiDraftUsed') && !Object.hasOwn(message, 'botRuleId')))
  assert.ok(state.roles.every(role => !role.caps.includes('manage_bots')))
  assert.ok(state.staff.every(staff => !Object.hasOwn(staff.prefs, 'aiSuggest')))
  assert.equal(Object.hasOwn(state.license, 'modules'), false)
  assert.equal(Object.hasOwn(state.profileSync, 'shareWithAi'), false)
})
function send(convId, actor, text, extra = {}) {
  const result = current().queueChatMessage({ convId, actor, text, ...extra })
  assert.equal(result.ok, true, result.reason)
  flush()
  return current().messages.find(m => m.id === result.id)
}
function dm() { return current().conversations.find(c => c.kind === 'dm' && c.seatId === seat.id && !current().customers.find(x => x.id === c.customerId)?.bannedAt && !current().customers.find(x => x.id === c.customerId)?.blockedSeatIds.includes(seat.id)) }
function groupContext() {
  const g = current().chatGroups.find(g => g.id === 'cg_community')
  // 风控不是本测试对象，使用已存在群成员并取消本次内存夹具的观察期。
  const ids = g.memberCustomerIds.slice(0, 2)
  store.setState({ customers: current().customers.map(c => ids.includes(c.id) ? { ...c, watchUntil: undefined, bannedAt: null, mutedAllUntil: null, globalMutedUntil: null } : c) })
  return { g, conv: current().conversations.find(c => c.chatGroupId === g.id), actor: { kind: 'customer', id: ids[0] }, other: { kind: 'customer', id: ids[1] } }
}
function addWord(scope, action, word = '测试词') {
  store.setState({ sensitiveWords: [...current().sensitiveWords, { id: 'rule_test', word, scope, action, replaceWith: '已替换' }] })
}
function singleInput(text) {
  return { name: '规则验收', seatId: seat.id, operatorId: seat.staffId, targetKind: 'friends', targetDesc: '测试客户', text, customerIds: [dm().customerId] }
}

function groupPermissionFixture(perms = []) {
  const { g: group, conv, actor: customer } = groupContext()
  const actor = { seatId: 'seat_lin', staffId: 'st_lin' }
  const targetSeatId = 'seat_cs'
  const addedCustomerId = current().customers.find(item => !item.deletedAt && item.id !== customer.id).id
  const messageId = current().messages.find(message => message.convId === conv.id).id
  store.setState({
    chatGroups: current().chatGroups.map(item => item.id === group.id ? {
      ...item, ownerSeatId: 'seat_chen', memberSeatIds: ['seat_chen', actor.seatId], official: false,
      admins: [
        { memberKind: 'seat', memberId: actor.seatId, perms, promotedBySeatId: 'seat_chen', promotedAt: new Date().toISOString() },
        { memberKind: 'customer', memberId: customer.id, perms: ['can_change_info'], promotedBySeatId: 'seat_chen', promotedAt: new Date().toISOString() },
      ],
      memberCustomerIds: item.memberCustomerIds.filter(customerId => customerId !== addedCustomerId),
      pinnedMessageIds: [], requiredTitleId: null, maxMembers: 10000,
    } : item),
  })
  return { groupId: group.id, actor, customerId: customer.id, addedCustomerId, messageId, targetSeatId, linkId: group.inviteLinks[0].id }
}

const groupPermissionCases = [
  ['设置', 'can_change_info', fixture => current().updateGroupSettings(fixture.groupId, { allMuted: true }, fixture.actor)],
  ['公告', 'can_change_info', fixture => current().setGroupAnnouncement(fixture.groupId, { title: '权限验收', content: '群公告', notify: true }, fixture.actor)],
  ['置顶', 'can_pin_messages', fixture => current().pinMessage(fixture.groupId, fixture.messageId, true, fixture.actor)],
  ['取消置顶', 'can_pin_messages', fixture => current().unpinMessage(fixture.groupId, fixture.messageId, fixture.actor)],
  ['拉客户', 'can_invite_users', fixture => current().addGroupMembers(fixture.groupId, [fixture.addedCustomerId], fixture.actor)],
  ['拉坐席', 'can_invite_users', fixture => current().addGroupSeat(fixture.groupId, fixture.targetSeatId, fixture.actor)],
  ['踢人', 'can_restrict_members', fixture => current().kickGroupMember(fixture.groupId, fixture.customerId, true, fixture.actor)],
  ['任命', 'can_promote_members', fixture => current().promoteGroupAdmin(fixture.groupId, 'customer', fixture.customerId, ['can_invite_users'], fixture.actor)],
  ['撤销管理员', 'can_promote_members', fixture => current().demoteGroupAdmin(fixture.groupId, 'customer', fixture.customerId, fixture.actor)],
  ['移出并禁止再进', 'can_restrict_members', fixture => current().restrictGroupMember(fixture.groupId, fixture.customerId, 'ban', null, '测试', fixture.actor)],
  ['禁言', 'can_restrict_members', fixture => current().restrictGroupMember(fixture.groupId, fixture.customerId, 'mute', 1, '测试', fixture.actor)],
  ['解除限制', 'can_restrict_members', fixture => current().liftGroupRestriction(fixture.groupId, fixture.customerId, fixture.actor)],
  ['创建链接', 'can_invite_users', fixture => current().createGroupInviteLink(fixture.groupId, { name: '测试', expiresAt: null, maxUses: null }, fixture.actor)],
  ['撤销链接', 'can_invite_users', fixture => current().revokeGroupInviteLink(fixture.groupId, fixture.linkId, fixture.actor)],
  ['重建主链接', 'can_invite_users', fixture => current().regenerateGroupMainLink(fixture.groupId, fixture.actor)],
]

for (const [label, permission, invoke] of groupPermissionCases) {
  test(`权限兜底：群${label}无对应权限时拒绝，数据、日志与审计均不变`, () => {
    const fixture = groupPermissionFixture([permission === 'can_pin_messages' ? 'can_invite_users' : 'can_pin_messages'])
    const before = current()
    const result = invoke(fixture)
    assert.equal(result.ok, false)
    assert.match(result.reason, /没有.*权限/)
    assert.equal(current(), before)
  })
  test(`权限兜底：群${label}只有对应单项权限时允许`, () => {
    const fixture = groupPermissionFixture([permission])
    const before = current()
    const result = invoke(fixture)
    assert.notEqual(result?.ok, false)
    assert.equal(current().groupLogs.length, before.groupLogs.length + 1)
    assert.equal(current().audit.length, before.audit.length + 1)
    assert.equal(current().audit[0].actorStaffId, fixture.actor.staffId)
    assert.notEqual(current().chatGroups, before.chatGroups)
  })
  test(`权限兜底：群${label}拒绝冒用坐席、无效员工和停用员工`, () => {
    const fixture = groupPermissionFixture([permission])
    for (const staffId of ['st_admin', 'missing']) {
      const before = current()
      assert.equal(invoke({ ...fixture, actor: { ...fixture.actor, staffId } }).ok, false)
      assert.equal(current(), before)
    }
    store.setState({ staff: current().staff.map(staff => staff.id === fixture.actor.staffId ? { ...staff, status: 'disabled' } : staff) })
    const before = current()
    assert.equal(invoke(fixture).ok, false)
    assert.equal(current(), before)
  })
}

test('权限兜底：群主与有管理所有群能力的真实实操员工允许；不存在的群或坐席拒绝', () => {
  const fixture = groupPermissionFixture()
  const owner = { seatId: 'seat_chen', staffId: current().seats.find(item => item.id === 'seat_chen').operatorStaffId }
  assert.equal(current().setGroupAnnouncement(fixture.groupId, null, owner), undefined)
  store.setState({ roles: current().roles.map(role => role.id === 'role_cs' ? { ...role, caps: [...role.caps, 'manage_groups'] } : role) })
  assert.equal(current().setGroupAnnouncement(fixture.groupId, null, fixture.actor), undefined)
  for (const input of [{ ...fixture, groupId: 'missing' }, { ...fixture, actor: { ...fixture.actor, seatId: 'missing' } }]) {
    const before = current()
    assert.equal(current().setGroupAnnouncement(input.groupId, null, input.actor).ok, false)
    assert.equal(current(), before)
  }
})

test('权限兜底：有权限可取消真实置顶和解除真实限制，无权限时原记录保留', () => {
  const fixture = groupPermissionFixture(['can_pin_messages', 'can_restrict_members'])
  const group = () => current().chatGroups.find(item => item.id === fixture.groupId)
  current().pinMessage(fixture.groupId, fixture.messageId, false, fixture.actor)
  current().restrictGroupMember(fixture.groupId, fixture.customerId, 'mute', 1, '验收', fixture.actor)
  assert.ok(group().pinnedMessageIds.includes(fixture.messageId))
  assert.ok(group().restrictions.some(item => item.customerId === fixture.customerId))
  store.setState({ chatGroups: current().chatGroups.map(item => item.id === fixture.groupId ? { ...item, admins: item.admins.map(admin => admin.memberId === fixture.actor.seatId ? { ...admin, perms: [] } : admin) } : item) })
  const before = current()
  assert.equal(current().unpinMessage(fixture.groupId, fixture.messageId, fixture.actor).ok, false)
  assert.equal(current().liftGroupRestriction(fixture.groupId, fixture.customerId, fixture.actor).ok, false)
  assert.equal(current(), before)
  const owner = { seatId: 'seat_chen', staffId: 'st_chen' }
  current().unpinMessage(fixture.groupId, fixture.messageId, owner)
  current().liftGroupRestriction(fixture.groupId, fixture.customerId, owner)
  assert.equal(group().pinnedMessageIds.includes(fixture.messageId), false)
  assert.equal(group().restrictions.some(item => item.customerId === fixture.customerId), false)
})

test('权限兜底：交接拒绝不存在、停用、同一员工与不存在的坐席', () => {
  store.setState({ staff: current().staff.map(staff => staff.id === 'st_wang' ? { ...staff, status: 'disabled' } : staff) })
  for (const [seatId, staffId, reason] of [['seat_lin', 'missing', /不存在/], ['seat_lin', 'st_wang', /停用/], ['seat_lin', 'st_lin', /当前实操员工/], ['missing', 'st_wang', /坐席不存在/]]) {
    const before = current()
    assert.match(current().handoverSeat(seatId, staffId, '交接验收', 'st_admin'), reason)
    assert.equal(current(), before)
  }
})

test('权限兜底：合法交接保留记录，旧员工失去会话与当前坐席，新员工可访问', () => {
  const conversation = dm()
  const before = current()
  assert.equal(current().handoverSeat('seat_lin', 'st_wang', '交接验收', 'st_admin'), null)
  assert.equal(current().seats.find(item => item.id === 'seat_lin').operatorStaffId, 'st_wang')
  assert.notEqual(current().session.workbenchSeatId, 'seat_lin')
  assert.equal(current().handovers.length, before.handovers.length + 1)
  assert.equal(current().handovers.at(-1).fromStaffId, 'st_lin')
  assert.equal(current().handovers.at(-1).toStaffId, 'st_wang')
  assert.equal(current().audit[0].type, 'seat.handover')
  assert.equal(rules.actorCanView(current(), conversation.id, seat), false)
  assert.equal(rules.actorCanView(current(), conversation.id, { ...seat, staffId: 'st_wang' }), true)
})

test('权限兜底：updateSeat 拒绝任何实操员工字段，允许普通资料更新', () => {
  for (const operatorStaffId of ['st_wang', 'st_lin', undefined]) {
    const before = current()
    assert.match(current().updateSeat('seat_lin', { displayName: '不应生效', operatorStaffId }, 'st_admin'), /只能通过交接/)
    assert.equal(current(), before)
  }
  assert.equal(current().updateSeat('seat_lin', { displayName: '资料更新', status: 'paused' }, 'st_admin'), null)
  assert.equal(current().seats.find(item => item.id === 'seat_lin').displayName, '资料更新')
  assert.equal(current().seats.find(item => item.id === 'seat_lin').operatorStaffId, 'st_lin')
})

test('权限兜底：创建坐席只允许存在且在职的实操员工', () => {
  const template = { ...current().seats[0], displayName: '权限验收' }
  store.setState({ staff: current().staff.map(staff => staff.id === 'st_wang' ? { ...staff, status: 'disabled' } : staff) })
  for (const operatorStaffId of ['missing', 'st_wang']) {
    const before = current()
    assert.equal(current().createSeat({ ...template, operatorStaffId }, 'st_admin'), null)
    assert.equal(current(), before)
  }
  const created = current().createSeat({ ...template, operatorStaffId: 'st_lin' }, 'st_admin')
  assert.equal(created.operatorStaffId, 'st_lin')
  assert.ok(current().seats.includes(created))
})

test('权限兜底：创建员工接手多个坐席逐一交接，旧工作台失效且未选坐席不变', () => {
  const selected = ['seat_lin', 'seat_chen']
  const before = current()
  const created = current().createStaff({ name: '接手员工', username: 'handover-test', roleId: 'role_cs', withSeat: false, assignSeatIds: [...selected, 'seat_lin', 'missing'] }, 'st_admin')
  assert.equal(current().handovers.length, before.handovers.length + selected.length)
  assert.equal(current().audit.filter(entry => entry.type === 'seat.handover').length, before.audit.filter(entry => entry.type === 'seat.handover').length + selected.length)
  for (const seatId of selected) {
    assert.equal(current().seats.find(item => item.id === seatId).operatorStaffId, created.id)
    assert.equal(current().handovers.findLast(entry => entry.seatId === seatId).toStaffId, created.id)
  }
  assert.notEqual(current().session.workbenchSeatId, 'seat_lin')
  assert.ok(current().seats.filter(item => !selected.includes(item.id)).every(item => item === before.seats.find(original => original.id === item.id)))
})

test('权限兜底：新建员工不接手已有坐席时不产生交接，允许同时创建同名坐席', () => {
  const before = current()
  const created = current().createStaff({ name: '新员工', username: 'new-test', roleId: 'role_cs', withSeat: true }, 'st_admin')
  assert.equal(current().handovers, before.handovers)
  assert.ok(current().seats.slice(0, before.seats.length).every((item, index) => item === before.seats[index]))
  assert.equal(current().seats.at(-1).operatorStaffId, created.id)
  assert.equal(current().session.workbenchSeatId, before.session.workbenchSeatId)
})

test('权限兜底：主归属实操员工、管理员、超级管理员均可重置客户密码', () => {
  const customerId = dm().customerId
  store.setState({
    customerSeats: current().customerSeats.map(link => link.customerId === customerId ? { ...link, primary: link.seatId === 'seat_lin' } : link),
    staff: current().staff.map(staff => staff.id === 'st_wang' ? { ...staff, roleId: 'role_admin' } : staff),
  })
  for (const staffId of ['st_lin', 'st_wang', 'st_admin']) {
    const before = current()
    const result = current().resetCustomerPassword(customerId, staffId)
    assert.equal(result.ok, true)
    assert.ok(result.password.length > 0)
    assert.equal(current().audit.length, before.audit.length + 1)
    assert.equal(current().audit[0].actorStaffId, staffId)
    assert.equal(current().customers.find(customer => customer.id === customerId).mustChangePassword, true)
  }
})

test('权限兜底：非主归属员工、停用员工与不存在客户拒绝重置，不生成密码或成功审计', () => {
  const customerId = dm().customerId
  store.setState({
    customerSeats: current().customerSeats.map(link => link.customerId === customerId ? { ...link, primary: link.seatId === 'seat_chen' } : link),
    staff: current().staff.map(staff => staff.id === 'st_admin' ? { ...staff, status: 'disabled' } : staff),
  })
  const originalRandom = Math.random
  let randomCalls = 0
  Math.random = () => { randomCalls += 1; return 0.5 }
  try {
    for (const [target, staffId] of [[customerId, 'st_lin'], [customerId, 'missing'], [customerId, 'st_admin'], ['missing', 'st_lin']]) {
      const before = current()
      const result = current().resetCustomerPassword(target, staffId)
      assert.equal(result.ok, false)
      assert.ok(result.reason)
      assert.equal(Object.hasOwn(result, 'password'), false)
      assert.equal(current(), before)
    }
    assert.equal(randomCalls, 0)
  } finally {
    Math.random = originalRandom
  }
})

const customerModerationCases = [
  ['封禁', (customerId, staffId) => current().setCustomerBan(customerId, true, staffId), customer => !!customer.bannedAt],
  ['解除封禁', (customerId, staffId) => current().setCustomerBan(customerId, false, staffId), customer => customer.bannedAt === null],
  ['群聊禁言', (customerId, staffId) => current().muteCustomerAllGroups(customerId, 1, staffId), customer => customerStatus.isAllGroupsMutedNow(customer)],
  ['解除群聊禁言', (customerId, staffId) => current().muteCustomerAllGroups(customerId, 0, staffId), customer => customer.mutedAllUntil === null],
  ['全部禁言', (customerId, staffId) => current().muteCustomerGlobally(customerId, 1, staffId), customer => customerStatus.isGlobalMutedNow(customer)],
  ['解除全部禁言', (customerId, staffId) => current().muteCustomerGlobally(customerId, 0, staffId), customer => customer.globalMutedUntil === null],
  ['强制下线', (customerId, staffId) => current().forceLogoutCustomer(customerId, staffId), customer => !!customer.sessionsRevokedAt],
]

for (const [label, invoke, verify] of customerModerationCases) {
  test(`权限兜底：客户${label}按能力允许非主归属员工，拒绝无能力的主归属员工`, () => {
    const customerId = dm().customerId
    store.setState({ customerSeats: current().customerSeats.map(link => link.customerId === customerId ? { ...link, primary: link.seatId === 'seat_lin' } : link) })
    const before = current()
    assert.match(invoke(customerId, 'st_lin'), /没有客户处置权限/)
    assert.equal(current(), before)
    store.setState({
      roles: [...current().roles, { id: 'role_moderator', name: '客户处置', builtin: false, caps: ['moderate_customers'] }],
      staff: current().staff.map(staff => staff.id === 'st_wang' ? { ...staff, roleId: 'role_moderator' } : staff),
    })
    assert.equal(invoke(customerId, 'st_wang'), null)
    assert.equal(verify(current().customers.find(customer => customer.id === customerId)), true)
    assert.equal(current().audit[0].actorStaffId, 'st_wang')
    assert.equal(invoke(customerId, 'st_admin'), null)
    store.setState({ roles: current().roles.map(role => role.id === 'role_moderator' ? { ...role, caps: [] } : role) })
    const revoked = current()
    assert.match(invoke(customerId, 'st_wang'), /没有客户处置权限/)
    assert.equal(current(), revoked)
    store.setState({ staff: current().staff.map(staff => staff.id === 'st_admin' ? { ...staff, status: 'disabled' } : staff) })
    const disabled = current()
    assert.match(invoke(customerId, 'st_admin'), /停用/)
    assert.match(invoke('missing', 'st_wang'), /客户不存在/)
    assert.match(invoke(customerId, 'missing'), /员工不存在/)
    assert.equal(current(), disabled)
  })
}

test('权限兜底：旧存档只为内置管理员补客户处置能力，不给客服或自定义角色授权', () => {
  const merge = store.persist.getOptions().merge
  const roles = current().roles.map(role => ({ ...role, caps: role.caps.filter(capability => capability !== 'moderate_customers') }))
  const migrated = merge({ roles }, current())
  for (const role of migrated.roles) assert.equal(role.caps.includes('moderate_customers'), ['role_super', 'role_admin'].includes(role.id))
  assert.equal(migrated.customerModerationVersion, 1)
  const subsequent = merge({ roles, customerModerationVersion: 1 }, current())
  assert.ok(subsequent.roles.every(role => !role.caps.includes('moderate_customers')))
})

for (const exit of ['主动退群', '移出并禁止再进']) {
  test(`权限兜底：客户管理员${exit}后重新入群只能是普通成员`, () => {
    const fixture = groupPermissionFixture(['can_restrict_members', 'can_invite_users'])
    const group = () => current().chatGroups.find(item => item.id === fixture.groupId)
    assert.equal(policy.groupRoleOf(group(), 'customer', fixture.customerId), 'admin')
    if (exit === '主动退群') current().customerLeaveGroup(fixture.groupId, fixture.customerId)
    else current().restrictGroupMember(fixture.groupId, fixture.customerId, 'ban', null, '验收', fixture.actor)
    assert.equal(group().memberCustomerIds.includes(fixture.customerId), false)
    assert.equal(policy.groupRoleOf(group(), 'customer', fixture.customerId), 'none')
    if (exit !== '主动退群') {
      assert.equal(current().addGroupMembers(fixture.groupId, [fixture.customerId], fixture.actor).added, 0)
      assert.equal(current().liftGroupRestriction(fixture.groupId, fixture.customerId, fixture.actor), undefined)
    }
    assert.equal(current().addGroupMembers(fixture.groupId, [fixture.customerId], fixture.actor).added, 1)
    assert.equal(policy.groupRoleOf(group(), 'customer', fixture.customerId), 'member')
    assert.equal(policy.groupPerm(group(), 'customer', fixture.customerId, 'can_change_info'), false)
  })
}

test('权限兜底：群内禁言不清管理员身份，官方群拒绝退群且保留原身份', () => {
  const fixture = groupPermissionFixture(['can_restrict_members'])
  const group = () => current().chatGroups.find(item => item.id === fixture.groupId)
  current().restrictGroupMember(fixture.groupId, fixture.customerId, 'mute', 1, '验收', fixture.actor)
  assert.equal(policy.groupRoleOf(group(), 'customer', fixture.customerId), 'admin')
  store.setState({ chatGroups: current().chatGroups.map(item => item.id === fixture.groupId ? { ...item, official: true } : item) })
  const before = current()
  current().customerLeaveGroup(fixture.groupId, fixture.customerId)
  assert.equal(current().chatGroups, before.chatGroups)
  assert.equal(current().messages, before.messages)
  assert.equal(current().groupLogs, before.groupLogs)
  assert.equal(policy.groupRoleOf(group(), 'customer', fixture.customerId), 'admin')
})

function renderCurrentState(render) {
  const React = require('react')
  const originalUseSyncExternalStore = React.useSyncExternalStore
  React.useSyncExternalStore = (subscribe, getSnapshot) => originalUseSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  try {
    return render()
  } finally {
    React.useSyncExternalStore = originalUseSyncExternalStore
  }
}

function renderCurrentPage(relative, component, props = {}) {
  return renderCurrentState(() => renderPage(relative, component, props))
}

function buttonByText(html, text) {
  const button = html.match(/<button\b[\s\S]*?<\/button>/g)?.find(item => item.includes(text))
  assert.ok(button, `找不到按钮：${text}`)
  return button
}

test('权限兜底界面：坐席编辑只读展示实操员工并提供交接，创建可选择在职员工', () => {
  const seatRecord = current().seats.find(item => item.id === 'seat_lin')
  const props = { onClose() {}, onHandover() {} }
  const editing = renderCurrentPage('src/apps/admin/pages/SeatsPage.parts.tsx', 'SeatEditModal', { ...props, seat: seatRecord })
  assert.match(editing, /林薇/)
  assert.doesNotMatch(editing, /<select/)
  assert.doesNotMatch(buttonByText(editing, '交接'), / disabled=/)
  store.setState({ staff: current().staff.map(staff => staff.id === 'st_wang' ? { ...staff, status: 'disabled' } : staff) })
  const creating = renderCurrentPage('src/apps/admin/pages/SeatsPage.parts.tsx', 'SeatEditModal', props)
  assert.match(creating, /<option value="st_lin"/)
  assert.doesNotMatch(creating, /<option value="st_wang"/)
  const handover = renderCurrentPage('src/apps/admin/pages/SeatsPage.parts.tsx', 'HandoverModal', { ...props, seat: seatRecord })
  assert.doesNotMatch(handover, /<option value="st_lin"|<option value="st_wang"/)
  assert.match(handover, /<option value="st_chen"/)
})

test('权限兜底界面：主归属客服只能重置密码，非主归属管理员可处置和重置', () => {
  const customerId = dm().customerId
  store.setState({ customerSeats: current().customerSeats.map(link => link.customerId === customerId ? { ...link, primary: link.seatId === 'seat_lin' } : link) })
  const customer = current().customers.find(item => item.id === customerId)
  const props = { c: customer, open: true, onClose() {} }
  const render = () => renderCurrentPage('src/apps/workbench/components/CustomerActions.tsx', 'CustomerActions', props)
  const ordinary = render()
  assert.doesNotMatch(buttonByText(ordinary, '重置密码'), / disabled=/)
  for (const label of ['强制下线', '群聊禁言', '全部禁言', '封禁']) {
    assert.match(buttonByText(ordinary, label), / disabled=""/)
    assert.match(buttonByText(ordinary, label), /没有客户处置权限/)
  }
  store.setState({ session: { ...current().session, workbenchStaffId: 'st_wang', workbenchSeatId: null } })
  assert.match(buttonByText(render(), '重置密码'), / disabled=""/)
  store.setState({ staff: current().staff.map(staff => staff.id === 'st_wang' ? { ...staff, roleId: 'role_admin' } : staff) })
  const admin = render()
  for (const label of ['重置密码', '强制下线', '群聊禁言', '全部禁言', '封禁']) assert.doesNotMatch(buttonByText(admin, label), / disabled=/)
})

test('权限兜底界面：后台客户处置同样受员工能力控制', () => {
  const customer = current().customers.find(item => item.id === dm().customerId)
  const render = () => renderCurrentPage('src/apps/admin/pages/CustomersAdminPage.controls.tsx', 'CustomerControlSection', { c: customer })
  assert.doesNotMatch(buttonByText(render(), '下线'), / disabled=/)
  store.setState({ session: { ...current().session, adminStaffId: 'st_lin' } })
  assert.match(buttonByText(render(), '下线'), / disabled=""/)
})

test('权限兜底界面：客户列表封禁入口无处置能力禁用，有能力时启用', () => {
  coverageFixture()
  const { createElement } = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const { MemoryRouter } = require('react-router-dom')
  const { CustomersPage } = loadSource('src/apps/workbench/pages/CustomersPage.tsx')
  const render = () => renderCurrentState(() => renderToStaticMarkup(createElement(MemoryRouter, null, createElement(CustomersPage))))
  assert.match(buttonByText(render(), '封禁'), / disabled=""/)
  store.setState({ roles: current().roles.map(role => role.id === 'role_cs' ? { ...role, caps: [...role.caps, 'moderate_customers'] } : role) })
  assert.doesNotMatch(buttonByText(render(), '封禁'), / disabled=/)
})

test('权限兜底界面：全员禁言和慢速模式与动作层统一使用修改群信息权限', () => {
  const fixture = groupPermissionFixture()
  const group = current().chatGroups.find(item => item.id === fixture.groupId)
  const render = permission => renderCurrentPage('src/apps/workbench/components/group/GroupSettingsPanel.tsx', 'GroupSettingsPanel', { group, actor: fixture.actor, officialEditable: false, perm: requested => requested === permission })
  const denied = render('can_restrict_members')
  assert.match(denied.match(/<button[^>]+role="switch"[^>]*>/)[0], / disabled=""/)
  assert.match(denied.match(/<select[^>]*>/)[0], / disabled=""/)
  const allowed = render('can_change_info')
  assert.doesNotMatch(allowed.match(/<button[^>]+role="switch"[^>]*>/)[0], / disabled=/)
  assert.doesNotMatch(allowed.match(/<select[^>]*>/)[0], / disabled=/)
})

test('权限兜底界面：没有群公告权限隐藏编辑入口，有权限显示；旧实操身份也不可用', () => {
  const fixture = groupPermissionFixture()
  const group = () => current().chatGroups.find(item => item.id === fixture.groupId)
  const render = () => renderCurrentPage('src/apps/workbench/components/group/GroupAnnouncementPanel.tsx', 'GroupAnnouncementPanel', {
    group: group(), actor: fixture.actor, perm: permission => policy.seatGroupPerm(current(), group(), fixture.actor.seatId, fixture.actor.staffId, permission),
  })
  assert.doesNotMatch(render(), />编辑<|>删除</)
  store.setState({ chatGroups: current().chatGroups.map(item => item.id === fixture.groupId ? { ...item, admins: item.admins.map(admin => admin.memberId === fixture.actor.seatId ? { ...admin, perms: ['can_change_info'] } : admin) } : item) })
  assert.doesNotMatch(buttonByText(render(), '编辑'), / disabled=/)
  current().handoverSeat(fixture.actor.seatId, 'st_wang', '权限失效', 'st_admin')
  assert.doesNotMatch(render(), />编辑<|>删除</)
})

test('权限兜底界面：后台无实操坐席时只读，分配自己的坐席后才能管理群', () => {
  const { createElement } = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const { MemoryRouter, Routes, Route } = require('react-router-dom')
  const { ChatGroupDetailPage } = loadSource('src/apps/admin/pages/ChatGroupDetailPage.tsx')
  renderCurrentState(() => {
    const render = () => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/admin/groups/cg_community'] }, createElement(Routes, null, createElement(Route, { path: '/admin/groups/:groupId', element: createElement(ChatGroupDetailPage) }))))
    const readonly = render()
    assert.match(readonly, /只读：没有实操坐席/)
    assert.doesNotMatch(readonly, />编辑<|>拉人<|以群主坐席身份/)
    current().handoverSeat('seat_cs', 'st_admin', '后台群管理', 'st_admin')
    const allowed = render()
    assert.match(allowed, /当前实操坐席：/)
    assert.doesNotMatch(buttonByText(allowed, '编辑'), / disabled=/)
  })
})

function coverageFixture(change = {}) {
  const conversation = dm()
  const customer = current().customers.find(item => item.id === conversation.customerId)
  store.setState({
    customers: [{ ...customer, deletedAt: null, bannedAt: null, globalMutedUntil: null, mutedAllUntil: null, blockedSeatIds: [], ...change }],
    customerSeats: [{ customerId: customer.id, seatId: 'seat_lin', primary: true }],
    conversations: [conversation], messages: [], broadcasts: [],
    enterprise: { ...current().enterprise, broadcastPerCustomerPerDay: 10, broadcastPerStaffPerDay: 100 },
  })
  return { customerId: customer.id, conversation, at: new Date().toISOString() }
}

function assertBroadcastParity(fixture, reason) {
  const { planCoverage } = loadSource('src/domain/broadcastCoverage.ts')
  const before = current()
  const operatorId = before.seats.find(item => item.id === 'seat_lin')?.operatorStaffId ?? ''
  const plan = planCoverage(before, ['seat_lin'], fixture.at)
  assert.equal(rules.seatBroadcastSkipReason(before, fixture.conversation.id, 'seat_lin', operatorId, false, fixture.at), reason)
  assert.equal(plan.skips[0]?.reason, reason)
  assert.equal(plan.deliveries.length, reason ? 0 : 1)
  if (reason) assert.equal(plan.skipReasons[reason], 1)
  const single = current().sendBroadcast({ name: '单坐席验收', seatId: 'seat_lin', operatorId, targetKind: 'friends', targetDesc: '验收', text: '权限验收', customerIds: [fixture.customerId] })
  const singleRecord = current().broadcasts[0]
  store.setState(before)
  const coverage = current().sendCoverageBroadcast({ name: '覆盖验收', seatIds: ['seat_lin'], operatorId: 'st_admin', text: '权限验收' })
  assert.equal(coverage.sent, single.sent)
  assert.equal(coverage.skipped, single.skipped)
  assert.deepEqual({ ...current().broadcasts[0].skipReasons }, { ...singleRecord.skipReasons })
  if (reason) {
    assert.equal(singleRecord.skipReasons[reason], 1)
    assert.equal(current().messages.length, before.messages.length)
  }
}

for (const [label, change, reason] of [
  ['正常', {}, undefined],
  ['注销', { deletedAt: '2026-01-01T00:00:00.000Z' }, 'deleted'],
  ['封禁', { bannedAt: '2026-01-01T00:00:00.000Z' }, 'banned'],
  ['全部禁言', { globalMutedUntil: '9999-12-31T00:00:00.000Z' }, 'globalMuted'],
  ['屏蔽坐席', { blockedSeatIds: ['seat_lin'] }, 'blocked'],
  ['群聊禁言不影响私聊群发', { mutedAllUntil: '9999-12-31T00:00:00.000Z' }, undefined],
]) {
  test(`权限兜底：全覆盖与单坐席群发对${label}客户的投递和跳过原因一致`, () => {
    assertBroadcastParity(coverageFixture(change), reason)
  })
}

for (const stateChange of ['员工不存在', '员工停用', '坐席不存在', '没有会话', '没有会话且员工停用', '暂停接新', '禁止文本发送']) {
  test(`权限兜底：全覆盖与单坐席群发在${stateChange}时一致`, () => {
    const fixture = coverageFixture()
    let reason = 'senderUnavailable'
    if (stateChange.includes('员工不存在')) store.setState({ seats: current().seats.map(item => item.id === 'seat_lin' ? { ...item, operatorStaffId: 'missing' } : item) })
    if (stateChange.includes('员工停用')) store.setState({ staff: current().staff.map(staff => staff.id === 'st_lin' ? { ...staff, status: 'disabled' } : staff) })
    if (stateChange === '坐席不存在') store.setState({ seats: current().seats.filter(item => item.id !== 'seat_lin') })
    if (stateChange.includes('没有会话')) {
      store.setState({ conversations: [] })
      if (stateChange === '没有会话') reason = 'left'
    }
    if (stateChange === '暂停接新') {
      store.setState({ seats: current().seats.map(item => item.id === 'seat_lin' ? { ...item, status: 'paused' } : item) })
      reason = undefined
    }
    if (stateChange === '禁止文本发送') {
      store.setState({ policyItems: [...current().policyItems, { key: 'dm.send', label: '私聊发送', group: '私聊', level: 'P0' }], policyMatrix: { ...current().policyMatrix, 'dm.send': { staff: false, customer: true } } })
      reason = 'muted'
    }
    assertBroadcastParity(fixture, reason)
  })
}

test('权限兜底：覆盖优先主归属；主归属不可用时回退另一个可用坐席且只发一次', () => {
  const fixture = coverageFixture()
  const { planCoverage } = loadSource('src/domain/broadcastCoverage.ts')
  store.setState({
    customerSeats: [...current().customerSeats, { customerId: fixture.customerId, seatId: 'seat_chen', primary: false }, ...current().customerSeats],
    conversations: [...current().conversations, { ...fixture.conversation, id: 'dm_fallback', seatId: 'seat_chen' }],
  })
  assert.equal(planCoverage(current(), ['seat_chen', 'seat_lin'], fixture.at).deliveries[0].seatId, 'seat_lin')
  store.setState({ customers: current().customers.map(customer => ({ ...customer, blockedSeatIds: ['seat_lin'] })) })
  const plan = planCoverage(current(), ['seat_lin', 'seat_chen'], fixture.at)
  assert.equal(plan.deliveries.length, 1)
  assert.equal(plan.deliveries[0].seatId, 'seat_chen')
  assert.equal(plan.skips.length, 0)
  const result = current().sendCoverageBroadcast({ name: '回退验收', seatIds: ['seat_lin', 'seat_chen'], operatorId: 'st_admin', text: '权限验收' })
  assert.equal(result.sent, 1)
  assert.equal(current().messages.length, 1)
  assert.equal(current().messages[0].senderId, 'seat_chen')
})

test('权限兜底：所有覆盖坐席都不可用时记录优先候选原始原因，判断早于频控', () => {
  const fixture = coverageFixture({ blockedSeatIds: ['seat_lin'] })
  const { planCoverage } = loadSource('src/domain/broadcastCoverage.ts')
  store.setState({
    customerSeats: [...current().customerSeats, { customerId: fixture.customerId, seatId: 'seat_chen', primary: false }],
    conversations: [...current().conversations, { ...fixture.conversation, id: 'dm_fallback', seatId: 'seat_chen' }],
    staff: current().staff.map(staff => staff.id === 'st_chen' ? { ...staff, status: 'disabled' } : staff),
    enterprise: { ...current().enterprise, broadcastPerCustomerPerDay: 0 },
  })
  const plan = planCoverage(current(), ['seat_chen', 'seat_lin'], fixture.at)
  assert.equal(plan.deliveries.length, 0)
  assert.equal(plan.skips[0].reason, 'blocked')
  assert.equal(plan.skipReasons.blocked, 1)
})

test('权限兜底：覆盖预览按计划时刻判断禁言，到期可发且客户频控原因与单坐席一致', () => {
  const fixture = coverageFixture({ globalMutedUntil: '2026-09-25T01:00:00.000Z' })
  const { planCoverage } = loadSource('src/domain/broadcastCoverage.ts')
  assert.equal(planCoverage(current(), ['seat_lin'], '2026-09-25T00:00:00.000Z').skips[0].reason, 'globalMuted')
  assert.equal(planCoverage(current(), ['seat_lin'], '2026-09-25T02:00:00.000Z').deliveries.length, 1)
  store.setState({ customers: current().customers.map(customer => ({ ...customer, globalMutedUntil: null })), enterprise: { ...current().enterprise, broadcastPerCustomerPerDay: 0 } })
  const before = current()
  assert.equal(planCoverage(before, ['seat_lin'], fixture.at).skips[0].reason, 'rateLimited')
  current().sendBroadcast({ name: '频控验收', seatId: 'seat_lin', operatorId: 'st_lin', targetKind: 'friends', targetDesc: '验收', text: '权限验收', customerIds: [fixture.customerId] })
  assert.equal(current().broadcasts[0].skipReasons.rateLimited, 1)
  store.setState(before)
  current().sendCoverageBroadcast({ name: '覆盖频控验收', seatIds: ['seat_lin'], operatorId: 'st_admin', text: '权限验收' })
  assert.equal(current().broadcasts[0].skipReasons.rateLimited, 1)
})
test('坐席编辑不能绕过敏感词；失败保留正文与历史，不创建假修改', () => {
  const c = dm(), m = send(c.id, seat, '你好')
  const oldHits = current().sensitiveHits.length
  assert.equal(current().queueChatMessage({ convId: c.id, actor: seat, text: '保证收益' }).ok, false)
  const reason = current().editMessage(m.id, '保证收益', seat.staffId, m.text)
  assert.match(reason ?? '', /合规词库拦截/)
  assert.equal(current().messages.find(x => x.id === m.id).text, '你好')
  assert.equal(current().messages.find(x => x.id === m.id).editedAt, undefined)
  assert.equal(current().sensitiveHits.length, oldHits + 2)
})
test('客户编辑不能绕过敏感词', () => {
  const { conv, actor } = groupContext(), m = send(conv.id, actor, '你好')
  assert.match(current().customerEditMessage(m.id, '保本', actor.id, m.text) ?? '', /不能发送/)
  assert.equal(current().messages.find(x => x.id === m.id).text, '你好')
})
test('编辑替换保留旧原文；过期草稿冲突不增加命中', () => {
  addWord('seat', 'replace')
  const m = send(dm().id, seat, '原来的正文')
  assert.equal(current().editMessage(m.id, '含测试词的内容', seat.staffId, m.text), null)
  const edited = current().messages.find(x => x.id === m.id)
  assert.equal(edited.text, '含已替换的内容')
  assert.equal(edited.editHistory[0].text, m.text)
  const n = current().sensitiveHits.length
  assert.match(current().editMessage(m.id, '测试词', seat.staffId, m.text), /其他窗口/)
  assert.equal(current().sensitiveHits.length, n)
})
test('客户编辑成影子后隐藏；再次编辑不解封、不修改起始时间', () => {
  const { conv, actor, other } = groupContext(), m = send(conv.id, actor, '你好')
  assert.equal(current().customerEditMessage(m.id, '加微信 test', actor.id, m.text), null)
  const hidden = current().messages.find(x => x.id === m.id), at = hidden.shadowedAt
  assert.ok(at)
  assert.equal(rules.messageVisibleFor(current(), hidden, other), false)
  assert.equal(rules.messageVisibleFor(current(), hidden, actor), true)
  assert.equal(current().customerEditMessage(m.id, '换回普通内容', actor.id, hidden.text), null)
  const edited = current().messages.find(x => x.id === m.id)
  assert.equal(edited.shadowedAt, at)
  assert.equal(rules.messageVisibleFor(current(), edited, other), false)
})
test('影子置顶不会生成公开通知，普通置顶正常通知', () => {
  const { g, conv, actor, other } = groupContext(), hidden = send(conv.id, actor, '加微信 test')
  const n = current().messages.length
  current().pinMessage(g.id, hidden.id, true, { seatId: seat.id, staffId: seat.staffId })
  assert.equal(current().messages.length, n)
  assert.ok(current().chatGroups.find(x => x.id === g.id).pinnedMessageIds.includes(hidden.id))
  const normal = send(conv.id, actor, '普通内容')
  current().pinMessage(g.id, normal.id, true, { seatId: seat.id, staffId: seat.staffId })
  const notification = current().messages.at(-1)
  assert.equal(notification.kind, 'system')
  assert.equal(rules.messageVisibleFor(current(), notification, other), true)
})
test('坐席与客户引用影子消息均保持隐藏，正常回复不受影响', () => {
  const { conv, actor, other } = groupContext(), hidden = send(conv.id, actor, '加微信 test')
  for (const who of [actor, seat]) {
    const derived = send(conv.id, who, '这是一条回复', { replyToId: hidden.id })
    assert.equal(derived.shadowedAt, derived.at)
    assert.equal(rules.messageVisibleFor(current(), derived, other), false)
    assert.equal(rules.messageVisibleFor(current(), derived, actor), true)
    assert.equal(rules.messageVisibleFor(current(), derived, seat), true)
  }
  assert.equal(rules.messageVisibleFor(current(), send(conv.id, seat, '正常回复'), other), true)
})
test('坐席转发影子消息到另一客户私聊仍不公开，不能经二次转发洗白', () => {
  const { conv, actor } = groupContext(), hidden = send(conv.id, actor, '加微信 test')
  const target = current().conversations.find(c => c.kind === 'dm' && c.seatId === seat.id && c.customerId !== actor.id && !current().customers.find(x => x.id === c.customerId)?.blockedSeatIds.includes(seat.id))
  const forward = send(target.id, seat, hidden.text, { forwardedFrom: { convId: conv.id, messageId: hidden.id } })
  assert.equal(rules.messageVisibleFor(current(), forward, { kind: 'customer', id: target.customerId }), false)
  const second = send(conv.id, seat, forward.text, { forwardedFrom: { convId: target.id, messageId: forward.id } })
  assert.equal(rules.messageVisibleFor(current(), second, { kind: 'customer', id: target.customerId }), false)
})
test('来源后来变成影子时，已有回复与置顶通知一起收窄', () => {
  const { g, conv, actor, other } = groupContext(), m = send(conv.id, actor, '普通原文')
  const reply = send(conv.id, seat, '引用普通原文', { replyToId: m.id, quoteText: '普通原文' })
  current().pinMessage(g.id, m.id, true, { seatId: seat.id, staffId: seat.staffId })
  const notice = current().messages.at(-1)
  assert.equal(rules.messageVisibleFor(current(), reply, other), true)
  assert.equal(current().customerEditMessage(m.id, '加微信 test', actor.id, m.text), null)
  assert.equal(rules.messageVisibleFor(current(), reply, other), false)
  assert.equal(rules.messageVisibleFor(current(), notice, other), false)
})
test('转发来源变得不可见时不能继续发送', () => {
  const { conv, actor, other } = groupContext(), hidden = send(conv.id, actor, '加微信 test')
  const n = current().messages.length
  const result = current().queueChatMessage({ convId: conv.id, actor: other, text: hidden.text, forwardedFrom: { convId: conv.id, messageId: hidden.id } })
  assert.equal(result.ok, false)
  assert.equal(current().messages.length, n)
})
for (const mode of ['single', 'coverage']) {
  function broadcast(text, extra = {}) {
    return mode === 'single' ? current().sendBroadcast({ ...singleInput(text), ...extra }) : current().sendCoverageBroadcast({ name: '规则验收', seatIds: [seat.id, 'seat_chen'], operatorId: 'st_admin', text, ...extra })
  }
  test(`${mode} 群发拦截不创建任务、不发送、不占额度`, () => {
    const n = current().messages.length, jobs = current().broadcasts.length, hits = current().sensitiveHits.length
    const result = broadcast('保证收益')
    assert.match(result?.reason ?? '', /合规词库拦截/)
    assert.equal(current().messages.length, n)
    assert.equal(current().broadcasts.length, jobs)
    assert.equal(current().sensitiveHits.length, hits + 1)
    assert.equal(current().sensitiveHits.at(-1).convId, '')
  })
  test(`${mode} 群发替换按实际收件会话记载并保持一人一条`, () => {
    addWord('seat', 'replace')
    const n = current().messages.length, hits = current().sensitiveHits.length
    const result = broadcast('公告：测试词')
    assert.ok(result && !result.reason)
    const delivered = current().messages.slice(n)
    assert.equal(delivered.length, result.sent)
    assert.ok(delivered.length > 0)
    assert.ok(delivered.every(m => m.text === '公告：已替换'))
    assert.equal(current().sensitiveHits.length, hits + delivered.length)
    assert.equal(new Set(delivered.map(m => current().conversations.find(c => c.id === m.convId).customerId)).size, delivered.length)
  })
  test(`${mode} 第一版群发不再展开变量`, () => {
    const jobs = current().broadcasts.length
    assert.match(broadcast('您好 {{customer.nickname}}')?.reason ?? '', /不支持变量/)
    assert.equal(current().broadcasts.length, jobs)
  })
  test(`${mode} 定时登记不伪造已发送或已替换命中`, () => {
    addWord('seat', 'replace')
    const n = current().messages.length, hits = current().sensitiveHits.length
    const result = broadcast('测试词', { scheduledAt: new Date(Date.now() + 3600000).toISOString() })
    assert.ok(result && !result.reason)
    assert.equal(current().messages.length, n)
    assert.equal(current().sensitiveHits.length, hits)
    assert.equal(current().broadcasts.at(0).status, 'scheduled')
  })
}
test('指定群群发同样检查词库', () => {
  const { g } = groupContext(), input = { ...singleInput('保证收益'), targetKind: 'group', chatGroupId: g.id }
  const n = current().messages.length
  assert.match(current().sendBroadcast(input)?.reason ?? '', /合规词库拦截/)
  assert.equal(current().messages.length, n)
})
test('频道没有发布权限时，群发跳过且不影响其他任务', () => {
  // 种子里林晓明在「恒信官方通知」就没有发布权，不用再改状态
  const channel = current().chatGroups.find(g => g.kind === 'channel' && g.memberSeatIds.includes(seat.id))
  const conv = current().conversations.find(c => c.chatGroupId === channel.id)

  assert.equal(rules.seatMessageSendAllowed(current(), conv.id, seat.id, seat.staffId), false)
  const before = current().messages.length
  const result = current().sendBroadcast({ ...singleInput('频道通知'), targetKind: 'group', chatGroupId: channel.id })

  assert.equal(result.sent, 0)
  assert.equal(result.skipped, 1)
  assert.equal(current().messages.length, before)
  assert.equal(current().broadcasts.at(0).skipReasons.noPostingPermission, 1)
})
test('整号影子模式关闭后，历史消息及其回复仍保持隐藏', () => {
  const { conv, actor, other } = groupContext()
  current().setCustomerShadowMode(actor.id, true, '本地测试', 'st_admin')
  const hidden = send(conv.id, actor, '正常内容但账号已进入影子模式')
  assert.equal(hidden.shadowReason, 'customer')
  current().setCustomerShadowMode(actor.id, false, '', 'st_admin')
  const reply = send(conv.id, seat, '收到', { replyToId: hidden.id })
  assert.equal(rules.messageVisibleFor(current(), hidden, other), false)
  assert.equal(rules.messageVisibleFor(current(), reply, other), false)
  assert.equal(rules.messageVisibleFor(current(), reply, actor), true)
  assert.equal(rules.messageVisibleFor(current(), send(conv.id, actor, '模式关闭后的新消息'), other), true)
})
test('封禁的收件人不产生替换记录或消息', () => {
  addWord('seat', 'replace')
  const c = dm().customerId
  store.setState({ customers: current().customers.map(x => x.id === c ? { ...x, bannedAt: new Date().toISOString() } : x) })
  const n = current().messages.length, hits = current().sensitiveHits.length
  const result = current().sendBroadcast({ ...singleInput('测试词'), customerIds: [c] })
  assert.equal(result.sent, 0)
  assert.equal(result.skipped, 1)
  assert.equal(current().messages.length, n)
  assert.equal(current().sensitiveHits.length, hits)
})

test('群聊禁言不拦私聊，但拦群和频道', () => {
  const { g, conv, actor } = groupContext()
  const until = new Date(Date.now() + 3600000).toISOString()
  store.setState({ customers: current().customers.map(c => c.id === actor.id ? { ...c, mutedAllUntil: until } : c) })
  const privateConv = current().conversations.find(c => c.kind === 'dm' && c.customerId === actor.id)
  const channelConv = current().conversations.find(c => c.kind === 'channel')

  assert.equal(current().queueChatMessage({ convId: privateConv.id, actor, text: '私聊消息' }).ok, true)
  assert.match(current().queueChatMessage({ convId: conv.id, actor, text: '群聊消息' }).reason ?? '', /群聊禁言.*私聊不受影响/)
  assert.match(current().queueChatMessage({ convId: channelConv.id, actor, text: '频道消息' }).reason ?? '', /群聊禁言.*私聊不受影响/)
  assert.equal(policy.customerCanSpeakIn(current(), g, actor.id, new Date(Date.now() + 7200000).toISOString()).ok, true)
})

test('全部禁言拦私聊、群和频道，到期后自动解除', () => {
  const { g, conv, actor } = groupContext()
  const until = new Date(Date.now() + 3600000).toISOString()
  store.setState({ customers: current().customers.map(c => c.id === actor.id ? { ...c, globalMutedUntil: until, mutedAllUntil: until } : c) })
  const privateConv = current().conversations.find(c => c.kind === 'dm' && c.customerId === actor.id)
  const channelConv = current().conversations.find(c => c.kind === 'channel')

  assert.match(current().queueChatMessage({ convId: privateConv.id, actor, text: '私聊消息' }).reason ?? '', /全部禁言/)
  assert.match(current().queueChatMessage({ convId: conv.id, actor, text: '群聊消息' }).reason ?? '', /全部禁言/)
  assert.match(current().queueChatMessage({ convId: channelConv.id, actor, text: '频道消息' }).reason ?? '', /全部禁言/)
  const flags = customerStatus.customerStatusFlags(current().customers.find(c => c.id === actor.id)).map(f => f.key)
  assert.ok(flags.includes('muted'))
  assert.ok(flags.includes('mutedAll'))
  assert.equal(policy.customerCanSpeakIn(current(), g, actor.id, new Date(Date.now() + 7200000).toISOString()).ok, true)
})

test('全部禁言的客户会被私聊群发跳过，群聊禁言不会', () => {
  const customerId = dm().customerId
  const until = new Date(Date.now() + 3600000).toISOString()
  store.setState({ customers: current().customers.map(c => c.id === customerId ? { ...c, globalMutedUntil: until } : c) })
  const globalResult = current().sendBroadcast({ ...singleInput('私聊群发'), customerIds: [customerId] })
  assert.equal(globalResult.sent, 0)
  assert.equal(globalResult.skipped, 1)
  assert.equal(current().broadcasts.at(0).skipReasons.globalMuted, 1)

  reset()
  const groupsMutedCustomerId = dm().customerId
  store.setState({ customers: current().customers.map(c => c.id === groupsMutedCustomerId ? { ...c, mutedAllUntil: until } : c) })
  const groupsResult = current().sendBroadcast({ ...singleInput('私聊群发'), customerIds: [groupsMutedCustomerId] })
  assert.equal(groupsResult.sent, 1)
  assert.equal(groupsResult.skipped, 0)
})

test('激活员工写入 staff.activate 审计类型', () => {
  const staff = current().staff.find(st => st.id !== 'st_admin')
  store.setState({ staff: current().staff.map(st => st.id === staff.id ? { ...st, status: 'disabled' } : st) })
  current().activateStaff(staff.id, 'st_admin')
  assert.equal(current().audit.at(0).type, 'staff.activate')
})

test('恒信官方通知只有 owner 客户服务能发布，两位坐席只能置顶', () => {
  const channel = current().chatGroups.find(g => g.id === 'cg_strategy')
  const conv = current().conversations.find(c => c.chatGroupId === channel.id)
  assert.deepEqual(channel.admins.find(a => a.memberId === 'seat_lin').perms, ['can_pin_messages'])
  assert.deepEqual(channel.admins.find(a => a.memberId === 'seat_chen').perms, ['can_pin_messages'])
  assert.equal(rules.seatMessageSendAllowed(current(), conv.id, 'seat_lin', 'st_lin'), false)
  assert.equal(rules.seatMessageSendAllowed(current(), conv.id, 'seat_chen', 'st_chen'), false)
  // owner 坐席不看管理员权限表，直接放行
  assert.equal(rules.seatMessageSendAllowed(current(), conv.id, 'seat_cs', 'st_chen'), true)
})

test('封禁状态下登录被拒，强制下线后的旧登录失效', () => {
  const c = current().customers.find(x => !x.bannedAt && !x.deletedAt)
  const startedAt = new Date(Date.now() - 1000).toISOString()
  store.setState({ customers: current().customers.map(x => x.id === c.id ? { ...x, bannedAt: new Date().toISOString() } : x) })
  assert.equal(customerStatus.customerLoginState(current().customers.find(x => x.id === c.id), startedAt), 'banned')

  store.setState({ customers: current().customers.map(x => x.id === c.id ? { ...x, bannedAt: null, sessionsRevokedAt: new Date().toISOString() } : x) })
  assert.equal(customerStatus.customerLoginState(current().customers.find(x => x.id === c.id), startedAt), 'forcedLogout')
})

test('客户隐藏最后上线时间后，员工侧已读回执仍正常写入', () => {
  const conv = dm()
  const customerId = conv.customerId
  const message = send(conv.id, seat, '请确认是否已收到')
  current().setCustomerLastSeenVisibility(customerId, 'nobody')
  current().customerMarkRead(conv.id, customerId, message.at)

  const updated = current().conversations.find((item) => item.id === conv.id)
  assert.equal(current().customers.find((customer) => customer.id === customerId).lastSeenVisibility, 'nobody')
  assert.equal(updated.readAtByCustomer[customerId], message.at)
})

function registrationGroup(chatGroupIds = []) {
  const group = { ...current().inviteGroups[0], id: 'ig_registration_test', code: 'BATCH9', fixedSeatIds: ['seat_lin', 'seat_cs'], rotatingSeatIds: [], chatGroupIds, isDefault: true, enabled: true }
  store.setState({
    inviteGroups: [group],
    enterprise: { ...current().enterprise, inviteCodeRequired: false },
  })
  return group
}

for (const welcome of ['', ' \t\n ']) {
  test(`注册：坐席欢迎语${welcome ? '全空白' : '为空'}时只建会话，其他坐席照常问候`, () => {
    const group = registrationGroup()
    store.setState({ seats: current().seats.map(item => item.id === 'seat_lin' ? { ...item, welcome } : item.id === 'seat_cs' ? { ...item, welcome: '{{customer.nickname}}，我是{{seat.name}}' } : item) })
    const result = current().registerCustomer({ nickname: '新客户', inviteCode: group.code })
    assert.equal(result.ok, true, result.error)
    const customer = current().customers.find(item => item.id === result.customerId)
    const silentConversation = current().conversations.find(item => item.customerId === customer.id && item.seatId === 'seat_lin')
    const welcomeConversation = current().conversations.find(item => item.customerId === customer.id && item.seatId === 'seat_cs')
    assert.ok(silentConversation)
    assert.ok(welcomeConversation)
    assert.equal(silentConversation.lastMessageAt, customer.registeredAt)
    assert.equal(current().messages.filter(item => item.convId === silentConversation.id).length, 0)
    const messages = current().messages.filter(item => item.convId === welcomeConversation.id && item.isWelcome)
    assert.equal(messages.length, 1)
    assert.equal(messages[0].text, `${customer.nickname}，我是${current().seats.find(item => item.id === 'seat_cs').displayName}`)
    assert.equal(messages[0].at, customer.registeredAt)
  })
}

for (const usePolicyLimit of [false, true]) {
  test(`注册：附带群满员时跳过并审计，${usePolicyLimit ? '策略' : '群级'}上限计入客户和坐席`, () => {
    const fullGroup = current().chatGroups.find(item => item.id === 'cg_community')
    const openGroup = current().chatGroups.find(item => item.id === 'cg_strategy')
    const group = registrationGroup([fullGroup.id, openGroup.id])
    store.setState({
      policyNumbers: { ...current().policyNumbers, groupMaxMembers: usePolicyLimit ? 2 : 10000 },
      chatGroups: current().chatGroups.map(item => item.id === fullGroup.id
        ? { ...item, memberCustomerIds: [item.memberCustomerIds[0]], memberSeatIds: ['seat_lin'], maxMembers: usePolicyLimit ? null : 2, welcomeText: '满员群欢迎语' }
        : item.id === openGroup.id ? { ...item, memberCustomerIds: [], memberSeatIds: ['seat_cs'], maxMembers: 2, welcomeText: '可加入群欢迎语' } : item),
    })
    const result = current().registerCustomer({ nickname: '容量验收', inviteCode: group.code })
    assert.equal(result.ok, true, result.error)
    assert.deepEqual(Array.from(result.addedGroupIds), [openGroup.id])
    assert.equal(current().chatGroups.find(item => item.id === fullGroup.id).memberCustomerIds.includes(result.customerId), false)
    assert.equal(current().chatGroups.find(item => item.id === openGroup.id).memberCustomerIds.includes(result.customerId), true)
    assert.ok(current().audit.find(item => item.type === 'customer.register').detail.endsWith(`；因满员未加入：${fullGroup.name}`))
    const groupWelcomes = current().messages.filter(item => item.recipientCustomerId === result.customerId && item.isWelcome)
    assert.equal(groupWelcomes.length, 1)
    assert.equal(groupWelcomes[0].text, '可加入群欢迎语')
  })
}

test('注册：邀请组未附带群时不加入任何群', () => {
  const group = registrationGroup()
  const result = current().registerCustomer({ nickname: '不入群客户', inviteCode: group.code })
  assert.equal(result.ok, true, result.error)
  assert.deepEqual(Array.from(result.addedGroupIds), [])
  assert.equal(current().chatGroups.some(item => item.memberCustomerIds.includes(result.customerId)), false)
})

test('注册：邀请组与链接附带群取并集，去重并忽略不存在的群', () => {
  const group = registrationGroup(['cg_community', 'cg_community', 'missing_group'])
  const link = { ...current().inviteLinks[0], id: 'link_registration_test', code: 'BATCH9L', inviteGroupId: group.id, chatGroupIds: ['cg_community', 'cg_strategy', 'missing_group'], status: 'active' }
  store.setState({ inviteLinks: [link] })
  const result = current().registerCustomer({ nickname: '链接客户', inviteCode: link.code })
  assert.equal(result.ok, true, result.error)
  assert.deepEqual(Array.from(result.addedGroupIds), ['cg_community', 'cg_strategy'])
  for (const groupId of result.addedGroupIds) {
    assert.equal(current().chatGroups.find(item => item.id === groupId).memberCustomerIds.filter(customerId => customerId === result.customerId).length, 1)
  }
})

test('注册：没带码只加入默认邀请组附带的群，官方群仍不可退出', () => {
  const group = registrationGroup(['cg_community'])
  store.setState({ chatGroups: current().chatGroups.map(item => item.id === 'cg_community' ? { ...item, official: true } : item) })
  const result = current().registerCustomer({ nickname: '无码客户', inviteCode: '' })
  assert.equal(result.ok, true, result.error)
  assert.equal(current().customers.find(item => item.id === result.customerId).inviteGroupId, group.id)
  assert.deepEqual(Array.from(result.addedGroupIds), ['cg_community'])
  assert.equal(policy.customerCan(current(), result.customerId, 'group.leave', 'cg_community'), false)
})

for (const welcome of ['', ' \t\n ', '您好，我是{{seat.name}}']) {
  test(`补加坐席：欢迎语${welcome.trim() ? '已配置时问候' : welcome ? '全空白时不问候' : '为空时不问候'}`, () => {
    const group = registrationGroup()
    store.setState({ inviteGroups: [{ ...group, fixedSeatIds: ['seat_lin'] }], seats: current().seats.map(item => item.id === 'seat_cs' ? { ...item, welcome } : item) })
    const result = current().registerCustomer({ nickname: '补加客户', inviteCode: group.code })
    assert.equal(result.ok, true, result.error)
    assert.equal(current().backfillSeat(group.id, 'seat_cs', 'st_admin'), 1)
    const conversation = current().conversations.find(item => item.customerId === result.customerId && item.seatId === 'seat_cs')
    assert.ok(conversation)
    assert.ok(conversation.lastMessageAt)
    const messages = current().messages.filter(item => item.convId === conversation.id)
    assert.equal(messages.length, welcome.trim() ? 1 : 0)
    if (welcome.trim()) {
      assert.equal(messages[0].isWelcome, true)
      assert.equal(messages[0].text, `您好，我是${current().seats.find(item => item.id === 'seat_cs').displayName}`)
    }
    assert.equal(current().backfillSeat(group.id, 'seat_cs', 'st_admin'), 0)
  })
}

test('注册：关闭邀请码必填后，种子默认组让无码客户加入官方通知和社区群', () => {
  store.setState({ enterprise: { ...current().enterprise, inviteCodeRequired: false } })
  const result = current().registerCustomer({ nickname: '默认组新客户', inviteCode: '' })
  assert.equal(result.ok, true, result.error)
  assert.equal(current().customers.find(item => item.id === result.customerId).inviteGroupId, 'ig_default')
  assert.deepEqual(Array.from(result.addedGroupIds), ['cg_strategy', 'cg_community'])
  for (const groupId of ['cg_strategy', 'cg_community']) {
    assert.equal(current().chatGroups.find(item => item.id === groupId).memberCustomerIds.includes(result.customerId), true)
  }
})
