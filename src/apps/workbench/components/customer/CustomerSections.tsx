/**
 * 客户资料卡的基础分区：基础信息、官方联系人与归属、头衔、内部标签、备注、购买与邀请。
 * 增删头衔 / 标签在顶部快捷动作里做，这里只展示与摘掉。
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star } from 'lucide-react'
import type { Customer } from '@/domain/types'
import { fmtAgo, fmtDate, fmtDateTime } from '@/domain/time'
import { customerById, seatsOfCustomer, staffById } from '@/store/selectors'
import { KV, SeatAvatar, TagChip, TitleChip } from '@/ui/display'
import { Textarea } from '@/ui/primitives'
import { useWorkbench } from '../../useWorkbench'
import { CollapsibleSection, type SectionCtl } from './CollapsibleSection'

const NOTE_MAX = 500
const NOTE_SUMMARY_LEN = 12
const LANGUAGE_LABEL: Record<string, string> = { zh: '中文', en: 'English' }
/** 演示汇率：购买金额按人民币存，展示为美元 */
const USD_RATE = 7.8

type SectionProps = { c: Customer; ctl: SectionCtl }

function fmtAmount(n: number): string {
  return `$${(n / USD_RATE).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export function BasicSection({ c, ctl }: SectionProps) {
  const { s } = useWorkbench()
  const nav = useNavigate()
  const group = s.inviteGroups.find((g) => g.id === c.inviteGroupId)
  const link = s.inviteLinks.find((l) => l.id === c.inviteLinkId)
  const language = c.customFields?.language ?? s.enterprise.defaultLanguage
  return (
    <CollapsibleSection title="基础信息" ctl={ctl} summary={`注册 ${fmtDate(c.registeredAt)}`}>
      <KV
        items={[
          { k: '注册时间', v: fmtDateTime(c.registeredAt) },
          {
            k: '注册来源',
            v: (
              <button type="button" className="text-left text-brand-700 hover:underline" title="跳到邀请链接页" onClick={() => nav('/workbench/invites')}>
                {group?.name ?? '-'}
                {link ? ` · ${link.name}` : ''}
              </button>
            ),
          },
          { k: '最近活跃', v: fmtAgo(c.lastActiveAt) },
          { k: '语言', v: LANGUAGE_LABEL[language] ?? language },
          { k: '设备', v: c.device },
          { k: '手机号', v: c.phone ?? '-' },
          { k: '邮箱', v: c.email ?? '-' },
        ]}
      />
    </CollapsibleSection>
  )
}

export function OfficialsSection({ c, ctl }: SectionProps) {
  const { s, staff, seat, can } = useWorkbench()
  const nav = useNavigate()
  const officials = seatsOfCustomer(s, c.id)
  return (
    <CollapsibleSection title="官方联系人与归属" ctl={ctl} summary={`${officials.length} 个坐席`} help="客户看得到左边的官方联系人，看不到右边的实操员工。★ 是主归属。坐席对客户是固定的，换人走管理后台的坐席交接，这里没有「转移客户」。">
      <ul className="space-y-1">
        {officials.map((o) => {
          const op = staffById(s, o.seat.operatorStaffId)
          const active = o.seat.id === seat?.id
          const mine = o.seat.operatorStaffId === staff?.id
          const handovers = s.handovers.filter((h) => h.seatId === o.seat.id)
          return (
            <li key={o.seatId} className={`flex items-center gap-2 rounded-md px-1.5 py-1 ${active ? 'bg-brand-50/70' : 'hover:bg-zinc-50'}`}>
              <SeatAvatar seat={o.seat} size={24} />
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => o.conv && mine && nav(`/workbench/chat/${o.conv.id}`)} title={mine ? '切到这条会话' : '不是你持有的坐席'}>
                <div className="flex items-center gap-1 text-[13px] text-zinc-900">
                  {o.seat.displayName}
                  {o.primary && <Star size={11} className="fill-gold-500 text-gold-500" />}
                  {o.source === 'backfill' && <span className="text-[11px] text-zinc-400">补加</span>}
                </div>
                <div className="truncate text-[11px] text-zinc-500">{o.seat.roleDesc}</div>
              </button>
              {can('view_seat_operator') && (
                <span className="shrink-0 text-right text-[11px] text-zinc-400" title={`当前实操员工，客户端永远看不到${handovers.length ? `\n交接记录：${handovers.map((h) => `${fmtDate(h.at)} ${staffById(s, h.fromStaffId)?.name ?? '无'}→${staffById(s, h.toStaffId)?.name}`).join('；')}` : ''}`}>
                  {op?.name ?? '无人'}
                  {handovers.length > 0 && <span className="block">交接 {handovers.length} 次</span>}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </CollapsibleSection>
  )
}

export function TitlesSection({ c, ctl }: SectionProps) {
  const { s, staff, can } = useWorkbench()
  const canAssign = can('assign_title')
  return (
    <CollapsibleSection title="头衔" ctl={ctl} summary={`${c.titleIds.length} 个`} help="官方发的头衔，客户和群里的人都能看到；昵称旁只显示主头衔。">
      <div className="flex flex-wrap gap-1">
        {c.titleIds.map((tid) => {
          const t = s.titles.find((x) => x.id === tid)
          if (!t) return null
          return (
            <span key={tid} className="inline-flex items-center gap-0.5">
              <TitleChip title={t} onRemove={canAssign && staff ? () => s.removeTitle(c.id, tid, staff.id) : undefined} />
              {c.primaryTitleId !== tid && canAssign && (
                <button type="button" className="text-[11px] text-zinc-400 hover:text-brand-700" onClick={() => s.setPrimaryTitle(c.id, tid)} title="设为主头衔（昵称旁只显示主头衔）">
                  设主
                </button>
              )}
            </span>
          )
        })}
        {c.titleIds.length === 0 && <span className="text-[12px] text-zinc-400">无</span>}
      </div>
    </CollapsibleSection>
  )
}

export function TagsSection({ c, ctl }: SectionProps) {
  const { s } = useWorkbench()
  return (
    <CollapsibleSection title="内部标签" ctl={ctl} summary={`${c.tagIds.length} 个`} help="内部标签只有员工看得到，客户永远看不到。">
      <div className="flex flex-wrap gap-1">
        {c.tagIds.map((tid) => {
          const t = s.tags.find((x) => x.id === tid)
          return t ? <TagChip key={tid} tag={t} onRemove={() => s.removeTag(c.id, tid)} /> : null
        })}
        {c.tagIds.length === 0 && <span className="text-[12px] text-zinc-400">无</span>}
      </div>
    </CollapsibleSection>
  )
}

/** 备注：失焦保存。用 key={c.id} 挂载，切客户时状态自然重置 */
export function NoteSection({ c, ctl }: SectionProps) {
  const { s } = useWorkbench()
  const [note, setNote] = useState(c.note)
  const summary = c.note ? (c.note.length > NOTE_SUMMARY_LEN ? `${c.note.slice(0, NOTE_SUMMARY_LEN)}…` : c.note) : '无'
  return (
    <CollapsibleSection title="备注" ctl={ctl} summary={summary} hint={`${note.length}/${NOTE_MAX}`}>
      <Textarea rows={3} value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== c.note && s.setNote(c.id, note)} placeholder="写点只有同事看得到的话，失焦保存" className="text-[13px]" />
    </CollapsibleSection>
  )
}

export function PurchasesSection({ c, ctl }: SectionProps) {
  const { s, can } = useWorkbench()
  const showAmount = can('view_all_customers')
  const referrer = customerById(s, c.referrerId)
  const totalAmount = c.purchases.reduce((n, p) => n + p.amount, 0)
  const lastPurchase = [...c.purchases].sort((a, b) => b.at.localeCompare(a.at))[0]
  return (
    <CollapsibleSection title="购买与邀请" ctl={ctl} summary={`${c.purchases.length} 笔`} help="从卖货系统同步，这里不能手改。">
      {c.purchases.length ? (
        <ul className="space-y-1 text-[13px]">
          {c.purchases.map((p, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="truncate text-zinc-800">{p.product}</span>
              <span className="shrink-0 tabular-nums text-zinc-500">
                {fmtDate(p.at)}
                {showAmount ? ` · ${fmtAmount(p.amount)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-[12px] text-zinc-400">暂无购买</div>
      )}
      <div className="mt-2">
        <KV
          items={[
            { k: '最近购买', v: lastPurchase ? fmtDate(lastPurchase.at) : '-' },
            { k: '累计金额', v: showAmount ? fmtAmount(totalAmount) : <span className="text-zinc-400" title="需员工角色能力 view_all_customers">按角色隐藏</span> },
            { k: '邀请人', v: referrer ? referrer.nickname : '-' },
            { k: '直接邀请', v: `${c.inviteCount} 人 · 团队 ${c.teamCount} 人` },
            { k: '角色', v: c.roleLabel ?? '-' },
          ]}
        />
      </div>
    </CollapsibleSection>
  )
}
