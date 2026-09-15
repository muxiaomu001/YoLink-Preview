import { useCallback,useEffect,useRef,useState } from 'react'
import { ArrowDown,ArrowUp,Mic,Pause,Play,Square,Trash2 } from 'lucide-react'
import type { MessageMedia } from '@/domain/types'
import { saveLocalMedia } from '@/domain/localMedia'
import { useStore } from '@/store/store'
import { Button,Textarea } from './primitives'
import { Modal } from './overlay'
import { formatBytes } from './mediaUtils'

export type ChatMediaKind='image'|'file'|'video'|'voice'
interface Picked {file:File;url:string}
export function MediaComposer({files=[],kind,onClose,onSend,draftId}:{draftId?:string;files?:File[];kind:ChatMediaKind;onClose:()=>void;onSend:(kind:ChatMediaKind,media:MessageMedia,text:string)=>boolean}){
  const s=useStore(),[items,setItems]=useState<Picked[]>(()=>files.map((file)=>({file,url:URL.createObjectURL(file)}))),[text,setText]=useState(()=>draftId?s.mediaDrafts?.[draftId]?.text??'':''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0)
  const [draftSaved,setDraftSaved]=useState(false)
  const [audioDuration,setAudioDuration]=useState(0)
  const tooLong=kind==='voice'&&audioDuration>s.policyNumbers.voiceMaxSeconds
  const [recording,setRecording]=useState(false),[paused,setPaused]=useState(false),[seconds,setSeconds]=useState(0)
  const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),alive=useRef(true),urls=useRef(items.map((x)=>x.url)),chunks=useRef<Blob[]>([])
  const cleanup=useCallback(()=>{alive.current=false;stream.current?.getTracks().forEach((t)=>t.stop());queueMicrotask(()=>{if(!alive.current)urls.current.forEach((url)=>URL.revokeObjectURL(url))})},[])
  useEffect(()=>{alive.current=true;return cleanup},[cleanup])
  useEffect(()=>{
    if(!draftId||!items.length)return
    let cancelled=false
    Promise.all(items.map((item)=>saveLocalMedia(item.file))).then((stored)=>{
      if(cancelled||!alive.current)return
      useStore.setState((state)=>({mediaDrafts:{...state.mediaDrafts,[draftId]:{kind,items:stored,text}}}));setDraftSaved(true)
    }).catch(()=>{if(!cancelled&&alive.current){setDraftSaved(false);setError('附件草稿尚未保存，请保留页面并重试')}})
    return()=>{cancelled=true}
  },[draftId,items,kind,text])
  const discard=()=>{if(draftId)useStore.setState((state)=>{const drafts={...state.mediaDrafts};delete drafts[draftId];return{mediaDrafts:drafts}});onClose()}
  useEffect(()=>{if(!recording||paused)return;const timer=window.setInterval(()=>setSeconds((v)=>v+1),1000);return()=>clearInterval(timer)},[recording,paused])
  useEffect(()=>{if(recording&&seconds>=s.policyNumbers.voiceMaxSeconds&&recorder.current?.state!=='inactive')recorder.current?.stop()},[seconds,recording,s.policyNumbers.voiceMaxSeconds])
  const start=async()=>{
    setError('');setAudioDuration(0)
    try{
      const input=await navigator.mediaDevices.getUserMedia({audio:true})
      if(!alive.current){input.getTracks().forEach((t)=>t.stop());return}
      stream.current=input;chunks.current=[];setSeconds(0)
      const type=['audio/webm;codecs=opus','audio/mp4'].find((t)=>MediaRecorder.isTypeSupported(t))
      const r=new MediaRecorder(input,type?{mimeType:type}:undefined);recorder.current=r
      r.ondataavailable=(e)=>{if(e.data.size)chunks.current.push(e.data)}
      r.onstop=()=>{input.getTracks().forEach((t)=>t.stop());if(!alive.current)return;const blob=new Blob(chunks.current,{type:r.mimeType}),file=new File([blob],`语音消息.${r.mimeType.includes('mp4')?'m4a':'webm'}`,{type:r.mimeType}),url=URL.createObjectURL(file);urls.current.push(url);setItems([{file,url}]);setRecording(false);setPaused(false)}
      r.onerror=()=>{input.getTracks().forEach((t)=>t.stop());setRecording(false);setError('录音失败，请重试')}
      r.start();setRecording(true)
    }catch{setError('无法使用麦克风，请允许浏览器访问后重试，或选择已有语音文件')}
  }
  const limit=kind==='image'?s.policyNumbers.imageMaxMb:kind==='video'?s.policyNumbers.videoMaxMb:(s.policyNumbers.fileMaxMb??20)
  const invalid=items.find((x)=>x.file.size>limit*1024*1024||(kind==='image'&&!x.file.type.startsWith('image/'))||(kind==='video'&&!x.file.type.startsWith('video/'))||(kind==='voice'&&!x.file.type.startsWith('audio/')))
  const send=async()=>{
    if(!items.length||busy||invalid||recording||tooLong)return
    setBusy(true);setError('')
    try{
      const stored:MessageMedia[]=[]
      for(let i=0;i<items.length;i++){stored.push(await saveLocalMedia(items[i].file));if(!alive.current)return;setProgress(i+1)}
      if(kind==='image'&&stored.length>1){if(!onSend('image',{...stored[0],album:stored},text)){setBusy(false);return}}
      else for(const media of stored){if(!onSend(kind,{...media,duration:kind==='voice'?seconds||undefined:undefined},text)){setBusy(false);return}}
      discard()
    }catch{setBusy(false);setError('附件准备失败，内容已保留，请重试或选择较小的文件')}
  }
  const move=(i:number,offset:number)=>{setDraftSaved(false);setItems((old)=>{const copy=[...old];[copy[i],copy[i+offset]]=[copy[i+offset],copy[i]];return copy})}
  const remove=(index:number)=>{setDraftSaved(false);const next=items.filter((_,i)=>i!==index);setItems(next);if(!next.length&&draftId)useStore.setState((state)=>{const drafts={...state.mediaDrafts};delete drafts[draftId];return{mediaDrafts:drafts}})}
  return <Modal open title={kind==='voice'?'录制与试听语音':`发送${kind==='image'?'图片':kind==='video'?'视频':'文件'}${items.length?` · ${items.length} 项`:''}`} onClose={discard} width={560} footer={<><Button onClick={discard}>取消</Button><Button variant="primary" onClick={()=>void send()} disabled={busy||!!invalid||!items.length||recording||tooLong}>{busy?`正在准备 ${progress}/${items.length}`:'确认发送'}</Button></>}>
    {kind==='voice'&&<div className="mb-4 flex items-center justify-center gap-3 rounded-xl bg-zinc-50 p-4">{!recording?<Button onClick={()=>void start()}><Mic size={16}/>{items.length?'重新录制':'开始录音'}</Button>:<><span className="tabular-nums text-red-600">{seconds} / {s.policyNumbers.voiceMaxSeconds} 秒</span><Button onClick={()=>{if(paused)recorder.current?.resume();else recorder.current?.pause();setPaused((v)=>!v)}}>{paused?<Play size={16}/>:<Pause size={16}/>} {paused?'继续':'暂停'}</Button><Button onClick={()=>recorder.current?.stop()}><Square size={14}/>停止并试听</Button></>}</div>}
    <div className="max-h-[45vh] space-y-3 overflow-auto">{items.map((item,i)=><div key={item.url} className="rounded-xl border border-zinc-200 p-3">
      {kind==='image'&&item.file.type.startsWith('image/')?<img src={item.url} alt={item.file.name} className="mx-auto max-h-52 max-w-full rounded-lg object-contain"/>:kind==='video'&&item.file.type.startsWith('video/')?<video src={item.url} controls className="max-h-60 w-full rounded-lg"/>:kind==='voice'&&item.file.type.startsWith('audio/')?<audio src={item.url} controls className="w-full" onLoadedMetadata={(e)=>{if(Number.isFinite(e.currentTarget.duration))setAudioDuration(e.currentTarget.duration)}}/>:null}
      <div className="mt-2 flex items-center gap-2 text-xs"><span className="min-w-0 flex-1 truncate">{i+1}. {item.file.name} · {formatBytes(item.file.size)}</span>{items.length>1&&<><button aria-label={`上移第${i+1}项`} disabled={i===0||busy} onClick={()=>move(i,-1)}><ArrowUp size={15}/></button><button aria-label={`下移第${i+1}项`} disabled={i===items.length-1||busy} onClick={()=>move(i,1)}><ArrowDown size={15}/></button></>}<button aria-label={`移除第${i+1}项`} disabled={busy} onClick={()=>remove(i)}><Trash2 size={15}/></button></div>
    </div>)}</div>
    {kind==='voice'&&!recording&&<label className="mt-3 block text-xs text-brand-700">选择已有语音文件<input type="file" accept="audio/*" className="mt-1 block w-full text-xs" onChange={(e)=>{const file=e.target.files?.[0];if(file){const url=URL.createObjectURL(file);urls.current.push(url);setItems([{file,url}])}}}/></label>}
    <Textarea aria-label="附件说明" placeholder="添加说明（可选）" maxLength={1024} value={text} onChange={(e)=>{setDraftSaved(false);setText(e.target.value)}} className="mt-4" rows={2}/>
    {draftId&&items.length>0&&<p className="mt-2 text-xs text-zinc-500">{draftSaved?'附件草稿已保存':'正在准备附件草稿…'}</p>}
    <p className="mt-2 text-xs text-zinc-500">单个附件上限 {limit}MB{kind==='image'&&items.length>1?' · 图片将作为一组发送':''}</p>
    {tooLong&&<p role="alert" className="mt-2 text-sm text-red-600">语音超过 {s.policyNumbers.voiceMaxSeconds} 秒，请缩短后发送</p>}
    {(invalid||error)&&<p role="alert" className="mt-2 text-sm text-red-600">{invalid?`请检查文件类型与大小，单个上限 ${limit}MB`:error}</p>}
  </Modal>
}
