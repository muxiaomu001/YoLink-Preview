import type { MessageMedia } from './types'

let connection:Promise<IDBDatabase>|undefined
const urls=new Map<string,string>()
function database(){
  return connection??=(new Promise((resolve,reject)=>{
    const request=indexedDB.open('yolink-demo-media',1)
    request.onupgradeneeded=()=>request.result.createObjectStore('files')
    request.onsuccess=()=>resolve(request.result)
    request.onerror=()=>{connection=undefined;reject(request.error)}
  }))
}
/** 附件只保存在当前浏览器；不会上传任何外部服务。 */
async function persistFile(file:File):Promise<MessageMedia>{
  const db=await database(),id=crypto.randomUUID()
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(file,id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})
  return{url:'idb:'+id,name:file.name,size:file.size,mime:file.type}
}
export async function localMediaURL(key:string){
  if(urls.has(key))return urls.get(key)!
  const db=await database()
  const blob=await new Promise<Blob>((resolve,reject)=>{const r=db.transaction('files').objectStore('files').get(key.slice(4));r.onsuccess=()=>r.result?resolve(r.result):reject(new Error('本机附件已不存在'));r.onerror=()=>reject(r.error)})
  const url=URL.createObjectURL(blob);urls.set(key,url);return url
}


const files=new WeakMap<File,Promise<MessageMedia>>()
export function saveLocalMedia(file:File){
  let saved=files.get(file)
  if(!saved){saved=persistFile(file).catch((error)=>{files.delete(file);throw error});files.set(file,saved)}
  return saved
}
export async function restoreLocalFile(media:MessageMedia){
  const url=await localMediaURL(media.url),blob=await fetch(url).then((r)=>r.blob())
  const file=new File([blob],media.name,{type:media.mime??blob.type});files.set(file,Promise.resolve(media));return file
}
