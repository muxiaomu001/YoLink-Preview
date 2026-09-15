import { useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { Send, Sparkles, Zap } from 'lucide-react'
import { draftsFor } from '@/domain/ai'
import type { Seat } from '@/domain/types'
import { fmtDateTime, fmtTime } from '@/domain/time'
import { customerById, messagesOf, seatById, staffById, type ConvRow } from '@/store/selectors'
import { Avatar, SeatAvatar, TitleChip } from '@/ui/display'
import { Button, Textarea } from '@/ui/primitives'
import { toast } from '@/ui/overlay'
import { useWorkbench } from '../useWorkbench'

export function ChatArea({ row, seat }: { row: ConvRow; seat: Seat }) {
  const { s, staff, can } = useWorkbench()
  const msgs = useMemo(() => messagesOf(s, row.conv.id), [s, row.conv.id])
  const [text, setText] = useState('')
  const [draftFrom, setDraftFrom] = useState<'ai' | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const isDm = row.conv.kind === 'dm'
  const customer = row.customer
  const group = !isDm ? s.chatGroups.find((g) => g.id === row.conv.chatGroupId) : undefined
  const blocked = customer?.blockedSeatIds.includes(seat.id)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [msgs.length, row.conv.id])

  useEffect(() => {
    setText('')
    setDraftFrom(null)
  }, [row.conv.id])

  const lastCustomerMsg = [...msgs].reverse().find((m) => m.senderKind === 'customer')
  const showAi = isDm && customer && row.waitingSince && lastCustomerMsg
  const drafts = showAi ? draftsFor({ lastCustomerText: lastCustomerMsg.text, customer, seat, knowledge: s.knowledge }) : []

  const send = () => {
    if (!text.trim() || !staff) return
    s.seatSend(row.conv.id, seat.id, staff.id, text.trim(), draftFrom === 'ai')
    if (draftFrom === 'ai') s.recordAi(staff.id, row.conv.id, 'adopted')
    setText('')
    setDraftFrom(null)
  }

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4">
        {isDm && customer ? (
          <>
            <Avatar text={customer.nickname} size={28} />
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-semibold text-zinc-900">{customer.nickname}</span>
              {customer.titleIds.map((tid) => {
                const t = s.titles.find((x) => x.id === tid && x.enabled)
                return t ? <TitleChip key={tid} title={t} size="xs" /> : null
              })}
            </div>
            <span className="text-[11px] text-zinc-400">{customer.accountId}</span>
          </>
        ) : (
          <>
            <Avatar text={group?.name ?? ''} size={28} color={group?.kind === 'channel' ? '#b45309' : '#0f766e'} official />
            <span className="text-[13px] font-semibold text-zinc-900">{group?.name}</span>
            <span className="text-[11px] text-zinc-400">{group?.kind === 'channel' ? '频道 · 客户只读' : `${(group?.memberCustomerIds.length ?? 0) + (group?.memberSeatIds.length ?? 0)} 位成员`}</span>
          </>
        )}
        <div className="ml-auto flex items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-1 text-[11px] text-zinc-600">
          <SeatAvatar seat={seat} size={16} /> 以「{seat.displayName}」身份发言
        </div>
      </header>

      <div ref={listRef} className="thin-scroll flex-1 overflow-y-auto px-5 py-4">
        {msgs.map((m, i) => {
          const mine = m.senderKind === 'seat' && m.seatId === seat.id
          const otherSeat = m.senderKind === 'seat' && m.seatId !== seat.id ? seatById(s, m.seatId) : undefined
          const sender = m.senderKind === 'customer' ? customerById(s, m.senderId) : undefined
          const op = m.senderKind === 'seat' ? staffById(s, m.operatorId) : undefined
          const showDate = i === 0 || new Date(m.at).toDateString() !== new Date(msgs[i - 1].at).toDateString()
          const senderTitle = sender?.primaryTitleId ? s.titles.find((t) => t.id === sender.primaryTitleId && t.enabled) : undefined
          return (
            <div key={m.id}>
              {showDate && <div className="my-3 text-center text-[10px] text-zinc-400">{fmtDateTime(m.at).slice(0, 10)}</div>}
              <div className={clsx('mb-3 flex gap-2', mine && 'flex-row-reverse')}>
                {mine ? <SeatAvatar seat={seat} size={28} /> : otherSeat ? <SeatAvatar seat={otherSeat} size={28} /> : <Avatar text={sender?.nickname ?? '?'} size={28} />}
                <div className={clsx('max-w-[70%]', mine && 'items-end text-right')}>
                  {!isDm && !mine && (
                    <div className="mb-0.5 flex items-center gap-1 text-[10px] text-zinc-500">
                      {otherSeat?.displayName ?? sender?.nickname}
                      {senderTitle && <TitleChip title={senderTitle} size="xs" />}
                    </div>
                  )}
                  <div className={clsx('inline-block rounded-lg px-3 py-2 text-left text-[13px] leading-relaxed whitespace-pre-wrap', mine ? 'bg-brand-700 text-white' : otherSeat ? 'bg-brand-50 text-zinc-800' : 'bg-white text-zinc-800 shadow-sm')}>
                    {m.text}
                  </div>
                  <div className={clsx('mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-400', mine && 'justify-end')}>
                    <span className="tabular-nums">{fmtTime(m.at)}</span>
                    {m.isWelcome && <span className="rounded bg-zinc-100 px-1">欢迎语</span>}
                    {m.aiDraftUsed && <span className="rounded bg-violet-50 px-1 text-violet-600">AI 草稿</span>}
                    {m.senderKind === 'seat' && can('view_seat_operator') && op && <span title="客户看不到这个">实操：{op.name}</span>}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* AI 回复推荐 */}
      {showAi && drafts.length > 0 && (
        <div className="border-t border-violet-100 bg-violet-50/60 px-4 py-2">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-violet-700">
            <Sparkles size={12} /> AI 回复推荐 · 依据客户最后一句、资料卡与知识库
          </div>
          <div className="flex flex-col gap-1.5">
            {drafts.map((d, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md border border-violet-100 bg-white px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="text-xs leading-relaxed text-zinc-800">{d.text}</div>
                  <div className="mt-0.5 text-[10px] text-zinc-400">依据：{d.basis}</div>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    if (!staff) return
                    s.seatSend(row.conv.id, seat.id, staff.id, d.text, true)
                    s.recordAi(staff.id, row.conv.id, 'adopted')
                  }}
                >
                  一键发出
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setText(d.text)
                    setDraftFrom('ai')
                    if (staff) s.recordAi(staff.id, row.conv.id, 'edited')
                  }}
                >
                  改后发
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 输入区 */}
      <div className="border-t border-zinc-200 bg-white px-4 py-3">
        {blocked && <div className="mb-2 text-xs text-amber-700">对方已拉黑「{seat.displayName}」，私聊发不出去；群消息照常。</div>}
        {group?.kind === 'channel' && <div className="mb-2 text-[11px] text-zinc-500">频道：以坐席身份发布，客户只读。</div>}
        <div className="mb-2 flex flex-wrap gap-1.5">
          {s.quickReplies.map((q) => (
            <button key={q.id} type="button" onClick={() => setText(q.text)} className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-600 hover:border-brand-300 hover:text-brand-800" title={q.text}>
              <Zap size={10} /> {q.title}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            rows={2}
            value={text}
            disabled={!!blocked}
            onChange={(e) => {
              setText(e.target.value)
              if (draftFrom && !e.target.value) setDraftFrom(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder={`以「${seat.displayName}」身份回复… Enter 发送，Shift+Enter 换行`}
          />
          <Button variant="primary" onClick={send} disabled={!text.trim() || !!blocked}>
            <Send size={13} /> 发送
          </Button>
        </div>
        <div className="mt-1.5 text-[10px] text-zinc-400">
          消息落库时同时记坐席「{seat.displayName}」与实操员工 {staff?.name}。客户看到的是坐席，审计查到的是真人。
          {!isDm && (
            <button type="button" className="ml-2 text-brand-700 hover:underline" onClick={() => toast('演示：群公告、置顶、禁言在群信息卡里')}>
              群管理
            </button>
          )}
        </div>
      </div>
    </>
  )
}
