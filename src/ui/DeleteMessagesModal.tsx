import { useState } from 'react'
import type { ChatActor } from '@/domain/types'
import { actorCanView, canManageDelete, deleteAllBlock } from '@/domain/messageRules'
import { useStore } from '@/store/store'
import { Button } from './primitives'
import { Modal, toast } from './overlay'

export function DeleteMessagesModal({ ids, actor, onClose, onDeleted }: { ids: string[]; actor: ChatActor; onClose: () => void; onDeleted?: () => void }) {
  const s=useStore(),[everyone,setEveryone]=useState(false),[error,setError]=useState('')
  const messages=ids.map((id)=>s.messages.find((m)=>m.id===id)).filter((m)=>!!m)
  const conv=s.conversations.find((c)=>c.id===messages[0]?.convId)
  const block=messages.map((m)=>deleteAllBlock(s,m,actor)).find(Boolean)
  const self=actor.kind==='seat'?s.seats.find((x)=>x.id===actor.id)?.displayName:'我'
  const audience=conv?.kind==='dm'?'对方':conv?.kind==='channel'?'所有订阅者':'群内所有人'
  const managed=messages.some((m)=>canManageDelete(s,m,actor))
  const submit=()=>{
    const result=s.deleteChatMessages(ids,actor,everyone)
    if(!result.ok)return setError(result.reason??'删除失败')
    toast(`已${everyone?'为所有人':'为本方身份'}删除 ${ids.length} 条消息`)
    onDeleted?.();onClose()
  }
  return <Modal open title={`删除${ids.length>1?` ${ids.length} 条`: '这条'}消息？`} onClose={onClose} width={440} footer={<><Button onClick={onClose}>取消</Button><Button variant="danger" onClick={submit} disabled={!conv||!actorCanView(s,conv.id,actor)||(everyone&&!!block)}>删除</Button></>}>
    <p className="mb-3 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700 line-clamp-3">{messages[0]?.text||messages[0]?.media?.name||'消息已不可用'}{ids.length>1?' 等':''}</p>
    <label className="flex cursor-pointer items-start gap-3 rounded-lg p-3 hover:bg-zinc-50"><input type="radio" name="delete-scope" checked={!everyone} onChange={()=>setEveryone(false)} className="mt-1"/><span><b className="text-sm font-medium">仅为「{self}」删除</b><span className="mt-1 block text-xs leading-relaxed text-zinc-500">{actor.kind==='seat'?'同一坐席的其他设备和接手者也不可见；其他参与者不受影响。':'只影响你的聊天视图，其他参与者不受影响。'}</span></span></label>
    <label className={`flex items-start gap-3 rounded-lg p-3 ${block?'text-zinc-400':'cursor-pointer hover:bg-zinc-50'}`}><input type="radio" name="delete-scope" checked={everyone} disabled={!!block} onChange={()=>setEveryone(true)} className="mt-1"/><span><b className="text-sm font-medium">同时为{audience}删除</b><span className="mt-1 block text-xs leading-relaxed text-zinc-500">{block??(managed?'以管理权限删除，所有参与者的普通聊天中直接移除，不留占位。':`${audience}的聊天里直接消失，不留「已撤回」之类的提示。`)}</span></span></label>
    <p className="mt-3 text-xs text-zinc-500">两种范围都不会在普通聊天里留下占位；企业审计保留原文、附件和操作人。</p>
    {error&&<p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
  </Modal>
}
