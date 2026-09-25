import type { DemoState } from './types'

export function canManageEmployeeRoles(state: DemoState, staffId: string | null): boolean {
  const staff = state.staff.find((member) => member.id === staffId && member.status === 'active')
  return !!staff && !!state.roles.find((role) => role.id === staff.roleId)?.caps.includes('manage_roles')
}

export function staffRoleChangeBlocker(state: DemoState, staffId: string): string | null {
  const staff = state.staff.find((member) => member.id === staffId)
  if (staff?.roleId !== 'role_super') return null
  const superCount = state.staff.filter((member) => member.roleId === 'role_super' && member.status === 'active').length
  return superCount <= 1 ? '最后一位超级管理员不能改成其他角色' : '超级管理员不能改成其他角色'
}

export function rolePermissionsBlocker(roleId: string): string | null {
  if (roleId === 'role_super') return '超级管理员权限固定为全部，不能修改'
  if (roleId === 'role_admin') return '管理员权限固定为除管理员工角色外的全部权限'
  return null
}
