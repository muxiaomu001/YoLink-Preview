/**
 * 置顶消息列表：每条可跳转到聊天区（不在视图时提示）、可取消置顶（can_pin_messages）。
 */
import { Pin } from 'lucide-react'
import { fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { senderName, visibleText } from '@/store/policy'
import { Button } from '@/ui/primitives'
import { toast } from '@/ui/overlay'
import { jumpToMessage, Section, type GroupPanelProps } from './shared'

export function GroupPinned({ group: g, actor, perm, compact }: GroupPanelProps) {
  const s = useStore()
  const canPin = perm('can_pin_messages')
  const list = g.pinnedMessageIds.map((id) => s.messages.find((m) => m.id === id)).filter((m) => !!m)

  const jump = (id: string) => {
    if (!jumpToMessage(id)) toast('该消息不在当前聊天视图里', 'info')
  }
  const unpin = (id: string) => {
    s.unpinMessage(g.id, id, actor)
    toast('已取消置顶')
  }

  return (
    <Section title={`置顶消息（${list.length}）`} compact={compact} hint={canPin ? '在聊天区悬停消息可置顶' : '取消置顶需要「置顶消息」权限'}>
      {!list.length && <div className="text-[12px] text-zinc-400">还没有置顶消息。置顶数量不限，置顶时可选是否通知成员。</div>}
      <ul className="space-y-1.5">
        {list.map((m) => (
          <li key={m.id} className="flex items-start gap-2 rounded-md border border-zinc-200 px-2.5 py-1.5">
            <Pin size={11} className="mt-0.5 shrink-0 text-amber-600" />
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => jump(m.id)} title="跳转到该消息">
              <div className="truncate text-[12px] text-zinc-800">{visibleText(m, 'staff')}</div>
              <div className="text-[11px] text-zinc-400">{senderName(s, m)} · {fmtDateTime(m.at)}</div>
            </button>
            {canPin && (
              <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[11px]" onClick={() => unpin(m.id)}>
                取消
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Section>
  )
}
