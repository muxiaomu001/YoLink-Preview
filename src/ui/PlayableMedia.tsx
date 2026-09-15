import { useRef } from 'react'
import type { MessageMedia } from '@/domain/types'
import { useMediaURL } from './useMediaURL'

export function PlayableMedia({media,kind}:{media:MessageMedia;kind:'video'|'voice'}){
  const {url,error}=useMediaURL(media.url),audio=useRef<HTMLAudioElement>(null)
  if(error)return <p className="text-xs text-red-600">{error}</p>
  if(!url)return <p className="text-xs text-zinc-500">正在载入附件…</p>
  if(kind==='video')return <video aria-label={media.name} src={url} controls preload="metadata" className="max-h-64 w-full max-w-sm rounded-lg bg-black"/>
  return <div className="max-w-full rounded-lg bg-white p-2 text-zinc-700"><audio ref={audio} aria-label={media.name} src={url} controls preload="metadata" className="h-10 w-full max-w-[280px]"/><label className="mt-1 flex items-center justify-end gap-1 text-xs">播放速度<select aria-label="语音播放速度" onChange={(e)=>{if(audio.current)audio.current.playbackRate=Number(e.target.value)}}><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label></div>
}
