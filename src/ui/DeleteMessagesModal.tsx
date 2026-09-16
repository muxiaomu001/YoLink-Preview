import { useState } from 'react'
import type { ChatActor } from '@/domain/types'
import { actorCanView, canManageDelete, deleteAllBlock } from '@/domain/messageRules'
import { useStore } from '@/store/store'
import { Button } from './primitives'
import { Modal, toast } from './overlay'

export function DeleteMessagesModal({ ids, actor, onClose, onDeleted }: { ids: string[]; actor: ChatActor; onClose: () => void; onDeleted?: () => void }) {
  const s = useStore()
  const [everyone, setEveryone] = useState(false)
  const [error, setError] = useState('')

  const messages = ids.map((id) => s.messages.find((m) => m.id === id)).filter((m) => !!m)
  const conv = s.conversations.find((c) => c.id === messages[0]?.convId)
  // 多选时任意一条不满足，就整体挡住「为所有人删除」
  const block = messages.map((m) => deleteAllBlock(s, m, actor)).find(Boolean)
  const self = actor.kind === 'seat' ? s.seats.find((x) => x.id === actor.id)?.displayName : '我'
  const audience = conv?.kind === 'dm' ? '对方' : conv?.kind === 'channel' ? '所有订阅者' : '群内所有人'
  const managed = messages.some((m) => canManageDelete(s, m, actor))

  const submit = () => {
    const result = s.deleteChatMessages(ids, actor, everyone)
    if (!result.ok) return setError(result.reason ?? '删除失败，请重试')
    toast(everyone ? `已为所有人删除 ${ids.length} 条消息` : `已删除 ${ids.length} 条消息`)
    onDeleted?.()
    onClose()
  }

  return (
    <Modal
      open
      title={`删除${ids.length > 1 ? ` ${ids.length} 条` : '这条'}消息？`}
      onClose={onClose}
      width={440}
      footer={<><Button onClick={onClose}>取消</Button><Button variant="danger" onClick={submit} disabled={!conv || !actorCanView(s, conv.id, actor) || (everyone && !!block)}>删除</Button></>}
    >
      <p className="mb-3 line-clamp-3 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">
        {messages[0]?.text || messages[0]?.media?.name || '消息已不可用'}{ids.length > 1 ? ' 等' : ''}
      </p>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg p-3 hover:bg-zinc-50">
        <input type="radio" name="delete-scope" checked={!everyone} onChange={() => setEveryone(false)} className="mt-1" />
        <span>
          <b className="text-sm font-medium">仅为「{self}」删除</b>
          <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
            {actor.kind === 'seat' ? '你的其他设备和接手的同事也不再显示，对方不受影响。' : `只在你的聊天里移除，${audience}仍然看得到。`}
          </span>
        </span>
      </label>

      <label className={`flex items-start gap-3 rounded-lg p-3 ${block ? 'text-zinc-400' : 'cursor-pointer hover:bg-zinc-50'}`}>
        <input type="radio" name="delete-scope" checked={everyone} disabled={!!block} onChange={() => setEveryone(true)} className="mt-1" />
        <span>
          <b className="text-sm font-medium">同时为{audience}删除</b>
          <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
            {block ?? (managed ? `${audience}都将看不到这条消息。` : `${audience}的聊天里也会一并移除。`)}
          </span>
        </span>
      </label>

      {actor.kind === 'seat' && <p className="mt-3 text-xs text-zinc-400">删除不影响企业留存的会话记录。</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </Modal>
  )
}
