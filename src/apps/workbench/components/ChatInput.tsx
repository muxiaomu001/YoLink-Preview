/**
 * 输入区：引用栏、`@` 成员选择（坐席 + 客户成员 + 「所有人」按策略）、`/` 快捷回复（企业 + 本人个人，方向键选 Enter 插入）、
 * 变量 {{customer.nickname}} {{staff.name}} {{company.name}} 发送时替换、上传按钮按策略显示。
 */
import { useMemo, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { AtSign, Paperclip, Send, X, Zap } from 'lucide-react'
import type { ChatGroup, Customer, Message, Seat } from '@/domain/types'
import { seatCan, senderName, visibleText } from '@/store/policy'
import { customerById, seatById } from '@/store/selectors'
import { Avatar, Pill, SeatAvatar } from '@/ui/display'
import { Button, Textarea } from '@/ui/primitives'
import { toast } from '@/ui/overlay'
import { useWorkbench } from '../useWorkbench'

const MENTION_ALL = '所有人'
const MAX_CANDIDATES = 8

type Pop = { kind: 'mention' | 'quick'; query: string; start: number }
type Candidate = { id: string; label: string; insert: string; avatar?: React.ReactNode; sub?: string }

export function ChatInput({
  seat,
  group,
  customer,
  text,
  setText,
  replyTo,
  onClearReply,
  disabledReason,
  onSend,
}: {
  seat: Seat
  group?: ChatGroup
  customer?: Customer
  text: string
  setText: (v: string) => void
  replyTo?: Message
  onClearReply: () => void
  disabledReason?: string
  onSend: (text: string, mentionAll: boolean) => void
}) {
  const { s, staff } = useWorkbench()
  // Textarea 组件不透传 ref：从包裹层找 textarea
  const wrapRef = useRef<HTMLDivElement>(null)
  const ref = { get current() { return wrapRef.current?.querySelector('textarea') ?? null } }
  const [pop, setPopRaw] = useState<Pop | null>(null)
  const [idx, setIdx] = useState(0)
  /** 弹层内容变了就从第一项选起 */
  const setPop = (p: Pop | null) => {
    setPopRaw(p)
    setIdx(0)
  }
  const isGroup = !!group
  const canMentionAll = isGroup && seatCan(s, seat.id, 'group.mention_all', group.id)
  const canMedia = seatCan(s, seat.id, isGroup ? 'group.send_media' : 'dm.send_media', group?.id)
  const disabled = !!disabledReason

  const candidates: Candidate[] = useMemo(() => {
    if (!pop) return []
    const q = pop.query.toLowerCase()
    if (pop.kind === 'quick') {
      return s.quickReplies
        .filter((r) => r.scope === 'enterprise' || r.staffId === staff?.id)
        .filter((r) => !q || r.title.toLowerCase().includes(q) || r.text.toLowerCase().includes(q))
        .slice(0, MAX_CANDIDATES)
        .map((r) => ({ id: r.id, label: r.title, insert: r.text, sub: `${r.scope === 'enterprise' ? '企业' : '个人'} · ${r.text.slice(0, 40)}` }))
    }
    const list: Candidate[] = []
    if (canMentionAll && (!q || MENTION_ALL.includes(q))) list.push({ id: 'all', label: `@${MENTION_ALL}`, insert: `@${MENTION_ALL} `, sub: '通知群里每个人（策略 group.mention_all）' })
    if (isGroup) {
      group.memberSeatIds.map((id) => seatById(s, id)).filter((x) => !!x).forEach((x) => {
        if (!q || x.displayName.toLowerCase().includes(q)) list.push({ id: x.id, label: x.displayName, insert: `@${x.displayName} `, avatar: <SeatAvatar seat={x} size={18} />, sub: '坐席' })
      })
      group.memberCustomerIds.map((id) => customerById(s, id)).filter((x) => !!x && !x.deletedAt).forEach((x) => {
        if (list.length < MAX_CANDIDATES && (!q || x!.nickname.toLowerCase().includes(q))) list.push({ id: x!.id, label: x!.nickname, insert: `@${x!.nickname} `, avatar: <Avatar text={x!.nickname} size={18} />, sub: '客户' })
      })
    } else if (customer) {
      list.push({ id: customer.id, label: customer.nickname, insert: `@${customer.nickname} `, avatar: <Avatar text={customer.nickname} size={18} />, sub: '客户' })
    }
    return list.slice(0, MAX_CANDIDATES)
  }, [pop, s, staff?.id, canMentionAll, isGroup, group, customer])

  /** 光标前是不是 @xxx 或 /xxx */
  const detect = (value: string, caret: number) => {
    const before = value.slice(0, caret)
    const m = /(^|\s)([@/])([^\s@/]*)$/.exec(before)
    if (!m) return setPop(null)
    setPop({ kind: m[2] === '@' ? 'mention' : 'quick', query: m[3], start: caret - m[3].length - 1 })
  }

  const pick = (c: Candidate) => {
    const caret = ref.current?.selectionStart ?? text.length
    const next = pop ? text.slice(0, pop.start) + c.insert + text.slice(caret) : text + c.insert
    setText(next)
    setPop(null)
    window.setTimeout(() => ref.current?.focus(), 0)
  }

  const renderVars = (t: string) => t.replace(/\{\{customer\.nickname\}\}/g, customer?.nickname ?? '各位').replace(/\{\{staff\.name\}\}/g, seat.displayName).replace(/\{\{company\.name\}\}/g, s.enterprise.name)

  const send = () => {
    const raw = text.trim()
    if (!raw || disabled) return
    const mentionAll = raw.includes(`@${MENTION_ALL}`)
    if (mentionAll && !canMentionAll) return toast('策略不允许本坐席 @所有人（group.mention_all）', 'warn')
    onSend(renderVars(raw), mentionAll)
    setPop(null)
  }

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (pop && candidates.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); return setIdx((i) => (i + 1) % candidates.length) }
      if (e.key === 'ArrowUp') { e.preventDefault(); return setIdx((i) => (i - 1 + candidates.length) % candidates.length) }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); return pick(candidates[idx]) }
      if (e.key === 'Escape') return setPop(null)
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="border-t border-zinc-200 bg-white px-4 py-3">
      {disabledReason && <div className="mb-2 text-xs text-amber-700">{disabledReason}</div>}
      {group?.kind === 'channel' && !disabledReason && <div className="mb-2 text-[11px] text-zinc-500">频道：以坐席身份发布，客户只读。</div>}
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-md border-l-2 border-brand-400 bg-zinc-50 px-2 py-1 text-[11px] text-zinc-600">
          <span className="shrink-0 text-zinc-400">引用</span>
          <span className="min-w-0 flex-1 truncate">{senderName(s, replyTo)}：{visibleText(replyTo, 'staff')}</span>
          <button type="button" onClick={onClearReply} className="text-zinc-400 hover:text-zinc-700" aria-label="取消引用"><X size={12} /></button>
        </div>
      )}
      <div className="relative" ref={wrapRef}>
        {pop && candidates.length > 0 && (
          <ul className="absolute bottom-full left-0 z-20 mb-1 w-80 rounded-md border border-zinc-200 bg-white py-1 shadow-lg">
            <li className="px-2.5 py-1 text-[10px] text-zinc-400">{pop.kind === 'mention' ? '@ 提及成员 · ↑↓ 选择，Enter 插入' : '快捷回复 · ↑↓ 选择，Enter 插入；变量发送时替换'}</li>
            {candidates.map((c, i) => (
              <li key={c.id}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(c)} className={clsx('flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs', i === idx ? 'bg-brand-50 text-brand-900' : 'text-zinc-700 hover:bg-zinc-50')}>
                  {c.avatar ?? <Zap size={12} className="text-zinc-400" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.label}</span>
                    {c.sub && <span className="block truncate text-[10px] text-zinc-400">{c.sub}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            rows={2}
            value={text}
            disabled={disabled}
            onChange={(e) => {
              setText(e.target.value)
              detect(e.target.value, e.target.selectionStart ?? e.target.value.length)
            }}
            onKeyDown={onKey}
            onBlur={() => window.setTimeout(() => setPop(null), 150)}
            placeholder={disabled ? '当前不能发送' : `以「${seat.displayName}」身份回复… @ 提及，/ 快捷回复，Enter 发送，Shift+Enter 换行`}
          />
          <Button variant="primary" onClick={send} disabled={!text.trim() || disabled}>
            <Send size={13} /> 发送
          </Button>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-zinc-400">
        <Tool label="@ 提及" onClick={() => { setText(`${text}@`); setPop({ kind: 'mention', query: '', start: text.length }); ref.current?.focus() }} disabled={disabled}><AtSign size={12} /></Tool>
        <Tool label="快捷回复（/）" onClick={() => { setText(`${text}/`); setPop({ kind: 'quick', query: '', start: text.length }); ref.current?.focus() }} disabled={disabled}><Zap size={12} /></Tool>
        {canMedia ? (
          <Tool label="上传图片 / 视频 / 语音（演示不上传）" onClick={() => toast(`演示：上传不落库。上限 图片 ${s.policyNumbers.imageMaxMb}MB · 视频 ${s.policyNumbers.videoMaxMb}MB · 语音 ${s.policyNumbers.voiceMaxSeconds} 秒`, 'info')} disabled={disabled}><Paperclip size={12} /></Tool>
        ) : (
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-zinc-300" title={`策略 ${isGroup ? 'group.send_media' : 'dm.send_media'} 对本坐席关闭`}><Paperclip size={12} /> 媒体已关</span>
        )}
        <span className="ml-2">消息落库记坐席「{seat.displayName}」与实操员工 {staff?.name}。客户看到坐席，审计查到真人。</span>
        <Pill className="ml-auto">拖拽粘贴上传 P1</Pill>
      </div>
    </div>
  )
}

function Tool({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={label} disabled={disabled} onClick={onClick} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-zinc-500 hover:bg-zinc-100 hover:text-brand-700 disabled:text-zinc-300">
      {children}
    </button>
  )
}
