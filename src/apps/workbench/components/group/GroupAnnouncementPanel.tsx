/**
 * 群公告：最多 1 条有效公告；编辑弹窗可勾选"通知全体成员"（发系统消息 + 推送）；删除后新成员不再弹窗。
 * 走「修改群信息」权限。
 */
import { useState } from 'react'
import { Megaphone } from 'lucide-react'
import { fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { seatById } from '@/store/selectors'
import { Button, Checkbox, Field, Input, Textarea } from '@/ui/primitives'
import { Modal, toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { Section, type GroupPanelProps } from './shared'

const TITLE_MAX = 64
const CONTENT_MAX = 1000

export function GroupAnnouncementPanel({ group: g, actor, perm, compact }: GroupPanelProps) {
  const s = useStore()
  const canEdit = perm('can_change_info')
  const [editing, setEditing] = useState(false)
  const a = g.announcement
  const by = a ? seatById(s, a.bySeatId) : undefined

  const remove = async () => {
    const ok = await confirm({ title: '删除群公告？', body: '删除后新成员入群不再看到公告弹窗；已发出的系统消息不撤回。', okText: '删除', danger: true })
    if (!ok) return
    const result = s.setGroupAnnouncement(g.id, null, actor)
    if (result) return toast(result.reason, 'warn')
    toast('群公告已删除')
  }

  return (
    <Section
      title="群公告"
      compact={compact}
      hint={a ? undefined : '没有公告'}
      extra={
        canEdit && (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>{a ? '编辑' : '发布公告'}</Button>
            {a && <Button size="sm" variant="ghost" className="text-red-700" onClick={() => void remove()}>删除</Button>}
          </div>
        )
      }
    >
      {a ? (
        <div className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-900"><Megaphone size={12} /> {a.title}</div>
          <div className="mt-1 text-[12px] leading-relaxed whitespace-pre-wrap text-zinc-700">{a.content}</div>
          <div className="mt-1.5 text-[11px] text-zinc-400">{by?.displayName ?? '坐席'} · {fmtDateTime(a.at)}{a.notified ? ' · 已通知全体成员' : ''}</div>
        </div>
      ) : (
        <div className="text-[12px] text-zinc-400">新成员入群时会弹窗显示公告。{canEdit ? '点「发布公告」创建。' : ''}</div>
      )}
      {editing && <AnnouncementModal group={g} actor={actor} onClose={() => setEditing(false)} />}
    </Section>
  )
}

function AnnouncementModal({ group: g, actor, onClose }: Pick<GroupPanelProps, 'group' | 'actor'> & { onClose: () => void }) {
  const s = useStore()
  const [title, setTitle] = useState(g.announcement?.title ?? '')
  const [content, setContent] = useState(g.announcement?.content ?? '')
  const [notify, setNotify] = useState(true)
  const titleOk = title.trim().length > 0 && title.trim().length <= TITLE_MAX
  const contentOk = content.trim().length > 0 && content.trim().length <= CONTENT_MAX
  const save = () => {
    const result = s.setGroupAnnouncement(g.id, { title: title.trim(), content: content.trim(), notify }, actor)
    if (result) return toast(result.reason, 'warn')
    toast(notify ? '公告已发布，并向全体成员发出系统消息与推送' : '公告已发布')
    onClose()
  }
  return (
    <Modal open onClose={onClose} title={g.announcement ? '编辑群公告' : '发布群公告'} width={480} footer={<><Button onClick={onClose}>取消</Button><Button variant="primary" disabled={!titleOk || !contentOk} onClick={save}>发布</Button></>}>
      <div className="space-y-3">
        <Field label="标题" required hint={`${title.trim().length}/${TITLE_MAX}`}>
          <Input value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="例如：群规与本周安排" />
        </Field>
        <Field label="内容" required hint={`${content.trim().length}/${CONTENT_MAX}`}>
          <Textarea rows={6} value={content} maxLength={CONTENT_MAX} onChange={(e) => setContent(e.target.value)} placeholder="支持换行；新成员入群时弹窗显示" />
        </Field>
        {!titleOk && title.length > 0 && <div className="text-xs text-red-600">标题不能为空。</div>}
        <Checkbox checked={notify} onChange={setNotify} label="通知全体成员（群里发一条系统消息并推送，相当于 @ 所有人）" />
      </div>
    </Modal>
  )
}
