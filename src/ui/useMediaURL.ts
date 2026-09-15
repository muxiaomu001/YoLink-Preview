import { useEffect,useState } from 'react'
import { localMediaURL } from '@/domain/localMedia'
import { mediaUrl } from '@/domain/mediaUrl'

export function useMediaURL(source:string){
  const [resolved,setResolved]=useState<{source:string;url?:string;error?:string}>()
  useEffect(()=>{if(!source.startsWith('idb:'))return;let alive=true;localMediaURL(source).then((url)=>{if(alive)setResolved({source,url})}).catch(()=>{if(alive)setResolved({source,error:'附件在此浏览器中已不可用'})});return()=>{alive=false}},[source])
  return source.startsWith('idb:')?resolved?.source===source?resolved:{source,url:undefined,error:undefined}:{source,url:mediaUrl(source),error:undefined}
}
