import type { ChatGroup,Customer,Message } from './types'
import { newId } from './ids'

/** 新成员专属欢迎，不给全群重复发送。 */
export function groupWelcomeMessages(group:ChatGroup,convId:string,customers:Customer[],at:string):Message[]{
  if(!group.welcomeText?.trim())return[]
  return customers.map((customer)=>({id:newId('welcome'),convId,senderKind:'system',senderId:'',kind:'system',text:group.welcomeText!.replaceAll('{{customer.nickname}}',customer.nickname).replaceAll('{{group.name}}',group.name),at,isWelcome:true,recipientCustomerId:customer.id}))
}
