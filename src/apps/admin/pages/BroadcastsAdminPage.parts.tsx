/**
 * 群发管理页（管理后台）的记录表、详情弹窗与「新建群发」弹窗。
 * 新建支持两种发送方式：单个坐席发给它的全部好友，或多坐席全覆盖（去重后一人只收一条）。
 * 两种都先算计划再发，发送前预览与真正发送走的是同一份 planCoverage / friendsOfSeat。
 * 实操一律记当前后台管理员：全覆盖只占他一个任务额度，不去扣各坐席实操员工的额度。
 */
import { useMemo, useState } from 'react'
import { Send, Users } from 'lucide-react'
import type { Broadcast, DemoState } from '@/domain/types'
import { fmtDateTime } from '@/domain/time'
import { SKIP_REASON_LABEL, planCoverage, type SkipReason } from '@/domain/broadcastCoverage'
import type { DemoStore } from '@/store/store'
import { friendsOfSeat, seatById, staffById } from '@/store/selectors'
import { Button, Checkbox, Field, Input, Select, Textarea } from '@/ui/primitives'
import { KV, Note, Pill, SeatAvatar, Table } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { DemoLevelTag, DemoNote } from '@/ui/DemoNote'
import { ContentKindPill, MediaPreview, StatusPill } from '@/apps/workbench/pages/BroadcastPage.parts'
import { CONTENT_KIND_LABEL, PREVIEW_LEN, TARGET_LABEL, broadcastPreviewFingerprint, isBroadcastPreviewStale } from '@/apps/workbench/pages/BroadcastPage.shared'

type SendMode = 'now' | 'scheduled'
/** 发送方式：一个坐席发给自己的好友，或多个坐席合起来覆盖到人 */
type Reach = 'single' | 'coverage'
type BroadcastPreview = {
  customerIds: string[]
  seatIds: string[]
  reach: Reach
  reachCount: number
  skipCount: number
  skipReasons?: Record<string, number>
  targetDesc: string
  scheduledAt: string | null
  conditionFingerprint: string
}

function skipLabel(key: string): string {
  return SKIP_REASON_LABEL[key as SkipReason] ?? key
}

/** 把跳过原因分布写成一行人话 */
function skipSummary(reasons: Record<string, number> | undefined): string {
  const parts = Object.entries(reasons ?? {}).filter(([, n]) => n > 0)
  return parts.length ? parts.map(([k, n]) => `${skipLabel(k)} ${n}`).join('、') : ''
}

/** 记录表：全部坐席的群发，倒序 */
export function BroadcastsAdminTable({ s, rows, onDetail, onCancel }: { s: DemoState; rows: Broadcast[]; onDetail: (b: Broadcast) => void; onCancel: (b: Broadcast) => void }) {
  return (
    <Table
      rows={rows}
      rowKey={(b) => b.id}
      empty="还没有群发记录"
      onRowClick={onDetail}
      columns={[
        { key: 'at', title: '时间', render: (b) => <span className="tabular-nums text-zinc-700">{fmtDateTime(b.status === 'scheduled' && b.scheduledAt ? b.scheduledAt : b.sentAt)}</span> },
        {
          key: 'seat',
          title: '发送坐席',
          render: (b) => {
            const seat = seatById(s, b.seatId)
            const extra = b.coverage ? b.coverage.filter((x) => x.count > 0).length - 1 : 0
            return seat ? (
              <span className="inline-flex items-center gap-1.5">
                <SeatAvatar seat={seat} size={20} /> {seat.displayName}
                {extra > 0 && (
                  <span className="text-[11px] text-zinc-400" title={b.targetDesc}>
                    +{extra} 个坐席
                  </span>
                )}
              </span>
            ) : (
              <span className="text-zinc-400">已删除</span>
            )
          },
        },
        { key: 'op', title: '实操员工', render: (b) => <span className="text-zinc-600">{staffById(s, b.operatorId)?.name ?? '-'}</span> },
        {
          key: 'target',
          title: '目标',
          render: (b) => (
            <div>
              <div className="text-zinc-800">{TARGET_LABEL[b.targetKind]}</div>
              <div className="max-w-44 truncate text-[11px] text-zinc-400" title={b.targetDesc}>
                {b.targetDesc}
              </div>
            </div>
          ),
        },
        {
          key: 'preview',
          title: '内容摘要',
          render: (b) => (
            <span className="block max-w-64 truncate text-zinc-600" title={b.text || b.media?.name}>
              <span className="mr-1 text-zinc-400">{b.name} ·</span>
              <ContentKindPill kind={b.contentKind} className="mr-1" />
              {b.text ? `${b.text.slice(0, PREVIEW_LEN)}${b.text.length > PREVIEW_LEN ? '…' : ''}` : (b.media?.name ?? '')}
            </span>
          ),
        },
        {
          key: 'counts',
          title: '送达 / 已读 / 跳过',
          align: 'right',
          render: (b) => (
            <span className="tabular-nums">
              {b.sentCount} / <span className="text-zinc-500">{b.readCount}</span> / <span className={b.skippedCount ? 'text-amber-700' : 'text-zinc-400'}>{b.skippedCount}</span>
            </span>
          ),
        },
        {
          key: 'status',
          title: '状态',
          render: (b) => (
            <div className="space-y-1">
              <StatusPill status={b.status} />
              {b.status === 'scheduled' && <DemoNote compact>演示里不实际投递</DemoNote>}
            </div>
          ),
        },
        {
          key: 'ops',
          title: '操作',
          align: 'right',
          render: (b) => (
            <span className="inline-flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => onDetail(b)}>查看详情</Button>
              {b.status === 'scheduled' && <Button size="sm" variant="ghost" onClick={() => onCancel(b)}>取消</Button>}
            </span>
          ),
        },
      ]}
    />
  )
}

export function BroadcastAdminDetailModal({ s, b, onClose }: { s: DemoState; b: Broadcast; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={`群发：${b.name}`} width={560} footer={<Button onClick={onClose}>关闭</Button>}>
      <div className="space-y-3">
        <KV
          items={[
            { k: b.coverage ? '主力坐席' : '发送坐席', v: seatById(s, b.seatId)?.displayName ?? '-' },
            { k: '实操员工', v: staffById(s, b.operatorId)?.name ?? '-' },
            { k: '目标', v: `${TARGET_LABEL[b.targetKind]} · ${b.targetDesc}` },
            { k: '内容类型', v: CONTENT_KIND_LABEL[b.contentKind] },
            ...(b.contentKind !== 'text' ? [{ k: '附件', v: <MediaPreview kind={b.contentKind} media={b.media} /> }] : []),
            { k: '状态', v: <StatusPill status={b.status} /> },
            { k: b.status === 'scheduled' ? '计划时间' : '发送时间', v: fmtDateTime(b.status === 'scheduled' && b.scheduledAt ? b.scheduledAt : b.sentAt) },
            { k: '送达', v: <span className="tabular-nums">{b.sentCount}</span> },
            { k: '已读', v: <span className="tabular-nums">{b.readCount}</span> },
            { k: '跳过', v: <span className="tabular-nums">{b.skippedCount}</span> },
            ...(b.skippedCount && skipSummary(b.skipReasons) ? [{ k: '跳过原因', v: <span className="text-zinc-600">{skipSummary(b.skipReasons)}</span> }] : []),
          ]}
        />
        {b.coverage && (
          <div>
            <div className="mb-1 text-[12px] font-medium text-zinc-600">各坐席实发条数</div>
            <div className="flex flex-wrap gap-1.5">
              {b.coverage.map((x) => {
                const seat = seatById(s, x.seatId)
                return (
                  <span key={x.seatId} className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-2 py-1 text-[12px] text-zinc-700">
                    {seat && <SeatAvatar seat={seat} size={16} />}
                    {seat?.displayName ?? '已删除'} <b className="tabular-nums">{x.count}</b>
                  </span>
                )
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-400">同时加了多个号的客户只收一条，发送身份优先用他的主归属坐席。</p>
          </div>
        )}
        {(b.text || b.contentKind === 'text') && (
          <div>
            <div className="mb-1 text-[12px] font-medium text-zinc-600">{b.contentKind === 'text' ? '全文' : '随附说明'}</div>
            <div className="rounded-md bg-zinc-50 px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap text-zinc-800">{b.text}</div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/** 新建群发：选发送方式 → 选坐席 → 名称与文本 → 发送前预览 → 立即 / 定时 */
export function BroadcastCreateModal({ s, onClose }: { s: DemoStore; onClose: () => void }) {
  const [openedAt] = useState(Date.now)
  const seats = useMemo(() => s.seats, [s.seats])
  const [reach, setReach] = useState<Reach>('single')
  const [seatId, setSeatId] = useState(seats[0]?.id ?? '')
  const [coverIds, setCoverIds] = useState<string[]>(seats.map((x) => x.id))
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [mode, setMode] = useState<SendMode>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [preview, setPreview] = useState<BroadcastPreview | null>(null)

  const seat = seats.find((x) => x.id === seatId)
  const friends = useMemo(() => (seatId ? friendsOfSeat(s, seatId) : []), [s, seatId])
  // 预览与真正发送算的是同一份计划，预览说触达多少人就发多少条
  const plan = useMemo(() => (reach === 'coverage' && coverIds.length ? planCoverage(s, coverIds, new Date().toISOString()) : null), [s, reach, coverIds])
  const operatorId = s.session.adminStaffId
  const perStaff = s.enterprise.broadcastPerStaffPerDay
  const scheduleOk = mode === 'now' || (!!scheduledAt && new Date(scheduledAt).getTime() > openedAt)
  const reachCount = reach === 'single' ? friends.length : (plan?.deliveries.length ?? 0)
  const skipCount = reach === 'single' ? 0 : (plan?.skips.length ?? 0)
  const error = !operatorId
    ? '后台未登录管理员'
    : reach === 'single'
      ? !seat
        ? '选一个发送坐席'
        : friends.length === 0
          ? '该坐席还没有好友'
          : ''
      : coverIds.length === 0
        ? '至少选一个坐席'
        : reachCount === 0
          ? '所选坐席覆盖不到任何客户'
          : ''
  const formError = error || (!name.trim() ? '填任务名称' : !text.trim() ? '填内容' : !scheduleOk ? '定时时间要晚于现在' : '')

  const currentPreviewFingerprint = broadcastPreviewFingerprint([reach, seatId, coverIds, name, text, mode, scheduledAt])
  const previewStale = !!preview && isBroadcastPreviewStale(preview.conditionFingerprint, currentPreviewFingerprint)

  const toggleCover = (id: string, on: boolean) => setCoverIds(on ? [...coverIds, id] : coverIds.filter((x) => x !== id))

  const openPreview = () => {
    if (formError || !operatorId) return
    if (mode === 'scheduled' && new Date(scheduledAt).getTime() <= Date.now()) return toast('定时时间要晚于现在', 'warn')
    setPreview({
      customerIds: reach === 'single' ? friends.map((customer) => customer.id) : (plan?.deliveries.map((delivery) => delivery.customer.id) ?? []),
      seatIds: reach === 'single' ? [seat!.id] : [...coverIds],
      reach,
      reachCount,
      skipCount,
      skipReasons: plan?.skipReasons,
      targetDesc: reach === 'single' ? `全部好友（${seat!.displayName}）` : `多坐席覆盖（${coverIds.length} 个坐席）`,
      scheduledAt: mode === 'scheduled' ? new Date(scheduledAt).toISOString() : null,
      conditionFingerprint: currentPreviewFingerprint,
    })
  }

  const submit = () => {
    if (!preview || !operatorId) return
    if (previewStale) return toast('条件变了，请重新预览', 'warn')
    const r =
      preview.reach === 'single'
        ? s.sendBroadcast({ name: name.trim(), seatId: preview.seatIds[0], operatorId, targetKind: 'friends', targetDesc: preview.targetDesc, text: text.trim(), customerIds: preview.customerIds, scheduledAt: preview.scheduledAt })
        : s.sendCoverageBroadcast({ name: name.trim(), seatIds: preview.seatIds, operatorId, text: text.trim(), customerIds: preview.customerIds, scheduledAt: preview.scheduledAt })
    if (!r) return toast(`该实操员工今天的群发任务已达上限 ${perStaff}`, 'warn')
    if (r.reason) return toast(r.reason, 'warn')
    if (preview.scheduledAt) toast('已创建定时任务（演示里不实际投递）', 'info')
    else toast(`已发送 ${r.sent} 人${r.skipped ? `，跳过 ${r.skipped} 人` : ''}`)
    setPreview(null)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="新建群发"
      width={620}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!!formError} title={formError || undefined} onClick={openPreview}>
            <Send size={13} /> 预览
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={<span>发送方式 <DemoLevelTag level="P1" /></span>} hint="全覆盖用来发全员通知：同时加了几个号的客户也只收一条">
          <div className="flex gap-2">
            {(
              [
                { v: 'single', label: '单个坐席', desc: '以一个坐席身份发给它的全部好友' },
                { v: 'coverage', label: '多坐席全覆盖', desc: '多个坐席合起来覆盖到人，自动去重' },
              ] as { v: Reach; label: string; desc: string }[]
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setReach(o.v)}
                className={`flex-1 rounded-md border px-3 py-2 text-left transition ${reach === o.v ? 'border-brand-400 bg-brand-50/70 ring-1 ring-brand-200' : 'border-zinc-200 hover:border-zinc-300'}`}
              >
                <div className={`text-[13px] font-medium ${reach === o.v ? 'text-brand-900' : 'text-zinc-800'}`}>{o.label}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-zinc-500">{o.desc}</div>
              </button>
            ))}
          </div>
        </Field>

        {reach === 'single' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="发送坐席" required hint="以该坐席身份进客户私聊">
              <Select value={seatId} onChange={(e) => setSeatId(e.target.value)}>
                {seats.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.displayName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="目标" hint="所有把该坐席加为坐席的在册客户">
              <div className="flex h-8 items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 text-[13px] text-zinc-800">
                {seat && <SeatAvatar seat={seat} size={18} />}
                全部好友 · <b className="tabular-nums">{friends.length}</b> 人
              </div>
            </Field>
          </div>
        ) : (
          <Field label="参与覆盖的坐席" required hint="顺序即挑选优先级；客户的主归属坐席永远优先">
            <div className="rounded-md border border-zinc-200">
              <div className="flex items-center justify-between border-b border-zinc-100 px-2.5 py-1.5 text-[11px] text-zinc-500">
                <span>已选 {coverIds.length} / {seats.length}</span>
                <span className="flex gap-2">
                  <button type="button" className="text-brand-700 hover:underline" onClick={() => setCoverIds(seats.map((x) => x.id))}>
                    全选
                  </button>
                  <button type="button" className="text-zinc-500 hover:underline" onClick={() => setCoverIds([])}>
                    清空
                  </button>
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto">
                {seats.map((x) => (
                  <label key={x.id} className="flex cursor-pointer items-center gap-2.5 border-b border-zinc-50 px-2.5 py-1.5 last:border-b-0 hover:bg-zinc-50">
                    <Checkbox checked={coverIds.includes(x.id)} onChange={(on) => toggleCover(x.id, on)} />
                    <SeatAvatar seat={x} size={22} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-zinc-800">{x.displayName}</span>
                      <span className="block truncate text-[11px] text-zinc-500">{x.roleDesc}</span>
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">{friendsOfSeat(s, x.id).length} 好友</span>
                  </label>
                ))}
              </div>
            </div>
          </Field>
        )}

        <Field label="任务名称" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="内部可见，如：本周市场观点" />
        </Field>
        <Field label="文本内容" required hint="所有收件人收到相同的正文">
          <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={<span>发送时机 <DemoLevelTag level="P1" /></span>}>
            <Select value={mode} onChange={(e) => setMode(e.target.value as SendMode)}>
              <option value="now">立即发送</option>
              <option value="scheduled">定时发送</option>
            </Select>
          </Field>
          {mode === 'scheduled' && (
            <Field label="定时时间" required hint="名单在预览时锁定，之后新加的客户不在这次名单里">
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </Field>
          )}
        </div>

        <CoveragePreview reach={reach} s={s} plan={plan} reachCount={reachCount} error={error} />

        <div className="text-[11px] text-zinc-400">
          实操员工记为当前管理员「{staffById(s, operatorId)?.name ?? '-'}」，占用其今日任务额度（{perStaff} 个 / 天）。
          {reach === 'coverage' && '全覆盖只算他一个任务，不占各坐席实操员工的额度。'}
          {formError && <span className="ml-1 text-zinc-500">{formError}</span>}
        </div>
        {preview && (
          <Modal
            open
            onClose={() => setPreview(null)}
            title="群发预览"
            width={460}
            footer={
              <>
                <Button onClick={() => setPreview(null)}>返回修改</Button>
                <Button variant="primary" disabled={previewStale} title={previewStale ? '条件变了，请重新预览' : undefined} onClick={submit}>
                  {preview.scheduledAt ? '确认创建定时任务' : `确认发送给 ${preview.reachCount} 人`}
                </Button>
              </>
            }
          >
            <div className="space-y-3">
              <div className="rounded-md border border-brand-200 bg-brand-50/60 px-3 py-2 text-[13px] text-brand-900">
                名单已锁定，共 <b className="tabular-nums">{preview.reachCount}</b> 人。
              </div>
              <div className="text-[12px] text-zinc-600">目标：{preview.targetDesc}</div>
              {previewStale && <div className="text-[12px] text-amber-700">条件变了，请重新预览</div>}
              {preview.skipCount > 0 && <div className="text-[12px] text-amber-700">按当前状态预计跳过 {preview.skipCount} 人（{skipSummary(preview.skipReasons)}），发送时仍会再次校验。</div>}
              <div className="text-[12px] leading-relaxed text-zinc-500">名单在预览时锁定，之后新加的客户不在这次名单里。</div>
              {preview.scheduledAt && <DemoNote compact>定时群发在演示里不实际投递。</DemoNote>}
            </div>
          </Modal>
        )}
      </div>
    </Modal>
  )
}

/** 发送前预览：触达多少人、哪些坐席各发多少、谁被跳过与为什么 */
function CoveragePreview({ reach, s, plan, reachCount, error }: { reach: Reach; s: DemoStore; plan: ReturnType<typeof planCoverage> | null; reachCount: number; error: string }) {
  if (reach !== 'coverage') return null
  if (error) return <Note tone="amber">{error}</Note>
  if (!plan) return null
  const used = plan.bySeat.filter((x) => x.count > 0)
  const skips = Object.entries(plan.skipReasons).filter(([, n]) => n > 0)
  return (
    <div className="rounded-md border border-brand-200 bg-brand-50/50 p-3">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-brand-900">
        <Users size={13} /> 发送前预览
      </div>
      <div className="mt-1.5 text-[13px] text-zinc-800">
        去重后触达 <b className="tabular-nums text-brand-800">{reachCount}</b> 人，一人只收一条。
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {used.map((x) => (
          <span key={x.seatId} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[12px] text-zinc-700">
            {seatById(s, x.seatId)?.displayName ?? '已删除'} <b className="tabular-nums">{x.count}</b>
          </span>
        ))}
        {!used.length && <span className="text-[12px] text-zinc-500">没有坐席能发出</span>}
      </div>
      <div className="mt-2 text-[12px] text-zinc-600">
        {skips.length ? (
          <span className="flex flex-wrap items-center gap-1.5">
            跳过 <b className="tabular-nums text-amber-700">{plan.skips.length}</b> 人：
            {skips.map(([k, n]) => (
              <Pill key={k} tone="amber">
                {skipLabel(k)} {n}
              </Pill>
            ))}
          </span>
        ) : (
          <span className="text-zinc-500">没有人被跳过。</span>
        )}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-zinc-500">没加过任何所选坐席的客户不算在内，也不计入跳过——他本来就不在这次目标里。</p>
    </div>
  )
}
