/**
 * 日报与提醒：接收人卡片（列表 + 新增弹窗）。渠道文案与层级来自 labels.ts。
 */
import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { ReportChannel, ReportRecipient } from '@/domain/types'
import { REPORT_CHANNEL_LABEL } from '@/domain/labels'
import { newId } from '@/domain/ids'
import { useStore } from '@/store/store'
import { staffById } from '@/store/selectors'
import { Button, Checkbox, Field, Input, Select } from '@/ui/primitives'
import { Card, Pill, Table } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'

const CHANNELS = Object.keys(REPORT_CHANNEL_LABEL) as ReportChannel[]
const isAvailable = (c: ReportChannel) => REPORT_CHANNEL_LABEL[c].level === 'P0'

/** 渠道多选：P1/P2 渠道禁用并标注层级 */
function ChannelPicker({ value, onChange }: { value: ReportChannel[]; onChange: (v: ReportChannel[]) => void }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {CHANNELS.map((c) => {
        const meta = REPORT_CHANNEL_LABEL[c]
        const on = value.includes(c)
        return (
          <Checkbox
            key={c}
            checked={on}
            disabled={!isAvailable(c)}
            onChange={(v) => onChange(v ? [...value, c] : value.filter((x) => x !== c))}
            label={
              <span className="inline-flex items-center gap-1">
                {meta.name}
                {!isAvailable(c) && <Pill tone="zinc">{meta.level}</Pill>}
              </span>
            }
          />
        )
      })}
    </div>
  )
}

export function RecipientsCard() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const recipients = s.dailyReport.recipients
  const [adding, setAdding] = useState(false)

  const save = (next: ReportRecipient[], msg: string) => {
    s.updateDailyReportSettings({ recipients: next }, admin)
    toast(msg)
  }
  const remove = async (r: ReportRecipient) => {
    const ok = await confirm({ title: `移除接收人「${r.name}」`, body: '移除后明天起不再给这个人发日报与事实提醒。', okText: '移除', danger: true })
    if (!ok) return
    save(
      recipients.filter((x) => x.id !== r.id),
      `已移除接收人「${r.name}」`,
    )
  }

  return (
    <Card
      title={`接收人 · ${recipients.length} 人`}
      padded={false}
      extra={
        <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
          <Plus size={12} /> 添加接收人
        </Button>
      }
    >
      <Table
        rows={recipients}
        rowKey={(r) => r.id}
        empty="还没有接收人，日报不会发出"
        columns={[
          { key: 'name', title: '姓名', render: (r) => <span className="font-medium text-zinc-900">{r.name}</span> },
          {
            key: 'staff',
            title: '是否关联员工',
            render: (r) => {
              const st = staffById(s, r.staffId)
              return st ? <Pill tone="blue">员工 · {st.name}</Pill> : <Pill tone="zinc">经营者，不登录后台</Pill>
            },
          },
          {
            key: 'channels',
            title: '渠道',
            render: (r) => (
              <ChannelPicker
                value={r.channels}
                onChange={(channels) => {
                  if (!channels.length) {
                    toast('至少保留一个渠道', 'warn')
                    return
                  }
                  save(
                    recipients.map((x) => (x.id === r.id ? { ...x, channels } : x)),
                    `「${r.name}」的渠道已更新：${channels.map((c) => REPORT_CHANNEL_LABEL[c].name).join('、')}`,
                  )
                }}
              />
            ),
          },
          {
            key: 'ops',
            title: '操作',
            align: 'right',
            width: '80px',
            render: (r) => (
              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => void remove(r)}>
                移除
              </Button>
            ),
          },
        ]}
      />
      {adding && <AddRecipientModal onClose={() => setAdding(false)} onAdd={(r) => save([...recipients, r], `已添加接收人「${r.name}」，明早 ${s.dailyReport.sendTime} 起收到日报`)} />}
    </Card>
  )
}

function AddRecipientModal({ onClose, onAdd }: { onClose: () => void; onAdd: (r: ReportRecipient) => void }) {
  const s = useStore()
  const used = new Set(s.dailyReport.recipients.map((r) => r.staffId).filter(Boolean))
  const candidates = s.staff.filter((st) => st.status === 'active' && !used.has(st.id))
  const [staffId, setStaffId] = useState('')
  const [name, setName] = useState('')
  const [channels, setChannels] = useState<ReportChannel[]>(['app'])
  const pickStaff = (id: string) => {
    setStaffId(id)
    const st = staffById(s, id)
    if (st) setName(st.name)
    // 不关联员工时 App 推送收不到，默认改成企微
    if (!id) {
      setChannels((list) => {
        const rest = list.filter((c) => c !== 'app')
        return rest.length ? rest : ['wecom']
      })
    }
  }
  const finalName = name.trim()
  const errors: string[] = []
  if (!finalName || finalName.length > 32) errors.push('姓名 1 到 32 字')
  if (!channels.length) errors.push('至少选一个渠道')
  if (!staffId && channels.includes('app')) errors.push('未关联员工收不到 App 推送')
  const submit = () => {
    if (errors.length) return
    onAdd({ id: newId('rr'), name: finalName, staffId: staffId || undefined, channels })
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="添加接收人"
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={errors.length > 0} onClick={submit}>
            添加
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="关联员工" hint="经营者不一定有后台账号，可不关联">
          <Select value={staffId} onChange={(e) => pickStaff(e.target.value)}>
            <option value="">不关联（经营者）</option>
            {candidates.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}（{s.roles.find((r) => r.id === st.roleId)?.name}）
              </option>
            ))}
          </Select>
        </Field>
        <Field label="姓名" required hint="1 到 32 字">
          <Input value={name} maxLength={32} onChange={(e) => setName(e.target.value)} placeholder="如：李总（经营者）" />
        </Field>
        <div>
          <div className="mb-1.5 text-xs font-medium text-zinc-600">渠道（App 推送需关联员工；微信服务号 P1，短信与邮件 P2）</div>
          <ChannelPicker value={channels} onChange={setChannels} />
        </div>
        {errors.length > 0 && <div className="text-[11px] text-red-600">{errors.join('；')}</div>}
      </div>
    </Modal>
  )
}
