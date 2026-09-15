/**
 * 群活跃助手页：机器人账号标签、剧本库标签及其弹窗。
 */
import { useState } from 'react'
import { Plus, Send } from 'lucide-react'
import type { BotAccount, BotScript, BotScriptSource } from '@/domain/types'
import { confirm } from '@/ui/confirm'
import { Button, Checkbox, Field, Input, Select, Switch, Textarea } from '@/ui/primitives'
import { Avatar, Card, Note, Pill, Table } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { useWorkbench } from '../useWorkbench'
import { BOT_AVATAR_COLORS, SCRIPT_TEMPLATES, SOURCE_LABEL } from './BotsPage.shared'

/** 机器人账号标签 */
export function BotsTab({ botLimit }: { botLimit: number }) {
  const { s, staff } = useWorkbench()
  const staffId = staff?.id ?? ''
  const [editing, setEditing] = useState<BotAccount | null>(null)
  const [creating, setCreating] = useState(false)
  const [manual, setManual] = useState<BotAccount | null>(null)
  const used = s.bots.filter((b) => b.enabled).length
  const full = used >= botLimit
  const groupName = (id: string) => s.chatGroups.find((g) => g.id === id)?.name ?? id

  const toggle = (b: BotAccount) => {
    if (!b.enabled && full) {
      toast(`授权上限 ${botLimit} 个已用完，先停用一个再启用`, 'warn')
      return
    }
    s.saveBot({ ...b, enabled: !b.enabled }, staffId)
    toast(b.enabled ? `已停用「${b.nickname}」，规则不再用它发言` : `已启用「${b.nickname}」`)
  }
  const remove = async (b: BotAccount) => {
    const ok = await confirm({ title: `删除机器人「${b.nickname}」`, body: '会从所属群移除，并从引用它的规则里去掉；历史消息与运行记录保留。', okText: '删除', danger: true })
    if (!ok) return
    s.deleteBot(b.id, staffId)
    toast(`已删除「${b.nickname}」`)
  }

  return (
    <div className="space-y-3">
      <Card
        title={`机器人账号（已启用 ${used} / 授权 ${botLimit}）`}
        padded={false}
        extra={
          <Button size="sm" variant="primary" disabled={full} title={full ? `许可证 AI 模块授权 ${botLimit} 个机器人账号，已用完` : undefined} onClick={() => setCreating(true)}>
            <Plus size={13} /> 新建机器人
          </Button>
        }
      >
        {full && <div className="border-b border-amber-100 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">已达许可证授权上限（{botLimit} 个启用中的机器人账号），不能再新建或启用；需要更多请在管理后台 → 许可证 里升级。</div>}
        <Table
          rows={s.bots}
          rowKey={(b) => b.id}
          columns={[
            { key: 'avatar', title: '头像', width: '48px', render: (b) => <Avatar text={b.nickname} color={b.avatarColor} size={28} /> },
            { key: 'name', title: '昵称', render: (b) => <span className="font-medium text-zinc-900">{b.nickname}</span> },
            { key: 'persona', title: '人设', render: (b) => <span className="line-clamp-2 max-w-[260px] text-xs text-zinc-600">{b.persona}</span> },
            { key: 'groups', title: '所属群', render: (b) => (b.groupIds.length ? b.groupIds.map(groupName).join('、') : <span className="text-zinc-400">未入群</span>) },
            { key: 'status', title: '状态', render: (b) => (b.enabled ? <Pill tone="green">启用</Pill> : <Pill>停用</Pill>) },
            { key: 'op', title: '实操员工', render: (b) => s.staff.find((x) => x.id === b.operatorStaffId)?.name ?? <span className="text-zinc-400">未指定</span> },
            {
              key: 'ops',
              title: '操作',
              align: 'right',
              render: (b) => (
                <div className="flex items-center justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(b)}>编辑</Button>
                  <Switch checked={b.enabled} onChange={() => toggle(b)} />
                  <Button size="sm" variant="ghost" disabled={!b.enabled || b.groupIds.length === 0} title={!b.enabled ? '已停用的机器人不能发言' : b.groupIds.length === 0 ? '先给它分配所属群' : undefined} onClick={() => setManual(b)}>
                    <Send size={12} /> 手动发一条
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => void remove(b)}>删除</Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      {(creating || editing) && <BotModal bot={editing ?? undefined} onClose={() => { setCreating(false); setEditing(null) }} />}
      {manual && <ManualSendModal bot={manual} onClose={() => setManual(null)} />}
    </div>
  )
}

function BotModal({ bot, onClose }: { bot?: BotAccount; onClose: () => void }) {
  const { s, staff } = useWorkbench()
  const [nickname, setNickname] = useState(bot?.nickname ?? '')
  const [color, setColor] = useState(bot?.avatarColor ?? BOT_AVATAR_COLORS[0])
  const [persona, setPersona] = useState(bot?.persona ?? '')
  const [groupIds, setGroupIds] = useState<string[]>(bot?.groupIds ?? [])
  const [operator, setOperator] = useState(bot?.operatorStaffId ?? staff?.id ?? '')
  const dup = s.bots.some((b) => b.id !== bot?.id && b.nickname.trim() === nickname.trim())
  const error = !nickname.trim() ? '昵称不能为空' : nickname.trim().length > 16 ? '昵称最多 16 字' : dup ? '已有同名机器人' : !persona.trim() ? '人设不能为空，AI 生成时要靠它保持口吻' : ''
  const groups = s.chatGroups.filter((g) => g.kind !== 'channel')
  const submit = () => {
    if (error) return
    s.saveBot({ id: bot?.id, nickname: nickname.trim(), avatarColor: color, persona: persona.trim(), groupIds, operatorStaffId: operator || null, enabled: bot?.enabled ?? true }, staff?.id ?? '')
    toast(bot ? `已更新「${nickname.trim()}」` : `已新建机器人「${nickname.trim()}」，已加入 ${groupIds.length} 个群`)
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={bot ? `编辑机器人：${bot.nickname}` : '新建机器人账号'}
      width={560}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!!error} onClick={submit}>{bot ? '保存' : '新建'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="昵称" required hint="客户看到的名字，与普通成员无差别">
            <Input value={nickname} maxLength={16} onChange={(e) => setNickname(e.target.value)} placeholder="如：老周说市" />
          </Field>
          <Field label="头像色">
            <div className="flex h-8 items-center gap-1.5">
              {BOT_AVATAR_COLORS.map((c) => (
                <button key={c} type="button" className={`h-6 w-6 rounded-full border-2 ${color === c ? 'border-zinc-900' : 'border-transparent'}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
              ))}
            </div>
          </Field>
        </div>
        <Field label="人设" required hint="性格、口吻、身份；AI 生成与混合剧本按它写话">
          <Textarea rows={3} maxLength={200} value={persona} onChange={(e) => setPersona(e.target.value)} placeholder="如：55 岁退休工程师，稳健派，喜欢聊美元短债和黄金，口吻平和" />
        </Field>
        <Field label="所属群" hint="保存后同步进群成员；只能进群，不能进频道">
          <div className="grid grid-cols-2 gap-1.5">
            {groups.map((g) => (
              <Checkbox key={g.id} checked={groupIds.includes(g.id)} onChange={(v) => setGroupIds((ids) => (v ? [...ids, g.id] : ids.filter((x) => x !== g.id)))} label={g.name} />
            ))}
          </div>
        </Field>
        <Field label="审核员工" hint="先审后发的内容进这位员工的待审列表；手动发言记真实操作者">
          <Select value={operator} onChange={(e) => setOperator(e.target.value)}>
            <option value="">未指定</option>
            {s.staff.filter((x) => x.status === 'active').map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </Select>
        </Field>
        {error && (nickname || persona) && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}

function ManualSendModal({ bot, onClose }: { bot: BotAccount; onClose: () => void }) {
  const { s, staff } = useWorkbench()
  const [groupId, setGroupId] = useState(bot.groupIds[0] ?? '')
  const [text, setText] = useState('')
  const g = s.chatGroups.find((x) => x.id === groupId)
  const error = !g ? '请选择群' : g.settings.allMuted ? '该群全员禁言中，机器人一律不发' : !text.trim() ? '内容不能为空' : text.includes('@') ? '不 @ 真实客户' : ''
  const submit = () => {
    if (error || !staff) return
    s.botManualSend(bot.id, groupId, text.trim(), staff.id)
    toast(`已以「${bot.nickname}」身份发到「${g?.name}」，消息记录操作者 ${staff.name}`)
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`以「${bot.nickname}」身份手动发一条`}
      width={480}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!!error} onClick={submit}><Send size={13} /> 发送</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Note>客户看到的是「{bot.nickname}」，消息上记录真实操作者（{staff?.name}）与来源「手动」，消息审计可查。</Note>
        <Field label="群" required>
          <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            {bot.groupIds.map((id) => (
              <option key={id} value={id}>{s.chatGroups.find((x) => x.id === id)?.name ?? id}</option>
            ))}
          </Select>
        </Field>
        <Field label="内容" required hint="按人设口吻写；不 @ 客户、不做交易承诺">
          <Textarea rows={3} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        {error && text && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}

/** 剧本库标签 */
export function ScriptsTab() {
  const { s, staff } = useWorkbench()
  const staffId = staff?.id ?? ''
  const [editing, setEditing] = useState<BotScript | null>(null)
  const [creating, setCreating] = useState(false)
  const remove = async (sc: BotScript) => {
    const using = s.botRules.filter((r) => r.scriptId === sc.id)
    const ok = await confirm({ title: `删除剧本「${sc.name}」`, body: using.length ? `有 ${using.length} 条规则在用它（${using.map((r) => r.name).join('、')}），删除后这些规则触发时会跳过。` : '删除后不可恢复。', okText: '删除', danger: true })
    if (!ok) return
    s.deleteBotScript(sc.id, staffId)
    toast(`已删除剧本「${sc.name}」`)
  }
  const addTemplate = (t: (typeof SCRIPT_TEMPLATES)[number]) => {
    s.saveBotScript({ ...t.script }, staffId)
    toast(`已把模板「${t.name}」加入剧本库，可再编辑`)
  }
  return (
    <div className="space-y-3">
      <Card title="剧本库" padded={false} extra={<Button size="sm" variant="primary" onClick={() => setCreating(true)}><Plus size={13} /> 新建剧本</Button>}>
        <Table
          rows={s.botScripts}
          rowKey={(x) => x.id}
          columns={[
            { key: 'name', title: '名称', render: (x) => <span className="font-medium text-zinc-900">{x.name}</span> },
            { key: 'source', title: '来源', render: (x) => <Pill tone={x.source === 'ai' ? 'purple' : x.source === 'mixed' ? 'blue' : 'zinc'}>{SOURCE_LABEL[x.source]}</Pill> },
            { key: 'scope', title: '范围', render: (x) => (x.groupId ? s.chatGroups.find((g) => g.id === x.groupId)?.name ?? x.groupId : '全局') },
            { key: 'lines', title: '台词数', align: 'right', render: (x) => (x.source === 'ai' ? <span className="text-zinc-400">AI 即兴</span> : <span className="tabular-nums">{x.lines.length}</span>) },
            { key: 'rules', title: '引用规则', align: 'right', render: (x) => <span className="tabular-nums">{s.botRules.filter((r) => r.scriptId === x.id).length}</span> },
            {
              key: 'ops',
              title: '操作',
              align: 'right',
              render: (x) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(x)}>编辑</Button>
                  <Button size="sm" variant="danger" onClick={() => void remove(x)}>删除</Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      <Card title="内置模板 · 金融投顾">
        <div className="grid grid-cols-2 gap-3">
          {SCRIPT_TEMPLATES.map((t) => (
            <div key={t.name} className="flex items-start justify-between gap-3 rounded-md border border-zinc-200 p-3">
              <div>
                <div className="text-[13px] font-medium text-zinc-900">{t.name} <Pill className="ml-1">{SOURCE_LABEL[t.script.source]}</Pill></div>
                <div className="mt-0.5 text-xs text-zinc-500">{t.desc}</div>
              </div>
              <Button size="sm" onClick={() => addTemplate(t)}>一键加入</Button>
            </div>
          ))}
        </div>
      </Card>
      {(creating || editing) && <ScriptModal script={editing ?? undefined} onClose={() => { setCreating(false); setEditing(null) }} />}
    </div>
  )
}

function ScriptModal({ script, onClose }: { script?: BotScript; onClose: () => void }) {
  const { s, staff } = useWorkbench()
  const [name, setName] = useState(script?.name ?? '')
  const [source, setSource] = useState<BotScriptSource>(script?.source ?? 'fixed')
  const [groupId, setGroupId] = useState(script?.groupId ?? '')
  const [linesText, setLinesText] = useState((script?.lines ?? []).join('\n'))
  const [topic, setTopic] = useState(script?.topic ?? '')
  const lines = linesText.split('\n').map((l) => l.trim()).filter(Boolean)
  const needLines = source !== 'ai'
  const needTopic = source !== 'fixed'
  const error = !name.trim() ? '名称不能为空' : needLines && lines.length === 0 ? '至少一条台词（每行一条）' : needTopic && !topic.trim() ? 'AI 生成需要主题提示' : lines.some((l) => l.includes('@')) ? '台词里不能 @ 客户' : ''
  const submit = () => {
    if (error) return
    s.saveBotScript({ id: script?.id, name: name.trim(), source, groupId: groupId || null, lines: needLines ? lines : [], topic: needTopic ? topic.trim() : undefined }, staff?.id ?? '')
    toast(script ? `剧本「${name.trim()}」已更新` : `已新建剧本「${name.trim()}」`)
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={script ? `编辑剧本：${script.name}` : '新建剧本'}
      width={560}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!!error} onClick={submit}>{script ? '保存' : '新建'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Field label="名称" required>
            <Input value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="来源">
            <Select value={source} onChange={(e) => setSource(e.target.value as BotScriptSource)}>
              <option value="fixed">固定台词</option>
              <option value="ai">AI 生成</option>
              <option value="mixed">混合（固定开场 + AI 接话）</option>
            </Select>
          </Field>
          <Field label="范围">
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">全局</option>
              {s.chatGroups.filter((g) => g.kind !== 'channel').map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
          </Field>
        </div>
        {needLines && (
          <Field label={source === 'mixed' ? '固定开场' : '台词'} required hint="每行一条；固定台词按顺序轮发">
            <Textarea rows={5} value={linesText} onChange={(e) => setLinesText(e.target.value)} placeholder={'早上好各位，今天……\n昨晚美股……'} />
          </Field>
        )}
        {needTopic && (
          <Field label="主题提示" required hint="写给模型看的话题范围；人设来自机器人账号，全局边界来自管理后台 AI 页">
            <Textarea rows={2} maxLength={300} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="围绕当天市场热点提一个开放式问题，不给结论" />
          </Field>
        )}
        {error && (name || linesText || topic) && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}
