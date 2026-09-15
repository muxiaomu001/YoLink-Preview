/**
 * 群设置：全员禁言、慢速模式、成员列表可见性、历史消息可见、官方群标记。
 * 全员禁言与慢速模式走「限制成员」权限，成员可见与历史可见走「修改群信息」权限；
 * 官方标记只有员工角色 manage_groups 或管理后台能改（officialEditable）。
 */
import { Pill } from '@/ui/display'
import { Select, Switch } from '@/ui/primitives'
import { toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { useStore } from '@/store/store'
import { SLOW_MODE_OPTIONS } from './groupRules'
import { Section, type GroupPanelProps } from './shared'

export function GroupSettingsPanel({ group: g, actor, perm, compact, officialEditable }: GroupPanelProps & { officialEditable: boolean }) {
  const s = useStore()
  const canRestrict = perm('can_restrict_members')
  const canInfo = perm('can_change_info')

  const patch = (p: Parameters<typeof s.updateGroupSettings>[1], msg: string) => {
    s.updateGroupSettings(g.id, p, actor)
    toast(msg)
  }
  const toggleOfficial = async (v: boolean) => {
    const ok = await confirm({
      title: v ? `标记「${g.name}」为官方群？` : `取消「${g.name}」的官方标记？`,
      body: v ? '标记后 group.leave 策略对该群客户强制关闭：客户不可退出，群名旁显示「官方」。' : '取消后客户可以自行退出该群。',
      okText: v ? '标记为官方群' : '取消标记',
      danger: !v,
    })
    if (!ok) return
    s.setGroupOfficial(g.id, v, actor.staffId)
    toast(v ? '已标记为官方群，客户不可退出' : '已取消官方标记')
  }
  const slowValue = g.settings.slowModeSeconds == null ? 'policy' : String(g.settings.slowModeSeconds)

  return (
    <Section title="群设置" compact={compact}>
      <div className="space-y-3">
        <Row label="全员禁言" desc={g.settings.allMuted ? '开启中：普通客户成员不能发言，管理员与坐席不受限' : '开启后仅管理员与坐席可发言'} disabledReason={canRestrict ? undefined : '需要「限制成员」权限'}>
          <Switch checked={g.settings.allMuted} disabled={!canRestrict} onChange={(v) => patch({ allMuted: v }, v ? '已开启全员禁言，管理员不受限' : '已关闭全员禁言')} />
        </Row>
        <Row label="慢速模式" desc={`当前企业策略 ${s.policyNumbers.slowModeSeconds} 秒`} disabledReason={canRestrict ? undefined : '需要「限制成员」权限'}>
          <Select
            className="h-7 w-32 text-[12px]"
            value={slowValue}
            disabled={!canRestrict}
            onChange={(e) => {
              const v = e.target.value
              patch({ slowModeSeconds: v === 'policy' ? null : Number(v) }, `慢速模式：${SLOW_MODE_OPTIONS.find((o) => o.value === v)?.label}`)
            }}
          >
            {SLOW_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Row>
        <Row label="成员列表对客户可见" desc={g.settings.membersVisible ? '客户手机端能看到成员列表' : '关闭中：客户看不到成员列表'} disabledReason={canInfo ? undefined : '需要「修改群信息」权限'}>
          <Switch checked={g.settings.membersVisible} disabled={!canInfo} onChange={(v) => patch({ membersVisible: v }, v ? '客户现在可以看到成员列表' : '客户看不到成员列表了')} />
        </Row>
        <Row label="新成员可见历史消息" desc={g.settings.historyVisible ? '新成员入群可看全部历史' : '新成员只看得到加入后的消息'} disabledReason={canInfo ? undefined : '需要「修改群信息」权限'}>
          <Switch checked={g.settings.historyVisible} disabled={!canInfo} onChange={(v) => patch({ historyVisible: v }, v ? '新成员可见全部历史消息' : '新成员仅可见加入后的消息')} />
        </Row>
        <Row label={<>官方群标记 {g.official && <Pill tone="amber">官方</Pill>}</>} desc="标记后客户不可退出（group.leave 对客户关闭）" disabledReason={officialEditable ? undefined : '仅员工角色「管理所有群」或管理后台可改'}>
          <Switch checked={g.official} disabled={!officialEditable} onChange={(v) => void toggleOfficial(v)} />
        </Row>
      </div>
    </Section>
  )
}

function Row({ label, desc, disabledReason, children }: { label: React.ReactNode; desc: string; disabledReason?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3" title={disabledReason}>
      <div className="min-w-0">
        <div className="flex items-center gap-1 text-[13px] text-zinc-800">{label}</div>
        <div className="text-[11px] leading-snug text-zinc-400">{desc}</div>
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  )
}
