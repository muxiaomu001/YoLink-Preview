/**
 * 会话页右栏「话术」页签：顶部搜索框 + 新建 → 左侧竖排分类标签（最近 / 全部 / 企业分类 / 我的 / 未分类）→ 右侧该分类的话术。
 * 图片话术在分类里按两列网格排，文字与文件按单列排。搜索时忽略当前分类，跨全库全文匹配（标题 / 正文 / 文件名），命中处高亮。
 * 发送 / 填入走 QuickReplyTarget（由会话页从聊天区拿到）；个人话术可新建 / 编辑 / 删除（受企业开关控制），企业话术只读。
 * 当前选中的标签记在本机（useLocalPref）。没选会话时面板照常显示，但发送按钮禁用。
 */
import { Fragment, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { Plus, Search, X } from 'lucide-react'
import type { QuickReply } from '@/domain/types'
import type { QuickReplyMatch } from '@/store/selectors'
import { matchQuickReplies, renderQuickReplyVars } from '@/store/selectors'
import { Input } from '@/ui/primitives'
import { HelpTip } from '@/ui/help'
import { toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { useWorkbench } from '../../useWorkbench'
import { useLocalPref } from '../../useLocalPref'
import { QuickReplyEditor } from './QuickReplyEditor'
import { QuickReplyImageCell, QuickReplyItem } from './QuickReplyItem'
import { buildQuickReplyTabs, categoryName, quickRepliesInTab, TAB_ALL, TAB_RECENT, type QuickReplyTab } from './quickReplyRules'
import type { QuickReplyTarget } from './shared'

const SEARCH_LIMIT = 50
const NO_CONVERSATION = '先选一条会话'
const EMPTY_RECENT = '还没用过话术，先从「全部」里挑一条'
const EMPTY_TAB = '这个分类还没有话术'

type Editing = { item?: QuickReply } | null

export function QuickReplyPanel({ target }: { target: QuickReplyTarget }) {
  const { s, staff, seat } = useWorkbench()
  const [q, setQ] = useState('')
  const [tabPref, setTabPref] = useLocalPref<string>('chat.qrTab', TAB_RECENT)
  const [editing, setEditing] = useState<Editing>(null)
  const staffId = staff?.id ?? null
  const reason = !target.active ? NO_CONVERSATION : target.blockReason
  const canCreate = s.enterprise.allowPersonalQuickReply && !!staff

  const tabs = useMemo(() => buildQuickReplyTabs(s, staffId), [s, staffId])
  // 存的分类可能已经被删掉，回落到「全部」
  const activeTab = tabs.some((t) => t.key === tabPref) ? tabPref : TAB_ALL
  const query = q.trim()
  const results = useMemo(() => (query ? matchQuickReplies(s, staffId, query, SEARCH_LIMIT) : null), [s, staffId, query])
  const tabItems = useMemo(() => quickRepliesInTab(s, staffId, activeTab), [s, staffId, activeTab])
  // 同一分类里图片在前（两列网格），文字与文件在后（单列），各自保持原顺序
  const images = useMemo(() => tabItems.filter((x) => x.kind === 'image' && x.media), [tabItems])
  const others = useMemo(() => tabItems.filter((x) => !(x.kind === 'image' && x.media)), [tabItems])

  const render = (text: string) => renderQuickReplyVars(text, { customer: target.customerName, seat: seat?.displayName ?? '', company: s.enterprise.name })

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

  /** 个人话术（自己的）才给编辑 / 删除 */
  const ownHandlers = (item: QuickReply) => {
    const own = item.scope === 'personal' && item.staffId === staffId
    return { onEdit: own ? () => setEditing({ item }) : undefined, onDelete: own ? () => void remove(item) : undefined }
  }
  const renderItem = (item: QuickReply, match?: QuickReplyMatch) => (
    <QuickReplyItem key={item.id} item={item} reason={reason} snippet={match?.snippet ?? null} hit={match?.hit} onSend={() => send(item)} onFill={() => fill(item)} {...ownHandlers(item)} />
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-zinc-200 px-2 py-2">
        <div className="relative min-w-0 flex-1">
          <Search size={13} className="absolute top-1/2 left-2 -translate-y-1/2 text-zinc-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜话术（标题 / 正文 / 文件名）" className="h-8 pr-6 pl-7 text-[12px]" />
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
        <HelpTip align="right" text="文字话术：悬停「发送」直接发、「填入」进输入框再改。图片 / 文件：点一下直接发出。输入框里打字满 2 个字会自动匹配（搜标题、正文、文件名），也可以输「/」浏览全部。" />
      </div>
      {reason && (
        <div className="shrink-0 border-b border-amber-100 bg-amber-50 px-3 py-1 text-[11px] text-amber-700" title="发送按钮已禁用，仍可浏览与填入">
          {reason}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="thin-scroll w-24 shrink-0 overflow-y-auto border-r border-zinc-200 py-1">
          {tabs.map((tab, i) => (
            <Fragment key={tab.key}>
              {needDivider(tabs[i - 1], tab) && <div className="my-1 border-t border-zinc-200" />}
              {tab.section === 'mine' && tabs[i - 1]?.section !== 'mine' && <div className="px-2 py-0.5 text-[10px] text-zinc-400">我的</div>}
              <TabButton tab={tab} active={tab.key === activeTab} onClick={() => setTabPref(tab.key)} />
            </Fragment>
          ))}
        </div>

        <div className="thin-scroll min-w-0 flex-1 overflow-y-auto px-2 pb-3">
          {results ? (
            <>
              <div className="px-1 py-2 text-[11px] text-zinc-400">{results.length ? `匹配 ${results.length} 条` : '没有匹配的话术'}</div>
              <div className="space-y-1.5">
                {results.map((m) => (
                  <div key={m.item.id}>
                    <div className="mb-0.5 truncate px-1 text-[11px] text-zinc-400">
                      {categoryName(s, m.item.categoryId)}
                      {m.item.scope === 'personal' ? ' · 我的' : ''}
                    </div>
                    {renderItem(m.item, m)}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-2">
              {images.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5">
                  {images.map((item) => (
                    <QuickReplyImageCell key={item.id} item={item} reason={reason} onSend={() => send(item)} {...ownHandlers(item)} />
                  ))}
                </div>
              )}
              {others.length > 0 && <div className={clsx('space-y-1.5', images.length > 0 && 'mt-2')}>{others.map((item) => renderItem(item))}</div>}
              {tabItems.length === 0 && <div className="px-2 py-6 text-center text-[11px] leading-relaxed text-zinc-400">{activeTab === TAB_RECENT ? EMPTY_RECENT : EMPTY_TAB}</div>}
            </div>
          )}
        </div>
      </div>

      {editing && <QuickReplyEditor key={editing.item?.id ?? 'new'} initial={editing.item} onClose={() => setEditing(null)} />}
    </div>
  )
}

/** 分区之间的细分隔线：企业分类与「最近 / 全部」之间、未分类之前 */
function needDivider(prev: QuickReplyTab | undefined, tab: QuickReplyTab): boolean {
  if (!prev) return false
  if (prev.section === 'top' && tab.section !== 'top') return true
  return tab.section === 'other' && prev.section !== 'other'
}

function TabButton({ tab, active, onClick }: { tab: QuickReplyTab; active: boolean; onClick: () => void }) {
  const Icon = tab.icon
  return (
    <button
      type="button"
      onClick={onClick}
      title={tab.title}
      className={clsx('relative flex w-full items-center gap-1 pr-1.5 pl-2 py-1.5 text-left text-[12px]', active ? 'bg-brand-50 font-medium text-brand-800' : 'text-zinc-600 hover:bg-zinc-50')}
    >
      {active && <span className="absolute top-1 bottom-1 left-0 w-0.5 rounded-r bg-brand-600" />}
      {Icon && <Icon size={12} className={clsx('shrink-0', active ? 'text-brand-600' : 'text-zinc-400')} />}
      <span className="min-w-0 flex-1 truncate">{tab.title}</span>
      <span className={clsx('shrink-0 text-[10px] tabular-nums', active ? 'text-brand-600' : 'text-zinc-400')}>{tab.count}</span>
    </button>
  )
}
