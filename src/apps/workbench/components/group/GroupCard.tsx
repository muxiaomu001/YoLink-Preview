/**
 * 群信息卡（组合）：工作台右栏与管理后台群管理页共用。
 * 顶部一行说明"你在本群的身份"，其后依次是基础信息、公告、置顶、群设置、成员、邀请链接、管理员日志。
 * 权限判定全部由 perm() 注入：工作台用 seatGroupPerm，管理后台恒 true。
 */
import { groupRoleOf } from '@/store/policy'
import { GroupAnnouncementPanel } from './GroupAnnouncementPanel'
import { GroupBasic } from './GroupBasic'
import { GroupInviteLinks } from './GroupInviteLinks'
import { GroupLogPanel } from './GroupLogPanel'
import { GroupMembers } from './GroupMembers'
import { GroupPinned } from './GroupPinned'
import { GroupSettingsPanel } from './GroupSettingsPanel'
import { PERM_META, type GroupPanelProps } from './shared'

export interface GroupCardProps extends GroupPanelProps {
  /** 官方群标记能不能改：员工角色 manage_groups 或管理后台 */
  officialEditable?: boolean
  /** 批量拉人里"全部客户"范围：员工角色 view_all_customers 或管理后台 */
  canViewAllCustomers?: boolean
  /** 顶部身份行的补充说明（例如管理后台："以群主坐席身份操作"） */
  identityNote?: string
}

export function GroupCard({ group, actor, perm, compact, officialEditable = false, canViewAllCustomers = false, identityNote }: GroupCardProps) {
  const role = groupRoleOf(group, 'seat', actor.seatId)
  const granted = PERM_META.filter((p) => perm(p.key))
  const allGranted = granted.length === PERM_META.length
  const roleText = role === 'owner' ? '群主（全部权限）' : role === 'admin' ? `管理员（权限：${granted.map((p) => p.label).join('、') || '无'}）` : role === 'member' ? (allGranted ? '成员，但员工角色有「管理所有群」，拥有全部权限' : '成员（没有管理权限）') : allGranted ? '不在群里，以管理身份操作（全部权限）' : '不在群里'
  const panel = { group, actor, perm, compact }

  return (
    <div className={compact ? '' : 'space-y-4'}>
      <div className={compact ? 'border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-[11px] text-zinc-600' : 'rounded-md border border-brand-100 bg-brand-50/60 px-3 py-2 text-xs text-brand-900'}>
        <span className="font-medium">你在本群的身份：</span>
        {roleText}
        {identityNote && <span className="ml-1 text-zinc-500">· {identityNote}</span>}
      </div>
      <GroupBasic {...panel} />
      <GroupAnnouncementPanel {...panel} />
      <GroupPinned {...panel} />
      <GroupSettingsPanel {...panel} officialEditable={officialEditable} />
      <GroupMembers {...panel} canViewAll={canViewAllCustomers} />
      <GroupInviteLinks {...panel} />
      <GroupLogPanel {...panel} />
    </div>
  )
}
