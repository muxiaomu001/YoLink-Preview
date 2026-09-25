/**
 * 群发页的记录表、详情弹窗、「从话术库选」弹窗与文案常量；
 * TARGET_LABEL / StatusPill / ContentKindPill / MediaPreview / DELIVERY_RULES 也供管理后台群发管理页复用。
 */
import { mediaUrl } from '@/domain/mediaUrl'
import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { Broadcast, BroadcastStatus, MessageMedia, QuickReply } from '@/domain/types'
import { SKIP_REASON_LABEL, type SkipReason } from '@/domain/broadcastCoverage'
import { fmtDateTime } from '@/domain/time'
import { matchQuickReplies, quickReplyCategoriesForStaff, quickRepliesForStaff, seatById, staffById } from '@/store/selectors'
import type { QuickReplyMatch, QuickReplySnippet } from '@/store/selectors'
import { Highlight } from '@/apps/workbench/components/quick-replies/shared'
import { Button, Input } from '@/ui/primitives'
import { Empty, KV, Pill, Table } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { DemoNote } from '@/ui/DemoNote'
import { FileCard, ImageThumb } from '@/ui/media'
import { useWorkbench } from '../useWorkbench'
import { CONTENT_KIND_LABEL, PREVIEW_LEN, TARGET_LABEL } from './BroadcastPage.shared'

const STATUS_META: Record<BroadcastStatus, { label: string; tone: 'zinc' | 'green' | 'amber' | 'red' | 'blue' }> = {
  scheduled: { label: '定时', tone: 'blue' },
  sending: { label: '发送中', tone: 'amber' },
  done: { label: '已完成', tone: 'green' },
  failed: { label: '失败', tone: 'red' },
  cancelled: { label: '已取消', tone: 'zinc' },
}

function skipSummary(reasons: Record<string, number> | undefined): string {
  return Object.entries(reasons ?? {}).filter(([, count]) => count > 0).map(([reason, count]) => `${SKIP_REASON_LABEL[reason as SkipReason] ?? reason} ${count}`).join('、')
}

export function StatusPill({ status }: { status: BroadcastStatus }) {
  const m = STATUS_META[status]
  return <Pill tone={m.tone}>{m.label}</Pill>
}

/** 内容类型标记：文本不显示，图片 / 文件各一枚 Pill */
export function ContentKindPill({ kind, className }: { kind: Broadcast['contentKind']; className?: string }) {
  if (kind === 'text') return null
  return (
    <Pill tone={kind === 'image' ? 'blue' : 'purple'} className={className}>
      {CONTENT_KIND_LABEL[kind]}
    </Pill>
  )
}

/** 附件预览：图片缩略图或文件卡；没附件时给占位 */
export function MediaPreview({ kind, media, maxWidth = 200 }: { kind: Broadcast['contentKind']; media?: MessageMedia; maxWidth?: number }) {
  if (kind === 'text') return null
  if (!media) return <span className="text-[12px] text-zinc-400">（附件缺失）</span>
  return kind === 'image' ? <ImageThumb media={media} maxWidth={maxWidth} /> : <FileCard media={media} />
}

export function BroadcastRecords({ rows, onDetail }: { rows: Broadcast[]; onDetail: (b: Broadcast) => void }) {
  const { s } = useWorkbench()
  return (
    <Table
      rows={rows}
      rowKey={(b) => b.id}
      dense
      empty="还没有群发记录"
      columns={[
        {
          key: 'at',
          title: '发送时间',
          render: (b) => (
            <div>
              <div className="tabular-nums text-zinc-800">{fmtDateTime(b.status === 'scheduled' && b.scheduledAt ? b.scheduledAt : b.sentAt)}</div>
              <div className="text-[11px] text-zinc-400">
                {seatById(s, b.seatId)?.displayName} · {staffById(s, b.operatorId)?.name}
                {b.status === 'scheduled' && <DemoNote compact>演示里不实际投递</DemoNote>}
              </div>
            </div>
          ),
        },
        {
          key: 'target',
          title: '目标',
          render: (b) => (
            <div>
              <div className="text-zinc-800">{TARGET_LABEL[b.targetKind]}</div>
              <div className="max-w-40 truncate text-[11px] text-zinc-400" title={b.targetDesc}>
                {b.targetDesc}
              </div>
            </div>
          ),
        },
        {
          key: 'preview',
          title: '内容预览',
          render: (b) => (
            <span className="block max-w-56 truncate text-zinc-600" title={b.text || b.media?.name}>
              <ContentKindPill kind={b.contentKind} className="mr-1" />
              {b.text ? `${b.text.slice(0, PREVIEW_LEN)}${b.text.length > PREVIEW_LEN ? '…' : ''}` : (b.media?.name ?? '')}
            </span>
          ),
        },
        { key: 'sent', title: '送达', align: 'right', render: (b) => <span className="tabular-nums">{b.sentCount}</span> },
        { key: 'read', title: '已读', align: 'right', render: (b) => <span className="tabular-nums text-zinc-500">{b.readCount}</span> },
        { key: 'skipped', title: '跳过', align: 'right', render: (b) => <span className={`tabular-nums ${b.skippedCount ? 'text-amber-700' : 'text-zinc-400'}`}>{b.skippedCount}</span> },
        { key: 'status', title: '状态', render: (b) => <StatusPill status={b.status} /> },
        {
          key: 'ops',
          title: '操作',
          align: 'right',
          render: (b) => (
            <span className="inline-flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => onDetail(b)}>
                查看详情
              </Button>
              {b.status === 'scheduled' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const staff = s.staff.find((item) => item.id === s.session.workbenchStaffId)
                    if (!staff) return
                    const result = s.cancelBroadcast(b.id, staff.id)
                    toast(result.ok ? '定时群发已取消' : result.error, result.ok ? 'ok' : 'warn')
                  }}
                >
                  取消
                </Button>
              )}
            </span>
          ),
        },
      ]}
    />
  )
}

export function BroadcastDetailModal({ b, onClose }: { b: Broadcast; onClose: () => void }) {
  const { s } = useWorkbench()
  return (
    <Modal open onClose={onClose} title={`群发：${b.name}`} width={560} footer={<Button onClick={onClose}>关闭</Button>}>
      <div className="space-y-3">
        <KV
          items={[
            { k: '发送身份', v: `${seatById(s, b.seatId)?.displayName ?? '-'}（实操：${staffById(s, b.operatorId)?.name ?? '-'}）` },
            { k: '目标', v: `${TARGET_LABEL[b.targetKind]} · ${b.targetDesc}` },
            { k: '内容类型', v: CONTENT_KIND_LABEL[b.contentKind] },
            ...(b.contentKind !== 'text' ? [{ k: '附件', v: <MediaPreview kind={b.contentKind} media={b.media} /> }] : []),
            { k: '状态', v: <StatusPill status={b.status} /> },
            { k: b.status === 'scheduled' ? '计划时间' : '发送时间', v: fmtDateTime(b.status === 'scheduled' && b.scheduledAt ? b.scheduledAt : b.sentAt) },
            { k: '送达 / 已读 / 跳过', v: `${b.sentCount} / ${b.readCount} / ${b.skippedCount}` },
            ...(b.skippedCount && skipSummary(b.skipReasons) ? [{ k: '跳过原因', v: <span className="text-zinc-600">{skipSummary(b.skipReasons)}</span> }] : []),
          ]}
        />
        {(b.text || b.contentKind === 'text') && (
          <div>
            <div className="mb-1 text-[12px] font-medium text-zinc-600">{b.contentKind === 'text' ? '全文' : '随附说明'}</div>
            <div className="rounded-md bg-zinc-50 px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap text-zinc-800">{b.text}</div>
          </div>
        )}
      </div>
    </Modal>
  )
}

const KIND_LABEL: Record<QuickReply['kind'], string> = { text: '文字', image: '图片', file: '文件' }

/** 选话术弹窗一次最多列多少条 */
const PICKER_LIMIT = 200

/** 标题命中才高亮标题；片段两头带省略号说明标题被截过，这时退回完整标题，免得标题看着缺一块 */
function titleSnippetOf(m: QuickReplyMatch): QuickReplySnippet | null {
  if (m.hit !== 'title' || !m.snippet) return null
  return m.snippet.before.startsWith('…') || m.snippet.after.endsWith('…') ? null : m.snippet
}

/** 从话术库选一条作为群发内容：启用的企业话术 + 本人个人话术，全文搜索（标题 / 正文 / 附件文件名） */
export function QuickReplyPickerModal({ onPick, onClose, broadcast = false }: { onPick: (q: QuickReply) => void; onClose: () => void; broadcast?: boolean }) {
  const { s, staff } = useWorkbench()
  const [keyword, setKeyword] = useState('')
  const all = useMemo(() => quickRepliesForStaff(s, staff?.id ?? null), [s, staff])
  const cats = useMemo(() => quickReplyCategoriesForStaff(s, staff?.id ?? null), [s, staff])
  const catName = (q: QuickReply) => (q.categoryId ? (cats.find((c) => c.id === q.categoryId)?.name ?? '未分类') : '未分类')
  const rows = useMemo<QuickReplyMatch[]>(() => {
    const kw = keyword.trim()
    // 没输关键词就按使用次数倒序列全部；输了就交给全文匹配，顺便拿到高亮片段
    if (!kw) return [...all].sort((a, b) => b.useCount - a.useCount).map((item) => ({ item, hit: 'title' as const, score: 0, snippet: null }))
    return matchQuickReplies(s, staff?.id ?? null, kw, PICKER_LIMIT)
  }, [all, s, staff, keyword])

  return (
    <Modal open onClose={onClose} title="从话术库选" width={640} footer={<Button onClick={onClose}>取消</Button>}>
      <div className="relative mb-3">
        <Search size={13} className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-zinc-400" />
        <Input autoFocus value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜标题 / 正文 / 文件名" className="pl-7" />
      </div>
      <div className="thin-scroll max-h-[420px] space-y-1 overflow-y-auto">
        {rows.length === 0 && <Empty text={all.length ? '没有匹配的话术' : '话术库是空的'} />}
        {rows.map((m) => {
          const variableBlocked = broadcast && /\{\{[^}]+\}\}/.test(m.item.text)
          return (
          <button key={m.item.id} type="button" disabled={variableBlocked} title={variableBlocked ? '群发不支持变量，请改成完整正文' : undefined} onClick={() => onPick(m.item)} className={`flex w-full items-start gap-3 rounded-md border border-transparent px-2.5 py-2 text-left hover:border-zinc-200 hover:bg-zinc-50 ${variableBlocked ? 'cursor-not-allowed opacity-45 hover:border-transparent hover:bg-transparent' : ''}`}>
            <span className="w-12 shrink-0">
              {m.item.kind === 'image' && m.item.media ? (
                <img src={mediaUrl(m.item.media.url)} alt={m.item.media.name} className="h-12 w-12 rounded-md border border-zinc-200 bg-white object-cover" />
              ) : (
                <Pill tone={m.item.kind === 'file' ? 'purple' : 'zinc'}>{KIND_LABEL[m.item.kind]}</Pill>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-900">
                <Highlight snippet={titleSnippetOf(m)} fallback={m.item.title} />
                <span className="text-[11px] font-normal text-zinc-400">
                  {m.item.scope === 'personal' ? '个人' : '企业'} · {catName(m.item)} · 用过 {m.item.useCount} 次
                </span>
              </span>
              <Highlight
                snippet={m.hit === 'title' ? null : m.snippet}
                fallback={m.item.kind === 'text' ? m.item.text : `${m.item.media?.name ?? ''}${m.item.text ? ` · ${m.item.text}` : ''}`}
                className="mt-0.5 block truncate text-[12px] text-zinc-500"
              />
              {variableBlocked && <span className="mt-1 block text-[11px] text-amber-700">群发不支持变量，请改成完整正文</span>}
            </span>
          </button>
          )
        })}
      </div>
    </Modal>
  )
}
