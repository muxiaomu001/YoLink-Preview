import { useMemo, useState } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { fmtDateTime } from '@/domain/time'
import { customersOfSeat, seatById, staffById } from '@/store/selectors'
import { Button, Field, Input, Select, Textarea } from '@/ui/primitives'
import { Card, Note, PageHeader, SeatAvatar, Table } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { useWorkbench } from '../useWorkbench'

export function BroadcastPage() {
  const { s, staff, seat, can } = useWorkbench()
  const [name, setName] = useState('')
  const [targetKind, setTargetKind] = useState<'mine' | 'title' | 'tag'>('mine')
  const [targetId, setTargetId] = useState('')
  const [text, setText] = useState('')

  const targets = useMemo(() => {
    if (!seat) return []
    const mine = customersOfSeat(s, seat.id)
    if (targetKind === 'mine') return mine
    if (targetKind === 'title') return mine.filter((c) => c.titleIds.includes(targetId))
    return mine.filter((c) => c.tagIds.includes(targetId))
  }, [s, seat, targetKind, targetId])

  const targetDesc = targetKind === 'mine' ? '我的客户' : targetKind === 'title' ? `头衔 = ${s.titles.find((t) => t.id === targetId)?.name ?? ''}` : `内部标签 = ${s.tags.find((t) => t.id === targetId)?.name ?? ''}`
  const todayCount = s.broadcasts.filter((b) => b.operatorId === staff?.id && new Date(b.sentAt).toDateString() === new Date().toDateString()).length
  const overLimit = todayCount >= 3

  const send = () => {
    if (!seat || !staff || !text.trim() || !name.trim() || targets.length === 0) return
    s.sendBroadcast({ name: name.trim(), seatId: seat.id, operatorId: staff.id, targetDesc, text: text.trim(), customerIds: targets.map((c) => c.id) })
    toast(`已以「${seat.displayName}」身份发给 ${targets.length} 位客户，各自进他们与本坐席的私聊`)
    setName('')
    setText('')
  }

  if (!can('broadcast')) return <Note tone="amber">当前员工角色没有 broadcast 能力。</Note>

  return (
    <div className="thin-scroll h-full overflow-y-auto p-5">
      <PageHeader title="群发" desc="以当前坐席身份发送，消息进每位客户与本坐席的私聊。频控：每个实操员工每天 3 个任务（跨其持有的坐席合并），每客户每天最多收 2 条（跨坐席合并）。" />
      <div className="grid grid-cols-[1fr_360px] gap-4">
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
                    setTargetKind(e.target.value as typeof targetKind)
                    setTargetId('')
                  }}
                >
                  <option value="mine">我的客户（本坐席主归属）</option>
                  <option value="title">按头衔</option>
                  <option value="tag">按内部标签</option>
                </Select>
              </Field>
              {targetKind !== 'mine' && (
                <Field label={targetKind === 'title' ? '头衔' : '内部标签'}>
                  <Select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                    <option value="">选择…</option>
                    {(targetKind === 'title' ? s.titles : s.tags).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>
            <Field label="内容" required hint="支持 {{customer.nickname}}">
              <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
            <div className="flex items-center justify-between">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setText('各位好，本周观点已整理：美元短端仍有吸引力，港股科技反弹属修复，黄金维持区间配置。周五晚 8 点线上复盘，欢迎参加。\n\n以上仅为信息分享，不构成投资建议。')
                  toast('AI 已按「本周观点、稳健语气、中等长度」写好文案', 'info')
                }}
              >
                <Sparkles size={13} /> AI 写文案
              </Button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500">
                  预计发送 <b className="text-zinc-900">{targets.length}</b> 人 · 今日已用 {todayCount}/3
                </span>
                <Button variant="primary" disabled={overLimit || !text.trim() || !name.trim() || targets.length === 0} onClick={send}>
                  <Send size={13} /> 立即发送
                </Button>
              </div>
            </div>
            {overLimit && <div className="text-xs text-amber-700">今日群发任务已达上限（3 个），明天再发。</div>}
          </div>
        </Card>
        <Card title="群发记录" padded={false}>
          <Table
            rows={s.broadcasts}
            rowKey={(b) => b.id}
            dense
            columns={[
              {
                key: 'name',
                title: '任务',
                render: (b) => (
                  <div>
                    <div className="text-zinc-900">{b.name}</div>
                    <div className="text-[10px] text-zinc-400">
                      {fmtDateTime(b.sentAt)} · {seatById(s, b.seatId)?.displayName} · {staffById(s, b.operatorId)?.name}
                    </div>
                    <div className="text-[10px] text-zinc-400">{b.targetDesc}</div>
                  </div>
                ),
              },
              { key: 'n', title: '送达/已读', align: 'right', render: (b) => <span className="tabular-nums">{b.sentCount}/{b.readCount}</span> },
            ]}
          />
        </Card>
      </div>
    </div>
  )
}
