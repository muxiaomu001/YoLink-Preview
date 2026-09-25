import { useState } from 'react'
import { useStore } from '@/store/store'
import { customerById, seatById } from '@/store/selectors'
import { customerCan } from '@/store/policy'
import { SeatAvatar } from '@/ui/display'
import { Button } from '@/ui/primitives'
import { confirm } from '@/ui/confirm'
import { toast } from '@/ui/overlay'
import { DemoHint, ScreenHeader } from '../parts'

export function SeatProfileScreen({ seatId, customerId, onBack }: { seatId: string; customerId: string; onBack: () => void }) {
  const s = useStore()
  const seat = seatById(s, seatId)
  const customer = customerById(s, customerId)
  const [busy, setBusy] = useState(false)
  if (!seat || !customer) return <div className="p-6 text-sm">资料不存在<button className="ml-2 text-brand-700" onClick={onBack}>返回</button></div>

  const blocked = customer.blockedSeatIds.includes(seat.id)
  const canBlock = customerCan(s, customerId, 'friend.block')
  const toggle = async () => {
    if (busy) return
    if (!blocked) {
      const ok = await confirm({ title: `拉黑「${seat.displayName}」？`, body: '拉黑后，你不会再收到这位官方联系人的私聊和群发消息。', okText: '拉黑', danger: true })
      if (!ok) return
    }
    setBusy(true)
    const result = s.customerBlockSeat(customerId, seat.id, !blocked)
    setBusy(false)
    toast(result.ok ? (blocked ? '已解除拉黑' : '已拉黑') : (result.reason ?? '操作失败'), result.ok ? 'ok' : 'warn')
  }

  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <ScreenHeader onBack={onBack} title="官方联系人资料" />
      <div className="flex flex-col items-center bg-white px-4 py-5">
        <SeatAvatar seat={seat} size={72} />
        <div className="mt-2 flex items-center gap-1 text-[16px] font-medium text-zinc-900">{seat.displayName}<span className="rounded bg-brand-50 px-1 text-[9px] font-normal text-brand-700">官方</span></div>
        <div className="mt-1 text-[12px] text-zinc-500">{seat.roleDesc}</div>
      </div>
      <div className="mt-2 bg-white px-4 py-3">
        <Button className="w-full" variant={blocked ? 'secondary' : 'danger'} disabled={!blocked && !canBlock || busy} onClick={() => void toggle()}>{blocked ? '解除拉黑' : '拉黑'}</Button>
      </div>
      {!canBlock && !blocked && <div className="px-4 py-3"><DemoHint>当前企业未开放阻止官方联系人的功能。</DemoHint></div>}
    </div>
  )
}
