/**
 * 话术库（管理后台）：企业共享话术的分类管理、条目增删改（文字 / 图片 / 文件）、启停与使用统计。
 * 只列 scope === 'enterprise' 的；个人话术由员工在工作台自己维护，这里只在页脚给个数量。
 */
import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import type { QuickReply, QuickReplyCategory, QuickReplyKind } from '@/domain/types'
import { fmtDateTime, daysSince } from '@/domain/time'
import { useStore } from '@/store/store'
import { Button, Input, Select, Switch } from '@/ui/primitives'
import { Card, PageHeader, Stat, Table } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { CAT_ALL, CAT_NONE, CategoryEditor, CategorySidebar, KIND_LABEL, KindCell, QuickReplyEditor, confirmDeleteCategory } from './QuickRepliesPage.parts'

type KindFilter = 'all' | QuickReplyKind

/**
 * 后台的全文过滤：规则和 selectors 里的 matchQuickReplies 一致（标题 / 正文 / 附件文件名，小写 includes），
 * 但后台要看到停用的和所有人的话术，而 matchQuickReplies 走 quickRepliesForStaff（只给启用的企业话术 + 本人个人话术），
 * 所以这里不复用它，只复用它的匹配规则。
 */
function matchesKeyword(q: QuickReply, kw: string): boolean {
  return q.title.toLowerCase().includes(kw) || q.text.toLowerCase().includes(kw) || (q.media?.name.toLowerCase().includes(kw) ?? false)
}
const WEEK_DAYS = 7
const TEXT_PREVIEW_LEN = 70

export function QuickRepliesPage() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [activeCat, setActiveCat] = useState<string>(CAT_ALL)
  const [keyword, setKeyword] = useState('')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [editing, setEditing] = useState<QuickReply | 'new' | null>(null)
  const [catEditing, setCatEditing] = useState<QuickReplyCategory | 'new' | null>(null)

  const cats = useMemo(() => s.quickReplyCategories.filter((c) => c.scope === 'enterprise').sort((a, b) => a.sortOrder - b.sortOrder), [s.quickReplyCategories])
  const items = useMemo(() => s.quickReplies.filter((q) => q.scope === 'enterprise'), [s.quickReplies])
  const personalCount = s.quickReplies.length - items.length
  const countOf = (catId: string) => items.filter((q) => q.categoryId === catId).length
  const uncategorized = items.filter((q) => !q.categoryId).length

  const rows = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return items.filter((q) => {
      if (activeCat === CAT_NONE ? q.categoryId !== null : activeCat !== CAT_ALL && q.categoryId !== activeCat) return false
      if (kindFilter !== 'all' && q.kind !== kindFilter) return false
      if (!kw) return true
      return matchesKeyword(q, kw)
    })
  }, [items, activeCat, kindFilter, keyword])

  const imageCount = items.filter((q) => q.kind === 'image').length
  const fileCount = items.filter((q) => q.kind === 'file').length
  // 本周使用：用「最近使用在 7 天内」的条目 useCount 之和近似
  const weekUses = items.filter((q) => q.lastUsedAt && daysSince(q.lastUsedAt) < WEEK_DAYS).reduce((sum, q) => sum + q.useCount, 0)
  const disabledCount = items.filter((q) => !q.enabled).length

  const remove = async (q: QuickReply) => {
    const ok = await confirm({ title: `删除话术「${q.title}」？`, body: '删除后员工的话术面板与自动匹配里都不再出现；已发出的消息不受影响。', okText: '删除', danger: true })
    if (!ok) return
    s.deleteQuickReply('enterprise', q.id, admin)
    toast(`已删除「${q.title}」`)
  }
  const removeCat = async (c: QuickReplyCategory) => {
    const ok = await confirmDeleteCategory(c, countOf(c.id))
    if (!ok) return
    s.deleteQuickReplyCategory('enterprise', c.id, admin)
    if (activeCat === c.id) setActiveCat(CAT_ALL)
    toast(`已删除分类「${c.name}」，其下话术转为未分类`)
  }
  const catName = (id: string | null) => (id ? (cats.find((c) => c.id === id)?.name ?? '未分类') : '未分类')

  return (
    <div>
      <PageHeader
        title="话术库"
        desc="企业共享话术，员工在工作台右栏「话术」里直接发送，打字时也会按标题 / 正文 / 文件名全文自动匹配；个人话术由员工自己在工作台维护。"
        extra={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus size={14} /> 新建话术
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-4 gap-3">
        <Stat label="话术总数" value={items.length} sub={`企业分类 ${cats.length} 个`} />
        <Stat label="图片 / 文件" value={`${imageCount} / ${fileCount}`} sub="点一下直接发出的附件话术" />
        <Stat label="本周使用次数" value={weekUses} sub="最近 7 天用过的话术累计发送 / 填入" />
        <Stat label="停用" value={disabledCount} tone={disabledCount ? 'warn' : 'default'} sub="停用后工作台不可见，后台保留" />
      </div>
      <div className="grid grid-cols-[220px_1fr] gap-4">
        <Card title="分类" className="self-start">
          <CategorySidebar cats={cats} countOf={countOf} total={items.length} uncategorized={uncategorized} active={activeCat} onPick={setActiveCat} onCreate={() => setCatEditing('new')} onRename={setCatEditing} onDelete={(c) => void removeCat(c)} />
        </Card>
        <Card
          title={`话术（${rows.length} 条）`}
          padded={false}
          extra={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-zinc-400" />
                <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜标题 / 正文 / 文件名" className="w-56 pl-7" />
              </div>
              <Select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as KindFilter)} className="w-28">
                <option value="all">全部类型</option>
                <option value="text">文字</option>
                <option value="image">图片</option>
                <option value="file">文件</option>
              </Select>
            </div>
          }
        >
          <Table
            rows={rows}
            rowKey={(q) => q.id}
            empty={items.length === 0 ? '还没有企业话术，点右上角「新建话术」' : '没有符合条件的话术'}
            columns={[
              { key: 'kind', title: '类型', width: '64px', render: (q) => <KindCell q={q} /> },
              {
                key: 'title',
                title: '标题',
                render: (q) => (
                  <div className="max-w-[460px]">
                    <div className={q.enabled ? 'font-medium text-zinc-900' : 'font-medium text-zinc-400'}>{q.title}</div>
                    <div className="truncate text-[11px] text-zinc-400" title={q.text || (q.media?.name ?? '')}>
                      {q.kind === 'text' ? q.text.slice(0, TEXT_PREVIEW_LEN) : `${KIND_LABEL[q.kind]}：${q.media?.name ?? '-'}${q.text ? ` · ${q.text.slice(0, TEXT_PREVIEW_LEN)}` : ''}`}
                    </div>
                  </div>
                ),
              },
              { key: 'cat', title: '分类', render: (q) => <span className={q.categoryId ? 'text-zinc-700' : 'text-zinc-400'}>{catName(q.categoryId)}</span> },
              { key: 'use', title: '使用次数', align: 'right', render: (q) => <span className="tabular-nums">{q.useCount}</span> },
              { key: 'last', title: '最近使用', render: (q) => <span className="tabular-nums text-zinc-500">{q.lastUsedAt ? fmtDateTime(q.lastUsedAt) : '-'}</span> },
              { key: 'enabled', title: '状态', render: (q) => <Switch checked={q.enabled} onChange={(v) => s.setQuickReplyEnabled(q.id, v, admin)} /> },
              {
                key: 'ops',
                title: '操作',
                align: 'right',
                render: (q) => (
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(q)}>
                      编辑
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => void remove(q)}>
                      删除
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </div>
      <div className="mt-3 text-[11px] text-zinc-400">
        个人话术不在这里显示：员工在工作台自己维护，目前共 {personalCount} 条；是否允许员工建个人话术在「企业设置 › 群发与话术」里设置。
      </div>

      {editing === 'new' && <QuickReplyEditor cats={cats} defaultCategoryId={activeCat !== CAT_ALL && activeCat !== CAT_NONE ? activeCat : null} onClose={() => setEditing(null)} />}
      {editing && editing !== 'new' && <QuickReplyEditor item={editing} cats={cats} onClose={() => setEditing(null)} />}
      {catEditing === 'new' && <CategoryEditor onClose={() => setCatEditing(null)} />}
      {catEditing && catEditing !== 'new' && <CategoryEditor cat={catEditing} onClose={() => setCatEditing(null)} />}
    </div>
  )
}
