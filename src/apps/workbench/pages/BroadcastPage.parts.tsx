/**
 * 群发页的记录表、详情弹窗与文案常量；TARGET_LABEL / StatusPill / DELIVERY_RULES 也供管理后台群发管理页复用。
 */
import type { Broadcast, BroadcastStatus, BroadcastTargetKind } from '@/domain/types'
import { fmtDateTime } from '@/domain/time'
import { seatById, staffById } from '@/store/selectors'
import { Button } from '@/ui/primitives'
import { KV, Pill, Table } from '@/ui/display'
import { Modal } from '@/ui/overlay'
import { useWorkbench } from '../useWorkbench'

export const TARGET_LABEL: Record<BroadcastTargetKind, string> = { friends: '全部好友', mine: '主归属客户', tag: '按标签', title: '按头衔', purchase: '按购买', role: '按角色', group: '指定群' }

const STATUS_META: Record<BroadcastStatus, { label: string; tone: 'zinc' | 'green' | 'amber' | 'red' | 'blue' }> = {
  scheduled: { label: '定时', tone: 'blue' },
  sending: { label: '发送中', tone: 'amber' },
  done: { label: '已完成', tone: 'green' },
  failed: { label: '失败', tone: 'red' },
}

export const PREVIEW_LEN = 50

/** 投递规则一句话，放 HelpTip 里 */
export const DELIVERY_RULES = '目标人群在发送时计算（定时任务也是）；自动跳过已注销、已拉黑、屏蔽本坐席、当日已达频控的客户；每任务每客户最多一条；「指定群」是往群里发一条群消息。'

/** 把变量替换成示例昵称；发送时逐人替换 */
export function renderVars(text: string, nickname: string): string {
  return text.replaceAll('{{customer.nickname}}', nickname)
}

export function StatusPill({ status }: { status: BroadcastStatus }) {
  const m = STATUS_META[status]
  return <Pill tone={m.tone}>{m.label}</Pill>
}

export function BroadcastRecords({ rows, onDetail }: { rows: Broadcast[]; onDetail: (b: Broadcast) => void }) {
  const { s } = useWorkbench()
  return (
    <Table
      rows={rows}
      rowKey={(b) => b.id}
      dense
      empty="还没有群发记录"
      columns={[
        {
          key: 'at',
          title: '发送时间',
          render: (b) => (
            <div>
              <div className="tabular-nums text-zinc-800">{fmtDateTime(b.status === 'scheduled' && b.scheduledAt ? b.scheduledAt : b.sentAt)}</div>
              <div className="text-[11px] text-zinc-400">
                {seatById(s, b.seatId)?.displayName} · {staffById(s, b.operatorId)?.name}
              </div>
            </div>
          ),
        },
        {
          key: 'target',
          title: '目标',
          render: (b) => (
            <div>
              <div className="text-zinc-800">{TARGET_LABEL[b.targetKind]}</div>
              <div className="max-w-40 truncate text-[11px] text-zinc-400" title={b.targetDesc}>
                {b.targetDesc}
              </div>
            </div>
          ),
        },
        {
          key: 'preview',
          title: '内容预览',
          render: (b) => (
            <span className="block max-w-56 truncate text-zinc-600" title={b.text}>
              {b.contentKind === 'image' && <Pill className="mr-1">图片</Pill>}
              {b.text.slice(0, PREVIEW_LEN)}
              {b.text.length > PREVIEW_LEN ? '…' : ''}
            </span>
          ),
        },
        { key: 'sent', title: '送达', align: 'right', render: (b) => <span className="tabular-nums">{b.sentCount}</span> },
        { key: 'read', title: '已读', align: 'right', render: (b) => <span className="tabular-nums text-zinc-500">{b.readCount}</span> },
        { key: 'skipped', title: '跳过', align: 'right', render: (b) => <span className={`tabular-nums ${b.skippedCount ? 'text-amber-700' : 'text-zinc-400'}`}>{b.skippedCount}</span> },
        { key: 'status', title: '状态', render: (b) => <StatusPill status={b.status} /> },
        {
          key: 'ops',
          title: '操作',
          align: 'right',
          render: (b) => (
            <Button size="sm" variant="ghost" onClick={() => onDetail(b)}>
              查看详情
            </Button>
          ),
        },
      ]}
    />
  )
}

export function BroadcastDetailModal({ b, onClose }: { b: Broadcast; onClose: () => void }) {
  const { s } = useWorkbench()
  return (
    <Modal open onClose={onClose} title={`群发：${b.name}`} width={560} footer={<Button onClick={onClose}>关闭</Button>}>
      <div className="space-y-3">
        <KV
          items={[
            { k: '发送身份', v: `${seatById(s, b.seatId)?.displayName ?? '-'}（实操：${staffById(s, b.operatorId)?.name ?? '-'}）` },
            { k: '目标', v: `${TARGET_LABEL[b.targetKind]} · ${b.targetDesc}` },
            { k: '内容类型', v: b.contentKind === 'image' ? '图片' : '文本' },
            { k: '状态', v: <StatusPill status={b.status} /> },
            { k: b.status === 'scheduled' ? '计划时间' : '发送时间', v: fmtDateTime(b.status === 'scheduled' && b.scheduledAt ? b.scheduledAt : b.sentAt) },
            { k: '送达 / 已读 / 跳过', v: `${b.sentCount} / ${b.readCount} / ${b.skippedCount}` },
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
