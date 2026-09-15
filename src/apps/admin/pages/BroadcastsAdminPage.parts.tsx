/**
 * 群发管理页（管理后台）的记录表、详情弹窗与「新建群发」弹窗。
 * 目标固定为所选坐席的全部好友，实操记当前后台管理员。
 */
import { useMemo, useState } from 'react'
import { Send } from 'lucide-react'
import type { Broadcast, DemoState } from '@/domain/types'
import { fmtDateTime } from '@/domain/time'
import type { DemoStore } from '@/store/store'
import { friendsOfSeat, seatById, staffById } from '@/store/selectors'
import { Button, Field, Input, Select, Textarea } from '@/ui/primitives'
import { KV, SeatAvatar, Table } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { PREVIEW_LEN, StatusPill, TARGET_LABEL } from '@/apps/workbench/pages/BroadcastPage.parts'

type SendMode = 'now' | 'scheduled'

/** 记录表：全部坐席的群发，倒序 */
export function BroadcastsAdminTable({ s, rows, onDetail }: { s: DemoState; rows: Broadcast[]; onDetail: (b: Broadcast) => void }) {
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
            return seat ? (
              <span className="inline-flex items-center gap-1.5">
                <SeatAvatar seat={seat} size={20} /> {seat.displayName}
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
            <span className="block max-w-64 truncate text-zinc-600" title={b.text}>
              <span className="mr-1 text-zinc-400">{b.name} ·</span>
              {b.text.slice(0, PREVIEW_LEN)}
              {b.text.length > PREVIEW_LEN ? '…' : ''}
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
        { key: 'status', title: '状态', render: (b) => <StatusPill status={b.status} /> },
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
            { k: '发送坐席', v: seatById(s, b.seatId)?.displayName ?? '-' },
            { k: '实操员工', v: staffById(s, b.operatorId)?.name ?? '-' },
            { k: '目标', v: `${TARGET_LABEL[b.targetKind]} · ${b.targetDesc}` },
            { k: '内容类型', v: b.contentKind === 'image' ? '图片' : '文本' },
            { k: '状态', v: <StatusPill status={b.status} /> },
            { k: b.status === 'scheduled' ? '计划时间' : '发送时间', v: fmtDateTime(b.status === 'scheduled' && b.scheduledAt ? b.scheduledAt : b.sentAt) },
            { k: '送达', v: <span className="tabular-nums">{b.sentCount}</span> },
            { k: '已读', v: <span className="tabular-nums">{b.readCount}</span> },
            { k: '跳过', v: <span className="tabular-nums">{b.skippedCount}</span> },
          ]}
        />
        <div>
          <div className="mb-1 text-[12px] font-medium text-zinc-600">全文</div>
          <div className="rounded-md bg-zinc-50 px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap text-zinc-800">{b.text}</div>
        </div>
      </div>
    </Modal>
  )
}

/** 新建群发：选坐席 → 目标固定全部好友 → 名称与文本 → 立即 / 定时 */
export function BroadcastCreateModal({ s, onClose }: { s: DemoStore; onClose: () => void }) {
  const seats = useMemo(() => s.seats.filter((x) => x.status !== 'disabled'), [s.seats])
  const [seatId, setSeatId] = useState(seats[0]?.id ?? '')
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [mode, setMode] = useState<SendMode>('now')
  const [scheduledAt, setScheduledAt] = useState('')

  const seat = seats.find((x) => x.id === seatId)
  const friends = useMemo(() => (seatId ? friendsOfSeat(s, seatId) : []), [s, seatId])
  const operatorId = s.session.adminStaffId
  const perStaff = s.enterprise.broadcastPerStaffPerDay
  const scheduleOk = mode === 'now' || (!!scheduledAt && new Date(scheduledAt).getTime() > Date.now())
  const error = !operatorId ? '后台未登录管理员' : !seat ? '选一个发送坐席' : friends.length === 0 ? '该坐席还没有好友' : !name.trim() ? '填任务名称' : !text.trim() ? '填内容' : !scheduleOk ? '定时时间要晚于现在' : ''

  const submit = () => {
    if (error || !seat || !operatorId) return
    const r = s.sendBroadcast({
      name: name.trim(),
      seatId: seat.id,
      operatorId,
      targetKind: 'friends',
      targetDesc: '全部好友',
      text: text.trim(),
      customerIds: friends.map((c) => c.id),
      scheduledAt: mode === 'scheduled' ? new Date(scheduledAt).toISOString() : null,
    })
    if (!r) return toast(`该实操员工今天的群发任务已达上限 ${perStaff}`, 'warn')
    if (mode === 'scheduled') toast(`已创建定时任务，到点以「${seat.displayName}」身份发给当时的全部好友`, 'info')
    else toast(`已发送 ${r.sent} 人，跳过 ${r.skipped} 人`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="新建群发"
      width={560}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!!error} title={error || undefined} onClick={submit}>
            <Send size={13} /> {mode === 'scheduled' ? '创建定时任务' : '立即发送'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
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
          <Field label="目标" hint="所有把该坐席加为官方联系人的在册客户">
            <div className="flex h-8 items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 text-[13px] text-zinc-800">
              {seat && <SeatAvatar seat={seat} size={18} />}
              全部好友 · <b className="tabular-nums">{friends.length}</b> 人
            </div>
          </Field>
        </div>
        <Field label="任务名称" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="内部可见，如：本周市场观点" />
        </Field>
        <Field label="文本内容" required hint="支持 {{customer.nickname}}，发送时逐人替换成客户昵称">
          <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="发送方式">
            <Select value={mode} onChange={(e) => setMode(e.target.value as SendMode)}>
              <option value="now">立即发送</option>
              <option value="scheduled">定时发送</option>
            </Select>
          </Field>
          {mode === 'scheduled' && (
            <Field label="定时时间" required hint="到点按当时人群计算再发">
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </Field>
          )}
        </div>
        <div className="text-[11px] text-zinc-400">
          实操员工记为当前管理员「{staffById(s, operatorId)?.name ?? '-'}」，占用其今日任务额度（{perStaff} 个 / 天）。
          {error && <span className="ml-1 text-zinc-500">{error}</span>}
        </div>
      </div>
    </Modal>
  )
}
