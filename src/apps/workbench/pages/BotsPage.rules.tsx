/**
 * 群活跃助手页：规则标签（表格、编辑弹窗、立即触发）与待审核 / 运行记录两块。
 */
import { useState } from 'react'
import { Play, Plus } from 'lucide-react'
import type { BotRule, BotRun, BotTrigger } from '@/domain/types'
import { fmtDateTime } from '@/domain/time'
import { confirm } from '@/ui/confirm'
import { Button, Checkbox, Field, Input, Select, Switch, Textarea } from '@/ui/primitives'
import { Avatar, Card, Pill, Table } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { useWorkbench } from '../useWorkbench'
import { RUN_STATUS_LABEL, RUN_STATUS_TONE, TRIGGER_LABEL, describeTrigger } from './BotsPage.shared'

const RUN_LOG_LIMIT = 30

/** 规则标签 */
export function RulesTab() {
  const { s, staff } = useWorkbench()
  const staffId = staff?.id ?? ''
  const [editing, setEditing] = useState<BotRule | null>(null)
  const [creating, setCreating] = useState(false)
  const names = (ids: string[], list: { id: string; name?: string; nickname?: string }[]) => ids.map((id) => list.find((x) => x.id === id)).filter(Boolean).map((x) => x?.name ?? x?.nickname).join('、')

  const simulate = (r: BotRule) => {
    const run = s.simulateBotRule(r.id, staffId)
    if (!run) return
    if (run.status === 'sent') toast(`「${r.name}」已触发：活跃角色发言已进群`, 'ok')
    else if (run.status === 'pending_review') toast(`「${r.name}」已触发：内容进入待审核，员工放行后才进群`, 'info')
    else toast(`「${r.name}」跳过：${run.reason}`, 'warn')
  }
  const remove = async (r: BotRule) => {
    const ok = await confirm({ title: `删除规则「${r.name}」`, body: '运行记录保留，只是不再触发。', okText: '删除', danger: true })
    if (!ok) return
    s.deleteBotRule(r.id, staffId)
    toast(`已删除规则「${r.name}」`)
  }

  return (
    <div className="space-y-3">
      <Card title="触发规则" padded={false} extra={<Button size="sm" variant="primary" onClick={() => setCreating(true)}><Plus size={13} /> 新建规则</Button>}>
        <Table
          rows={s.botRules}
          rowKey={(r) => r.id}
          columns={[
            { key: 'name', title: '名称', render: (r) => <span className="font-medium text-zinc-900">{r.name}</span> },
            { key: 'trigger', title: '触发', render: (r) => <span className="text-[12px]">{describeTrigger(r)}</span> },
            { key: 'limit', title: '每小时上限', align: 'right', render: (r) => <span className="tabular-nums">{r.hourlyLimit}</span> },
            { key: 'review', title: '审核模式', render: (r) => (r.reviewMode === 'review' ? <Pill tone="amber">先审后发</Pill> : <Pill tone="green">自动发</Pill>) },
            { key: 'groups', title: '群', render: (r) => names(r.groupIds, s.chatGroups) || <span className="text-zinc-400">无</span> },
            { key: 'script', title: '剧本', render: (r) => s.botScripts.find((x) => x.id === r.scriptId)?.name ?? <span className="text-red-600">剧本已删除</span> },
            { key: 'bots', title: '活跃角色', render: (r) => names(r.botIds, s.bots) || <span className="text-zinc-400">无</span> },
            { key: 'enabled', title: '启停', render: (r) => <Switch checked={r.enabled} onChange={(v) => { s.saveBotRule({ ...r, enabled: v }, staffId); toast(v ? `已启用「${r.name}」` : `已停用「${r.name}」`) }} /> },
            {
              key: 'ops',
              title: '操作',
              align: 'right',
              render: (r) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>编辑</Button>
                  <Button size="sm" variant="ghost" onClick={() => simulate(r)} title="走与服务端定时器同一条判定链：暂停 / 停用 / 全员禁言 / 每小时上限 → 跳过；先审后发 → 待审；否则进群">
                    <Play size={12} /> 立即触发一次
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => void remove(r)}>删除</Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      {(creating || editing) && <RuleModal rule={editing ?? undefined} onClose={() => { setCreating(false); setEditing(null) }} />}
    </div>
  )
}

function RuleModal({ rule, onClose }: { rule?: BotRule; onClose: () => void }) {
  const { s, staff } = useWorkbench()
  const [name, setName] = useState(rule?.name ?? '')
  const [trigger, setTrigger] = useState<BotTrigger>(rule?.trigger ?? 'silence')
  const [silence, setSilence] = useState(rule?.silenceMinutes ?? 60)
  const [times, setTimes] = useState((rule?.scheduleTimes ?? ['10:00']).join(','))
  const [hourly, setHourly] = useState(rule?.hourlyLimit ?? 2)
  const [reviewMode, setReviewMode] = useState<BotRule['reviewMode']>(rule?.reviewMode ?? s.aiSettings.group.reviewMode)
  const [groupIds, setGroupIds] = useState<string[]>(rule?.groupIds ?? [])
  const [scriptId, setScriptId] = useState(rule?.scriptId ?? s.botScripts[0]?.id ?? '')
  const [botIds, setBotIds] = useState<string[]>(rule?.botIds ?? [])
  const timeList = times.split(/[,，\s]+/).map((t) => t.trim()).filter(Boolean)
  const timeOk = timeList.every((t) => /^\d{2}:\d{2}$/.test(t))
  const error = !name.trim() ? '名称不能为空' : trigger === 'silence' && silence < 5 ? '沉默时长至少 5 分钟' : trigger === 'schedule' && (!timeList.length || !timeOk) ? '时段格式 HH:MM，多个用逗号分隔' : hourly < 1 ? '每小时上限至少 1' : !scriptId ? '请选择剧本' : groupIds.length === 0 ? '至少选一个群' : botIds.length === 0 ? '至少选一个活跃角色' : ''
  const groups = s.chatGroups.filter((g) => g.kind !== 'channel')
  const botsInGroups = s.bots.filter((b) => b.enabled)
  const submit = () => {
    if (error) return
    s.saveBotRule({ id: rule?.id, name: name.trim(), trigger, silenceMinutes: trigger === 'silence' ? silence : undefined, scheduleTimes: trigger === 'schedule' ? timeList : undefined, hourlyLimit: hourly, reviewMode, groupIds, scriptId, botIds, enabled: rule?.enabled ?? true }, staff?.id ?? '')
    toast(rule ? `规则「${name.trim()}」已更新` : `已新建规则「${name.trim()}」`)
    onClose()
  }
  const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0))
  return (
    <Modal
      open
      onClose={onClose}
      title={rule ? `编辑规则：${rule.name}` : '新建规则'}
      width={600}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!!error} onClick={submit}>{rule ? '保存' : '新建'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="名称" required>
            <Input value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="触发">
            <Select value={trigger} onChange={(e) => setTrigger(e.target.value as BotTrigger)}>
              {(Object.keys(TRIGGER_LABEL) as BotTrigger[]).map((k) => (
                <option key={k} value={k}>{TRIGGER_LABEL[k]}</option>
              ))}
            </Select>
          </Field>
          {trigger === 'silence' && (
            <Field label="沉默多少分钟" required hint="群内无人发言超过该时长">
              <Input type="number" min={5} value={silence} onChange={(e) => setSilence(num(e.target.value))} />
            </Field>
          )}
          {trigger === 'schedule' && (
            <Field label="时段" required hint="HH:MM，多个用逗号">
              <Input value={times} onChange={(e) => setTimes(e.target.value)} placeholder="10:00, 20:00" />
            </Field>
          )}
          <Field label="每小时上限" required hint="每群每小时活跃角色发言次数">
            <Input type="number" min={1} value={hourly} onChange={(e) => setHourly(num(e.target.value))} />
          </Field>
          <Field label="审核模式" hint="金融场景建议先审后发">
            <Select value={reviewMode} onChange={(e) => setReviewMode(e.target.value as BotRule['reviewMode'])}>
              <option value="review">先审后发</option>
              <option value="auto">自动发</option>
            </Select>
          </Field>
          <Field label="剧本" required>
            <Select value={scriptId} onChange={(e) => setScriptId(e.target.value)}>
              <option value="">选择…</option>
              {s.botScripts.map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="群" required>
          <div className="grid grid-cols-2 gap-1.5">
            {groups.map((g) => (
              <Checkbox key={g.id} checked={groupIds.includes(g.id)} onChange={(v) => setGroupIds((ids) => (v ? [...ids, g.id] : ids.filter((x) => x !== g.id)))} label={g.name} />
            ))}
          </div>
        </Field>
        <Field label="活跃角色" required hint="多选则轮换；只列出启用中的">
          <div className="grid grid-cols-2 gap-1.5">
            {botsInGroups.map((b) => (
              <Checkbox key={b.id} checked={botIds.includes(b.id)} onChange={(v) => setBotIds((ids) => (v ? [...ids, b.id] : ids.filter((x) => x !== b.id)))} label={`${b.nickname}${b.groupIds.length ? '' : '（未入群）'}`} />
            ))}
            {botsInGroups.length === 0 && <span className="text-[12px] text-zinc-400">没有启用中的活跃角色</span>}
          </div>
        </Field>
        {error && name && <p className="text-[12px] text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}

/** 待审核列表 + 运行记录 */
export function ReviewAndRuns() {
  const { s, staff } = useWorkbench()
  const staffId = staff?.id ?? ''
  const [rejecting, setRejecting] = useState<BotRun | null>(null)
  const [reason, setReason] = useState('')
  const pending = s.botRuns.filter((r) => r.status === 'pending_review')
  const recent = [...s.botRuns].sort((a, b) => b.at.localeCompare(a.at)).slice(0, RUN_LOG_LIMIT)
  const botOf = (id: string) => s.bots.find((b) => b.id === id)
  const groupName = (id: string) => s.chatGroups.find((g) => g.id === id)?.name ?? id
  const ruleName = (id: string | null) => (id ? s.botRules.find((r) => r.id === id)?.name ?? '已删除的规则' : '手动')

  const approve = (r: BotRun) => {
    const g = s.chatGroups.find((x) => x.id === r.groupId)
    if (g?.settings.allMuted) {
      toast(`「${g.name}」全员禁言中，放行也不会进群，请先解除禁言`, 'warn')
      return
    }
    const error = s.reviewBotRun(r.id, true, staffId)
    if (error) return toast(error, 'warn')
    toast(`已放行，「${botOf(r.botId)?.nickname}」的发言已进「${groupName(r.groupId)}」`)
  }
  const reject = () => {
    if (!rejecting || !reason.trim()) return
    const error = s.reviewBotRun(rejecting.id, false, staffId, reason.trim())
    if (error) return toast(error, 'warn')
    toast('已驳回，不会进群')
    setRejecting(null)
    setReason('')
  }

  return (
    <div className="grid grid-cols-[1fr_1fr] gap-4">
      <Card title={`待审核（${pending.length}）`} padded={false}>
        <Table
          rows={pending}
          rowKey={(r) => r.id}
          dense
          empty="没有待审核的活跃角色发言"
          columns={[
            { key: 'bot', title: '活跃角色', render: (r) => <span className="flex items-center gap-1.5"><Avatar text={botOf(r.botId)?.nickname ?? '?'} color={botOf(r.botId)?.avatarColor} size={20} />{botOf(r.botId)?.nickname}</span> },
            { key: 'group', title: '群', render: (r) => groupName(r.groupId) },
            { key: 'text', title: '内容', render: (r) => <span className="line-clamp-2 max-w-[240px] text-[12px] text-zinc-700">{r.text}</span> },
            { key: 'at', title: '时间', render: (r) => <span className="tabular-nums text-zinc-500">{fmtDateTime(r.at)}</span> },
            {
              key: 'ops',
              title: '操作',
              align: 'right',
              render: (r) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="primary" onClick={() => approve(r)}>放行</Button>
                  <Button size="sm" variant="danger" onClick={() => setRejecting(r)}>驳回</Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      <Card title={`运行记录（最近 ${RUN_LOG_LIMIT} 条）`} padded={false}>
        <Table
          rows={recent}
          rowKey={(r) => r.id}
          dense
          columns={[
            { key: 'at', title: '时间', render: (r) => <span className="tabular-nums text-zinc-500">{fmtDateTime(r.at)}</span> },
            { key: 'rule', title: '规则', render: (r) => <span className="text-[12px]">{ruleName(r.ruleId)}</span> },
            { key: 'bot', title: '活跃角色', render: (r) => botOf(r.botId)?.nickname ?? <span className="text-zinc-400">已删除</span> },
            { key: 'group', title: '群', render: (r) => groupName(r.groupId) },
            { key: 'status', title: '状态', render: (r) => <Pill tone={RUN_STATUS_TONE[r.status]}>{RUN_STATUS_LABEL[r.status]}</Pill> },
            { key: 'detail', title: '原因 / 内容', render: (r) => <span className="line-clamp-1 max-w-[220px] text-[12px] text-zinc-600" title={r.reason ?? r.text}>{r.status === 'skipped' || r.status === 'rejected' ? r.reason : r.text}</span> },
          ]}
        />
      </Card>
      {rejecting && (
        <Modal
          open
          onClose={() => setRejecting(null)}
          title="驳回这条活跃角色发言"
          width={440}
          footer={
            <>
              <Button onClick={() => setRejecting(null)}>取消</Button>
              <Button variant="danger" disabled={!reason.trim()} onClick={reject}>确认驳回</Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="rounded-md bg-zinc-50 px-3 py-2 text-[12px] leading-relaxed text-zinc-700">
              <span className="text-zinc-500">「{botOf(rejecting.botId)?.nickname}」→ {groupName(rejecting.groupId)}：</span>
              {rejecting.text}
            </div>
            <Field label="驳回原因" required hint="会写入这条发言的运行记录">
              <Textarea rows={2} maxLength={100} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="如：话题重复 / 口吻不像人设" />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  )
}
