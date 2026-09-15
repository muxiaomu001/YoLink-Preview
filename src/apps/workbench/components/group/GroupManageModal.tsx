/**
 * 群管理弹窗：左侧竖向 tab、右侧内容区可滚动。没有对应权限的 tab 不显示，群主全有。
 * tab 与权限：基础信息 / 公告 → 修改群信息；置顶 → 置顶消息；群设置 → 修改群信息或限制成员；
 * 成员 → 邀请用户或限制成员；管理员 → 任免管理员；邀请链接 → 邀请用户；日志 → 任一权限。
 */
import { useState, type ComponentType } from 'react'
import { clsx } from 'clsx'
import { Info, Link2, Megaphone, Pin, ScrollText, Shield, SlidersHorizontal, Users } from 'lucide-react'
import type { GroupAdminPerm } from '@/domain/types'
import { Modal } from '@/ui/overlay'
import { GroupAdmins } from './GroupAdmins'
import { GroupAnnouncementPanel } from './GroupAnnouncementPanel'
import { GroupBasic } from './GroupBasic'
import { GroupInviteLinks } from './GroupInviteLinks'
import { GroupLogPanel } from './GroupLogPanel'
import { GroupMembers } from './GroupMembers'
import { GroupPinned } from './GroupPinned'
import { GroupSettingsPanel } from './GroupSettingsPanel'
import { PERM_META } from './groupRules'
import type { GroupPanelProps } from './shared'

type TabKey = 'basic' | 'announcement' | 'pinned' | 'settings' | 'members' | 'admins' | 'links' | 'logs'
type PermFn = (p: GroupAdminPerm) => boolean

const MODAL_WIDTH = 760
const BODY_HEIGHT = 560

const TABS: { key: TabKey; label: string; icon: ComponentType<{ size?: number }>; allow: (perm: PermFn) => boolean }[] = [
  { key: 'basic', label: '基础信息', icon: Info, allow: (p) => p('can_change_info') },
  { key: 'announcement', label: '公告', icon: Megaphone, allow: (p) => p('can_change_info') },
  { key: 'pinned', label: '置顶', icon: Pin, allow: (p) => p('can_pin_messages') },
  { key: 'settings', label: '群设置', icon: SlidersHorizontal, allow: (p) => p('can_change_info') || p('can_restrict_members') },
  { key: 'members', label: '成员', icon: Users, allow: (p) => p('can_invite_users') || p('can_restrict_members') },
  { key: 'admins', label: '管理员', icon: Shield, allow: (p) => p('can_promote_members') },
  { key: 'links', label: '邀请链接', icon: Link2, allow: (p) => p('can_invite_users') },
  { key: 'logs', label: '管理员日志', icon: ScrollText, allow: (p) => PERM_META.some((m) => p(m.key)) },
]

export function GroupManageModal({ group, actor, perm, officialEditable, canViewAllCustomers, onClose }: GroupPanelProps & { officialEditable: boolean; canViewAllCustomers: boolean; onClose: () => void }) {
  const tabs = TABS.filter((t) => t.allow(perm))
  const [tab, setTab] = useState<TabKey>(tabs[0]?.key ?? 'basic')
  const panel = { group, actor, perm, compact: false }
  const hasMembers = tabs.some((t) => t.key === 'members')

  return (
    <Modal open onClose={onClose} title={`管理「${group.name}」`} width={MODAL_WIDTH}>
      <div className="-m-4 flex" style={{ height: BODY_HEIGHT }}>
        <nav className="w-36 shrink-0 border-r border-zinc-100 bg-zinc-50 py-2">
          {tabs.map((t) => {
            const active = t.key === tab
            const Icon = t.icon
            return (
              <button key={t.key} type="button" onClick={() => setTab(t.key)} className={clsx('flex w-full items-center gap-2 border-r-2 px-4 py-2 text-left text-[13px] transition-colors', active ? 'border-brand-600 bg-white font-medium text-brand-700' : 'border-transparent text-zinc-600 hover:bg-zinc-100')}>
                <Icon size={14} />
                {t.label}
              </button>
            )
          })}
        </nav>
        <div className="thin-scroll min-w-0 flex-1 overflow-y-auto bg-zinc-50/40 p-4">
          {tab === 'basic' && <GroupBasic {...panel} onJumpMembers={hasMembers ? () => setTab('members') : undefined} />}
          {tab === 'announcement' && <GroupAnnouncementPanel {...panel} />}
          {tab === 'pinned' && <GroupPinned {...panel} />}
          {tab === 'settings' && <GroupSettingsPanel {...panel} officialEditable={officialEditable} />}
          {tab === 'members' && <GroupMembers {...panel} canViewAll={canViewAllCustomers} />}
          {tab === 'admins' && <GroupAdmins {...panel} />}
          {tab === 'links' && <GroupInviteLinks {...panel} />}
          {tab === 'logs' && <GroupLogPanel {...panel} />}
          {tabs.length === 0 && <div className="py-10 text-center text-[13px] text-zinc-400">没有可用的管理项</div>}
        </div>
      </div>
    </Modal>
  )
}
