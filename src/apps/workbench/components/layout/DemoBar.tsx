/**
 * 演示浮条：固定右下角的小圆钮，点开后可切换登录员工、打开客户手机屏 / 管理后台。
 * 正式客户端没有这一块，所有演示控制都收在这里，不进正式界面。
 */
import { useState } from 'react'
import { clsx } from 'clsx'
import { Link, useParams } from 'react-router-dom'
import { ExternalLink, FlaskConical, X } from 'lucide-react'
import { seatsOfStaff } from '@/store/selectors'
import { toast } from '@/ui/overlay'
import { useWorkbench } from '../../useWorkbench'

export function DemoBar() {
  const { s, staff, seat } = useWorkbench()
  const { convId } = useParams()
  const conv = s.conversations.find((c) => c.id === convId)
  const group = s.chatGroups.find((g) => g.id === conv?.chatGroupId)
  const customerId = conv?.customerId ?? group?.memberCustomerIds[0]
  const phoneUrl = customerId && convId ? `/phone?customer=${customerId}&conversation=${convId}` : '/phone'
  const [open, setOpen] = useState(false)
  const candidates = s.staff.filter((x) => x.status === 'active' && x.roleId !== 'role_admin')

  const loginAs = (staffId: string) => {
    const target = candidates.find((x) => x.id === staffId)
    if (!target) return
    const seats = seatsOfStaff(s, target.id)
    s.setSession({ workbenchStaffId: target.id, workbenchSeatId: seats[0]?.id ?? null })
    s.logAudit('login', '登录工作台', target.id)
    setOpen(false)
    toast(seats.length ? `已以 ${target.name} 登录，当前身份「${seats[0].displayName}」` : `已以 ${target.name} 登录，他还没有坐席`, 'info')
  }

  return (
    <div className="fixed right-4 bottom-16 z-40 flex flex-col items-end gap-2">
      {open && (
        <div className="w-64 rounded-lg border border-zinc-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2">
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-zinc-800">
              <FlaskConical size={13} className="text-brand-700" /> 演示控制
            </span>
            <button type="button" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-700" aria-label="关闭">
              <X size={14} />
            </button>
          </div>
          <div className="px-3 py-2">
            <div className="mb-1 text-[11px] text-zinc-500">切换登录员工</div>
            <ul className="max-h-48 overflow-y-auto rounded-md border border-zinc-200">
              {candidates.map((st) => (
                <li key={st.id}>
                  <button
                    type="button"
                    onClick={() => loginAs(st.id)}
                    className={clsx('flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[12px] hover:bg-zinc-50', st.id === staff?.id && 'bg-brand-50/70 font-medium text-brand-900')}
                  >
                    <span>{st.name}</span>
                    <span className="ml-2 truncate text-[11px] text-zinc-400">{seatsOfStaff(s, st.id).map((x) => x.displayName).join('、') || '无坐席'}</span>
                  </button>
                </li>
              ))}
            </ul>
            {conv && seat && staff && <div className="mt-3 border-t border-zinc-100 pt-2 text-xs text-zinc-600">
              <div className="mb-1 font-medium">体验消息操作</div>
              <button type="button" className="text-brand-700 hover:underline" onClick={() => { s.seatSendRich({ convId: conv.id, seatId: seat.id, operatorId: staff.id, text: '您好，明天下午三点我们再沟通。' }); setOpen(false) }}>发送一条演示消息</button>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">点击消息旁的 ··· 试编辑、引用或撤回。打开下方客户手机屏查看已读和双方变化。</p>
            </div>}
            <div className="mt-2 flex flex-col gap-1">
              <Link to={phoneUrl} target="_blank" className="inline-flex items-center gap-1 text-[12px] text-brand-700 hover:underline">
                <ExternalLink size={12} /> 打开当前会话的客户手机屏
              </Link>
              <Link to="/admin" target="_blank" className="inline-flex items-center gap-1 text-[12px] text-brand-700 hover:underline">
                <ExternalLink size={12} /> 打开管理后台
              </Link>
            </div>
            <div className="mt-2 border-t border-zinc-100 pt-1.5 text-[11px] text-zinc-400">演示用，正式客户端没有这一块</div>
          </div>
        </div>
      )}
      <button
        type="button"
        title="演示控制"
        onClick={() => setOpen((v) => !v)}
        className={clsx('flex h-9 w-9 items-center justify-center rounded-full border shadow-md transition-colors', open ? 'border-brand-700 bg-brand-700 text-white' : 'border-zinc-200 bg-white text-zinc-500 hover:text-brand-700')}
      >
        <FlaskConical size={16} />
      </button>
    </div>
  )
}
