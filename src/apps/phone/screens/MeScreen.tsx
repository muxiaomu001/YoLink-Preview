/**
 * 「我的」页：13 文档的功能清单；钱包 / 签到 / 邀请 / 注销等入口按模块 + 策略显示，被禁用的直接不显示。
 */
import { useState } from 'react'
import { CalendarCheck, Wallet } from 'lucide-react'
import { useStore } from '@/store/store'
import { customerById } from '@/store/selectors'
import { customerCan } from '@/store/policy'
import { walletBalance } from '@/store/actions/modules'
import { Avatar, TitleChip } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { demoToast } from '@/ui/DemoNote'
import { DemoHint, LevelTag, Row, ScreenHeader, SectionLabel, Sheet, TabTitle } from '../parts'
import { AppearanceScreen, BlockedListScreen, InfoScreen, NotificationScreen, ProfileScreen } from './MeSubScreens'
import type { LastSeenVisibility } from '@/domain/types'

type Sub = 'profile' | 'appearance' | 'notification' | 'privacy' | 'blocked' | 'storage' | 'security' | 'language' | 'help' | 'about' | 'wallet' | 'referral' | null

export function MeScreen({ customerId, onLoggedOut }: { customerId: string; onLoggedOut: () => void }) {
  const s = useStore()
  const c = customerById(s, customerId)!
  const [sub, setSub] = useState<Sub>(null)
  const titles = c.titleIds.map((id) => s.titles.find((t) => t.id === id && t.enabled)).filter((t) => !!t)
  const can = (k: string) => customerCan(s, customerId, k)
  const back = () => setSub(null)

  if (sub === 'profile') return <ProfileScreen customerId={customerId} onBack={back} />
  if (sub === 'appearance') return <AppearanceScreen customerId={customerId} onBack={back} />
  if (sub === 'notification') return <NotificationScreen onBack={back} />
  if (sub === 'privacy') return <PrivacyScreen customerId={customerId} onBack={back} onOpenBlocked={() => setSub('blocked')} />
  if (sub === 'blocked') return <BlockedListScreen customerId={customerId} onBack={back} />
  if (sub === 'storage') return <InfoScreen title="数据与存储" onBack={back} rows={[{ label: '存储用量', value: '128 MB', level: 'P1' }, { label: '清理缓存', level: 'P1' }, { label: '自动下载媒体', value: 'Wi-Fi', level: 'P1' }]} />
  if (sub === 'security') return <InfoScreen title="账号安全" onBack={back} rows={[{ label: '修改密码', level: 'P1' }, { label: '设备管理', value: `最多 ${s.policyNumbers.maxDevices} 台在线`, level: 'P1' }, { label: '两步验证', value: '未开启', level: 'P1' }]} note={c.mustChangePassword ? '客服为你重置过密码，请尽快修改。' : `同一账号最多 ${s.policyNumbers.maxDevices} 台设备同时在线。`} />
  if (sub === 'language') return <InfoScreen title="语言" onBack={back} rows={[{ label: '中文', value: '✓' }, { label: 'English' }]} />
  if (sub === 'help') return <InfoScreen title="帮助与反馈" onBack={back} rows={[{ label: '帮助文档', value: s.enterprise.faqUrl }, { label: '意见反馈' }]} />
  if (sub === 'about') return <InfoScreen title="关于" onBack={back} rows={[{ label: '版本号', value: '1.0.0' }, { label: '服务条款', value: s.enterprise.agreementUrl }, { label: '隐私政策', value: s.enterprise.privacyUrl }]} />
  if (sub === 'wallet') return <WalletScreen customerId={customerId} onBack={back} />
  if (sub === 'referral') return <InfoScreen title="邀请好友" onBack={back} rows={[{ label: '我的邀请码', value: c.accountId, level: 'P2' }, { label: '已邀请', value: `${c.inviteCount} 人`, level: 'P2' }, { label: '团队人数', value: `${c.teamCount} 人`, level: 'P2' }]} />

  const showWallet = s.enterprise.modules.wallet && can('wallet.view')
  const showCheckin = s.enterprise.modules.checkin && can('checkin.sign')
  const showReferral = s.enterprise.modules.referral && can('referral.invite')
  const showDelete = can('account.delete')

  const deleteAccount = async () => {
    const ok = await confirm({ title: '注销账号？', body: '注销后数据保留但不再出现在工作台，需要重新注册才能使用。', okText: '注销', danger: true })
    if (!ok) return
    s.deleteCustomer(customerId, 'customer_self')
    toast('账号已注销')
    onLoggedOut()
  }

  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <div className="bg-white">
        <TabTitle title="我的" />
        <button type="button" onClick={() => setSub('profile')} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-zinc-50">
          <Avatar text={c.nickname} color={c.avatarUpdatedAt ? '#2563eb' : undefined} size={56} />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-medium text-zinc-900">{c.nickname}</div>
            <div className="text-[11px] text-zinc-400">账号 {c.accountId}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {titles.map((t) => (
                <TitleChip key={t.id} title={t} size="xs" />
              ))}
            </div>
          </div>
          <span className="text-[11px] text-zinc-400">资料 ›</span>
        </button>
      </div>
      <div className="thin-scroll flex-1 overflow-y-auto">
        {(showWallet || showCheckin) && (
          <div className="mx-4 mt-3 grid grid-cols-2 gap-2">
            {showWallet && (
              <button type="button" onClick={() => setSub('wallet')} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left active:bg-zinc-50">
                <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                  <Wallet size={12} /> 钱包 <LevelTag level="P2" />
                </div>
                <div className="mt-0.5 text-[15px] font-semibold text-zinc-900">{walletBalance(s.walletTxs, customerId)} 积分</div>
              </button>
            )}
            {showCheckin && (
              <button type="button" onClick={() => demoToast('签到')} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left active:bg-zinc-50">
                <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                  <CalendarCheck size={12} /> 每日签到 <LevelTag level="P2" />
                </div>
                <div className="mt-0.5 text-[13px] font-medium text-brand-700">点击签到</div>
              </button>
            )}
          </div>
        )}
        <SectionLabel>设置</SectionLabel>
        <div className="bg-white">
          <Row label="外观" onClick={() => setSub('appearance')} />
          <Row label="通知" onClick={() => setSub('notification')} />
          <Row label="隐私" level="P1" onClick={() => setSub('privacy')} />
          <Row label="数据与存储" level="P1" onClick={() => setSub('storage')} />
          <Row label="账号安全" level="P1" onClick={() => setSub('security')} />
          <Row label="语言" value="中文" onClick={() => setSub('language')} />
          <Row label="帮助与反馈" onClick={() => setSub('help')} />
          <Row label="关于" value="1.0.0" onClick={() => setSub('about')} />
          {showReferral && <Row label="邀请好友" level="P2" onClick={() => setSub('referral')} />}
          {showDelete && <Row label="注销账号" level="P1" danger onClick={() => void deleteAccount()} />}
        </div>
        <div className="px-4 py-3">
          <DemoHint>看不到的入口（钱包、签到、邀请好友、注销账号）是模块或策略关了，右侧演示控制面板列出了原因。</DemoHint>
        </div>
      </div>
    </div>
  )
}

const LAST_SEEN_LABEL: Record<LastSeenVisibility, string> = {
  everyone: '所有人',
  friends: '我的好友',
  nobody: '无人',
}

function PrivacyScreen({ customerId, onBack, onOpenBlocked }: { customerId: string; onBack: () => void; onOpenBlocked: () => void }) {
  const s = useStore()
  const c = customerById(s, customerId)!
  const [choosingLastSeen, setChoosingLastSeen] = useState(false)
  const lastSeenVisibility = c.lastSeenVisibility ?? 'everyone'

  return (
    <div className="relative flex h-full flex-col bg-zinc-50">
      <ScreenHeader title="隐私" onBack={onBack} />
      <div className="mt-2 bg-white">
        <Row label="手机号可见" value="我的好友" level="P1" />
        <Row label="最后上线时间" value={LAST_SEEN_LABEL[lastSeenVisibility]} level="P1" onClick={() => setChoosingLastSeen(true)} />
        <Row label="头像可见" value="所有人" level="P1" />
        <Row label="谁可以拉我入群" value="我的好友" level="P1" />
        <Row label="阻止列表" value={`${c.blockedSeatIds.length} 人`} onClick={onOpenBlocked} />
        <Row label="已读回执" value="企业侧使用，不提供关闭" />
      </div>
      {choosingLastSeen && (
        <Sheet title="谁可以看到我的最后上线时间" onClose={() => setChoosingLastSeen(false)}>
          <div className="space-y-1">
            {(Object.keys(LAST_SEEN_LABEL) as LastSeenVisibility[]).map((visibility) => (
              <button
                key={visibility}
                type="button"
                onClick={() => {
                  s.setCustomerLastSeenVisibility(customerId, visibility)
                  setChoosingLastSeen(false)
                }}
                className="flex w-full items-center justify-between border-b border-zinc-100 py-2.5 text-left last:border-0"
              >
                <span>{LAST_SEEN_LABEL[visibility]}</span>
                {lastSeenVisibility === visibility && <span className="text-brand-700">✓</span>}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  )
}

function WalletScreen({ customerId, onBack }: { customerId: string; onBack: () => void }) {
  const s = useStore()
  const canWithdraw = customerCan(s, customerId, 'wallet.withdraw')
  const canBind = customerCan(s, customerId, 'wallet.bind_account')
  const txs = s.walletTxs.filter((t) => t.customerId === customerId).slice(0, 8)
  return (
    <InfoScreen
      title="钱包"
      onBack={onBack}
      rows={[
        { label: '积分余额', value: `${walletBalance(s.walletTxs, customerId)}`, level: 'P2' },
        ...(canWithdraw ? [{ label: '申请提现', level: 'P2' as const }] : []),
        ...(canBind ? [{ label: '绑定收款账户', level: 'P2' as const }] : []),
        ...txs.map((t) => ({ label: t.note || t.type, value: `${t.amount > 0 ? '+' : ''}${t.amount}` })),
      ]}
    />
  )
}
