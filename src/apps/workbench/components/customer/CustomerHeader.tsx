/**
 * 客户资料卡顶部固定区：头像、昵称、头衔、在线状态与最近活跃、账号 ID、状态标记。
 * 状态标记的判断在 domain/customerStatus，后台客户列表用的是同一份，两边不会再各说各话。
 */
import type { Customer } from '@/domain/types'
import { fmtAgo } from '@/domain/time'
import { customerStatusFlags } from '@/domain/customerStatus'
import { Avatar, Pill, TitleChip } from '@/ui/display'
import { useWorkbench } from '../../useWorkbench'

/** 最近活跃在这个时间内视为在线（演示模型没有真正的在线状态） */
const ONLINE_WITHIN_MS = 10 * 60 * 1000

function isOnline(lastActiveAt: string): boolean {
  return Date.now() - new Date(lastActiveAt).getTime() < ONLINE_WITHIN_MS
}

export function CustomerHeader({ c }: { c: Customer }) {
  const { s } = useWorkbench()
  const online = isOnline(c.lastActiveAt)
  const titles = c.titleIds.map((tid) => s.titles.find((x) => x.id === tid && x.enabled)).filter((t) => !!t)
  const flags = customerStatusFlags(c)

  return (
    <div className="flex items-start gap-3">
      <Avatar text={c.nickname} size={48} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-zinc-900">{c.nickname}</div>
        {titles.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {titles.map((t) => (
              <TitleChip key={t.id} title={t} />
            ))}
          </div>
        )}
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span className={`inline-block h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
          {online ? '在线' : `最近活跃 ${fmtAgo(c.lastActiveAt)}`}
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-zinc-400">{c.accountId}</div>
        {flags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {flags.map((f) => (
              <span key={f.key} title={f.title}>
                <Pill tone={f.tone}>{f.label}</Pill>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
