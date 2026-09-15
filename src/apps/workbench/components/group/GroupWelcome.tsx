import { useState } from 'react'
import { useStore } from '@/store/store'
import { Button,Textarea } from '@/ui/primitives'
import { toast } from '@/ui/overlay'
import type { GroupPanelProps } from './shared'

export function GroupWelcome({group,actor,perm}:GroupPanelProps){
  const s=useStore(),[text,setText]=useState(group.welcomeText??'')
  const canEdit=perm('can_change_info')
  return <section className="mt-4 border-t border-zinc-100 pt-3"><h3 className="mb-1 text-sm font-medium">新成员欢迎语</h3><p className="mb-2 text-xs text-zinc-500">仅新加入的成员看到，不重复通知其他成员。留空表示关闭。</p><Textarea aria-label="新成员欢迎语" disabled={!canEdit} value={text} maxLength={1024} rows={3} onChange={(e)=>setText(e.target.value)} placeholder="欢迎 {{customer.nickname}} 加入 {{group.name}}！"/>{canEdit&&<Button size="sm" className="mt-2" disabled={text===(group.welcomeText??'')} onClick={()=>{s.updateChatGroup(group.id,{welcomeText:text.trim()},actor.staffId);toast('已保存欢迎语，对之后加入的成员生效')}}>保存欢迎语</Button>}</section>
}
