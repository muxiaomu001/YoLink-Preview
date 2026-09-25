/**
 * 客户资料卡的分区：所在群与频道（跳转 / 移出 / 加入）、
 * 钱包 / 签到 / 推荐三个模块区块（企业模块启用时才显示）。
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import type { ChatGroup, Customer, DemoState, WalletTxType } from '@/domain/types'
import { fmtDate, fmtDateTime } from '@/domain/time'
import { walletBalance } from '@/store/actions/modules'
import { seatGroupPerm } from '@/store/policy'
import { customerById } from '@/store/selectors'
import { Button } from '@/ui/primitives'
import { KV } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { useWorkbench } from '../useWorkbench'
import { CollapsibleSection, type SectionCtl } from './customer/CollapsibleSection'
import { JoinGroupModal } from './customer/JoinGroupModal'

type SectionProps = { c: Customer; ctl: SectionCtl }

// ---------- 所在群与频道 ----------

export function GroupsSection({ c, ctl }: SectionProps) {
  const { s, staff, seat } = useWorkbench()
  const nav = useNavigate()
  const [joining, setJoining] = useState(false)
  if (!staff || !seat) return null
  const by = { seatId: seat.id, staffId: staff.id }
  const joined = s.chatGroups.filter((g) => g.memberCustomerIds.includes(c.id))
  const hasCandidates = s.chatGroups.some((g) => !g.memberCustomerIds.includes(c.id))

  const open = (g: ChatGroup) => {
    const conv = s.conversations.find((x) => x.chatGroupId === g.id)
    if (conv) nav(`/workbench/chat/${conv.id}`)
  }
  const kick = async (g: ChatGroup) => {
    const ok = await confirm({ title: `把「${c.nickname}」移出「${g.name}」？`, body: '群里会出现系统提示；之后可以再拉回来。', okText: '移出', danger: true })
    if (!ok) return
    const result = s.kickGroupMember(g.id, c.id, false, by)
    if (result) return toast(result.reason, 'warn')
    toast(`已把「${c.nickname}」移出「${g.name}」`)
  }

  return (
    <CollapsibleSection title="所在群与频道" ctl={ctl} summary={`${joined.length} 个`} help="点名称跳到该群会话；本坐席不在的群看不到会话。">
      <ul className="space-y-1">
        {joined.map((g) => {
          const seatIn = g.memberSeatIds.includes(seat.id)
          const canKick = seatGroupPerm(s, g, seat.id, staff.id, 'can_restrict_members')
          return (
            <li key={g.id} className="flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-zinc-50">
              <button type="button" className="min-w-0 flex-1 truncate text-left text-[13px] text-zinc-800 disabled:text-zinc-400" disabled={!seatIn} title={seatIn ? '打开该群会话' : '本坐席不在该群，看不到会话'} onClick={() => open(g)}>
                {g.name}
                <span className="ml-1 text-[11px] text-zinc-400">{g.kind === 'channel' ? '频道' : '群'}</span>
              </button>
              <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[11px]" disabled={!canKick} title={canKick ? '移出该群' : '需要群主、有「限制成员」权限的管理员或 manage_groups 能力'} onClick={() => void kick(g)}>
                移出
              </Button>
            </li>
          )
        })}
        {joined.length === 0 && <li className="text-[12px] text-zinc-400">未加入任何群或频道</li>}
      </ul>
      <Button size="sm" variant="ghost" className="mt-1.5 h-6 px-1.5 text-[11px]" disabled={!hasCandidates} onClick={() => setJoining(true)}>
        <Plus size={11} /> 加入群
      </Button>
      <JoinGroupModal c={c} open={joining} onClose={() => setJoining(false)} />
    </CollapsibleSection>
  )
}

// ---------- 钱包 ----------

const TX_LABEL: Record<WalletTxType, string> = {
  checkin_reward: '签到奖励',
  referral_reward: '推荐奖励',
  admin_adjust: '手动调整',
  withdraw_freeze: '提现冻结',
  withdraw_paid: '提现打款',
  withdraw_refund: '提现驳回退回',
}
const TX_RECENT = 5

function mask(v: string): string {
  return v.length > 6 ? `${v.slice(0, 3)}****${v.slice(-3)}` : `${v.slice(0, 1)}***`
}

/** 收款账户：优先 customFields 里配置的收款字段；没有则取最近一次提现申请填写的账户 */
function payoutAccount(s: DemoState, c: Customer): { text: string; from: string } | null {
  const fromFields = s.payoutFields.map((f) => c.customFields?.[f.name]).filter((v): v is string => !!v)
  if (fromFields.length) return { text: fromFields.map(mask).join(' · '), from: '客户绑定' }
  const last = [...s.withdrawals].filter((w) => w.customerId === c.id).sort((a, b) => b.at.localeCompare(a.at))[0]
  if (!last) return null
  return { text: Object.values(last.account).map(mask).join(' · '), from: '最近提现申请' }
}

export function WalletSection({ c, ctl }: SectionProps) {
  const { s } = useWorkbench()
  const ws = s.walletSettings
  const balance = walletBalance(s.walletTxs, c.id)
  const mine = s.withdrawals.filter((w) => w.customerId === c.id)
  const frozen = mine.filter((w) => w.status === 'pending' || w.status === 'approved').reduce((n, w) => n + w.points, 0)
  const paid = mine.filter((w) => w.status === 'paid').reduce((n, w) => n + w.points, 0)
  const txs = s.walletTxs.filter((t) => t.customerId === c.id).slice(0, TX_RECENT)
  const account = payoutAccount(s, c)
  return (
    <CollapsibleSection title="钱包" ctl={ctl} summary={`${balance.toLocaleString()} ${ws.unitName}`} help="完整流水与提现记录在管理后台钱包页。">
      <KV
        items={[
          { k: '积分余额', v: `${balance} ${ws.unitName}` },
          { k: '冻结积分', v: `${frozen} ${ws.unitName}${frozen ? '（提现中）' : ''}` },
          { k: '累计提现', v: `${(paid / ws.rate).toFixed(2)} ${ws.currency}（${paid} ${ws.unitName}）` },
          { k: '收款账户', v: account ? <span title={`来源：${account.from}`}>{account.text}</span> : <span className="text-zinc-400">未绑定</span> },
        ]}
      />
      <div className="mt-2 text-[11px] text-zinc-400">最近流水</div>
      <ul className="mt-1 space-y-0.5 text-[12px]">
        {txs.map((t) => (
          <li key={t.id} className="flex justify-between gap-2">
            <span className="truncate text-zinc-700" title={t.note}>
              {TX_LABEL[t.type]}
            </span>
            <span className={`shrink-0 tabular-nums ${t.amount >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {t.amount >= 0 ? '+' : ''}
              {t.amount} · {fmtDate(t.at)}
            </span>
          </li>
        ))}
        {txs.length === 0 && <li className="text-zinc-400">暂无流水</li>}
      </ul>
    </CollapsibleSection>
  )
}

// ---------- 签到 ----------

/** 当前连签：从今天（今天没签就从昨天）往前数连续签到的天数 */
function currentStreak(ats: string[]): number {
  const days = new Set(ats.map((a) => new Date(a).toDateString()))
  const cursor = new Date()
  if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1)
  let n = 0
  while (days.has(cursor.toDateString())) {
    n += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return n
}

export function CheckinSection({ c, ctl }: SectionProps) {
  const { s } = useWorkbench()
  const recs = s.checkinRecords.filter((r) => r.customerId === c.id).sort((a, b) => b.at.localeCompare(a.at))
  const days = new Set(recs.map((r) => new Date(r.at).toDateString())).size
  return (
    <CollapsibleSection title="签到" ctl={ctl} summary={`${days} 天`}>
      <KV
        items={[
          { k: '累计天数', v: `${days} 天` },
          { k: '当前连签', v: `${currentStreak(recs.map((r) => r.at))} 天` },
          { k: '最近签到', v: recs[0] ? fmtDateTime(recs[0].at) : '从未签到' },
        ]}
      />
    </CollapsibleSection>
  )
}

// ---------- 推荐 ----------

export function ReferralSection({ c, ctl }: SectionProps) {
  const { s, seat } = useWorkbench()
  const nav = useNavigate()
  const referrer = customerById(s, c.referrerId)
  const referred = s.customers.filter((x) => x.referrerId === c.id && !x.deletedAt)
  const reward = s.walletTxs.filter((t) => t.customerId === c.id && t.type === 'referral_reward').reduce((n, t) => n + t.amount, 0)
  const open = (id: string) => {
    const conv = seat && s.conversations.find((x) => x.kind === 'dm' && x.customerId === id && x.seatId === seat.id)
    if (conv) nav(`/workbench/chat/${conv.id}`)
    else toast('该客户不在本坐席名下，切换坐席身份后再看', 'warn')
  }
  const link = (id: string, name: string) => (
    <button type="button" className="text-brand-700 hover:underline" onClick={() => open(id)}>
      {name}
    </button>
  )
  return (
    <CollapsibleSection title="推荐" ctl={ctl} summary={`被推荐 ${referred.length} 人`}>
      <KV
        items={[
          { k: '推荐人', v: referrer ? link(referrer.id, referrer.nickname) : '-' },
          { k: '累计奖励', v: `${reward} ${s.walletSettings.unitName}` },
          {
            k: '被推荐',
            v: referred.length ? (
              <span className="flex flex-wrap gap-x-2 gap-y-0.5">
                {referred.map((x) => (
                  <span key={x.id}>{link(x.id, x.nickname)}</span>
                ))}
              </span>
            ) : (
              '无'
            ),
          },
        ]}
      />
    </CollapsibleSection>
  )
}
