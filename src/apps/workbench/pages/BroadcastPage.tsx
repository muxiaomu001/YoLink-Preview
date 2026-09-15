/**
 * 群发页（04 文档）：目标五选一并显示命中人数、内容类型、发送方式（定时 P1）、
 * 频控读企业设置、记录表按 PRD 列；投递规则在 Note 里讲清。
 */
import { useMemo, useState } from 'react'
import { Send, Sparkles } from 'lucide-react'
import type { Broadcast, BroadcastTargetKind } from '@/domain/types'
import { customersOfSeat } from '@/store/selectors'
import { Button, Checkbox, Field, Input, Select, Textarea } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, SeatAvatar } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { useWorkbench } from '../useWorkbench'
import { BroadcastDetailModal, BroadcastRecords, DeliveryRulesNote, TARGET_LABEL, renderVars } from './BroadcastPage.parts'

type ContentKind = 'text' | 'image' | 'card'
type SendMode = 'now' | 'scheduled'

const AI_SAMPLE = '各位好，本周观点已整理：美元短端仍有吸引力，港股科技反弹属修复，黄金维持区间配置。周五晚 8 点线上复盘，欢迎参加。\n\n以上仅为信息分享，不构成投资建议。'

export function BroadcastPage() {
  const { s, staff, seat, can } = useWorkbench()
  const [name, setName] = useState('')
  const [targetKind, setTargetKind] = useState<BroadcastTargetKind>('mine')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [product, setProduct] = useState('')
  const [role, setRole] = useState('')
  const [groupId, setGroupId] = useState('')
  const [contentKind, setContentKind] = useState<ContentKind>('text')
  const [text, setText] = useState('')
  const [mode, setMode] = useState<SendMode>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [detail, setDetail] = useState<Broadcast | null>(null)

  const today = new Date().toISOString().slice(0, 10)
  const perStaff = s.enterprise.broadcastPerStaffPerDay
  const perCustomer = s.enterprise.broadcastPerCustomerPerDay
  const todayCount = s.broadcasts.filter((b) => b.operatorId === staff?.id && b.sentAt.slice(0, 10) === today).length
  const overLimit = todayCount >= perStaff

  const mine = useMemo(() => (seat ? customersOfSeat(s, seat.id).filter((c) => !c.deletedAt) : []), [s, seat])
  const myGroups = useMemo(() => (seat ? s.chatGroups.filter((g) => g.memberSeatIds.includes(seat.id)) : []), [s, seat])
  const products = useMemo(() => Array.from(new Set(mine.flatMap((c) => c.purchases.map((p) => p.product)))), [mine])
  const roles = useMemo(() => Array.from(new Set(mine.map((c) => c.roleLabel).filter((r): r is string => !!r))), [mine])
  const group = s.chatGroups.find((g) => g.id === groupId)

  const targets = useMemo(() => {
    if (targetKind === 'mine') return mine
    if (targetKind === 'tag') return mine.filter((c) => tagIds.some((t) => c.tagIds.includes(t)))
    if (targetKind === 'purchase') return mine.filter((c) => (product ? c.purchases.some((p) => p.product === product) : c.purchases.length > 0))
    if (targetKind === 'role') return mine.filter((c) => c.roleLabel === role)
    return []
  }, [mine, targetKind, tagIds, product, role])

  /** 发送前预估会被跳过的人：注销 / 拉黑 / 屏蔽本坐席 / 今日已达每客户频控 */
  const willSkip = useMemo(() => {
    if (!seat) return 0
    return targets.filter((c) => {
      if (c.blacklistedAt || c.blockedSeatIds.includes(seat.id)) return true
      const received = s.messages.filter((m) => m.isBroadcast && m.at.slice(0, 10) === today && s.conversations.find((x) => x.id === m.convId)?.customerId === c.id).length
      return received >= perCustomer
    }).length
  }, [targets, seat, s.messages, s.conversations, today, perCustomer])

  const targetDesc =
    targetKind === 'mine'
      ? `我的客户（${seat?.displayName ?? ''}）`
      : targetKind === 'tag'
        ? `标签 ∈ ${tagIds.map((id) => s.tags.find((t) => t.id === id)?.name).join('、') || '未选'}`
        : targetKind === 'purchase'
          ? `买过 ${product || '任一产品'}`
          : targetKind === 'role'
            ? `角色 = ${role || '未选'}`
            : `群「${group?.name ?? '未选'}」`
  const targetOk = targetKind === 'group' ? !!group : targets.length > 0 && (targetKind !== 'tag' || tagIds.length > 0) && (targetKind !== 'role' || !!role)
  const scheduleOk = mode === 'now' || (!!scheduledAt && new Date(scheduledAt).getTime() > Date.now())
  const contentOk = contentKind !== 'card' && !!text.trim()
  const canSend = !overLimit && !!name.trim() && contentOk && targetOk && scheduleOk
  const reason = overLimit ? `今日群发任务已达上限（${perStaff} 个）` : !name.trim() ? '填任务名称' : contentKind === 'card' ? '自定义卡片是 P1，演示不可发' : !text.trim() ? '填内容' : !targetOk ? '目标没有命中任何人' : !scheduleOk ? '定时时间要晚于现在' : ''

  const send = () => {
    if (!seat || !staff || !canSend) return
    const r = s.sendBroadcast({ name: name.trim(), seatId: seat.id, operatorId: staff.id, targetKind, targetDesc, contentKind: contentKind === 'image' ? 'image' : 'text', text: text.trim(), customerIds: targets.map((c) => c.id), chatGroupId: targetKind === 'group' ? groupId : undefined, scheduledAt: mode === 'scheduled' ? new Date(scheduledAt).toISOString() : null })
    if (!r) return toast(`超过频控：每个实操员工每天 ${perStaff} 个任务，明天再发`, 'warn')
    if (mode === 'scheduled') toast(`已创建定时任务，到点按当时人群发送（P1，演示不真正定时）`, 'info')
    else if (targetKind === 'group') toast(r.sent ? `已以「${seat.displayName}」身份往群「${group?.name}」发了一条群消息` : '群会话不存在，未发送', r.sent ? 'ok' : 'warn')
    else toast(`已以「${seat.displayName}」身份发给 ${r.sent} 位客户${r.skipped ? `，跳过 ${r.skipped} 位（注销 / 拉黑 / 屏蔽 / 频控）` : ''}`)
    setName('')
    setText('')
  }

  if (!can('broadcast')) return <Note tone="amber">当前员工角色没有 broadcast 能力。</Note>
  if (!s.enterprise.modules.broadcast) return <Note tone="amber">企业已停用「群发」模块，在管理后台「模块」里开启。</Note>

  return (
    <div className="thin-scroll h-full overflow-y-auto p-5">
      <PageHeader title="群发" desc={`以当前坐席身份发送，消息进每位客户与本坐席的私聊。频控（管理后台可配）：每个实操员工每天 ${perStaff} 个任务（跨其持有的坐席合并），每客户每天最多收 ${perCustomer} 条（跨坐席、跨任务合并）。`} />
      <div className="mb-4">
        <DeliveryRulesNote />
      </div>
      <div className="grid grid-cols-[1fr_400px] gap-4">
        <Card title="新建群发">
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-md bg-zinc-50 px-3 py-2 text-xs">
              发送身份：{seat && <SeatAvatar seat={seat} size={20} />} <b>{seat?.displayName}</b>
              <span className="text-zinc-400">（切换顶部坐席身份可换）</span>
            </div>
            <Field label="任务名称" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="内部可见，如：本周市场观点" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="目标">
                <Select
                  value={targetKind}
                  onChange={(e) => {
                    setTargetKind(e.target.value as BroadcastTargetKind)
                    setTagIds([])
                    setProduct('')
                    setRole('')
                    setGroupId('')
                  }}
                >
                  {(['mine', 'tag', 'purchase', 'role', 'group'] as BroadcastTargetKind[]).map((k) => (
                    <option key={k} value={k}>
                      {TARGET_LABEL[k]}
                      {k === 'mine' ? '（本坐席主归属）' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              {targetKind === 'purchase' && (
                <Field label="买过某产品">
                  <Select value={product} onChange={(e) => setProduct(e.target.value)}>
                    <option value="">任一产品</option>
                    {products.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {targetKind === 'role' && (
                <Field label="角色标签">
                  <Select value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="">选择…</option>
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {targetKind === 'group' && (
                <Field label="指定群" hint="只列本坐席所在的群">
                  <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                    <option value="">选择…</option>
                    {myGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}（{g.memberCustomerIds.length} 人）
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>
            {targetKind === 'tag' && (
              <Field label="标签筛选" hint="命中任一标签即算">
                <div className="flex flex-wrap gap-3 rounded-md border border-zinc-200 px-3 py-2">
                  {s.tags.map((t) => (
                    <Checkbox key={t.id} checked={tagIds.includes(t.id)} onChange={(v) => setTagIds((l) => (v ? [...l, t.id] : l.filter((x) => x !== t.id)))} label={<span style={{ color: t.color }}>{t.name}</span>} />
                  ))}
                </div>
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="内容类型">
                <Select value={contentKind} onChange={(e) => setContentKind(e.target.value as ContentKind)}>
                  <option value="text">文本</option>
                  <option value="image">图片（演示用文字占位）</option>
                  <option value="card" disabled>
                    自定义卡片（P1，未开放）
                  </option>
                </Select>
              </Field>
              <Field label="发送方式">
                <Select value={mode} onChange={(e) => setMode(e.target.value as SendMode)}>
                  <option value="now">立即发送</option>
                  <option value="scheduled">定时发送（P1）</option>
                </Select>
              </Field>
            </div>
            {mode === 'scheduled' && (
              <Field label="定时时间" required hint="到点按当时人群计算再发">
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </Field>
            )}
            <Field label={contentKind === 'image' ? '图片说明' : '文本内容'} required hint="支持 {{customer.nickname}}，发送时逐人替换">
              <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={contentKind === 'image' ? '正式版这里是上传按钮；演示用一句文字代替图片' : ''} />
            </Field>
            {text.includes('{{customer.nickname}}') && mine[0] && <div className="text-[11px] text-zinc-500">预览（以「{mine[0].nickname}」为例）：{renderVars(text, mine[0].nickname).slice(0, 80)}</div>}
            <div className="flex items-center justify-between">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setText(AI_SAMPLE)
                  toast('AI 已按「本周观点、稳健语气、中等长度」写好文案', 'info')
                }}
              >
                <Sparkles size={13} /> AI 写文案
              </Button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500">
                  命中 <b className="text-zinc-900">{targetKind === 'group' ? (group?.memberCustomerIds.length ?? 0) : targets.length}</b> 人
                  {willSkip > 0 && targetKind !== 'group' && <span className="text-amber-700">（预计跳过 {willSkip}）</span>} · 今日已用 {todayCount}/{perStaff}
                </span>
                <Button variant="primary" disabled={!canSend} title={reason} onClick={send}>
                  <Send size={13} /> {mode === 'scheduled' ? '创建定时任务' : '立即发送'}
                </Button>
              </div>
            </div>
            {reason && (
              <div className={`text-xs ${overLimit ? 'text-amber-700' : 'text-zinc-400'}`}>
                {reason}
                {overLimit && <span className="ml-1">· 在管理后台「企业设置 › 群发频控」里改</span>}
              </div>
            )}
          </div>
        </Card>
        <Card
          title="群发记录"
          padded={false}
          extra={
            <span className="text-[11px] text-zinc-400">
              已读数 <Pill>P1</Pill> 预留
            </span>
          }
        >
          <BroadcastRecords rows={s.broadcasts} onDetail={setDetail} />
        </Card>
      </div>
      {detail && <BroadcastDetailModal b={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
