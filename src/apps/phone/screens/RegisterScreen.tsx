/**
 * 注册页与注册成功页：成功页列出官方联系人 + 自动加入的群与频道（邀请组 / 邀请链接 / 企业默认三者并集）。
 */
import { useState } from 'react'
import { BadgeCheck } from 'lucide-react'
import { useStore } from '@/store/store'
import { seatById } from '@/store/selectors'
import { SeatAvatar } from '@/ui/display'
import { Button, Input } from '@/ui/primitives'
import { DemoHint, GroupAvatar } from '../parts'
import { groupKindLabel } from '../shared'

export interface JustAdded {
  seatIds: string[]
  groupIds: string[]
}

export function WelcomeScreen({ added, onEnter }: { added: JustAdded; onEnter: () => void }) {
  const s = useStore()
  const groups = added.groupIds.map((id) => s.chatGroups.find((g) => g.id === id)).filter((g) => !!g)
  return (
    <div className="thin-scroll flex h-full flex-col items-center overflow-y-auto px-7 pt-10 pb-6 text-center">
      <BadgeCheck size={40} className="text-emerald-600" />
      <div className="mt-3 text-base font-semibold">注册成功</div>
      <p className="mt-2 text-xs leading-relaxed text-zinc-500">你的官方联系人已经在会话列表里了，不需要搜索或申请。</p>
      <div className="mt-4 w-full space-y-2">
        {added.seatIds.map((id) => {
          const seat = seatById(s, id)
          return seat ? (
            <div key={id} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-left">
              <SeatAvatar seat={seat} size={30} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium">{seat.displayName}</div>
                <div className="truncate text-[10px] text-zinc-500">{seat.roleDesc}</div>
              </div>
              <span className="rounded bg-brand-50 px-1 text-[9px] text-brand-700">官方</span>
            </div>
          ) : null
        })}
      </div>
      {groups.length > 0 && (
        <>
          <p className="mt-4 text-[11px] text-zinc-500">已自动加入 {groups.length} 个群与频道</p>
          <div className="mt-2 w-full space-y-2">
            {groups.map((g) => (
              <div key={g.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-left">
                <GroupAvatar g={g} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium">{g.name}</div>
                  <div className="truncate text-[10px] text-zinc-500">
                    {groupKindLabel(g)}
                    {g.official ? ' · 官方' : ''} · {g.desc}
                  </div>
                </div>
                <span className="rounded bg-emerald-50 px-1 text-[9px] text-emerald-700">已自动加入</span>
              </div>
            ))}
          </div>
        </>
      )}
      <Button variant="primary" className="mt-6 h-10 w-full shrink-0 text-sm" onClick={onEnter}>
        进入
      </Button>
    </div>
  )
}

export function RegisterScreen({ onDone }: { onDone: (added: JustAdded) => void }) {
  const s = useStore()
  const [nick, setNick] = useState('')
  const [code, setCode] = useState('')
  const [phone, setPhone] = useState('')
  const [err, setErr] = useState('')

  const submit = () => {
    const r = s.registerCustomer({ nickname: nick, inviteCode: code, phone: phone || undefined })
    if (!r.ok) {
      setErr(r.error ?? '失败')
      return
    }
    onDone({ seatIds: r.addedSeatIds ?? [], groupIds: r.addedGroupIds ?? [] })
  }

  return (
    <div className="flex h-full flex-col px-7 pt-10">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-sm font-bold text-white">{s.enterprise.logoText.slice(0, 1)}</span>
        <div>
          <div className="text-base font-semibold text-zinc-900">{s.enterprise.name}</div>
          <div className="text-[10px] text-zinc-400">企业码 {s.enterprise.code}</div>
        </div>
      </div>
      <p className="mt-4 mb-5 text-xs text-zinc-500">{s.enterprise.slogan}</p>
      <div className="space-y-3">
        <div>
          <div className="mb-1 text-[11px] text-zinc-500">昵称</div>
          <Input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="如：张先生" className="h-10" />
        </div>
        <div>
          <div className="mb-1 text-[11px] text-zinc-500">手机号（即用户名，选填）</div>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+852" className="h-10" />
        </div>
        <div>
          <div className="mb-1 text-[11px] text-zinc-500">密码</div>
          <Input type="password" defaultValue="demo1234" className="h-10" />
          <DemoHint>演示里密码不校验，注册只看昵称和邀请码。</DemoHint>
        </div>
        <div>
          <div className="mb-1 text-[11px] text-zinc-500">邀请码{s.enterprise.inviteCodeRequired ? '' : '（选填）'}</div>
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="6 位" className="h-10 font-mono tracking-widest uppercase" />
        </div>
        {err && <div className="text-xs text-red-600">{err}</div>}
        <Button variant="primary" className="h-10 w-full text-sm" disabled={!nick.trim() || (s.enterprise.inviteCodeRequired && code.length < 4)} onClick={submit}>
          注册
        </Button>
        <p className="text-center text-[10px] text-zinc-400">注册即同意用户协议与隐私政策</p>
      </div>
    </div>
  )
}
