import { useState } from 'react'
import type { ChatActor } from '@/domain/types'
import { messageVisibleFor } from '@/domain/messageRules'
import { useStore } from '@/store/store'
import { senderName } from '@/store/policy'
import { fmtDateTime } from '@/domain/time'
import { Tabs } from './display'
import { Input } from './primitives'
import { Modal } from './overlay'
import { FileCard,ImageThumb } from './media'
import { PlayableMedia } from './PlayableMedia'

export function ChatMediaLibrary({convId,actor,onClose,onLocate}:{convId:string;actor:ChatActor;onClose:()=>void;onLocate:(id:string)=>void}){
  const s=useStore(),[tab,setTab]=useState<'media'|'files'|'links'>('media'),[q,setQ]=useState('')
  const list=s.messages.filter((m)=>m.convId===convId&&messageVisibleFor(s,m,actor)&&(!m.delivery||m.delivery==='sent')).filter((m)=>`${m.text} ${m.media?.name??''}`.toLowerCase().includes(q.toLowerCase())).filter((m)=>tab==='media'?['image','video','voice'].includes(m.kind):tab==='files'?m.kind==='file':/https?:\/\//.test(m.text)).sort((a,b)=>b.at.localeCompare(a.at))
  return <Modal open title="文件与媒体" width={640} onClose={onClose}>
    <Tabs value={tab} onChange={setTab} items={[{key:'media',label:'图片 / 视频 / 语音'},{key:'files',label:'文件'},{key:'links',label:'链接'}]}/>
    <Input aria-label="搜索会话资料" placeholder="搜索说明或文件名" value={q} onChange={(e)=>setQ(e.target.value)} className="my-3"/>
    <div className="max-h-[60vh] space-y-4 overflow-auto">{!list.length&&<p className="py-8 text-center text-sm text-zinc-400">没有匹配的内容</p>}{list.map((m)=><section key={m.id} className="border-b border-zinc-100 pb-3"><div className="mb-2 flex justify-between text-xs text-zinc-500"><span>{senderName(s,m)} · {fmtDateTime(m.at)}</span><button className="text-brand-700 hover:underline" onClick={()=>{onClose();onLocate(m.id)}}>定位消息</button></div>{m.media&&(m.kind==='image'?<ImageThumb media={m.media} maxWidth={260}/>:m.kind==='video'||m.kind==='voice'?<PlayableMedia kind={m.kind} media={m.media}/>:<FileCard media={m.media}/>)}{tab==='links'?Array.from(m.text.matchAll(/https?:\/\/[^\s]+/g)).map((match,i)=><a key={i} href={match[0]} target="_blank" rel="noreferrer" className="block break-all text-sm text-brand-700 underline">{match[0]}</a>):<p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{m.text}</p>}</section>)}</div>
  </Modal>
}
