const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { reset, flush, store, rules, customerStatus, policy } = require('./source-store.cjs')
const current = () => store.getState()
const seat = { kind: 'seat', id: 'seat_lin', staffId: 'st_lin' }
beforeEach(reset)
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
  assert.ok(state.license.modules.every(module => module.key !== 'ai' && !Object.hasOwn(module, 'botLimit') && !Object.hasOwn(module, 'botUsed')))
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
  // 种子里林顾问在「恒信官方通知」就没有发布权，不用再改状态
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

test('全群禁言不拦私聊，但拦群和频道', () => {
  const { g, conv, actor } = groupContext()
  const until = new Date(Date.now() + 3600000).toISOString()
  store.setState({ customers: current().customers.map(c => c.id === actor.id ? { ...c, mutedAllUntil: until } : c) })
  const privateConv = current().conversations.find(c => c.kind === 'dm' && c.customerId === actor.id)
  const channelConv = current().conversations.find(c => c.kind === 'channel')

  assert.equal(current().queueChatMessage({ convId: privateConv.id, actor, text: '私聊消息' }).ok, true)
  assert.match(current().queueChatMessage({ convId: conv.id, actor, text: '群聊消息' }).reason ?? '', /全群禁言.*私聊不受影响/)
  assert.match(current().queueChatMessage({ convId: channelConv.id, actor, text: '频道消息' }).reason ?? '', /全群禁言.*私聊不受影响/)
  assert.equal(policy.customerCanSpeakIn(current(), g, actor.id, new Date(Date.now() + 7200000).toISOString()).ok, true)
})

test('全局禁言拦私聊、群和频道，到期后自动解除', () => {
  const { g, conv, actor } = groupContext()
  const until = new Date(Date.now() + 3600000).toISOString()
  store.setState({ customers: current().customers.map(c => c.id === actor.id ? { ...c, globalMutedUntil: until, mutedAllUntil: until } : c) })
  const privateConv = current().conversations.find(c => c.kind === 'dm' && c.customerId === actor.id)
  const channelConv = current().conversations.find(c => c.kind === 'channel')

  assert.match(current().queueChatMessage({ convId: privateConv.id, actor, text: '私聊消息' }).reason ?? '', /全局禁言/)
  assert.match(current().queueChatMessage({ convId: conv.id, actor, text: '群聊消息' }).reason ?? '', /全局禁言/)
  assert.match(current().queueChatMessage({ convId: channelConv.id, actor, text: '频道消息' }).reason ?? '', /全局禁言/)
  const flags = customerStatus.customerStatusFlags(current().customers.find(c => c.id === actor.id)).map(f => f.key)
  assert.ok(flags.includes('muted'))
  assert.ok(flags.includes('mutedAll'))
  assert.equal(policy.customerCanSpeakIn(current(), g, actor.id, new Date(Date.now() + 7200000).toISOString()).ok, true)
})

test('全局禁言的客户会被私聊群发跳过，全群禁言不会', () => {
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

test('恒信官方通知只有 owner 客户服务能发布，两位顾问只能置顶', () => {
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
