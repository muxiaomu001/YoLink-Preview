import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star } from 'lucide-react'
import { fmtDate, fmtDateTime, fmtAgo } from '@/domain/time'
import { customerById, seatsOfCustomer, staffById } from '@/store/selectors'
import { Avatar, KV, SeatAvatar, TagChip, TitleChip } from '@/ui/display'
import { Select, Textarea } from '@/ui/primitives'
import { toast } from '@/ui/overlay'
import { useWorkbench } from '../useWorkbench'

function Section({ title, children, hint }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-zinc-100 px-4 py-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h4 className="text-[11px] font-semibold tracking-wide text-zinc-500">{title}</h4>
        {hint && <span className="text-[10px] text-zinc-400">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

export function CustomerCard({ customerId }: { customerId: string }) {
  const { s, staff, seat, can } = useWorkbench()
  const nav = useNavigate()
  const c = customerById(s, customerId)
  const [note, setNote] = useState(c?.note ?? '')
  useEffect(() => setNote(c?.note ?? ''), [c?.id, c?.note])
  if (!c || !staff) return null

  const officials = seatsOfCustomer(s, c.id)
  const group = s.inviteGroups.find((g) => g.id === c.inviteGroupId)
  const link = s.inviteLinks.find((l) => l.id === c.inviteLinkId)
  const referrer = customerById(s, c.referrerId)
  const groups = s.chatGroups.filter((g) => g.memberCustomerIds.includes(c.id))
  const titlesAvail = s.titles.filter((t) => t.enabled && !c.titleIds.includes(t.id))
  const tagsAvail = s.tags.filter((t) => !c.tagIds.includes(t.id))

  return (
    <div>
      <div className="flex flex-col items-center border-b border-zinc-100 px-4 py-4 text-center">
        <Avatar text={c.nickname} size={56} />
        <div className="mt-2 text-sm font-semibold text-zinc-900">{c.nickname}</div>
        <div className="mt-1 flex flex-wrap justify-center gap-1">
          {c.titleIds.map((tid) => {
            const t = s.titles.find((x) => x.id === tid && x.enabled)
            return t ? <TitleChip key={tid} title={t} size="xs" /> : null
          })}
        </div>
        <div className="mt-1 text-[11px] text-zinc-400">{c.accountId}</div>
      </div>

      <Section title="基础信息">
        <KV
          items={[
            { k: '注册时间', v: fmtDateTime(c.registeredAt) },
            { k: '注册来源', v: `${group?.name ?? '-'}${link ? ` · ${link.name}` : ''}` },
            { k: '最近活跃', v: fmtAgo(c.lastActiveAt) },
            { k: '设备', v: c.device },
            { k: '手机号', v: c.phone ?? '-' },
          ]}
        />
      </Section>

      <Section title="官方联系人与归属" hint="客户看得到左边，看不到右边">
        <ul className="space-y-1.5">
          {officials.map((o) => {
            const op = staffById(s, o.seat.operatorStaffId)
            const active = o.seat.id === seat?.id
            return (
              <li key={o.seatId} className={`flex items-center gap-2 rounded-md px-1.5 py-1 ${active ? 'bg-brand-50/70' : 'hover:bg-zinc-50'}`}>
                <SeatAvatar seat={o.seat} size={24} />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => o.conv && o.seat.operatorStaffId === staff.id && nav(`/workbench/chat/${o.conv.id}`)} title={o.seat.operatorStaffId === staff.id ? '切到这条会话' : '不是你持有的坐席'}>
                  <div className="flex items-center gap-1 text-xs text-zinc-900">
                    {o.seat.displayName}
                    {o.primary && <Star size={11} className="fill-gold-500 text-gold-500" />}
                    {o.source === 'backfill' && <span className="text-[10px] text-zinc-400">补加</span>}
                  </div>
                  <div className="truncate text-[10px] text-zinc-500">{o.seat.roleDesc}</div>
                </button>
                {can('view_seat_operator') && <span className="shrink-0 text-[10px] text-zinc-400" title="当前实操员工，客户端永远看不到">{op?.name ?? '无人'}</span>}
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
        {can('assign_title') && titlesAvail.length > 0 && c.titleIds.length < 5 && (
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
            <option value="">添加内部标签…</option>
            {tagsAvail.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        )}
      </Section>

      <Section title="备注" hint="内部可见">
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== c.note && s.setNote(c.id, note)} placeholder="写点只有同事看得到的话" className="text-xs" />
      </Section>

      <Section title="购买与邀请" hint="从卖货系统同步，不手改">
        {c.purchases.length ? (
          <ul className="space-y-1 text-xs">
            {c.purchases.map((p, i) => (
              <li key={i} className="flex justify-between">
                <span className="text-zinc-800">{p.product}</span>
                <span className="tabular-nums text-zinc-500">
                  {fmtDate(p.at)} · ${(p.amount / 7.8).toLocaleString(undefined, { maximumFractionDigits: 0 })}
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
              { k: '邀请人', v: referrer ? referrer.nickname : '-' },
              { k: '直接邀请', v: `${c.inviteCount} 人 · 团队 ${c.teamCount} 人` },
              { k: '角色', v: c.roleLabel ?? '-' },
            ]}
          />
        </div>
      </Section>

      <Section title="所在群与频道">
        <div className="flex flex-wrap gap-1">
          {groups.map((g) => (
            <span key={g.id} className="rounded-md border border-zinc-200 px-1.5 text-[11px] leading-5 text-zinc-600">
              {g.name}
            </span>
          ))}
          {groups.length === 0 && <span className="text-[11px] text-zinc-400">无</span>}
        </div>
      </Section>

      <div className="px-4 py-3 text-[10px] text-zinc-400">
        操作：重置密码、拉黑、注销在正式产品里，演示不展开。
      </div>
    </div>
  )
}
