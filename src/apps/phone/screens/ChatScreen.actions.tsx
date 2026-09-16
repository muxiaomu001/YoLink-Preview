/**
 * 手机端的消息操作：长按消息唤出菜单（桌面浏览器里右键或按住左键同样触发）。
 * 按主流聊天软件的做法，消息旁不常驻按钮，单击留给图片预览、回复条跳转和链接。
 * 菜单条目与顺序和客服工作台保持一致，见 docs/界面文案与名词规范.md。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { clsx } from 'clsx'
import { Copy, CornerUpLeft, Forward, Pencil, Trash2 } from 'lucide-react'
import type { ChatActor, Message } from '@/domain/types'
import { messageVisibleFor } from '@/domain/messageRules'
import { conversationsForCustomer } from '@/store/selectors'
import { customerCan } from '@/store/policy'
import { useStore } from '@/store/store'
import { copyText } from '@/ui/clipboard'
import { Avatar } from '@/ui/display'
import { Input } from '@/ui/primitives'
import { toast } from '@/ui/overlay'
import { Sheet } from '../parts'
import { customerPreview } from './ChatScreen.shared'

const LONG_PRESS_MS = 420

/**
 * 长按唤出：手指按住、鼠标按住、或右键都算。
 * 手指移动超过 8px 视为滚动，取消这次长按。
 */
export function useLongPress(onTrigger: () => void) {
  const timer = useRef(0)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)

  const cancel = () => {
    window.clearTimeout(timer.current)
    origin.current = null
  }
  useEffect(() => cancel, [])

  const start = (x: number, y: number) => {
    fired.current = false
    origin.current = { x, y }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      fired.current = true
      onTrigger()
    }, LONG_PRESS_MS)
  }

  return {
    handlers: {
      // 长按刚唤出菜单，松手带出的这一次 click 要吞掉，别顺带打开图片、下载附件或跳链接。
      // 捕获阶段拦截，事件到不了里面的图片与链接；普通单击不受影响。
      onClickCapture: (e: React.MouseEvent) => {
        if (!fired.current) return
        fired.current = false
        e.preventDefault()
        e.stopPropagation()
      },
      onTouchStart: (e: React.TouchEvent) => start(e.touches[0].clientX, e.touches[0].clientY),
      onTouchMove: (e: React.TouchEvent) => {
        const o = origin.current
        if (!o) return
        const t = e.touches[0]
        if (Math.abs(t.clientX - o.x) > 8 || Math.abs(t.clientY - o.y) > 8) cancel()
      },
      onTouchEnd: cancel,
      onTouchCancel: cancel,
      onMouseDown: (e: React.MouseEvent) => e.button === 0 && start(e.clientX, e.clientY),
      onMouseUp: cancel,
      onMouseLeave: cancel,
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault()
        cancel()
        fired.current = true
        onTrigger()
      },
    },
  }
}

export interface BubbleAction {
  label: string
  icon: typeof Copy
  danger?: boolean
  onSelect: () => void
}

/** 贴着消息气泡的浮层菜单；空间不够时自动翻到气泡上方 */
export function BubbleMenu({ actions, mine, above, onClose }: { actions: BubbleAction[]; mine: boolean; above: boolean; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-30" onMouseDown={onClose} onTouchStart={onClose} />
      <div
        role="menu"
        className={clsx(
          'absolute z-40 min-w-[140px] overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg',
          mine ? 'right-0' : 'left-0',
          above ? 'bottom-full mb-1' : 'top-full mt-1',
        )}
      >
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            role="menuitem"
            onClick={() => {
              onClose()
              a.onSelect()
            }}
            className={clsx(
              'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] active:bg-zinc-100',
              a.danger ? 'text-red-600' : 'text-zinc-700',
            )}
          >
            <a.icon size={15} className={a.danger ? 'text-red-500' : 'text-zinc-400'} />
            {a.label}
          </button>
        ))}
      </div>
    </>
  )
}

/** 组装一条消息可用的操作；不适用的项直接不出现，不置灰 */
export function useBubbleActions({ m, mine, customerId, convId, canReply, onReply, onEdit, onDelete, onForward }: {
  m: Message
  mine: boolean
  customerId: string
  convId: string
  canReply: boolean
  onReply: () => void
  onEdit?: () => void
  onDelete: () => void
  onForward: () => void
}): BubbleAction[] {
  const s = useStore()
  const group = s.conversations.find((c) => c.id === convId)?.chatGroupId
  const canForward = customerCan(s, customerId, group ? 'group.forward' : 'dm.forward', group)
  return useMemo(() => {
    const list: BubbleAction[] = []
    if (canReply) list.push({ label: '回复', icon: CornerUpLeft, onSelect: onReply })
    if (m.text) list.push({
      label: '复制',
      icon: Copy,
      onSelect: () => void copyText(m.text).then((ok) => toast(ok ? '已复制' : '复制失败：浏览器不允许访问剪贴板', ok ? 'ok' : 'warn')),
    })
    if (canForward && m.kind !== 'system') list.push({ label: '转发', icon: Forward, onSelect: onForward })
    if (mine && onEdit) list.push({ label: '编辑', icon: Pencil, onSelect: onEdit })
    list.push({ label: '删除', icon: Trash2, danger: true, onSelect: onDelete })
    return list
  }, [m.text, m.kind, mine, canReply, canForward, onReply, onEdit, onDelete, onForward])
}

/** 转发：从这位客户自己的会话里挑一个目标 */
export function ForwardSheet({ message, customerId, onClose }: { message: Message; customerId: string; onClose: () => void }) {
  const s = useStore()
  const [q, setQ] = useState('')
  const actor: ChatActor = { kind: 'customer', id: customerId }
  const rows = conversationsForCustomer(s, customerId)
    .filter((r) => r.conv.id !== message.convId && r.conv.kind !== 'channel')
    .filter((r) => !q.trim() || r.title.includes(q.trim()))

  const send = (targetId: string) => {
    const current = s.messages.find((x) => x.id === message.id)
    if (!current || !messageVisibleFor(s, current, actor) || (current.delivery && current.delivery !== 'sent')) {
      return toast('这条消息已经不能转发了', 'warn')
    }
    const from = s.conversations.find((c) => c.id === current.convId)
    const name = from?.kind === 'dm' ? s.seats.find((x) => x.id === from.seatId)?.displayName : s.chatGroups.find((g) => g.id === from?.chatGroupId)?.name
    const r = s.queueChatMessage({ convId: targetId, actor, text: current.text, kind: current.kind === 'system' ? 'text' : current.kind, media: current.media, forwardedFrom: { convId: current.convId, messageId: current.id, name } })
    if (!r.ok) return toast(r.reason ?? '转发失败', 'warn')
    toast('已转发')
    onClose()
  }

  return (
    <Sheet title="转发到" onClose={onClose}>
      <p className="mb-3 line-clamp-2 rounded-lg bg-zinc-50 px-3 py-2 text-[12px] text-zinc-600">{customerPreview(message)}</p>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索聊天" className="mb-2 h-8 text-[13px]" />
      <ul className="thin-scroll max-h-56 divide-y divide-zinc-100 overflow-y-auto">
        {!rows.length && <li className="py-8 text-center text-[12px] text-zinc-400">{q ? '没有匹配的聊天' : '还没有其他可以转发到的聊天'}</li>}
        {rows.map((r) => (
          <li key={r.conv.id}>
            <button type="button" onClick={() => send(r.conv.id)} className="flex w-full items-center gap-2.5 py-2 text-left active:bg-zinc-50">
              <Avatar text={r.title} size={30} official={r.official} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-800">{r.title}</span>
              <span className="text-[11px] text-zinc-400">{r.conv.kind === 'dm' ? '私聊' : '群'}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

/** 转发来源条 */
export function ForwardedFrom({ name, children }: { name?: string; children?: ReactNode }) {
  return <div className="mb-1 text-[11px] text-zinc-400">转发自 {name ?? '其他聊天'}{children}</div>
}
