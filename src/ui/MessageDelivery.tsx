import { useEffect } from 'react'
import { AlertCircle, Clock3 } from 'lucide-react'
import type { ChatActor, Message } from '@/domain/types'
import { useStore } from '@/store/store'
import { toast } from './overlay'

export function MessageDelivery({ message:m, actor }: { message:Message; actor:ChatActor }) {
  const expire=useStore((s)=>s.expirePendingMessage)
  useEffect(()=>{
    if(m.delivery!=='pending'||!m.attemptId)return
    const id=window.setTimeout(()=>expire(m.id,m.attemptId!),3000)
    return()=>window.clearTimeout(id)
  },[m.id,m.delivery,m.attemptId,expire])
  if(m.delivery==='pending')return <span className="inline-flex items-center gap-1 text-zinc-500"><Clock3 size={12}/>发送中</span>
  if(m.delivery!=='failed')return null
  return <button type="button" className="inline-flex items-center gap-1 text-red-600 hover:underline" title={m.failureReason} onClick={()=>{const r=useStore.getState().retryChatMessage(m.id,actor);if(!r.ok)toast(r.reason??'重试失败','warn')}}><AlertCircle size={13}/>发送失败 · 重试</button>
}
