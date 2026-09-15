/**
 * 客户资料卡（04 文档「右侧：客户资料卡」）：基础信息、官方联系人与归属、头衔、内部标签、备注、
 * 购买与邀请、所在群与频道、钱包 / 签到 / 推荐（P2，模块启用时）、底部固定操作区。
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star } from 'lucide-react'
import { fmtDate, fmtDateTime, fmtAgo } from '@/domain/time'
import { seatCan } from '@/store/policy'
import { customerById, seatsOfCustomer, staffById } from '@/store/selectors'
import { Avatar, KV, Note, Pill, SeatAvatar, TagChip, TitleChip } from '@/ui/display'
import { Button, Input, Select, Textarea } from '@/ui/primitives'
import { toast } from '@/ui/overlay'
import { useWorkbench } from '../useWorkbench'
import { CheckinSection, GroupsSection, ReferralSection, Section, WalletSection } from './CustomerCard.parts'
import { CustomerActions } from './CustomerActions'

const NOTE_MAX = 500
const TAG_COLORS = ['#2563eb', '#0f766e', '#b45309', '#7e22ce', '#be123c', '#4d7c0f']
const LANGUAGE_LABEL: Record<string, string> = { zh: '中文', en: 'English' }

function pickColor(name: string): string {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TAG_COLORS[h % TAG_COLORS.length]
}

export function CustomerCard({ customerId }: { customerId: string }) {
  const { s, staff, seat, can } = useWorkbench()
  const nav = useNavigate()
  const c = customerById(s, customerId)
  const [note, setNote] = useState(c?.note ?? '')
  const [newTag, setNewTag] = useState('')
  useEffect(() => setNote(c?.note ?? ''), [c?.id, c?.note])
  if (!c || !staff) return null

  const officials = seatsOfCustomer(s, c.id)
  const group = s.inviteGroups.find((g) => g.id === c.inviteGroupId)
  const link = s.inviteLinks.find((l) => l.id === c.inviteLinkId)
  const referrer = customerById(s, c.referrerId)
  const titlesAvail = s.titles.filter((t) => t.enabled && !c.titleIds.includes(t.id))
  const tagsAvail = s.tags.filter((t) => !c.tagIds.includes(t.id))
  const canCreateTag = seatCan(s, seat?.id, 'tag.create')
  const showAmount = can('view_all_customers')
  const language = c.customFields?.language ?? s.enterprise.defaultLanguage
  const totalAmount = c.purchases.reduce((n, p) => n + p.amount, 0)
  const lastPurchase = [...c.purchases].sort((a, b) => b.at.localeCompare(a.at))[0]
  const fmtAmount = (n: number) => `$${(n / 7.8).toLocaleString(undefined, { maximumFractionDigits: 0 })}`

  const createTag = () => {
    const name = newTag.trim()
    if (!name) return
    const existing = s.tags.find((t) => t.name === name)
    const tag = existing ?? s.createTag(name, pickColor(name), 'staff')
    s.addTag(c.id, tag.id)
    toast(existing ? `已添加已有标签「${name}」` : `已新建内部标签「${name}」并加到客户身上，标签库同步新增`)
    setNewTag('')
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-col items-center border-b border-zinc-100 px-4 py-4 text-center">
        <Avatar text={c.nickname} size={56} />
        <div className="mt-2 text-sm font-semibold text-zinc-900">{c.nickname}</div>
        <div className="mt-1 flex flex-wrap justify-center gap-1">
          {c.titleIds.map((tid) => {
            const t = s.titles.find((x) => x.id === tid && x.enabled)
            return t ? <TitleChip key={tid} title={t} size="xs" /> : null
          })}
        </div>
        {c.deletedAt && <Pill tone="red" className="mt-1">已注销 {fmtDateTime(c.deletedAt)}</Pill>}
      </div>

      <Section title="基础信息">
        <KV
          items={[
            { k: '账号 ID', v: <span className="font-mono">{c.accountId}</span> },
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
      </Section>

      <Section title="官方联系人与归属" hint="客户看得到左边，看不到右边">
        <ul className="space-y-1.5">
          {officials.map((o) => {
            const op = staffById(s, o.seat.operatorStaffId)
            const active = o.seat.id === seat?.id
            const mine = o.seat.operatorStaffId === staff.id
            const handovers = s.handovers.filter((h) => h.seatId === o.seat.id)
            return (
              <li key={o.seatId} className={`flex items-center gap-2 rounded-md px-1.5 py-1 ${active ? 'bg-brand-50/70' : 'hover:bg-zinc-50'}`}>
                <SeatAvatar seat={o.seat} size={24} />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => o.conv && mine && nav(`/workbench/chat/${o.conv.id}`)} title={mine ? '切到这条会话' : '不是你持有的坐席'}>
                  <div className="flex items-center gap-1 text-xs text-zinc-900">
                    {o.seat.displayName}
                    {o.primary && <Star size={11} className="fill-gold-500 text-gold-500" />}
                    {o.source === 'backfill' && <span className="text-[10px] text-zinc-400">补加</span>}
                  </div>
                  <div className="truncate text-[10px] text-zinc-500">{o.seat.roleDesc}</div>
                </button>
                {can('view_seat_operator') && (
                  <span className="shrink-0 text-right text-[10px] text-zinc-400" title={`当前实操员工，客户端永远看不到${handovers.length ? `\n交接记录：${handovers.map((h) => `${fmtDate(h.at)} ${staffById(s, h.fromStaffId)?.name ?? '无'}→${staffById(s, h.toStaffId)?.name}`).join('；')}` : ''}`}>
                    {op?.name ?? '无人'}
                    {handovers.length > 0 && <span className="block">交接 {handovers.length} 次</span>}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
        <p className="mt-2 text-[10px] leading-relaxed text-zinc-400">★ 主归属。没有「转移客户」按钮：坐席对客户是固定的，换人是管理后台的坐席交接。</p>
      </Section>

      <Section title="头衔" hint="官方发的，所有人可见">
        <div className="flex flex-wrap gap-1">
          {c.titleIds.map((tid) => {
            const t = s.titles.find((x) => x.id === tid)
            if (!t) return null
            return (
              <span key={tid} className="inline-flex items-center gap-0.5">
                <TitleChip title={t} onRemove={can('assign_title') ? () => s.removeTitle(c.id, tid, staff.id) : undefined} />
                {c.primaryTitleId !== tid && can('assign_title') && (
                  <button type="button" className="text-[10px] text-zinc-400 hover:text-brand-700" onClick={() => s.setPrimaryTitle(c.id, tid)} title="设为主头衔（昵称旁只显示主头衔）">
                    设主
                  </button>
                )}
              </span>
            )
          })}
          {c.titleIds.length === 0 && <span className="text-[11px] text-zinc-400">无</span>}
        </div>
        {can('assign_title') ? (
          titlesAvail.length > 0 &&
          c.titleIds.length < 5 && (
            <Select
              className="mt-2 h-7 text-xs"
              value=""
              onChange={(e) => {
                if (!e.target.value) return
                s.assignTitle(c.id, e.target.value, staff.id)
                toast(`已挂头衔「${s.titles.find((t) => t.id === e.target.value)?.name}」，客户和群里的人都能看到`)
              }}
            >
              <option value="">从头衔库挂一个…</option>
              {titlesAvail.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )
        ) : (
          <p className="mt-1 text-[10px] text-zinc-400">需员工角色能力 assign_title 才能挂、摘头衔</p>
        )}
      </Section>

      <Section title="内部标签" hint="客户永远看不到">
        <div className="flex flex-wrap gap-1">
          {c.tagIds.map((tid) => {
            const t = s.tags.find((x) => x.id === tid)
            return t ? <TagChip key={tid} tag={t} onRemove={() => s.removeTag(c.id, tid)} /> : null
          })}
          {c.tagIds.length === 0 && <span className="text-[11px] text-zinc-400">无</span>}
        </div>
        {tagsAvail.length > 0 && (
          <Select className="mt-2 h-7 text-xs" value="" onChange={(e) => e.target.value && s.addTag(c.id, e.target.value)}>
            <option value="">从标签库添加…</option>
            {tagsAvail.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        )}
        {canCreateTag ? (
          <div className="mt-1.5 flex gap-1">
            <Input className="h-7 text-xs" value={newTag} maxLength={16} placeholder="新建标签，回车确认" onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createTag()} />
            <Button size="sm" disabled={!newTag.trim()} onClick={createTag}>
              新建
            </Button>
          </div>
        ) : (
          <p className="mt-1 text-[10px] text-zinc-400">策略 tag.create 对本坐席关闭：只能从标签库选，不能新建</p>
        )}
      </Section>

      <Section title="备注" hint={`${note.length}/${NOTE_MAX}`}>
        <Textarea rows={2} value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== c.note && s.setNote(c.id, note)} placeholder="写点只有同事看得到的话，失焦保存" className="text-xs" />
        <div className="mt-1 text-[10px] text-zinc-400">最新一条 · {staff.name}</div>
        <div className="mt-1.5">
          <Note>正式版按时间倒序显示多条备注，每条带作者与时间，作者可编辑、删除。演示模型只有一条，当作最新一条显示。</Note>
        </div>
      </Section>

      <Section title="购买与邀请" hint="从卖货系统同步，不手改">
        {c.purchases.length ? (
          <ul className="space-y-1 text-xs">
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
          <div className="text-[11px] text-zinc-400">暂无购买</div>
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
      </Section>

      <GroupsSection c={c} />
      {s.enterprise.modules.wallet && <WalletSection c={c} />}
      {s.enterprise.modules.checkin && <CheckinSection c={c} />}
      {s.enterprise.modules.referral && <ReferralSection c={c} />}

      <div className="flex-1" />
      <CustomerActions c={c} />
    </div>
  )
}
