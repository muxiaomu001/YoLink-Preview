/**
 * 注册后的软引导条。
 *
 * 注册提速把昵称和头像从注册表单里拿掉了，但这些资料本身还是有用的——
 * 客服认不出「客户8231」是谁。所以把「填资料」从注册时的
 * 硬门槛改成进来之后的软提醒：可关、关了不再来、任何时候都不挡路。
 *
 * 只在「消息」页顶部出现一条，不做弹窗、不做全屏引导页——那些都是变相的硬门槛。
 */
import { X } from 'lucide-react'
import type { Customer } from '@/domain/types'
import { useStore } from '@/store/store'

interface Todo {
  key: string
  label: string
}

/** 还差哪几项资料；空数组表示没什么可提醒的 */
export function profileTodos(c: Customer): Todo[] {
  const list: Todo[] = []
  if (c.nicknameAuto) list.push({ key: 'nickname', label: '起个名字' })
  if (!c.avatarUpdatedAt) list.push({ key: 'avatar', label: '换个头像' })
  return list
}

export function shouldShowProfileGuide(c: Customer): boolean {
  return !c.profileGuideDismissedAt && profileTodos(c).length > 0
}

export function ProfileGuide({ customer, onGoProfile }: { customer: Customer; onGoProfile: () => void }) {
  const s = useStore()
  const todos = profileTodos(customer)
  return (
    <div className="flex items-start gap-2 border-b border-brand-100 bg-brand-50/70 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium text-brand-900">完善一下资料，客服更好认你</div>
        <div className="mt-0.5 text-[10px] text-brand-800/70">还差：{todos.map((t) => t.label).join('、')}。不填也不影响聊天。</div>
      </div>
      <button type="button" onClick={onGoProfile} className="shrink-0 rounded-md bg-brand-700 px-2 py-1 text-[10px] font-medium text-white active:bg-brand-800">
        去完善
      </button>
      <button type="button" onClick={() => s.dismissProfileGuide(customer.id)} className="shrink-0 rounded p-1 text-brand-700/60 active:bg-brand-100" aria-label="不再提醒" title="不再提醒">
        <X size={14} />
      </button>
    </div>
  )
}
