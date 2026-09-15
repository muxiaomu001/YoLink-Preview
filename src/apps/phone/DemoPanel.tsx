/**
 * 演示控制面板（不是产品的一部分）：切换客户视角、邀请码、当前客户的能力快照（为关的键与来源）。
 */
import { Link } from 'react-router-dom'
import { useStore } from '@/store/store'
import { customerById } from '@/store/selectors'
import { customerSnapshot, resolveCap } from '@/store/policy'
import { Button, Select } from '@/ui/primitives'
import { PHONE_SOURCE_LABEL } from './parts'

export function DemoPanel({ onSwitch }: { onSwitch: () => void }) {
  const s = useStore()
  const customer = customerById(s, s.session.phoneCustomerId)
  const snapshot = customer ? customerSnapshot(s, customer.id) : null
  const off = snapshot
    ? s.policyItems
        .filter((p) => !p.staffOnly && snapshot[p.key] === false)
        .map((p) => ({ item: p, source: resolveCap(s, { role: 'customer', key: p.key, userId: customer!.id }).source }))
    : []
  const mutedAll = customer?.mutedAllUntil && customer.mutedAllUntil > new Date().toISOString()

  return (
    <aside className="thin-scroll max-h-[780px] w-72 overflow-y-auto rounded-lg border border-dashed border-zinc-400 bg-white/70 p-4 text-xs">
      <div className="mb-2 font-semibold text-zinc-700">演示控制</div>
      <p className="mb-3 leading-relaxed text-zinc-500">这块不是产品的一部分。手机屏演示注册、聊天、联系人和我的。网站栏目、发现、经营等入口尚未覆盖；手机导航待单独确认。客户看到官方身份，不显示实操员工。</p>
      <label className="mb-1 block text-[11px] text-zinc-500">以哪位客户的视角查看</label>
      <Select
        value={customer?.id ?? ''}
        className="mb-2"
        onChange={(e) => {
          s.setSession({ phoneCustomerId: e.target.value || null })
          onSwitch()
        }}
      >
        <option value="">未登录（去注册）</option>
        {s.customers
          .filter((c) => !c.deletedAt)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.nickname} · {s.inviteGroups.find((g) => g.id === c.inviteGroupId)?.name}
            </option>
          ))}
      </Select>
      {customer && (
        <Button
          size="sm"
          className="w-full"
          onClick={() => {
            s.setSession({ phoneCustomerId: null })
            onSwitch()
          }}
        >
          退出登录，回到注册页
        </Button>
      )}

      {customer && snapshot && (
        <div className="mt-4 border-t border-zinc-200 pt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-700">当前客户的能力快照</span>
            <span className="text-[10px] text-zinc-400">关 {off.length} / {s.policyItems.filter((p) => !p.staffOnly).length}</span>
          </div>
          {(customer.blacklistedAt || mutedAll) && (
            <p className="mb-1 rounded bg-red-50 px-2 py-1 text-[10px] text-red-700">
              {customer.blacklistedAt ? '已被拉黑：发不出任何消息。' : ''}
              {mutedAll ? '所有群禁言中。' : ''}
            </p>
          )}
          {off.length === 0 ? (
            <p className="text-[10px] text-zinc-400">全部为开：这位客户什么都能做。</p>
          ) : (
            <ul className="space-y-0.5">
              {off.map(({ item, source }) => (
                <li key={item.key} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-zinc-700" title={item.key}>
                    {item.label}
                  </span>
                  <span className="shrink-0 rounded bg-zinc-100 px-1 text-[10px] text-zinc-500">{PHONE_SOURCE_LABEL[source]}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 leading-relaxed text-zinc-500">
            在管理后台「策略与能力开关」改一下，这里立刻变。群内还会叠加群级覆盖（如私享会员群放开看成员）。
            <Link to="/admin/policies" target="_blank" className="ml-1 text-brand-700 hover:underline">
              去改 →
            </Link>
          </p>
        </div>
      )}

      <div className="mt-4 border-t border-zinc-200 pt-3">
        <div className="mb-1 text-[11px] text-zinc-500">可用邀请码</div>
        <ul className="space-y-1">
          {s.inviteGroups
            .filter((g) => g.enabled)
            .map((g) => (
              <li key={g.id} className="flex items-center justify-between">
                <span className="text-zinc-700">
                  {g.name}
                  {g.chatGroupIds.length > 0 && <span className="ml-1 text-[10px] text-zinc-400">默认进 {g.chatGroupIds.length} 群</span>}
                </span>
                <span className="rounded bg-zinc-100 px-1 font-mono text-[11px]">{g.code}</span>
              </li>
            ))}
        </ul>
      </div>
      <div className="mt-4 flex flex-col gap-1 border-t border-zinc-200 pt-3">
        <Link to="/workbench" target="_blank" className="text-brand-700 hover:underline">
          打开客服工作台
        </Link>
        <Link to="/admin/policies" target="_blank" className="text-brand-700 hover:underline">
          打开管理后台 · 策略与能力开关
        </Link>
        <Link to="/" className="text-zinc-500 hover:underline">
          演示首页
        </Link>
      </div>
    </aside>
  )
}
