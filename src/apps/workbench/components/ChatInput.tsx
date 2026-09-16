/**
 * 输入区：回复条 → 工具栏（表情 / 附件 / 语音 / 话术 / @ 提及 / AI 推荐）→ 多行输入框 → 底部「发送」。
 * 三种候选浮层共用 CandidatePopover：
 * - `@` 成员选择（坐席 + 客户成员 + 「所有人」按策略），Enter / Tab 插入
 * - `/` 话术（matchQuickReplies），Enter / Tab 选中：文字插入光标处，图片 / 文件直接发出
 * - 打字自动匹配（staff.prefs.quickMatch）：光标前最后一段 ≥ 2 字就在全库找（标题 / 正文 / 文件名），长的先试、没结果再往短里退；
 *   Tab / 点击选中，Enter 仍是发送，Esc 关闭后同一个词不再弹；选中文字话术用正文替换整个输入框
 * 变量 {{customer.nickname}} {{staff.name}} {{company.name}} 发送时替换；附件按钮按策略 canMedia 显示，按文件类型自动分图片 / 视频 / 文件，进预览后再发。
 */
import { useMemo, useRef, useState } from 'react'
import { AtSign, Mic, Paperclip, Send, Smile, Sparkles, X, Zap } from 'lucide-react'
import type { ChatGroup, Customer, Message, MessageMedia, QuickReply, Seat } from '@/domain/types'
import { DEFAULT_STAFF_PREFS } from '@/domain/seed-groups'
import { seatCan, senderName, visibleText } from '@/store/policy'
import { customerById, matchQuickReplies, renderQuickReplyVars, seatById } from '@/store/selectors'
import { Avatar, SeatAvatar } from '@/ui/display'
import { Button } from '@/ui/primitives'
import { restoreLocalFile } from '@/domain/localMedia'
import { MediaComposer, type ChatMediaKind } from '@/ui/MediaComposer'
import { toast } from '@/ui/overlay'
import { useWorkbench } from '../useWorkbench'
import { CandidatePopover, type CandidateBase } from './quick-replies/CandidatePopover'
import { categoryName, KIND_META, previewLine } from './quick-replies/quickReplyRules'
import { Highlight } from './quick-replies/shared'

const MENTION_ALL = '所有人'
const MAX_CANDIDATES = 8
/** 自动匹配：最多几条、至少几个字才匹配、最多取光标前多少个字当查询词 */
const AUTO_MAX = 5
const AUTO_MIN_CHARS = 2
const AUTO_WORD_MAX = 12

type PopKind = 'mention' | 'quick' | 'auto'
type Pop = { kind: PopKind; query: string; start: number }
type Candidate = CandidateBase & { insert: string; qr?: QuickReply; mentionKind?: 'seat' | 'customer' }

const POP_TITLE: Record<PopKind, string> = {
  mention: '@ 提及成员 · ↑↓ 选择，Enter 插入',
  quick: '话术 · ↑↓ 选择，Enter 选中；图片 / 文件直接发出',
  auto: '匹配到的话术（标题 / 正文 / 文件名）· Tab 选中，Esc 关闭',
}

/** 光标前最后一个「词」：按空白切，取最后一段的末尾若干字 */
function lastWord(before: string): string {
  const seg = before.split(/\s+/).pop() ?? ''
  return seg.slice(-AUTO_WORD_MAX)
}

/** 中文没有空格，整句都会被当成一个词；从长到短依次退，取第一个能搜到东西的后缀 */
function suffixQueries(word: string): string[] {
  const out: string[] = []
  for (let n = word.length; n >= AUTO_MIN_CHARS; n -= 1) out.push(word.slice(-n))
  return out
}

export function ChatInput({
  seat,
  draftId,
  group,
  customer,
  text,
  setText,
  replyTo,
  quoteText,
  onClearReply,
  disabledReason,
  onSend,
  onSendMedia,
  onAiSuggest,
  onBlurText,
}: {
  seat: Seat
  draftId:string
  group?: ChatGroup
  customer?: Customer
  text: string
  setText: (v: string) => void
  replyTo?: Message
  quoteText?: string
  onClearReply: () => void
  disabledReason?: string
  onSend: (text: string, mentionAll: boolean, selected: { mentionSeatIds: string[]; mentionCustomerIds: string[] }) => void
  /** 图片 / 文件消息：工具栏选本机文件、话术里选到图片 / 文件时直接发出 */
  onSendMedia: (kind: ChatMediaKind, media: MessageMedia, text: string) => boolean
  /** 不传则不显示「AI 推荐」按钮（策略不允许） */
  onAiSuggest?: () => void
  /** 失焦时把输入框内容落进草稿（平时按防抖写，避免逐键持久化） */
  onBlurText?: () => void
}) {
  const { s, staff } = useWorkbench()
  // Textarea 不透传 ref：从包裹层找 textarea
  const wrapRef = useRef<HTMLDivElement>(null)
  const ref = { get current() { return wrapRef.current?.querySelector('textarea') ?? null } }
  const [mediaPick,setMediaPick]=useState<{kind:ChatMediaKind;files:File[]}|null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [pop, setPopRaw] = useState<Pop | null>(null)
  const [selectedMembers, setSelectedMembers] = useState<Candidate[]>([])
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [idx, setIdx] = useState(0)
  /** 自动匹配被 Esc 关掉的词：同一个词不再弹，词变了才重新弹 */
  const [dismissedWord, setDismissedWord] = useState<string | null>(null)
  /** 弹层内容变了就从第一项选起 */
  const setPop = (p: Pop | null) => {
    setPopRaw(p)
    setIdx(0)
  }
  const isGroup = !!group
  const canMentionAll = isGroup && seatCan(s, seat.id, 'group.mention_all', group.id)
  const canMedia = seatCan(s, seat.id, isGroup ? 'group.send_media' : 'dm.send_media', group?.id)
  const quickMatch = staff?.prefs?.quickMatch ?? DEFAULT_STAFF_PREFS.quickMatch
  const disabled = !!disabledReason

  const candidates: Candidate[] = useMemo(() => {
    if (!pop) return []
    if (pop.kind !== 'mention') {
      const staffId = staff?.id ?? null
      const auto = pop.kind === 'auto'
      const limit = auto ? AUTO_MAX : MAX_CANDIDATES
      // 自动匹配时长后缀先试，没结果再退一个字；`/` 弹层直接用输入的词
      const queries = auto ? suffixQueries(pop.query) : [pop.query]
      // 一个都搜不到就不弹（`/` 弹层的空查询本身会返回最近使用，不受影响）
      const hits = queries.map((q) => matchQuickReplies(s, staffId, q, limit)).find((r) => r.length > 0) ?? []
      return hits.map(({ item, hit, snippet }) => {
        const Icon = KIND_META[item.kind].icon
        const cat = categoryName(s, item.categoryId)
        const label = hit === 'title' && snippet ? <Highlight snippet={snippet} /> : item.title
        const sub =
          hit === 'title' || !snippet ? (
            `${cat} · ${previewLine(item)}`
          ) : (
            <>
              {cat} · <Highlight snippet={snippet} />
            </>
          )
        return { id: item.id, label, insert: item.text, qr: item, icon: <Icon size={12} className="shrink-0 text-zinc-400" />, sub }
      })
    }
    const q = pop.query.toLowerCase()
    const list: Candidate[] = []
    if (canMentionAll && (!q || MENTION_ALL.includes(q))) list.push({ id: 'all', label: `@${MENTION_ALL}`, insert: `@${MENTION_ALL} `, sub: '通知群里每个人' })
    if (isGroup) {
      group.memberSeatIds.map((id) => seatById(s, id)).filter((x) => !!x).forEach((x) => {
        if (!q || x.displayName.toLowerCase().includes(q)) list.push({ id: x.id, mentionKind: 'seat', label: x.displayName, insert: `@${x.displayName} `, icon: <SeatAvatar seat={x} size={18} />, sub: '坐席' })
      })
      group.memberCustomerIds.map((id) => customerById(s, id)).filter((x) => !!x && !x.deletedAt).forEach((x) => {
        if (list.length < MAX_CANDIDATES && (!q || x!.nickname.toLowerCase().includes(q))) list.push({ id: x!.id, mentionKind: 'customer', label: x!.nickname, insert: `@${x!.nickname} `, icon: <Avatar text={x!.nickname} size={18} />, sub: `客户 · ${x!.accountId}` })
      })
    } else if (customer) {
      list.push({ id: customer.id, mentionKind: 'customer', label: customer.nickname, insert: `@${customer.nickname} `, icon: <Avatar text={customer.nickname} size={18} />, sub: `客户 · ${customer.accountId}` })
    }
    return list.slice(0, MAX_CANDIDATES)
  }, [pop, s, staff?.id, canMentionAll, isGroup, group, customer])

  /** 光标前是不是 @xxx 或 /xxx；都不是时按偏好做无触发字符的自动匹配 */
  const detect = (value: string, caret: number) => {
    const before = value.slice(0, caret)
    const m = /(^|\s)([@/])([^\s@/]*)$/.exec(before)
    if (m) return setPop({ kind: m[2] === '@' ? 'mention' : 'quick', query: m[3], start: caret - m[3].length - 1 })
    const word = quickMatch ? lastWord(before) : ''
    if (word.length < AUTO_MIN_CHARS || /^[@/]/.test(word)) return setPop(null)
    if (word === dismissedWord) return setPop(null)
    if (dismissedWord) setDismissedWord(null)
    setPop({ kind: 'auto', query: word, start: caret - word.length })
  }

  const renderVars = (t: string) => renderQuickReplyVars(t, { customer: customer?.nickname, staff: seat.displayName, company: s.enterprise.name })

  const pick = (c: Candidate) => {
    if (c.mentionKind) setSelectedMembers((items) => [...items.filter((x) => x.id !== c.id), c])
    const caret = ref.current?.selectionStart ?? text.length
    const q = c.qr
    if (q) s.touchQuickReply(q.id)
    if (q && q.kind !== 'text' && q.media) {
      // 图片 / 文件话术：直接发出，把触发词从输入框里去掉
      setText(pop ? text.slice(0, pop.start) + text.slice(caret) : text)
      onSendMedia(q.kind, q.media, renderVars(q.text))
      toast('已发送')
    } else if (pop?.kind === 'auto') {
      // 自动匹配：客服通常只打了两个字找话术，正文替换整个输入框
      setText(c.insert)
    } else {
      setText(pop ? text.slice(0, pop.start) + c.insert + text.slice(caret) : text + c.insert)
    }
    setPop(null)
    setDismissedWord(null)
    window.setTimeout(() => ref.current?.focus(), 0)
  }

  /** 工具栏触发 @ / 斜杠：在文末追加触发字符并打开弹层 */
  const openPop = (kind: 'mention' | 'quick') => {
    const trigger = kind === 'mention' ? '@' : '/'
    const prefix = text && !/\s$/.test(text) ? `${text} ` : text
    setText(`${prefix}${trigger}`)
    setPop({ kind, query: '', start: prefix.length })
    ref.current?.focus()
  }

  /** 工具栏选本机附件：一个入口，按文件类型自动判断图片 / 视频 / 文件，进预览后再发 */
  const pickAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    const kind: ChatMediaKind = files.every((f) => f.type.startsWith('image/')) ? 'image' : files.every((f) => f.type.startsWith('video/')) ? 'video' : 'file'
    setMediaPick({ kind, files })
  }

  /** 表情插到光标处，而不是无脑追加到末尾 */
  const insertEmoji = (emoji: string) => {
    const el = ref.current
    const start = el?.selectionStart ?? text.length
    const end = el?.selectionEnd ?? start
    setText(text.slice(0, start) + emoji + text.slice(end))
    setEmojiOpen(false)
    window.setTimeout(() => { const t = ref.current; t?.focus(); t?.setSelectionRange(start + emoji.length, start + emoji.length) }, 0)
  }

  const send = () => {
    const raw = text.trim()
    if (!raw || disabled) return
    const mentionAll = raw.includes(`@${MENTION_ALL}`)
    if (mentionAll && !canMentionAll) return toast('策略不允许本坐席 @所有人', 'warn')
    const kept = selectedMembers.filter((x) => raw.includes(x.insert.trim()))
    onSend(renderVars(raw), mentionAll, { mentionSeatIds: kept.filter((x) => x.mentionKind === 'seat').map((x) => x.id), mentionCustomerIds: kept.filter((x) => x.mentionKind === 'customer').map((x) => x.id) })
    setSelectedMembers([])
    setPop(null)
    setDismissedWord(null)
  }

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return
    if (pop && candidates.length) {
      const auto = pop.kind === 'auto'
      if (e.key === 'ArrowDown') { e.preventDefault(); return setIdx((i) => (i + 1) % candidates.length) }
      if (e.key === 'ArrowUp') { e.preventDefault(); return setIdx((i) => (i - 1 + candidates.length) % candidates.length) }
      // 自动匹配不抢 Enter：Enter 仍然发送，只有 Tab / 点击选中
      if (e.key === 'Tab' || (e.key === 'Enter' && !auto)) { e.preventDefault(); return pick(candidates[idx]) }
      if (e.key === 'Escape') {
        e.preventDefault()
        if (auto) setDismissedWord(pop.query)
        return setPop(null)
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // 上限值直接读后台策略：老板在后台改一个数字，这里的提示立刻跟着变
  const mediaHint = `上限：图片 ${s.policyNumbers.imageMaxMb}MB · 视频 ${s.policyNumbers.videoMaxMb}MB · 文件 ${s.policyNumbers.fileMaxMb}MB · 语音 ${s.policyNumbers.voiceMaxSeconds} 秒（后台「策略 · 数值型」可改）`

  return (
    <div className="border-t border-zinc-200 bg-white">
      {mediaPick&&<MediaComposer draftId={draftId} files={mediaPick.files} kind={mediaPick.kind} onClose={()=>setMediaPick(null)} onSend={onSendMedia}/>}
      {replyTo && (
        <div className="mx-3 mt-2 flex items-center gap-2 rounded-md border-l-2 border-brand-400 bg-zinc-50 px-2 py-1 text-[12px] text-zinc-600">
          <span className="shrink-0 text-zinc-400">回复</span>
          <span className="min-w-0 flex-1 truncate">{senderName(s, replyTo)}：{quoteText&&replyTo.text.includes(quoteText)?quoteText:visibleText(replyTo,'staff')}</span>
          <button type="button" onClick={onClearReply} className="text-zinc-400 hover:text-zinc-700" aria-label="取消回复"><X size={13} /></button>
        </div>
      )}

      {!mediaPick&&s.mediaDrafts?.[draftId]&&<button type="button" className="mx-3 mt-2 rounded-md bg-brand-50 px-3 py-2 text-xs text-brand-700" onClick={async()=>{const draft=s.mediaDrafts?.[draftId];if(!draft)return;try{const files=await Promise.all(draft.items.map(restoreLocalFile));setMediaPick({kind:draft.kind,files})}catch{toast('附件草稿在此浏览器中已不可用','warn')}}}>继续编辑附件草稿（{s.mediaDrafts[draftId].items.length} 项）</button>}
      {/* 工具栏 */}
      <div className="flex items-center gap-0.5 px-2 pt-1.5">
        <Tool label="表情" onClick={() => setEmojiOpen((v) => !v)} disabled={disabled}><Smile size={16} /></Tool>
        {canMedia && (
          <>
            <input ref={fileInput} type="file" multiple className="hidden" onChange={pickAttachment} />
            <Tool label={`附件：图片 / 视频 / 文件，选好先预览再发送。${mediaHint}`} onClick={() => fileInput.current?.click()} disabled={disabled}><Paperclip size={16} /></Tool>
            <Tool label="录制语音" onClick={()=>setMediaPick({kind:'voice',files:[]})} disabled={disabled}><Mic size={16}/></Tool>
          </>
        )}
        <Tool label="话术（输入 / 也可打开；右栏「话术」页签可浏览全部）" onClick={() => openPop('quick')} disabled={disabled}><Zap size={16} /></Tool>
        <Tool label="@ 提及（输入 @ 也可打开）" onClick={() => openPop('mention')} disabled={disabled}><AtSign size={16} /></Tool>
        {onAiSuggest && <Tool label="AI 推荐：根据客户最后一句生成回复草稿" onClick={onAiSuggest} disabled={disabled}><Sparkles size={16} /></Tool>}
        {group?.kind === 'channel' && !disabledReason && <span className="ml-auto text-[11px] text-zinc-400">以频道身份发布，客户只读</span>}
      </div>

      {emojiOpen && <div className="mx-3 mt-1 flex flex-wrap gap-1 rounded-md border border-zinc-200 p-2" aria-label="表情选择器">{['😊', '👍', '🙏', '🌹', '🎉', '👌', '🤝', '☀️', '❤️', '✅', '👋', '💪'].map((emoji) => <button type="button" key={emoji} aria-label={`插入表情 ${emoji}`} className="rounded p-1 text-xl hover:bg-zinc-100" onClick={() => { insertEmoji(emoji) }}>{emoji}</button>)}</div>}
      <div id="wb-chat-input" className="relative px-3 pb-2" ref={wrapRef}>
        {pop && candidates.length > 0 && <CandidatePopover title={POP_TITLE[pop.kind]} items={candidates} idx={idx} onPick={pick} onHover={setIdx} />}
        <textarea
          rows={3}
          maxLength={4096}
          value={text}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value)
            detect(e.target.value, e.target.selectionStart ?? e.target.value.length)
          }}
          onKeyDown={onKey}
          onBlur={() => { onBlurText?.(); window.setTimeout(() => setPop(null), 150) }}
          placeholder={disabledReason ?? (group?.kind==='channel'?`向「${group.name}」发布…`:`以「${seat.displayName}」身份回复…`)}
          className="w-full resize-none border-0 bg-transparent px-1 py-1.5 text-[13px] leading-relaxed text-zinc-800 placeholder:text-zinc-400 focus:outline-none disabled:text-zinc-400"
        />
        <div className="flex items-center justify-end gap-3">
          {disabledReason && <span className="mr-auto text-[11px] text-amber-700">{disabledReason}</span>}
          <span className="text-[11px] text-zinc-400">Enter 发送，Shift+Enter 换行</span>
          <Button variant="primary" size="sm" onClick={send} disabled={!text.trim() || disabled}>
            <Send size={13} /> 发送
          </Button>
        </div>
      </div>
    </div>
  )
}

function Tool({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="flex h-6 w-6 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-brand-700 disabled:text-zinc-300 disabled:hover:bg-transparent">
      {children}
    </button>
  )
}
