/**
 * 客户资料卡顶部固定区：头像、昵称、头衔、在线状态与最近活跃、账号 ID、状态标记（已拉黑 / 全群禁言 / 待改密）。
 */
import type { Customer } from '@/domain/types'
import { fmtAgo, fmtDateTime } from '@/domain/time'
import { Avatar, Pill, TitleChip } from '@/ui/display'
import { useWorkbench } from '../../useWorkbench'

/** 最近活跃在这个时间内视为在线（演示模型没有真正的在线状态） */
const ONLINE_WITHIN_MS = 10 * 60 * 1000

/** muteCustomerAll 用这个年份表示永久 */
const FOREVER_PREFIX = '9999-'

function isOnline(lastActiveAt: string): boolean {
  return Date.now() - new Date(lastActiveAt).getTime() < ONLINE_WITHIN_MS
}

function isMutedNow(c: Customer): boolean {
  return !!c.mutedAllUntil && c.mutedAllUntil > new Date().toISOString()
}

export function CustomerHeader({ c }: { c: Customer }) {
  const { s } = useWorkbench()
  const online = isOnline(c.lastActiveAt)
  const muted = isMutedNow(c)
  const titles = c.titleIds.map((tid) => s.titles.find((x) => x.id === tid && x.enabled)).filter((t) => !!t)
  const hasStatus = !!c.blacklistedAt || muted || !!c.mustChangePassword || !!c.deletedAt

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
        {hasStatus && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {c.deletedAt && <Pill tone="red">已注销 {fmtDateTime(c.deletedAt)}</Pill>}
            {c.blacklistedAt && <Pill tone="red">已拉黑 {fmtDateTime(c.blacklistedAt)}</Pill>}
            {muted && <Pill tone="amber">全群禁言{c.mutedAllUntil!.startsWith(FOREVER_PREFIX) ? '（永久）' : `至 ${fmtDateTime(c.mutedAllUntil!)}`}</Pill>}
            {c.mustChangePassword && <Pill>待首次改密</Pill>}
          </div>
        )}
      </div>
    </div>
  )
}
