/**
 * 客户资料卡（工作台右栏）：顶部固定区（头像、昵称、头衔、状态、账号 ID、4 个快捷动作），
 * 下面是可折叠分区，折叠状态记在本机（useLocalPref）。
 */
import { customerById } from '@/store/selectors'
import { useLocalPref } from '../useLocalPref'
import { useWorkbench } from '../useWorkbench'
import type { SectionCtl } from './customer/CollapsibleSection'
import { SECTION_DEFAULTS, type SectionKey } from './customer/sectionPrefs'
import { CustomerHeader } from './customer/CustomerHeader'
import { BasicSection, BusinessProfileSection, NoteSection, OfficialsSection, PurchasesSection, TagsSection, TitlesSection } from './customer/CustomerSections'
import { QuickActions } from './customer/QuickActions'
import { CheckinSection, GroupsSection, ReferralSection, WalletSection } from './CustomerCard.parts'

const PREF_KEY = 'customer-card-sections'

export function CustomerCard({ customerId }: { customerId: string }) {
  const { s, staff } = useWorkbench()
  const [stored, setStored] = useLocalPref<Partial<Record<SectionKey, boolean>>>(PREF_KEY, SECTION_DEFAULTS)
  const c = customerById(s, customerId)
  if (!c || !staff) return null

  // 本机存过的键优先，没存过的用默认；老版本少了键也不会丢展开状态
  const sections: Record<SectionKey, boolean> = { ...SECTION_DEFAULTS, ...stored }
  const ctl = (k: SectionKey): SectionCtl => ({
    open: sections[k],
    toggle: () => setStored((prev) => ({ ...prev, [k]: !(prev[k] ?? SECTION_DEFAULTS[k]) })),
  })

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 border-b border-zinc-100 bg-white px-4 pt-4 pb-3">
        <CustomerHeader c={c} />
        <QuickActions c={c} />
      </div>

      <NoteSection key={c.id} c={c} ctl={ctl('note')} />
      <TagsSection c={c} ctl={ctl('tags')} />
      <TitlesSection c={c} ctl={ctl('titles')} />
      <PurchasesSection c={c} ctl={ctl('purchases')} />
      <BusinessProfileSection c={c} ctl={ctl('business')} />
      <BasicSection c={c} ctl={ctl('basic')} />
      <OfficialsSection c={c} ctl={ctl('officials')} />
      <GroupsSection c={c} ctl={ctl('groups')} />
      {s.enterprise.modules.wallet && <WalletSection c={c} ctl={ctl('wallet')} />}
      {s.enterprise.modules.checkin && <CheckinSection c={c} ctl={ctl('checkin')} />}
      {s.enterprise.modules.referral && <ReferralSection c={c} ctl={ctl('referral')} />}
    </div>
  )
}
