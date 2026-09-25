/**
 * 日报与提醒（老板可感知层，PRD 05 942 行 + 15 文档口径）：
 * 只给事实与对比，不换算金额，不写建议。
 */
import { useState } from 'react'
import { Send } from 'lucide-react'
import type { DemoState } from '@/domain/types'
import { fmtDate } from '@/domain/time'
import { useStore } from '@/store/store'
import { dashboardNumbers, waitingSince } from '@/store/selectors'
import { Button, Field, Input } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, Table } from '@/ui/display'
import { DemoLevelTag, DemoNote } from '@/ui/DemoNote'
import { toast } from '@/ui/overlay'
import { RecipientsCard } from './DailyReportPage.parts'

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export function DailyReportPage() {
  const s = useStore()
  const recipients = s.dailyReport.recipients
  const send = () => {
    if (!recipients.length) {
      toast('没有接收人，先添加再发送', 'warn')
      return
    }
    s.sendDailyReportNow()
    toast(`已发送给：${recipients.map((r) => r.name).join('、')}，记录见下方`)
  }
  return (
    <div>
      <PageHeader
        title="日报与提醒"
        desc="每天按时把昨天的经营与服务数据推给指定的人，这里可以预览内容、管理接收人、查看发送记录。"
        extra={
          <Button variant="primary" onClick={send}>
            <Send size={14} /> 立即发送一次
          </Button>
        }
      />
      <Note>
        <b>只给事实与对比，不写建议</b>：日报会说「首响中位数 14 分钟，阈值 10 分钟」，不会说「建议增加客服」。
      </Note>
      <DemoNote className="mt-2">
        第一版支持 App 推送、企微机器人、飞书机器人；微信服务号<DemoLevelTag level="P1" />，短信与邮件<DemoLevelTag level="P2" />。演示里「立即发送一次」只生成记录，不真的推出去。
      </DemoNote>
      <div className="mt-4 space-y-4">
        <RecipientsCard />
        <div className="grid grid-cols-2 gap-4">
          <ScheduleCard />
          <PreviewCard />
        </div>
        <RecordsCard />
      </div>
    </div>
  )
}

function ScheduleCard() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const cfg = s.dailyReport
  const [sendTime, setSendTime] = useState(cfg.sendTime)
  const [th, setTh] = useState(cfg.thresholds)
  const num = (k: keyof typeof th, v: string) => setTh((t) => ({ ...t, [k]: Math.max(0, Number(v) || 0) }))
  const errors: string[] = []
  if (!TIME_RE.test(sendTime)) errors.push('发送时间格式 HH:MM')
  if (th.medianMinutes < 1 || th.waitingOverMinutes < 1 || th.idleDays < 1) errors.push('阈值都要大于 0')
  const dirty = sendTime !== cfg.sendTime || th.medianMinutes !== cfg.thresholds.medianMinutes || th.waitingOverMinutes !== cfg.thresholds.waitingOverMinutes || th.idleDays !== cfg.thresholds.idleDays
  return (
    <Card title="发送时间与事实提醒阈值">
      <div className="space-y-3">
        <Field label="每日发送时间" hint={`企业时区 ${s.enterprise.timezone}`}>
          <Input type="time" value={sendTime} onChange={(e) => setSendTime(e.target.value)} className="w-40" />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="首响中位数超过" hint="分钟">
            <Input type="number" min={1} value={th.medianMinutes} onChange={(e) => num('medianMinutes', e.target.value)} />
          </Field>
          <Field label="客户等待超过" hint="分钟">
            <Input type="number" min={1} value={th.waitingOverMinutes} onChange={(e) => num('waitingOverMinutes', e.target.value)} />
          </Field>
          <Field label="客户沉默超过" hint="天">
            <Input type="number" min={1} value={th.idleDays} onChange={(e) => num('idleDays', e.target.value)} />
          </Field>
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-500">超过阈值时，当天日报里标出来；等待超时的当场推一条事实提醒给接收人，只写「谁等了多久」，不写该怎么办。</p>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            disabled={errors.length > 0 || !dirty}
            onClick={() => {
              s.updateDailyReportSettings({ sendTime, thresholds: th }, admin)
              toast(`已保存：每天 ${sendTime} 发送；首响 ${th.medianMinutes} 分钟、等待 ${th.waitingOverMinutes} 分钟、沉默 ${th.idleDays} 天`)
            }}
          >
            保存
          </Button>
          {errors.length > 0 && <span className="text-[11px] text-red-600">{errors[0]}</span>}
        </div>
      </div>
    </Card>
  )
}

/** 用看板数字生成一段纯事实文本，与推送到手机的内容一致 */
function buildPreviewLines(s: DemoState): string[] {
  const n = dashboardNumbers(s)
  const th = s.dailyReport.thresholds
  const nowMs = Date.now()
  const waitingOver = s.conversations.filter((c) => {
    if (c.kind !== 'dm') return false
    const since = waitingSince(s, c)
    return !!since && nowMs - new Date(since).getTime() > th.waitingOverMinutes * 60000
  }).length
  const idle = s.customers.filter((c) => !c.deletedAt && nowMs - new Date(c.lastActiveAt).getTime() > th.idleDays * 86400000).length
  return [
    `【${s.enterprise.name} 经营日报】${fmtDate(new Date(nowMs).toISOString())}`,
    `客户 ${n.customersTotal} 位，本周新增 ${n.newThisWeek}；7 日活跃 ${n.active7} 位（${n.active7Pct}%）。`,
    `今日客服接待 ${n.repliedCustomers} 位客户，在线员工 ${n.onlineStaff} 人，人均 ${n.perStaff}。`,
    `首次响应中位数 ${n.medianMin} 分钟，阈值 ${th.medianMinutes} 分钟${n.medianMin > th.medianMinutes ? '，已超过' : ''}。`,
    `此刻等待超过 ${th.waitingOverMinutes} 分钟未回复的客户 ${waitingOver} 位。`,
    `沉默超过 ${th.idleDays} 天的客户 ${idle} 位。`,
    n.lastBc ? `最近一次群发「${n.lastBc.name}」送达 ${n.lastBc.sentCount}，已读 ${n.lastBc.readCount}。` : '尚未群发。',
  ]
}

function PreviewCard() {
  const s = useStore()
  const lines = buildPreviewLines(s)
  return (
    <Card title="预览今天的日报" extra={<span className="text-[11px] text-zinc-400">按当前数据实时生成</span>}>
      <pre className="whitespace-pre-wrap rounded-md bg-zinc-50 px-3 py-2.5 font-sans text-[12px] leading-relaxed text-zinc-800">{lines.join('\n')}</pre>
      <p className="mt-2 text-[11px] text-zinc-400">只有数字与阈值对比，没有金额换算，没有建议。</p>
    </Card>
  )
}

function RecordsCard() {
  const s = useStore()
  const rows = [...s.dailyReportRecords].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60)
  const failed = rows.filter((r) => r.status === 'failed').length
  return (
    <Card title="最近 30 天记录" padded={false} extra={<span className="text-[11px] text-zinc-500">{failed ? `${failed} 次发送失败` : '全部发送成功'}</span>}>
      <Table
        rows={rows}
        rowKey={(r) => r.id}
        dense
        empty="还没有发送记录"
        columns={[
          { key: 'date', title: '日期', width: '110px', render: (r) => <span className="tabular-nums text-zinc-700">{r.date}</span> },
          { key: 'to', title: '发送对象', render: (r) => <span className="text-zinc-700">{r.sentTo.join('、')}</span> },
          { key: 'status', title: '状态', width: '80px', render: (r) => (r.status === 'sent' ? <Pill tone="green">已发送</Pill> : <Pill tone="red">失败</Pill>) },
          { key: 'summary', title: '摘要', render: (r) => <span className={r.status === 'failed' ? 'text-red-700' : 'text-zinc-600'}>{r.summary}</span> },
        ]}
      />
    </Card>
  )
}
