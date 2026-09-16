/**
 * 效果预览：选一个客户（可再选一个他所在的群），列出此刻为「关」的能力键与决定它的层。
 * 让看 demo 的人明白"这个客户现在为什么不能加好友"。
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { useStore } from '@/store/store'
import { activeCustomers } from '@/store/selectors'
import { resolveCap, type CapResult } from '@/store/policy'
import { Field, Select } from '@/ui/primitives'
import { Card, Note, Pill } from '@/ui/display'
import { SOURCE_LABEL } from './PoliciesPage.shared'

const SOURCE_TONE: Record<CapResult['source'], 'zinc' | 'green' | 'amber' | 'red' | 'blue' | 'purple'> = {
  default: 'zinc',
  group: 'blue',
  user: 'purple',
  module_off: 'amber',
  official_group: 'red',
  unknown: 'zinc',
}

export function EffectPreview() {
  const s = useStore()
  const customers = activeCustomers(s)
  const [customerId, setCustomerId] = useState(s.session.phoneCustomerId ?? customers[0]?.id ?? '')
  const [groupId, setGroupId] = useState('')
  const customer = customers.find((c) => c.id === customerId)
  const groups = s.chatGroups.filter((g) => g.memberCustomerIds.includes(customerId))
  const effectiveGroup = groups.some((g) => g.id === groupId) ? groupId : ''

  const rows = s.policyItems
    .filter((p) => !p.staffOnly)
    .map((p) => ({ item: p, ...resolveCap(s, { role: 'customer', key: p.key, groupId: effectiveGroup || null, userId: customerId }) }))
  const off = rows.filter((r) => !r.allowed)
  const overridden = rows.filter((r) => r.allowed && r.source !== 'default')

  return (
    <Card
      title="效果预览：这个客户此刻不能做什么"
      extra={
        <Link to="/phone" target="_blank" className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">
          去客户手机屏看效果 <ExternalLink size={12} />
        </Link>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="客户" hint="按用户级覆盖解析">
          <Select
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value)
              setGroupId('')
            }}
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nickname}（{c.accountId}）
              </option>
            ))}
          </Select>
        </Field>
        <Field label="在哪个群里看（可选）" hint="群级覆盖只在群内生效">
          <Select value={effectiveGroup} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">不在群里（私聊 / 通用）</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.kind === 'channel' ? '频道' : '群'} · {g.name}
                {g.official ? '（官方）' : ''}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {!customer ? (
        <p className="mt-3 text-xs text-zinc-400">没有客户</p>
      ) : (
        <>
          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
            <span>
              「{customer.nickname}」为关：{off.length} 项；为开：{rows.length - off.length} 项
              {customer.bannedAt && (
                <Pill tone="red" className="ml-1.5">
                  已封禁：无法登录
                </Pill>
              )}
            </span>
          </div>
          <ul className="mt-2 divide-y divide-zinc-100 rounded-md border border-zinc-200">
            {off.length === 0 && <li className="px-3 py-3 text-center text-xs text-zinc-400">这个客户什么都能做</li>}
            {off.map((r) => (
              <li key={r.item.key} className="flex items-center justify-between px-3 py-1.5">
                <div>
                  <span className="text-[13px] text-zinc-800">{r.item.label}</span>
                  <span className="ml-1.5 font-mono text-[11px] text-zinc-400">{r.item.key}</span>
                </div>
                <Pill tone={SOURCE_TONE[r.source]}>{SOURCE_LABEL[r.source]}</Pill>
              </li>
            ))}
          </ul>
          {overridden.length > 0 && (
            <p className="mt-2 text-[11px] text-zinc-500">
              被覆盖放开的：
              {overridden.map((r) => (
                <span key={r.item.key} className="ml-1">
                  <span className="font-mono">{r.item.key}</span>（{SOURCE_LABEL[r.source]}）
                </span>
              ))}
            </p>
          )}
        </>
      )}
      <div className="mt-3">
        <Note>来源含义：企业默认 = 上面矩阵里「客户」这一列；群级覆盖 = 只在这个群里；用户级覆盖 = 只对这个人；模块停用 = 模块启停页关了；官方群 = 官方群强制不可退出。</Note>
      </div>
    </Card>
  )
}
