/**
 * 会话页右栏「话术」页签：搜索框（标题 / 关键词 / 正文）→ 可折叠分组（最近使用、企业分类、我的、未分类）→ 条目。
 * 发送 / 填入走 QuickReplyTarget（由会话页从聊天区拿到）；个人话术可新建 / 编辑 / 删除（受企业开关控制），企业话术只读。
 * 折叠状态记在本机（useLocalPref）。没选会话时面板照常显示，但发送按钮禁用。
 */
import { Fragment, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { ChevronDown, ChevronRight, Plus, Search, X } from 'lucide-react'
import type { QuickReply } from '@/domain/types'
import { matchQuickReplies, renderQuickReplyVars } from '@/store/selectors'
import { Input } from '@/ui/primitives'
import { HelpTip } from '@/ui/help'
import { toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { useWorkbench } from '../../useWorkbench'
import { useLocalPref } from '../../useLocalPref'
import { QuickReplyEditor } from './QuickReplyEditor'
import { QuickReplyItem } from './QuickReplyItem'
import { buildQuickReplyGroups, categoryName, type QuickReplyTarget } from './shared'

const SEARCH_LIMIT = 50
const NO_CONVERSATION = '先选一条会话'

type Editing = { item?: QuickReply } | null

export function QuickReplyPanel({ target }: { target: QuickReplyTarget }) {
  const { s, staff, seat } = useWorkbench()
  const [q, setQ] = useState('')
  const [collapsed, setCollapsed] = useLocalPref<Record<string, boolean>>('chat.qrCollapsed', {})
  const [editing, setEditing] = useState<Editing>(null)
  const staffId = staff?.id ?? null
  const reason = !target.active ? NO_CONVERSATION : target.blockReason
  const canCreate = s.enterprise.allowPersonalQuickReply && !!staff

  const groups = useMemo(() => buildQuickReplyGroups(s, staffId), [s, staffId])
  const query = q.trim()
  const results = useMemo(() => (query ? matchQuickReplies(s, staffId, query, SEARCH_LIMIT).map((m) => m.item) : null), [s, staffId, query])

  const render = (text: string) => renderQuickReplyVars(text, { customer: target.customerName, staff: seat?.displayName ?? staff?.name ?? '', company: s.enterprise.name })

  const send = (item: QuickReply) => {
    if (reason) return toast(reason, 'warn')
    if (item.kind === 'text') target.sendText(render(item.text))
    else if (item.media) target.sendMedia(item.kind, item.media, render(item.text))
    else return toast('这条话术没有附件', 'warn')
    s.touchQuickReply(item.id)
    toast('已发送')
  }
  const fill = (item: QuickReply) => {
    if (!target.active) return toast(NO_CONVERSATION, 'warn')
    target.insertText(item.text)
    s.touchQuickReply(item.id)
  }
  const remove = async (item: QuickReply) => {
    if (!staff) return
    const ok = await confirm({ title: `删除话术「${item.title}」？`, body: '只删你自己的这条，不影响企业话术。', okText: '删除', danger: true })
    if (!ok) return
    s.deleteQuickReply('personal', item.id, staff.id)
    toast('已删除')
  }
  const toggle = (key: string) => setCollapsed((c) => ({ ...c, [key]: !c[key] }))

  const renderItem = (item: QuickReply) => {
    const own = item.scope === 'personal' && item.staffId === staffId
    return <QuickReplyItem key={item.id} item={item} reason={reason} onSend={() => send(item)} onFill={() => fill(item)} onEdit={own ? () => setEditing({ item }) : undefined} onDelete={own ? () => void remove(item) : undefined} />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-zinc-200 px-2 py-2">
        <div className="relative min-w-0 flex-1">
          <Search size={13} className="absolute top-1/2 left-2 -translate-y-1/2 text-zinc-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜标题 / 关键词 / 正文" className="h-8 pr-6 pl-7 text-[12px]" />
          {q && (
            <button type="button" onClick={() => setQ('')} className="absolute top-1/2 right-1.5 -translate-y-1/2 text-zinc-400 hover:text-zinc-700" aria-label="清空">
              <X size={13} />
            </button>
          )}
        </div>
        {canCreate && (
          <button type="button" title="新建我的话术（只有你看得到）" onClick={() => setEditing({})} className="flex h-8 shrink-0 items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 text-[12px] text-zinc-700 hover:bg-zinc-50 hover:text-brand-700">
            <Plus size={13} /> 新建
          </button>
        )}
        <HelpTip align="right" text="文字话术：悬停「发送」直接发、「填入」进输入框再改。图片 / 文件：点一下直接发出。输入框里打字满 2 个字会自动匹配，也可以输「/」浏览全部。" />
      </div>
      {reason && (
        <div className="shrink-0 border-b border-amber-100 bg-amber-50 px-3 py-1 text-[11px] text-amber-700" title="发送按钮已禁用，仍可浏览与填入">
          {reason}
        </div>
      )}

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {results ? (
          <>
            <div className="px-1 py-2 text-[11px] text-zinc-400">{results.length ? `匹配 ${results.length} 条` : '没有匹配的话术'}</div>
            <div className="space-y-1.5">
              {results.map((item) => (
                <div key={item.id}>
                  <div className="mb-0.5 px-1 text-[11px] text-zinc-400">{categoryName(s, item.categoryId)}{item.scope === 'personal' ? ' · 我的' : ''}</div>
                  {renderItem(item)}
                </div>
              ))}
            </div>
          </>
        ) : (
          groups.map((g, i) => (
            <Fragment key={g.key}>
              {g.section === 'mine' && groups[i - 1]?.section !== 'mine' && <div className="mt-3 px-1 text-[11px] font-medium text-zinc-400">我的</div>}
              <button type="button" onClick={() => toggle(g.key)} className="mt-1.5 flex w-full items-center gap-1 rounded px-1 py-1 text-left text-[12px] font-medium text-zinc-700 hover:bg-zinc-50">
                {collapsed[g.key] ? <ChevronRight size={13} className="text-zinc-400" /> : <ChevronDown size={13} className="text-zinc-400" />}
                <span className="truncate">{g.title}</span>
                <span className={clsx('rounded-full px-1.5 text-[11px] leading-4 tabular-nums', g.items.length ? 'bg-zinc-100 text-zinc-500' : 'text-zinc-300')}>{g.items.length}</span>
              </button>
              {!collapsed[g.key] && (
                <div className="space-y-1.5 pb-1">
                  {g.items.map(renderItem)}
                  {g.items.length === 0 && <div className="px-2 py-1 text-[11px] text-zinc-400">这个分类还没有话术</div>}
                </div>
              )}
            </Fragment>
          ))
        )}
        {!results && groups.length === 0 && <div className="px-2 py-6 text-center text-[12px] text-zinc-400">还没有话术</div>}
      </div>

      {editing && <QuickReplyEditor key={editing.item?.id ?? 'new'} initial={editing.item} onClose={() => setEditing(null)} />}
    </div>
  )
}
