/**
 * 群活跃助手页（P0，04 文档 + 14 文档模块 D）：活跃角色、剧本库、规则三个标签，
 * 顶部一键暂停与统计，下方待审核与运行记录。入口需员工能力 manage_bots 且坐席策略 ai.group_warmup。
 */
import { useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { seatCan } from '@/store/policy'
import { Button } from '@/ui/primitives'
import { Note, PageHeader, Stat, Tabs } from '@/ui/display'
import { HelpTip } from '@/ui/help'
import { toast } from '@/ui/overlay'
import { useWorkbench } from '../useWorkbench'
import { BotsTab, ScriptsTab } from './BotsPage.parts'
import { ReviewAndRuns, RulesTab } from './BotsPage.rules'
import { botSentCount, driveRate, isToday } from './BotsPage.shared'

type TabKey = 'bots' | 'scripts' | 'rules'

export function BotsPage() {
  const { s, staff, seat, can } = useWorkbench()
  const [tab, setTab] = useState<TabKey>('bots')
  const lic = s.license.modules.find((m) => m.key === 'ai')
  const botLimit = lic?.botLimit ?? s.aiSettings.group.botLimit

  if (!can('manage_bots')) return <div className="p-5"><Note tone="amber">当前员工角色没有 manage_bots 能力，不能管理群活跃助手。管理后台 → 角色 里给角色勾上「管理群活跃助手」。</Note></div>
  if (!lic?.enabled) return <div className="p-5"><Note tone="amber">许可证里 AI 模块未授权，群活跃助手不可用。管理后台 → 许可证 查看。</Note></div>
  if (!seatCan(s, seat?.id, 'ai.group_warmup')) return <div className="p-5"><Note tone="amber">当前坐席「{seat?.displayName}」的策略 ai.group_warmup 被关闭（策略矩阵或用户级覆盖），不能使用群活跃助手。管理后台 → 策略 里打开。</Note></div>

  const paused = s.botsPausedAll
  const sent = botSentCount(s.botRuns)
  const drive = driveRate(s)
  const pending = s.botRuns.filter((r) => r.status === 'pending_review').length
  const skippedToday = s.botRuns.filter((r) => r.status === 'skipped' && isToday(r.at)).length

  const togglePause = () => {
    s.setBotsPausedAll(!paused, staff?.id ?? '')
    toast(paused ? '已恢复全部群活跃助手，规则按各自触发条件继续' : '暂停期间一律不发，包括审核放行和手动发言', paused ? 'ok' : 'warn')
  }

  return (
    <div className="thin-scroll h-full overflow-y-auto p-5">
      {paused && (
        <div className="mb-3 flex items-center justify-between rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-[12px] text-amber-900">
          <span>暂停期间一律不发，包括审核放行和手动发言。</span>
          <Button size="sm" onClick={togglePause}><Play size={12} /> 恢复</Button>
        </div>
      )}
      <PageHeader
        title="群活跃助手"
        desc={
          <span className="inline-flex items-center gap-1.5">
            为活跃角色设置昵称、人设与剧本，让它以群成员的方式参与聊天；内部可查看发言来源与操作人。
            <HelpTip text="边界：不 @ 真实客户、不做交易承诺、不回复真实客户的直接提问（转给其主归属坐席的实操员工）；群全员禁言、活跃角色被禁言、发言限流未到间隔、群已暂停、模块停用或未授权时一律不发，只记一条跳过记录；敏感词规则同样适用。" />
          </span>
        }
        extra={
          <Button variant={paused ? 'primary' : 'danger'} onClick={togglePause}>
            {paused ? <><Play size={13} /> 恢复全部</> : <><Pause size={13} /> 一键暂停全部</>}
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-4 gap-3">
        <Stat label="活跃角色发言数" value={sent} sub="运行记录里真正进群的" />
        <Stat label="带动率" value={drive.rate.toFixed(1)} sub={`活跃角色 ${drive.botMsgs} 条发言后 30 分钟内带动客户发言 ${drive.driven} 条`} />
        <Stat label="待审核" value={pending} sub="先审后发规则产生的内容" tone={pending ? 'warn' : 'default'} />
        <Stat label="今日跳过" value={skippedToday} sub="暂停 / 禁言 / 限流 / 停用导致" />
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: 'bots', label: '活跃角色', count: s.bots.length },
          { key: 'scripts', label: '剧本库', count: s.botScripts.length },
          { key: 'rules', label: '规则', count: s.botRules.length },
        ]}
      />
      <div className="mt-4">
        {tab === 'bots' && <BotsTab botLimit={botLimit} />}
        {tab === 'scripts' && <ScriptsTab />}
        {tab === 'rules' && <RulesTab />}
      </div>
      <div className="mt-6">
        <ReviewAndRuns />
      </div>
    </div>
  )
}
