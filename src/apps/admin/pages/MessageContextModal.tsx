/**
 * 消息上下文弹窗：目标消息前后各 20 条，按时间排列，目标高亮。
 * 消息审计与举报处理共用。坐席消息显示坐席名与当时的实操员工。
 */
import { useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import { useStore } from '@/store/store'
import { customerById, messagesOf, seatById, staffById } from '@/store/selectors'
import { Pill } from '@/ui/display'
import { Modal } from '@/ui/overlay'
import { PlayableMedia } from '@/ui/PlayableMedia'
import { FileCard, ImageThumb } from '@/ui/media'
import { convName, fmtDateTimeSec, messageText } from './audit-helpers'

const CONTEXT_SIZE = 20

export function MessageContextModal({ messageId, onClose }: { messageId: string; onClose: () => void }) {
  const s = useStore()
  const target = s.messages.find((m) => m.id === messageId)
  const list = target ? messagesOf(s, target.convId) : []
  const idx = list.findIndex((m) => m.id === messageId)
  const slice = idx >= 0 ? list.slice(Math.max(0, idx - CONTEXT_SIZE), idx + CONTEXT_SIZE + 1) : []
  const targetRef = useRef<HTMLDivElement>(null)

  // 打开后把目标消息滚到视野中间
  useEffect(() => {
    targetRef.current?.scrollIntoView({ block: 'center' })
  }, [messageId])

  if (!target) return null

  return (
    <Modal open onClose={onClose} title="消息上下文" width={680}>
      <div className="mb-3 text-xs text-zinc-500">
        会话：<span className="text-zinc-800">{convName(s, target.convId)}</span> · 目标消息前后各 {CONTEXT_SIZE} 条，共 {slice.length} 条
      </div>
      <div className="space-y-1.5">
        {slice.map((m) => {
          const isTarget = m.id === messageId
          const seat = m.senderKind === 'seat' ? seatById(s, m.seatId) : undefined
          const operator = m.senderKind === 'seat' ? staffById(s, m.operatorId) : undefined
          const customer = m.senderKind === 'customer' ? customerById(s, m.senderId) : undefined
          return (
            <div
              key={m.id}
              ref={isTarget ? targetRef : undefined}
              className={clsx('rounded-md px-3 py-2 text-[13px]', isTarget ? 'bg-amber-50 ring-1 ring-amber-300' : 'bg-zinc-50')}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500">
                <span className="tabular-nums">{fmtDateTimeSec(m.at)}</span>
                {m.senderKind === 'seat' && (
                  <>
                    <span className="font-medium text-zinc-800">{seat?.displayName ?? '未知坐席'}</span>
                    <Pill tone="blue">坐席</Pill>
                    <span>实操：{operator?.name ?? '未记录'}</span>
                  </>
                )}
                {m.senderKind === 'customer' && (
                  <span className="font-medium text-zinc-800">
                    {customer?.nickname ?? '未知客户'}
                    <span className="ml-1 font-normal text-zinc-400">{customer?.accountId}</span>
                  </span>
                )}
                {m.senderKind === 'bot' && (
                  <span className="font-medium text-zinc-800">
                    {s.bots.find((b) => b.id === m.senderId)?.nickname ?? '未知活跃角色'}
                    <Pill tone="purple" className="ml-1">活跃角色</Pill>
                  </span>
                )}
                {m.senderKind === 'system' && <Pill>系统</Pill>}
                {isTarget && <Pill tone="amber">目标消息</Pill>}
              </div>
              {m.deletedAt&&<Pill tone="red">{m.deletedByManager?'管理删除':'作者删除'}，审计保留</Pill>}
              {m.editedAt && <Pill tone="blue">已编辑</Pill>}
              {!!m.editHistory?.length && <details className="my-2 rounded border border-zinc-200 bg-white p-2 text-xs">
                <summary className="cursor-pointer text-brand-700">查看 {m.editHistory.length} 次修改记录</summary>
                {m.editHistory.map((version, i) => <div key={`${version.at}-${i}`} className="mt-2 border-t border-zinc-100 pt-2">
                  <div className="text-zinc-500">{fmtDateTimeSec(version.at)} · 修改人：{staffById(s, version.operatorId)?.name ?? customerById(s, version.operatorId)?.nickname ?? version.operatorId}</div>
                  <div className="mt-1 whitespace-pre-wrap text-zinc-800">修改前：{version.text}</div>
                </div>)}
              </details>}
              {m.media ? (
                <div className="mt-1 space-y-1">
                  {m.kind==='video'||m.kind==='voice'?<PlayableMedia kind={m.kind} media={m.media}/>:m.kind === 'image' ? <ImageThumb media={m.media} maxWidth={200} /> : <FileCard media={m.media} />}
                  {m.text && <div className="whitespace-pre-wrap break-words text-zinc-800">{m.text}</div>}
                </div>
              ) : (
                <div className={clsx('mt-1 whitespace-pre-wrap break-words', m.deletedAt ? 'italic text-zinc-400' : 'text-zinc-800')}>{messageText(m)}</div>
              )}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
