const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { reset, flush, store, rules, customerStatus, policy } = require('./source-store.cjs')
const current = () => store.getState()
const seat = { kind: 'seat', id: 'seat_lin', staffId: 'st_lin' }
beforeEach(reset)
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
  store.setState({ customers: current().customers.map(c => ids.includes(c.id) ? { ...c, watchUntil: undefined, bannedAt: null, mutedAllUntil: null } : c) })
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
test('暂停后不能放行或手动发言，恢复后只发一次', () => {
  const run = current().botRuns.find(r => r.status === 'pending_review'), n = current().messages.length, count = current().botRuns.length
  current().setBotsPausedAll(true, 'st_zhao')
  const refusal = current().reviewBotRun(run.id, true, 'st_zhao')
  assert.equal(current().messages.length, n)
  assert.equal(current().botRuns.find(r => r.id === run.id).status, 'pending_review')
  assert.match(refusal ?? '', /已暂停/)
  assert.match(current().botManualSend(run.botId, run.groupId, '测试发言', 'st_zhao') ?? '', /已暂停/)
  assert.equal(current().botRuns.length, count)
  assert.equal(current().messages.length, n)
  current().setBotsPausedAll(false, 'st_zhao')
  assert.equal(current().reviewBotRun(run.id, true, 'st_zhao'), null)
  assert.equal(current().messages.length, n + 1)
  assert.match(current().reviewBotRun(run.id, true, 'st_zhao'), /已处理/)
  assert.equal(current().messages.length, n + 1)
})
for (const kind of ['mute', 'license', 'disabled', 'left']) test(`活跃角色 ${kind} 状态约束自动、审核和手动三个入口`, () => {
  const run = current().botRuns.find(r => r.status === 'pending_review')
  if (kind === 'mute') store.setState({ chatGroups: current().chatGroups.map(g => g.id === run.groupId ? { ...g, settings: { ...g.settings, allMuted: true } } : g) })
  if (kind === 'license') store.setState({ license: { ...current().license, modules: current().license.modules.map(m => m.key === 'ai' ? { ...m, enabled: false } : m) } })
  if (kind === 'disabled') store.setState({ bots: current().bots.map(b => b.id === run.botId ? { ...b, enabled: false } : b) })
  if (kind === 'left') store.setState({ chatGroups: current().chatGroups.map(g => g.id === run.groupId ? { ...g, memberBotIds: g.memberBotIds.filter(id => id !== run.botId) } : g) })
  const n = current().messages.length
  assert.ok(current().reviewBotRun(run.id, true, 'st_zhao'))
  assert.ok(current().botManualSend(run.botId, run.groupId, '测试', 'st_zhao'))
  const rule = current().botRules.find(r => r.botIds.includes(run.botId) && r.groupIds.includes(run.groupId))
  if (rule) {
    // 自动触发当前只取规则首个角色，夹具明确选择本项被禁用/移出的角色。
    store.setState({ botRules: current().botRules.map(r => r.id === rule.id ? { ...r, botIds: [run.botId], groupIds: [run.groupId] } : r) })
    assert.equal(current().simulateBotRule(rule.id, 'st_zhao').status, 'skipped')
  }
  assert.equal(current().messages.length, n)
  assert.equal(current().botRuns.find(r => r.id === run.id).status, 'pending_review')
})
test('暂停期间仍可驳回待审内容', () => {
  const run = current().botRuns.find(r => r.status === 'pending_review')
  current().setBotsPausedAll(true, 'st_zhao')
  assert.equal(current().reviewBotRun(run.id, false, 'st_zhao', '内容不合适'), null)
  assert.equal(current().botRuns.find(r => r.id === run.id).status, 'rejected')
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

test('全局禁言覆盖私聊和群聊，到期后自动解除', () => {
  const { g, conv, actor } = groupContext()
  const until = new Date(Date.now() + 3600000).toISOString()
  store.setState({ customers: current().customers.map(c => c.id === actor.id ? { ...c, mutedAllUntil: until } : c) })
  const privateConv = current().conversations.find(c => c.kind === 'dm' && c.customerId === actor.id)

  assert.match(current().queueChatMessage({ convId: privateConv.id, actor, text: '私聊消息' }).reason ?? '', /全局禁言/)
  assert.match(current().queueChatMessage({ convId: conv.id, actor, text: '群聊消息' }).reason ?? '', /全局禁言/)
  assert.equal(policy.customerCanSpeakIn(current(), g, actor.id, new Date(Date.now() + 7200000).toISOString()).ok, true)
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
