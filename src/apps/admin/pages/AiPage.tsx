import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Plug } from 'lucide-react'
import type { AiSettings } from '@/domain/types'
import { fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { Button, Field, Input, Select, Switch, Textarea } from '@/ui/primitives'
import { Avatar, Card, KV, Note, PageHeader, Pill, Stat, Table, Tabs } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { KnowledgeTab, UsageTab } from './AiPage.parts'

type TabKey = 'service' | 'reply' | 'knowledge' | 'group' | 'usage'

/** AI 模块（P0）：AI 服务、回复推荐、知识库、群活跃助手、用量 */
export function AiPage() {
  const s = useStore()
  const [tab, setTab] = useState<TabKey>('service')
  return (
    <div>
      <PageHeader title="AI 模块" desc="AI 只给员工出草稿、给群里起话题，永远不直接替坐席对客户下结论。密钥只写不读，客户资料是否喂给 AI 由企业自己决定。" />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: 'service', label: 'AI 服务' },
          { key: 'reply', label: '回复推荐' },
          { key: 'knowledge', label: '知识库', count: s.knowledge.length },
          { key: 'group', label: '群活跃助手' },
          { key: 'usage', label: '用量' },
        ]}
      />
      <div className="mt-4">
        {tab === 'service' && <ServiceTab />}
        {tab === 'reply' && <ReplyTab />}
        {tab === 'knowledge' && <KnowledgeTab />}
        {tab === 'group' && <GroupTab />}
        {tab === 'usage' && <UsageTab />}
      </div>
    </div>
  )
}

function ServiceTab() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const ai = s.aiSettings
  const [endpoint, setEndpoint] = useState(ai.endpoint)
  const [changingKey, setChangingKey] = useState(!ai.keyConfigured)
  const [newKey, setNewKey] = useState('')
  const [shareProfile, setShareProfile] = useState(ai.shareProfile)
  const endpointOk = /^https:\/\/[^\s]+$/.test(endpoint.trim())
  const keyOk = !changingKey || newKey.trim().length >= 16
  const error = !endpointOk ? '服务地址必须是 https:// 开头' : !keyOk ? '密钥至少 16 位' : ''
  const dirty = endpoint !== ai.endpoint || shareProfile !== ai.shareProfile || (changingKey && newKey)

  const save = () => {
    if (error) return
    const patch: Partial<AiSettings> = { endpoint: endpoint.trim(), shareProfile }
    if (changingKey && newKey.trim()) patch.keyConfigured = true
    s.updateAiSettings(patch, admin)
    setChangingKey(false)
    setNewKey('')
    toast(changingKey && newKey ? '演示配置已保存；未保存或使用真实密钥' : 'AI 服务设置已保存')
  }
  const test = () => {
    const ok = s.testAiConnection()
    toast(ok ? '演示检查通过：配置项已填写，未连接真实模型' : '演示检查未通过：请填写示例配置', ok ? 'ok' : 'warn')
  }

  return (
    <div className="grid grid-cols-[1fr_320px] gap-4">
      <Card title="AI 服务" extra={<Button size="sm" variant="primary" disabled={!!error || !dirty} onClick={save}>保存</Button>}>
        <div className="space-y-3">
          <Field label="服务地址" required hint="OpenAI 兼容接口地址">
            <Input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://" />
          </Field>
          <Field label="密钥" required hint="演示仅记录已配置状态，不保存密钥，请勿输入真实凭据">
            {changingKey ? (
              <div className="flex gap-2">
                <Input type="password" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="请输入虚构示例，不要填真实密钥" autoComplete="off" />
                {ai.keyConfigured && (
                  <Button onClick={() => { setChangingKey(false); setNewKey('') }}>取消</Button>
                )}
              </div>
            ) : (
              <div className="flex h-8 items-center gap-3">
                <span className="font-mono text-[13px] text-zinc-700">已配置 ••••••••</span>
                <Button size="sm" onClick={() => setChangingKey(true)}>更换</Button>
              </div>
            )}
          </Field>
          <div className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2">
            <div className="text-xs">
              <div className="font-medium text-zinc-800">把客户资料传给 AI</div>
              <div className="text-zinc-500">开启后生成草稿时附带客户的头衔、备注与购买记录摘要</div>
            </div>
            <Switch checked={shareProfile} onChange={setShareProfile} />
          </div>
          {shareProfile && <Note tone="amber">合规提醒：客户资料出境或传给第三方模型可能触发数据保护要求，请确认与客户签署的隐私条款允许。</Note>}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </Card>
      <Card title="模拟配置检查" extra={<Button size="sm" onClick={test}><Plug size={13} /> 模拟配置检查</Button>}>
        <KV
          items={[
            { k: '最近测试', v: ai.lastTestAt ? fmtDateTime(ai.lastTestAt) : '从未测试' },
            { k: '结果', v: ai.lastTestOk === null ? '-' : ai.lastTestOk ? <Pill tone="green">模拟通过</Pill> : <Pill tone="red">失败</Pill> },
            { k: '密钥', v: ai.keyConfigured ? <Pill tone="green">已配置</Pill> : <Pill tone="red">未配置</Pill> },
          ]}
        />
        <p className="mt-3 text-[11px] text-zinc-400">这里只检查演示配置是否填写，不发出网络请求，不证明模型可用。</p>
      </Card>
    </div>
  )
}

function ReplyTab() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const ai = s.aiSettings
  const [contextCount, setContextCount] = useState(ai.contextCount)
  const [tone, setTone] = useState<AiSettings['tone']>(ai.tone)
  const [limit, setLimit] = useState(ai.dailyLimitPerStaff)
  const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0))
  const error = contextCount < 1 || contextCount > 50 ? '上下文条数 1 到 50' : limit < 1 ? '每员工每日上限至少 1 次' : ''
  const save = () => {
    if (error) return
    s.updateAiSettings({ contextCount, tone, dailyLimitPerStaff: limit }, admin)
    toast('回复推荐设置已保存，员工下一次生成草稿即生效')
  }
  return (
    <div className="grid grid-cols-[1fr_320px] gap-4">
      <Card title="回复推荐" extra={<Button size="sm" variant="primary" disabled={!!error} onClick={save}>保存</Button>}>
        <div className="grid grid-cols-3 gap-3">
          <Field label="上下文条数" required hint="带入最近几条消息">
            <Input type="number" min={1} max={50} value={contextCount} onChange={(e) => setContextCount(num(e.target.value))} />
          </Field>
          <Field label="语气预设">
            <Select value={tone} onChange={(e) => setTone(e.target.value as AiSettings['tone'])}>
              <option value="professional">专业</option>
              <option value="warm">亲切</option>
              <option value="concise">简洁</option>
            </Select>
          </Field>
          <Field label="每员工每日上限" required hint="生成次数">
            <Input type="number" min={1} value={limit} onChange={(e) => setLimit(num(e.target.value))} />
          </Field>
        </div>
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      </Card>
      <Note>
        员工在工作台点「AI 草稿」时，把最近 {contextCount} 条消息 + 知识库命中条目交给模型，以「{tone === 'professional' ? '专业' : tone === 'warm' ? '亲切' : '简洁'}」语气出一版草稿。员工可以直接采纳、改一改再发或忽略，采纳率进用量页。
      </Note>
    </div>
  )
}

function GroupTab() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const g = s.aiSettings.group
  const lic = s.license.modules.find((m) => m.key === 'ai')
  const botLimit = lic?.botLimit ?? g.botLimit
  // 已用按真实机器人账号算：启用中的才占授权名额
  const botUsed = s.bots.filter((b) => b.enabled).length
  const pendingRuns = s.botRuns.filter((r) => r.status === 'pending_review').length
  const [rule, setRule] = useState(g.defaultRule)
  const [reviewMode, setReviewMode] = useState<'auto' | 'review'>(g.reviewMode)
  const error = !rule.trim() ? '全局默认规则不能为空' : rule.length > 1000 ? '规则最多 1000 字' : ''
  const save = () => {
    if (error) return
    s.updateAiSettings({ group: { ...g, defaultRule: rule.trim(), reviewMode } }, admin)
    toast('群活跃助手设置已保存，各群未单独设置的沿用全局规则')
  }
  return (
    <div className="space-y-4">
      <Note tone="amber">群活跃助手为产品讨论稿：保留当前演示，首版的触发、节奏和审核细节待确认。</Note>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="授权机器人账号数" value={botLimit} sub="来自许可证 AI 模块" />
        <Stat label="已用" value={botUsed} sub={`剩余 ${Math.max(0, botLimit - botUsed)} 个可绑定到群`} tone={botUsed >= botLimit ? 'warn' : 'default'} />
        <Stat label="许可到期" value={lic ? fmtDateTime(lic.expiresAt).slice(0, 10) : '-'} />
      </div>
      <Card
        title="机器人账号"
        padded={false}
        extra={
          <Link to="/workbench/bots" target="_blank" className="flex items-center gap-1 text-xs text-brand-700 hover:underline">
            <ExternalLink size={11} /> 去工作台管理
          </Link>
        }
      >
        <Table
          rows={s.bots}
          rowKey={(b) => b.id}
          dense
          empty="还没有机器人账号，去工作台 → 群活跃助手 新建"
          columns={[
            { key: 'name', title: '昵称', render: (b) => <span className="flex items-center gap-1.5"><Avatar text={b.nickname} color={b.avatarColor} size={20} /><span className="font-medium text-zinc-900">{b.nickname}</span></span> },
            { key: 'groups', title: '所属群', render: (b) => b.groupIds.map((id) => s.chatGroups.find((x) => x.id === id)?.name).filter(Boolean).join('、') || <span className="text-zinc-400">未入群</span> },
            { key: 'rules', title: '规则数', align: 'right', render: (b) => <span className="tabular-nums">{s.botRules.filter((r) => r.botIds.includes(b.id)).length}</span> },
            { key: 'pending', title: '待审', align: 'right', render: (b) => <span className="tabular-nums">{s.botRuns.filter((r) => r.botId === b.id && r.status === 'pending_review').length}</span> },
            { key: 'status', title: '状态', render: (b) => (b.enabled ? <Pill tone="green">启用</Pill> : <Pill>停用</Pill>) },
          ]}
        />
        <div className="border-t border-zinc-100 px-3 py-1.5 text-[11px] text-zinc-400">
          规则 {s.botRules.length} 条（启用 {s.botRules.filter((r) => r.enabled).length}）· 待审核 {pendingRuns} 条{s.botsPausedAll ? ' · 全部已暂停' : ''}。机器人账号、剧本与规则在工作台维护，这里只看全局默认规则与授权。
        </div>
      </Card>
      <Card title="全局默认规则" extra={<Button size="sm" variant="primary" disabled={!!error} onClick={save}>保存</Button>}>
        <div className="space-y-3">
          <Field label="规则" required hint="多行文本，写给模型看的边界与话题范围">
            <Textarea rows={5} maxLength={1000} value={rule} onChange={(e) => setRule(e.target.value)} />
          </Field>
          <Field label="审核模式默认值" hint="各群可单独覆盖">
            <div className="flex h-8 items-center gap-5 text-[13px] text-zinc-700">
              <label className="flex items-center gap-1.5">
                <input type="radio" className="accent-brand-700" checked={reviewMode === 'auto'} onChange={() => setReviewMode('auto')} /> 自动发
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" className="accent-brand-700" checked={reviewMode === 'review'} onChange={() => setReviewMode('review')} /> 先审后发
              </label>
            </div>
          </Field>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Note>先审后发：AI 起的话题先进机器人账号实操员工的待办，员工点发送才进群。金融场景建议保持先审后发。</Note>
        </div>
      </Card>
    </div>
  )
}
