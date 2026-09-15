import { useEffect,useState } from 'react'
import type { ChatActor } from '@/domain/types'
import { actorKey } from '@/domain/messageRules'
import { useStore } from '@/store/store'

export function ChatTyping({convId,actor}:{convId:string;actor:ChatActor}){
  const typing=useStore((s)=>s.chatTyping),[now,setNow]=useState(Date.now)
  const until=Math.max(0,...Object.entries(typing??{}).filter(([key,v])=>v.convId===convId&&key!==actorKey(actor)+':'+convId).map(([,v])=>v.until))
  useEffect(()=>{if(!until)return;const timer=window.setInterval(()=>{const current=Date.now();setNow(current);if(current>=until)clearInterval(timer)},1000);return()=>clearInterval(timer)},[until])
  return until>now?<span className="text-xs text-brand-600">对方正在输入…</span>:null
}
