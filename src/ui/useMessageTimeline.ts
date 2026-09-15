import { useCallback, useEffect, useRef, useState } from 'react'

/** 保持阅读位置：看历史时不被新消息拉走，回到底部后恢复跟随。 */
export function useMessageTimeline(rootId:string,key:string,ids:string,firstUnreadId?:string) {
  const [hasReturn,setHasReturn]=useState(false)
  const [atBottom,setAtBottom]=useState(true),[newCount,setNewCount]=useState(0)
  const following=useRef(true),previous=useRef(ids),returnTop=useRef<number|null>(null)
  const jumpLatest=useCallback(()=>{const root=document.getElementById(rootId);if(root){root.scrollTop=root.scrollHeight;following.current=true;setAtBottom(true);setNewCount(0)}},[rootId])
  const jump=useCallback((id:string)=>{const root=document.getElementById(rootId),node=document.getElementById(id);if(!root||!node)return false;returnTop.current=root.scrollTop;setHasReturn(true);following.current=false;root.scrollTop+=node.getBoundingClientRect().top-root.getBoundingClientRect().top-32;setAtBottom(false);return true},[rootId])
  const goBack=useCallback(()=>{const root=document.getElementById(rootId);if(root&&returnTop.current!==null){root.scrollTop=returnTop.current;returnTop.current=null;setHasReturn(false)}},[rootId])
  useEffect(()=>{
    const root=document.getElementById(rootId);if(!root)return
    const saved=sessionStorage.getItem('yolink-read-position:'+key)
    if(saved!==null){root.scrollTop=Number(saved);following.current=root.scrollHeight-root.scrollTop-root.clientHeight<50}
    else if(firstUnreadId){const node=root.querySelector<HTMLElement>(`[data-message-id="${firstUnreadId}"]`);if(node)root.scrollTop+=node.getBoundingClientRect().top-root.getBoundingClientRect().top-28;following.current=root.scrollHeight-root.scrollTop-root.clientHeight<50}
    else root.scrollTop=root.scrollHeight
    const scroll=()=>{const bottom=root.scrollHeight-root.scrollTop-root.clientHeight<50;following.current=bottom;setAtBottom(bottom);if(bottom)setNewCount(0);sessionStorage.setItem('yolink-read-position:'+key,String(root.scrollTop))}
    const resize=new ResizeObserver(()=>{if(following.current)root.scrollTop=root.scrollHeight})
    if(root.firstElementChild)resize.observe(root.firstElementChild)
    root.addEventListener('scroll',scroll,{passive:true})
    return()=>{sessionStorage.setItem('yolink-read-position:'+key,String(root.scrollTop));resize.disconnect();root.removeEventListener('scroll',scroll)}
  },[rootId,key,firstUnreadId])
  useEffect(()=>{const old=new Set(previous.current.split(','));const added=ids.split(',').filter((id)=>id&&!old.has(id)).length;previous.current=ids;if(!added)return;if(following.current)jumpLatest();else setNewCount((n)=>n+added)},[ids,jumpLatest])
  return {atBottom,newCount,jumpLatest,jump,goBack,hasReturn}
}
