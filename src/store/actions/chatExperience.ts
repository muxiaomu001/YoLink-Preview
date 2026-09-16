import type { ChatActor, ChatDraft, Message, MessageKind, MessageMedia } from '@/domain/types'
import { actorCanView, actorKey, canManageDelete, deleteAllBlock, draftKey, messageVisibleFor, mentionsIn, sendFailure } from '@/domain/messageRules'
import { customerCan, seatCan } from '../policy'
import { newId } from '@/domain/ids'
import { type Get, type Set, now, withAudit } from './helpers'

export interface ChatSendInput {
  convId: string; actor: ChatActor; text: string; kind?: Exclude<MessageKind, 'system'>; media?: MessageMedia
  replyToId?: string; quoteText?: string; signature?: boolean; aiDraftUsed?: boolean
  selectedMentions?: { mentionSeatIds: string[]; mentionCustomerIds: string[] }
  forwardedFrom?: Message['forwardedFrom']
}
export interface ChatExperienceActions {
  deleteChatMessages: (ids: string[], actor: ChatActor, everyone: boolean) => { ok: boolean; reason?: string }
  clearChatFor: (convId: string, actor: ChatActor) => boolean
  hideChatFor: (convId: string, actor: ChatActor) => boolean
  saveChatDraft: (convId: string, actor: ChatActor, draft: ChatDraft) => void
  queueChatMessage: (input: ChatSendInput) => { ok: boolean; reason?: string; id?: string }
  retryChatMessage: (id: string, actor: ChatActor) => { ok: boolean; reason?: string }
  expirePendingMessage: (id: string, attemptId: string) => void
  simulateNextSendFailure: (on: boolean) => void
}

export function chatExperienceActions(set: Set, get: Get): ChatExperienceActions {
  const finish = (id: string, attemptId: string, actor: ChatActor, simulatedFailure: boolean) => {
    window.setTimeout(() => {
      const s = get(), m = s.messages.find((x) => x.id === id)
      if (!m || m.attemptId !== attemptId || m.delivery !== 'pending' || m.deletedAt || m.hiddenFor?.includes(actorKey(actor))) return
      const failure = sendFailure(s, m.convId, actor, !!m.media) ?? (simulatedFailure ? '模拟发送失败，请重试' : !navigator.onLine ? '网络已断开，请联网后重试' : undefined)
      set({ messages: s.messages.map((x) => x.id === id ? { ...x, delivery: failure ? 'failed' : 'sent', failureReason: failure } : x),
        customers: !failure&&actor.kind==='customer'?s.customers.map((c)=>c.id===actor.id?{...c,lastActiveAt:now()}:c):s.customers,
        conversations: failure ? s.conversations : s.conversations.map((c) => c.id === m.convId ? { ...c, lastMessageAt: m.at } : c) })
    }, 700)
  }
  return {
    deleteChatMessages: (ids, actor, everyone) => {
      const s = get(), unique = [...new Set(ids)], messages = unique.map((id) => s.messages.find((m) => m.id === id))
      if (!unique.length || messages.some((m) => !m || !messageVisibleFor(s, m, actor))) return { ok: false, reason: '部分消息已不可用，请重新选择' }
      if (everyone) {
        const reason = messages.map((m) => deleteAllBlock(s, m!, actor)).find(Boolean)
        if (reason) return { ok: false, reason: `未删除任何消息：${reason}` }
      }
      const at = now(), key = actorKey(actor)
      // 为所有人删除：两端普通聊天直接消失、不留占位；deletedByManager 只给审计区分作者删除与管理删除
      set({ messages: s.messages.map((m) => unique.includes(m.id) ? everyone ? { ...m, deletedAt: at, deletedByManager: canManageDelete(s, m, actor) || undefined } : { ...m, hiddenFor: [...new Set([...(m.hiddenFor ?? []), key])] } : m),
        chatGroups: everyone?s.chatGroups.map((g)=>({...g,pinnedMessageIds:g.pinnedMessageIds.filter((id)=>!unique.includes(id))})):s.chatGroups,
        groupLogs: everyone ? [...Array.from(new Set(messages.map((m)=>s.conversations.find((c)=>c.id===m!.convId)?.chatGroupId).filter((id):id is string=>!!id))).map((groupId)=>({id:newId('glog'),groupId,at,actorKind:actor.kind,actorId:actor.id,action:'delete_message',detail:`为所有人移除 ${unique.length} 条消息，原文保留审计`})),...s.groupLogs] : s.groupLogs,
        audit: withAudit(s.audit, 'message.delete', `${key} ${everyone ? '为所有人' : '仅为本方身份'}删除 ${unique.length} 条消息：${unique.join('、')}${everyone && messages.some((m) => canManageDelete(s, m!, actor)) ? '（管理权限）' : ''}`, actor.staffId ?? null) })
      return { ok: true }
    },
    clearChatFor: (convId, actor) => {
      const s = get()
      if (!actorCanView(s, convId, actor)) return false
      const last = s.messages.filter((m) => m.convId === convId).sort((a,b) => b.at.localeCompare(a.at))[0]?.at ?? now()
      set({ conversations: s.conversations.map((c) => c.id === convId ? { ...c, clearedThroughByViewer: { ...c.clearedThroughByViewer, [actorKey(actor)]: last }, unreadMarkBySeatIds: (c.unreadMarkBySeatIds ?? []).filter((id) => id !== actor.id) } : c),
        audit: withAudit(s.audit, 'message.delete', `${actorKey(actor)} 清空本方会话 ${convId} 的可见历史，保留关系与审计`, actor.staffId ?? null) })
      return true
    },
    hideChatFor: (convId, actor) => {
      const s=get()
      if (!actorCanView(s,convId,actor)) return false
      set({conversations:s.conversations.map((c)=>c.id===convId?{...c,hiddenAtByViewer:{...c.hiddenAtByViewer,[actorKey(actor)]:now()}}:c)})
      return true
    },
    saveChatDraft: (convId, actor, draft) => {
      const s=get()
      if (!actorCanView(s,convId,actor)) return
      set({chatDrafts:{...s.chatDrafts,[draftKey(actor,convId)]:draft},chatTyping:{...s.chatTyping,[actorKey(actor)+':'+convId]:{convId,until:draft.text?Date.now()+5000:0}}})
    },
    queueChatMessage: (input) => {
      const s=get(), text=input.text.trim()
      const reason=sendFailure(s,input.convId,input.actor,!!input.media)
      if(reason)return{ok:false,reason}
      if((!text&&!input.media)||text.length>(input.media?1024:4096))return{ok:false,reason:'请检查内容长度或附件'}
      const conv=s.conversations.find((c)=>c.id===input.convId)!, group=s.chatGroups.find((g)=>g.id===conv.chatGroupId)
      const mentions=mentionsIn(s,input.convId,text,input.selectedMentions)
      if(mentions.mentionAll&&!(input.actor.kind==='seat'?seatCan(s,input.actor.id,'group.mention_all',group?.id):customerCan(s,input.actor.id,'group.mention_all',group?.id)))return{ok:false,reason:'当前不允许 @所有人'}
      if(input.replyToId&&!s.messages.some((m)=>m.id===input.replyToId&&m.convId===input.convId&&messageVisibleFor(s,m,input.actor)))return{ok:false,reason:'要回复的消息已不可用，请取消回复后发送'}
      if(input.quoteText&&input.replyToId&&!s.messages.find((m)=>m.id===input.replyToId)?.text.includes(input.quoteText))return{ok:false,reason:'所引用的原文已变化，请重新选择'}
      // 转发按来源会话再查一次转发能力：挑目标的弹层开着时管理员可能刚关掉这项能力
      if(input.forwardedFrom){const from=s.conversations.find((c)=>c.id===input.forwardedFrom!.convId),fwdKey=from?.chatGroupId?'group.forward':'dm.forward'
        if(!(input.actor.kind==='seat'?seatCan(s,input.actor.id,fwdKey,from?.chatGroupId):customerCan(s,input.actor.id,fwdKey,from?.chatGroupId)))return{ok:false,reason:'当前不允许转发这条消息'}}
      const id=newId('msg'),attemptId=newId('attempt'),at=now()
      const m:Message={id,convId:input.convId,senderKind:input.actor.kind,senderId:input.actor.id,seatId:input.actor.kind==='seat'?input.actor.id:undefined,operatorId:input.actor.staffId,kind:input.kind??'text',text,media:input.media,at,replyToId:input.replyToId,quoteText:input.quoteText,...mentions,delivery:'pending',attemptId,aiDraftUsed:input.aiDraftUsed,forwardedFrom:input.forwardedFrom,
        channelId:group?.kind==='channel'?group.id:undefined,channelSignature:group?.kind==='channel'&&input.signature?s.seats.find((x)=>x.id===input.actor.id)?.displayName:undefined,receiptMemberSeatIds:group?.memberSeatIds,receiptMemberCustomerIds:group?.memberCustomerIds}
      set({messages:[...s.messages,m],failNextSend:false})
      finish(id,attemptId,input.actor,!!s.failNextSend)
      return{ok:true,id}
    },
    retryChatMessage: (id,actor) => {
      const s=get(),m=s.messages.find((x)=>x.id===id)
      if(!m||m.delivery!=='failed'||m.senderKind!==actor.kind||m.senderId!==actor.id||(actor.kind==='seat'&&m.operatorId!==actor.staffId)||!messageVisibleFor(s,m,actor))return{ok:false,reason:'无法重试这条消息'}
      const reason=sendFailure(s,m.convId,actor,!!m.media)
      if(reason)return{ok:false,reason}
      if(m.replyToId&&!s.messages.some((x)=>x.id===m.replyToId&&messageVisibleFor(s,x,actor)))return{ok:false,reason:'要回复的消息已不可用，请删除这条失败消息后重新发送'}
      const attemptId=newId('attempt')
      set({messages:s.messages.map((x)=>x.id===id?{...x,delivery:'pending',failureReason:undefined,attemptId}:x),failNextSend:false})
      finish(id,attemptId,actor,!!s.failNextSend)
      return{ok:true}
    },
    expirePendingMessage: (id, attemptId) => {
      const s=get()
      set({messages:s.messages.map((m)=>m.id===id&&m.attemptId===attemptId&&m.delivery==='pending'?{...m,delivery:'failed',failureReason:'尚未确认发送结果，请重试'}:m)})
    },
    simulateNextSendFailure: (on) => set({failNextSend:on}),
  }
}
