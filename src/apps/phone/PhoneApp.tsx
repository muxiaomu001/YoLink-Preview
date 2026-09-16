/**
 * 客户手机屏：手机壳 + 底部三个标签 + 右侧演示控制面板。
 * 所有"能不能"都由 customerCan / customerCanSpeakIn 决定，管理后台改了策略这里立刻变。
 */
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { Contact, MessageCircle, UserRound } from 'lucide-react'
import { useStore } from '@/store/store'
import { customerById } from '@/store/selectors'
import { DemoPanel } from './DemoPanel'
import { RegisterScreen, WelcomeScreen, type JustAdded } from './screens/RegisterScreen'
import { ProfileGuide, shouldShowProfileGuide } from './screens/ProfileGuide'
import { ChatsScreen } from './screens/ChatsScreen'
import { ContactsScreen } from './screens/ContactsScreen'
import { MeScreen } from './screens/MeScreen'
import { ChatScreen } from './screens/ChatScreen'
import { ActiveAnnouncementBar, StartupExperience } from './StartupExperience'

type Tab = 'chats' | 'contacts' | 'me'

const TABS: { key: Tab; label: string; Icon: typeof MessageCircle }[] = [
  { key: 'chats', label: '消息', Icon: MessageCircle },
  { key: 'contacts', label: '联系人', Icon: Contact },
  { key: 'me', label: '我的', Icon: UserRound },
]

export function PhoneApp() {
  const s = useStore()
  const [params, setParams] = useSearchParams()
  const customer = customerById(s, params.get('customer') ?? s.session.phoneCustomerId)
  const loggedIn = !!customer && !customer.deletedAt
  const [tab, setTab] = useState<Tab>('chats')
  const [openConv, setOpenConv] = useState<string | null>(() => params.get('conversation'))
  const [justAdded, setJustAdded] = useState<JustAdded | null>(null)
  const [startupRun, setStartupRun] = useState(0)

  const reset = () => {
    setParams({}, { replace: true })
    setOpenConv(null)
    setTab('chats')
    setStartupRun((value) => value + 1)
  }
  const logout = () => {
    s.setSession({ phoneCustomerId: null })
    reset()
  }

  return (
    <div className="flex h-full overflow-auto items-start justify-center bg-zinc-200 p-2 sm:p-6">
      <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-start lg:gap-6">
        {/* 手机 */}
        <div className="relative h-[min(780px,90dvh)] w-[min(380px,calc(100vw-16px))] overflow-hidden rounded-[40px] border-[10px] border-zinc-900 bg-white shadow-2xl">
          <div className="absolute top-0 left-1/2 z-10 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-zinc-900" />
          <div className="relative flex h-full flex-col pt-6">
            {!loggedIn ? (
              // registerCustomer 成功后自动把 session.phoneCustomerId 指向新客户
              <RegisterScreen onDone={setJustAdded} />
            ) : justAdded ? (
              <WelcomeScreen added={justAdded} onEnter={() => setJustAdded(null)} />
            ) : openConv ? (
              <ChatScreen convId={openConv} customerId={customer.id} onBack={() => setOpenConv(null)} />
            ) : (
              <>
                {/* 软引导只在「消息」页顶上出现一条：可关、关了不再来、任何时候都不挡路 */}
                {tab === 'chats' && <ActiveAnnouncementBar />}
                {tab === 'chats' && shouldShowProfileGuide(customer) && <ProfileGuide customer={customer} onGoProfile={() => setTab('me')} />}
                <div className="min-h-0 flex-1">
                  {tab === 'chats' && <ChatsScreen customerId={customer.id} onOpen={setOpenConv} />}
                  {tab === 'contacts' && <ContactsScreen customerId={customer.id} onOpen={setOpenConv} />}
                  {tab === 'me' && <MeScreen customerId={customer.id} onLoggedOut={logout} />}
                </div>
                <nav className="grid grid-cols-3 border-t border-zinc-200 bg-white pb-3">
                  {TABS.map(({ key, label, Icon }) => (
                    <button key={key} type="button" onClick={() => setTab(key)} className={clsx('flex flex-col items-center gap-0.5 py-2 text-[10px]', tab === key ? 'text-brand-700' : 'text-zinc-400')}>
                      <Icon size={20} />
                      {label}
                    </button>
                  ))}
                </nav>
              </>
            )}
          </div>
          <StartupExperience key={startupRun} customerId={customer?.id} />
        </div>

        <DemoPanel customerId={customer?.id} onSwitch={reset} onReplayStartup={() => setStartupRun((value) => value + 1)} />
      </div>
    </div>
  )
}
