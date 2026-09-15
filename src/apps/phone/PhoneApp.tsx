import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { BadgeCheck, ChevronLeft, Contact, MessageCircle, Send, UserRound } from 'lucide-react'
import { useStore } from '@/store/store'
import { conversationsForCustomer, customerById, messagesOf, seatById, seatsOfCustomer } from '@/store/selectors'
import { fmtRelative, fmtTime } from '@/domain/time'
import { Avatar, SeatAvatar, TitleChip } from '@/ui/display'
import { Button, Input, Select } from '@/ui/primitives'

type Tab = 'chats' | 'contacts' | 'me'

export function PhoneApp() {
  const s = useStore()
  const customer = customerById(s, s.session.phoneCustomerId)
  const [tab, setTab] = useState<Tab>('chats')
  const [openConv, setOpenConv] = useState<string | null>(null)
  const [justAdded, setJustAdded] = useState<string[] | null>(null)

  return (
    <div className="flex h-full items-center justify-center bg-zinc-200 p-6">
      <div className="flex items-start gap-6">
        {/* 手机 */}
        <div className="relative h-[780px] w-[380px] overflow-hidden rounded-[40px] border-[10px] border-zinc-900 bg-white shadow-2xl">
          <div className="absolute top-0 left-1/2 z-10 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-zinc-900" />
          <div className="flex h-full flex-col pt-6">
            {!customer ? (
              <RegisterScreen onDone={setJustAdded} />
            ) : justAdded ? (
              <WelcomeScreen seatIds={justAdded} onEnter={() => setJustAdded(null)} />
            ) : openConv ? (
              <ChatScreen convId={openConv} customerId={customer.id} onBack={() => setOpenConv(null)} />
            ) : (
              <>
                <div className="min-h-0 flex-1">
                  {tab === 'chats' && <ChatsScreen customerId={customer.id} onOpen={setOpenConv} />}
                  {tab === 'contacts' && <ContactsScreen customerId={customer.id} onOpen={setOpenConv} />}
                  {tab === 'me' && <MeScreen customerId={customer.id} />}
                </div>
                <nav className="grid grid-cols-3 border-t border-zinc-200 bg-white pb-3">
                  {(
                    [
                      ['chats', '消息', MessageCircle],
                      ['contacts', '联系人', Contact],
                      ['me', '我的', UserRound],
                    ] as const
                  ).map(([k, label, Icon]) => (
                    <button key={k} type="button" onClick={() => setTab(k)} className={clsx('flex flex-col items-center gap-0.5 py-2 text-[10px]', tab === k ? 'text-brand-700' : 'text-zinc-400')}>
                      <Icon size={20} />
                      {label}
                    </button>
                  ))}
                </nav>
              </>
            )}
          </div>
        </div>

        {/* 演示控制 */}
        <aside className="w-64 rounded-lg border border-dashed border-zinc-400 bg-white/70 p-4 text-xs">
          <div className="mb-2 font-semibold text-zinc-700">演示控制</div>
          <p className="mb-3 leading-relaxed text-zinc-500">这块不是产品的一部分。左边是客户在 App 里看到的一切：只有坐席，没有员工。</p>
          <label className="mb-1 block text-[11px] text-zinc-500">以哪位客户的视角查看</label>
          <Select
            value={customer?.id ?? ''}
            className="mb-2"
            onChange={(e) => {
              s.setSession({ phoneCustomerId: e.target.value || null })
              setOpenConv(null)
              setTab('chats')
            }}
          >
            <option value="">未登录（去注册）</option>
            {s.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nickname} · {s.inviteGroups.find((g) => g.id === c.inviteGroupId)?.name}
              </option>
            ))}
          </Select>
          {customer && (
            <Button
              size="sm"
              className="w-full"
              onClick={() => {
                s.setSession({ phoneCustomerId: null })
                setOpenConv(null)
              }}
            >
              退出登录，回到注册页
            </Button>
          )}
          <div className="mt-4 border-t border-zinc-200 pt-3">
            <div className="mb-1 text-[11px] text-zinc-500">可用邀请码</div>
            <ul className="space-y-1">
              {s.inviteGroups
                .filter((g) => g.enabled)
                .map((g) => (
                  <li key={g.id} className="flex items-center justify-between">
                    <span className="text-zinc-700">{g.name}</span>
                    <span className="rounded bg-zinc-100 px-1 font-mono text-[11px]">{g.code}</span>
                  </li>
                ))}
            </ul>
          </div>
          <div className="mt-4 flex flex-col gap-1 border-t border-zinc-200 pt-3">
            <Link to="/workbench" target="_blank" className="text-brand-700 hover:underline">
              打开客服工作台
            </Link>
            <Link to="/admin" target="_blank" className="text-brand-700 hover:underline">
              打开管理后台
            </Link>
            <Link to="/" className="text-zinc-500 hover:underline">
              演示首页
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}

function WelcomeScreen({ seatIds, onEnter }: { seatIds: string[]; onEnter: () => void }) {
  const s = useStore()
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <BadgeCheck size={40} className="text-emerald-600" />
      <div className="mt-3 text-base font-semibold">注册成功</div>
      <p className="mt-2 text-xs leading-relaxed text-zinc-500">你的官方联系人已经在会话列表里了，不需要搜索或申请。</p>
      <div className="mt-4 w-full space-y-2">
        {seatIds.map((id) => {
          const seat = seatById(s, id)
          return seat ? (
            <div key={id} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-left">
              <SeatAvatar seat={seat} size={30} />
              <div>
                <div className="text-xs font-medium">{seat.displayName}</div>
                <div className="text-[10px] text-zinc-500">{seat.roleDesc}</div>
              </div>
            </div>
          ) : null
        })}
      </div>
      <Button variant="primary" className="mt-6 h-10 w-full text-sm" onClick={onEnter}>
        进入
      </Button>
    </div>
  )
}

function RegisterScreen({ onDone }: { onDone: (seatIds: string[]) => void }) {
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
    onDone(r.addedSeatIds ?? [])
  }

  return (
    <div className="flex h-full flex-col px-7 pt-10">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-sm font-bold text-white">恒</span>
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

function ChatsScreen({ customerId, onOpen }: { customerId: string; onOpen: (id: string) => void }) {
  const s = useStore()
  const rows = useMemo(() => conversationsForCustomer(s, customerId), [s, customerId])
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2 pb-2 text-lg font-semibold">消息</div>
      <div className="thin-scroll flex-1 overflow-y-auto">
        {rows.map((r) => {
          const last = r.last
          const senderName = last?.senderKind === 'seat' ? (r.conv.kind === 'dm' ? '' : `${seatById(s, last.seatId)?.displayName}：`) : last?.senderKind === 'customer' ? (last.senderId === customerId ? '我：' : `${customerById(s, last.senderId)?.nickname}：`) : ''
          const unread = messagesOf(s, r.conv.id).filter((m) => m.senderKind === 'seat' && new Date(m.at).getTime() > Date.now() - 3600000).length
          return (
            <button key={r.conv.id} type="button" onClick={() => onOpen(r.conv.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-zinc-50">
              {r.seat ? <SeatAvatar seat={r.seat} size={44} /> : <Avatar text={r.title} size={44} color={r.group?.kind === 'channel' ? '#b45309' : '#0f766e'} official={r.official} />}
              <div className="min-w-0 flex-1 border-b border-zinc-100 pb-2.5">
                <div className="flex items-center justify-between">
                  <span className="truncate text-[14px] text-zinc-900">{r.title}</span>
                  <span className="text-[10px] text-zinc-400">{last ? fmtRelative(last.at) : ''}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="truncate text-xs text-zinc-500">
                    {senderName}
                    {last?.text}
                  </span>
                  {unread > 0 && r.conv.kind === 'dm' && <span className="ml-2 shrink-0 rounded-full bg-red-500 px-1.5 text-[10px] leading-4 text-white">{unread}</span>}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ContactsScreen({ customerId, onOpen }: { customerId: string; onOpen: (id: string) => void }) {
  const s = useStore()
  const officials = seatsOfCustomer(s, customerId)
  const groups = s.chatGroups.filter((g) => g.memberCustomerIds.includes(customerId))
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2 pb-2 text-lg font-semibold">联系人</div>
      <div className="thin-scroll flex-1 overflow-y-auto">
        <div className="bg-zinc-50 px-4 py-1 text-[10px] text-zinc-500">官方联系人</div>
        {officials.map((o) => (
          <button key={o.seatId} type="button" onClick={() => o.conv && onOpen(o.conv.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-zinc-50">
            <SeatAvatar seat={o.seat} size={40} />
            <div className="min-w-0 flex-1 border-b border-zinc-100 pb-2.5">
              <div className="flex items-center gap-1 text-[14px] text-zinc-900">
                {o.seat.displayName}
                <span className="rounded bg-brand-50 px-1 text-[9px] text-brand-700">企业官方账号</span>
              </div>
              <div className="truncate text-xs text-zinc-500">{o.seat.roleDesc}</div>
            </div>
          </button>
        ))}
        <div className="bg-zinc-50 px-4 py-1 text-[10px] text-zinc-500">群与频道</div>
        {groups.map((g) => {
          const conv = s.conversations.find((c) => c.chatGroupId === g.id)
          return (
            <button key={g.id} type="button" onClick={() => conv && onOpen(conv.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-zinc-50">
              <Avatar text={g.name} size={40} color={g.kind === 'channel' ? '#b45309' : '#0f766e'} official={g.official} />
              <div className="min-w-0 flex-1 border-b border-zinc-100 pb-2.5">
                <div className="text-[14px] text-zinc-900">{g.name}</div>
                <div className="truncate text-xs text-zinc-500">{g.kind === 'channel' ? '频道' : '群'} · {g.desc}</div>
              </div>
            </button>
          )
        })}
        <p className="px-4 py-4 text-[10px] leading-relaxed text-zinc-400">客服预设下没有「添加好友」「搜索用户」，客户只与官方联系人往来。</p>
      </div>
    </div>
  )
}

function MeScreen({ customerId }: { customerId: string }) {
  const s = useStore()
  const c = customerById(s, customerId)!
  const titles = c.titleIds.map((id) => s.titles.find((t) => t.id === id && t.enabled)!).filter(Boolean)
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2 pb-2 text-lg font-semibold">我的</div>
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar text={c.nickname} size={56} />
        <div>
          <div className="text-[15px] font-medium text-zinc-900">{c.nickname}</div>
          <div className="text-[11px] text-zinc-400">账号 {c.accountId}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {titles.map((t) => (
              <TitleChip key={t.id} title={t} size="xs" />
            ))}
          </div>
        </div>
      </div>
      <div className="mx-4 rounded-lg border border-zinc-200 text-[13px]">
        {[
          ['昵称', c.nickname],
          ['用户名', c.phone ?? c.accountId],
          ['头衔', titles.length ? titles.map((t) => t.name).join('、') : '无'],
          ['语言', '中文'],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between border-b border-zinc-100 px-3 py-2.5 last:border-0">
            <span className="text-zinc-600">{k}</span>
            <span className="text-zinc-900">{v}</span>
          </div>
        ))}
      </div>
      <p className="px-4 pt-3 text-[10px] leading-relaxed text-zinc-400">头衔是企业发的，这里只显示，不能编辑、不能隐藏。</p>
    </div>
  )
}

function ChatScreen({ convId, customerId, onBack }: { convId: string; customerId: string; onBack: () => void }) {
  const s = useStore()
  const conv = s.conversations.find((c) => c.id === convId)
  const msgs = useMemo(() => messagesOf(s, convId), [s, convId])
  const [text, setText] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight })
  }, [msgs.length])
  if (!conv) return null
  const seat = conv.kind === 'dm' ? seatById(s, conv.seatId) : undefined
  const group = conv.kind !== 'dm' ? s.chatGroups.find((g) => g.id === conv.chatGroupId) : undefined
  const readOnly = group?.kind === 'channel'
  const send = () => {
    if (!text.trim()) return
    s.customerSend(convId, text.trim())
    setText('')
  }
  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <header className="flex items-center gap-2 border-b border-zinc-200 bg-white px-2 py-2">
        <button type="button" onClick={onBack} className="p-1 text-zinc-600">
          <ChevronLeft size={20} />
        </button>
        {seat && <SeatAvatar seat={seat} size={28} />}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium text-zinc-900">{seat?.displayName ?? group?.name}</div>
          <div className="truncate text-[10px] text-zinc-400">{seat ? seat.roleDesc : group?.kind === 'channel' ? '频道 · 只读' : `${(group?.memberCustomerIds.length ?? 0) + (group?.memberSeatIds.length ?? 0)} 人`}</div>
        </div>
        {seat && <BadgeCheck size={16} className="mr-2 text-brand-600" />}
      </header>
      <div ref={ref} className="thin-scroll flex-1 overflow-y-auto px-3 py-3">
        {msgs.map((m) => {
          const mine = m.senderKind === 'customer' && m.senderId === customerId
          const sSeat = m.senderKind === 'seat' ? seatById(s, m.seatId) : undefined
          const sCus = m.senderKind === 'customer' && !mine ? customerById(s, m.senderId) : undefined
          const t = sCus?.primaryTitleId ? s.titles.find((x) => x.id === sCus.primaryTitleId && x.enabled) : undefined
          return (
            <div key={m.id} className={clsx('mb-2.5 flex gap-2', mine && 'flex-row-reverse')}>
              {!mine && (sSeat ? <SeatAvatar seat={sSeat} size={30} /> : <Avatar text={sCus?.nickname ?? '?'} size={30} />)}
              <div className={clsx('max-w-[75%]', mine && 'text-right')}>
                {conv.kind !== 'dm' && !mine && (
                  <div className="mb-0.5 flex items-center gap-1 text-[10px] text-zinc-500">
                    {sSeat ? (
                      <>
                        {sSeat.displayName}
                        <span className="rounded bg-brand-50 px-1 text-[9px] text-brand-700">官方</span>
                      </>
                    ) : (
                      <>
                        {sCus?.nickname}
                        {t && <TitleChip title={t} size="xs" />}
                      </>
                    )}
                  </div>
                )}
                <div className={clsx('inline-block rounded-2xl px-3 py-2 text-left text-[13px] leading-relaxed whitespace-pre-wrap', mine ? 'rounded-tr-sm bg-brand-700 text-white' : 'rounded-tl-sm bg-white text-zinc-800 shadow-sm')}>{m.text}</div>
                <div className="mt-0.5 text-[9px] text-zinc-400">{fmtTime(m.at)}</div>
              </div>
            </div>
          )
        })}
      </div>
      {readOnly ? (
        <div className="border-t border-zinc-200 bg-white py-3 text-center text-[11px] text-zinc-400">频道内容由官方发布，客户只读</div>
      ) : (
        <div className="flex items-center gap-2 border-t border-zinc-200 bg-white px-3 py-2 pb-5">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={seat ? `发消息给 ${seat.displayName}` : '发消息'}
            className="h-9 rounded-full"
          />
          <button type="button" onClick={send} disabled={!text.trim()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white disabled:bg-zinc-300">
            <Send size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
