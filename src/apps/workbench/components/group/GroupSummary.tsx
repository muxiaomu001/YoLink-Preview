/**
 * 工作台右栏的群摘要卡：头像、名称、类型、成员数、你在本群的身份、公告摘要、置顶数、开启中的群设置；
 * 有任一管理权限时显示「管理」按钮，打开 GroupManageModal。
 */
import { useState } from 'react'
import { Megaphone, Pin, Settings2 } from 'lucide-react'
import { messageVisibleFor } from '@/domain/messageRules'
import { groupRoleOf } from '@/store/policy'
import { useStore } from '@/store/store'
import { Avatar, Pill } from '@/ui/display'
import { Button } from '@/ui/primitives'
import type { GroupCardProps } from './GroupCard'
import { GroupManageModal } from './GroupManageModal'
import { GROUP_KIND_TEXT, memberTotal, PERM_META, SLOW_MODE_OPTIONS } from './groupRules'

const AVATAR_COLOR = { group: '#0f766e', channel: '#b45309' } as const

export function GroupSummary({ group: g, actor, perm, officialEditable = false, canViewAllCustomers = false, identityNote }: GroupCardProps) {
  const s = useStore()
  const [manage, setManage] = useState(false)
  const role = groupRoleOf(g, 'seat', actor.seatId)
  const granted = PERM_META.filter((p) => perm(p.key))
  const canManage = role === 'owner' || granted.length > 0
  const roleText = role === 'owner' ? '群主' : role === 'admin' ? `管理员 · ${granted.length} 项权限` : role === 'member' ? (granted.length ? '成员 · 员工角色管理所有群' : '成员') : granted.length ? '不在群里 · 以管理身份操作' : '不在群里'

  const visiblePins=g.pinnedMessageIds.filter((id)=>s.messages.some((m)=>m.id===id&&messageVisibleFor(s,m,{kind:'seat',id:actor.seatId,staffId:actor.staffId}))).length
  const a = g.announcement
  const firstLine = a?.content.split('\n').find((l) => l.trim()) ?? ''
  const slowSeconds = g.settings.slowModeSeconds ?? s.policyNumbers.slowModeSeconds
  const slowLabel = SLOW_MODE_OPTIONS.find((o) => o.value === String(slowSeconds))?.label ?? `${slowSeconds} 秒`
  const flags = [g.settings.allMuted && '全员禁言中', slowSeconds > 0 && `慢速模式 ${slowLabel}`, g.settings.membersVisible && '成员可见', g.settings.historyVisible && '历史可见'].filter((f): f is string => !!f)

  return (
    <div className="px-4 py-4">
      <div className="flex items-start gap-3">
        <Avatar text={g.name} size={48} color={AVATAR_COLOR[g.kind]} official={g.official} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold text-zinc-900">{g.name}</span>
            {g.official && <Pill tone="amber">官方</Pill>}
          </div>
          <div className="mt-0.5 text-[12px] text-zinc-600">
            {GROUP_KIND_TEXT[g.kind]} · {memberTotal(g)} 人
          </div>
          <div className="text-[11px] text-zinc-400">
            客户 {g.memberCustomerIds.length} · 坐席 {g.memberSeatIds.length} · 机器人 {g.memberBotIds.length}
          </div>
        </div>
      </div>
      {g.desc && <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-zinc-500">{g.desc}</p>}

      <div className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-[12px]">
        <span className="text-zinc-500">你在{g.kind==='channel'?'本频道':'本群'}：</span>
        <span className="text-zinc-800">{roleText}</span>
        {identityNote && <span className="ml-1 text-zinc-400">· {identityNote}</span>}
      </div>

      <div className="mt-3 rounded-md border border-zinc-200 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-zinc-800">
          <Megaphone size={13} className="shrink-0 text-amber-600" />
          <span className="truncate">{a ? a.title : '暂无公告'}</span>
        </div>
        {a && firstLine && <div className="mt-0.5 truncate text-[12px] text-zinc-500">{firstLine}</div>}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[12px] text-zinc-500">
        <Pin size={13} className="shrink-0 text-amber-600" />
        置顶 {visiblePins} 条
      </div>
      {flags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {flags.map((f) => (
            <Pill key={f} tone={f === '全员禁言中' ? 'amber' : 'zinc'}>
              {f}
            </Pill>
          ))}
        </div>
      )}

      {canManage && (
        <Button variant="primary" className="mt-4 w-full" onClick={() => setManage(true)}>
          <Settings2 size={14} /> 管理
        </Button>
      )}
      {manage && <GroupManageModal group={g} actor={actor} perm={perm} officialEditable={officialEditable} canViewAllCustomers={canViewAllCustomers} onClose={() => setManage(false)} />}
    </div>
  )
}
