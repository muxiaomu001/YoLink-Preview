/**
 * 注册页与注册成功页。
 *
 * 注册页按企业设置的昵称三档（必填 / 选填 / 不问）决定要不要出昵称框；
 * 成功页列出官方联系人 + 自动加入的群与频道（邀请组与邀请链接附带群的并集），
 * 并把「系统给你起了个名」和「新号观察期」这两件事在这里讲清楚，不留到客户在群里发不出话才发现。
 */
import { useState } from 'react'
import { BadgeCheck, Clock, PenLine } from 'lucide-react'
import { NICKNAME_MAX, WATCH_LIMIT_TEXT, renderDefaultNickname } from '@/domain/register'
import { fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { seatById } from '@/store/selectors'
import { SeatAvatar } from '@/ui/display'
import { Button, Input } from '@/ui/primitives'
import { DemoHint, GroupAvatar } from '../parts'
import { groupKindLabel } from '../shared'

export interface JustAdded {
  seatIds: string[]
  groupIds: string[]
  /** 昵称是系统发的默认名 */
  nicknameAuto?: boolean
  /** 新号观察期到期时间 */
  watchUntil?: string
}

export function WelcomeScreen({ added, onEnter }: { added: JustAdded; onEnter: () => void }) {
  const s = useStore()
  const groups = added.groupIds.map((id) => s.chatGroups.find((g) => g.id === id)).filter((g) => !!g)
  const me = s.customers.find((c) => c.id === s.session.phoneCustomerId)
  return (
    <div className="thin-scroll flex h-full flex-col items-center overflow-y-auto px-7 pt-10 pb-6 text-center">
      <BadgeCheck size={40} className="text-emerald-600" />
      <div className="mt-3 text-base font-semibold">注册成功</div>
      <p className="mt-2 text-xs leading-relaxed text-zinc-500">你的官方联系人已经在会话列表里了，不需要搜索或申请。</p>
      {added.nicknameAuto && me && (
        <div className="mt-3 flex w-full items-start gap-2 rounded-lg border border-brand-200 bg-brand-50/70 px-3 py-2 text-left">
          <PenLine size={14} className="mt-0.5 shrink-0 text-brand-700" />
          <p className="text-[11px] leading-relaxed text-brand-900">
            先给你起了个名字：<b>{me.nickname}</b>。想改随时在「我的 › 个人资料」改，不影响现在聊天。
          </p>
        </div>
      )}
      {added.watchUntil && (
        <div className="mt-2 flex w-full items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-left">
          <Clock size={14} className="mt-0.5 shrink-0 text-amber-700" />
          <p className="text-[11px] leading-relaxed text-amber-900">
            新号观察期至 {fmtDateTime(added.watchUntil)}：{WATCH_LIMIT_TEXT}。有问题直接问上面的官方联系人，不受影响。
          </p>
        </div>
      )}
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
  // 昵称三档：必填出星号、选填出输入框但不拦、不问直接不渲染这一格
  const policy = s.enterprise.nicknamePolicy
  const askNick = policy !== 'skip'
  const nickRequired = policy === 'required'
  // 账号 ID 注册那一刻才生成，这里只是让客户先看到默认昵称长什么样
  const samplePreview = renderDefaultNickname(s.enterprise.defaultNicknameTemplate, '****')

  const submit = () => {
    const r = s.registerCustomer({ nickname: askNick ? nick : '', inviteCode: code, phone: phone || undefined })
    if (!r.ok) {
      setErr(r.error ?? '失败')
      return
    }
    onDone({ seatIds: r.addedSeatIds ?? [], groupIds: r.addedGroupIds ?? [], nicknameAuto: r.nicknameAuto, watchUntil: r.watchUntil })
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto px-7 pt-10 pb-6">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-sm font-bold text-white">{s.enterprise.logoText.slice(0, 1)}</span>
        <div>
          <div className="text-base font-semibold text-zinc-900">{s.enterprise.name}</div>
          <div className="text-[10px] text-zinc-400">企业码 {s.enterprise.code}</div>
        </div>
      </div>
      <p className="mt-4 mb-5 text-xs text-zinc-500">{s.enterprise.slogan}</p>
      <div className="space-y-3">
        {askNick && (
          <div>
            <div className="mb-1 text-[11px] text-zinc-500">
              昵称{nickRequired ? <span className="text-red-500">*</span> : '（选填）'}
            </div>
            <Input value={nick} maxLength={NICKNAME_MAX} onChange={(e) => setNick(e.target.value)} placeholder={nickRequired ? '如：张先生' : `不填就叫「${samplePreview}」`} className="h-10" />
          </div>
        )}
        <div>
          <div className="mb-1 text-[11px] text-zinc-500">手机号（即用户名，选填）</div>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+852" className="h-10" />
        </div>
        <div>
          <div className="mb-1 text-[11px] text-zinc-500">密码</div>
          <Input type="password" defaultValue="demo1234" className="h-10" />
          <DemoHint>
            演示里密码不校验。昵称按后台「注册资料规则」走，现在是
            <b>{nickRequired ? '必填' : askNick ? '选填' : '不问'}</b>
            {askNick ? '；昵称可以和别人重名。' : `：直接发默认昵称「${samplePreview}」，进去后随时能改。`}
          </DemoHint>
        </div>
        <div>
          <div className="mb-1 text-[11px] text-zinc-500">邀请码{s.enterprise.inviteCodeRequired ? '' : '（选填）'}</div>
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="4-16 位" className="h-10 font-mono tracking-widest uppercase" />
        </div>
        {err && <div className="text-xs text-red-600">{err}</div>}
        <Button variant="primary" className="h-10 w-full text-sm" disabled={(nickRequired && !nick.trim()) || (s.enterprise.inviteCodeRequired && code.length < 4)} onClick={submit}>
          注册
        </Button>
        {s.enterprise.registerPerDevicePerDay > 0 && (
          <DemoHint>同设备 24 小时最多注册 {s.enterprise.registerPerDevicePerDay} 个账号；演示里手机屏算一台设备，连着注册就能看到风控拦人。</DemoHint>
        )}
        <p className="text-center text-[10px] text-zinc-400">注册即同意用户协议与隐私政策</p>
      </div>
    </div>
  )
}
