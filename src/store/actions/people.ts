/**
 * 员工账号（编辑、重置密码、强制下线）与员工角色。
 */
import type { Role, Staff } from '@/domain/types'
import { newId } from '@/domain/ids'
import { type Get, type Set, now, randomPassword, withAudit } from './helpers'

export interface PeopleActions {
  updateStaff: (id: string, patch: Partial<Pick<Staff, 'name' | 'email' | 'roleId'>>, byStaffId: string) => void
  /** 随机生成返回明文一次；手动设置返回 undefined */
  resetPassword: (id: string, input: { mode: 'random' } | { mode: 'manual'; password: string; mustChange: boolean }, byStaffId: string) => string | undefined
  forceLogout: (id: string, byStaffId: string) => void
  createRole: (input: { name: string; desc: string; caps: Role['caps'] }, byStaffId: string) => Role
  updateRole: (id: string, patch: Partial<Pick<Role, 'name' | 'desc' | 'caps'>>, byStaffId: string) => void
  /** 内置角色或还有成员的角色不能删，返回 false */
  deleteRole: (id: string, byStaffId: string) => boolean
}

export function peopleActions(set: Set, get: Get): PeopleActions {
  return {
    updateStaff: (id, patch, byStaffId) =>
      set((s) => {
        const st = s.staff.find((x) => x.id === id)
        const roleName = patch.roleId ? s.roles.find((r) => r.id === patch.roleId)?.name : undefined
        return {
          staff: s.staff.map((x) => (x.id === id ? { ...x, ...patch } : x)),
          audit: withAudit(s.audit, 'staff.update', `修改员工 ${st?.name}：${Object.keys(patch).join('、')}${roleName ? `（角色 → ${roleName}）` : ''}`, byStaffId),
        }
      }),

    resetPassword: (id, input, byStaffId) => {
      const s = get()
      const st = s.staff.find((x) => x.id === id)
      const generated = input.mode === 'random' ? randomPassword() : undefined
      const mustChange = input.mode === 'random' ? true : input.mustChange
      set({
        staff: s.staff.map((x) => (x.id === id ? { ...x, mustChangePassword: mustChange } : x)),
        audit: withAudit(s.audit, 'staff.reset_password', `重置员工 ${st?.name} 的密码（${input.mode === 'random' ? '随机生成，首次登录强制修改' : `手动设置${mustChange ? '，下次登录必须修改' : ''}`}）`, byStaffId),
      })
      return generated
    },

    forceLogout: (id, byStaffId) =>
      set((s) => {
        const st = s.staff.find((x) => x.id === id)
        return {
          staff: s.staff.map((x) => (x.id === id ? { ...x, sessionsRevokedAt: now() } : x)),
          audit: withAudit(s.audit, 'staff.force_logout', `强制下线 ${st?.name}：撤销全部登录 session 与 token`, byStaffId),
        }
      }),

    createRole: (input, byStaffId) => {
      const role: Role = { id: newId('role'), name: input.name, desc: input.desc, builtin: false, caps: input.caps }
      set((s) => ({ roles: [...s.roles, role], audit: withAudit(s.audit, 'role.create', `创建角色「${role.name}」，${role.caps.length} 项权限`, byStaffId) }))
      return role
    },

    updateRole: (id, patch, byStaffId) =>
      set((s) => {
        const r = s.roles.find((x) => x.id === id)
        return {
          roles: s.roles.map((x) => (x.id === id ? { ...x, ...patch } : x)),
          audit: withAudit(s.audit, 'role.update', `修改角色「${r?.name}」：${Object.keys(patch).join('、')}${patch.caps ? `（${patch.caps.length} 项权限）` : ''}`, byStaffId),
        }
      }),

    deleteRole: (id, byStaffId) => {
      const s = get()
      const r = s.roles.find((x) => x.id === id)
      if (!r || r.builtin || s.staff.some((x) => x.roleId === id)) return false
      set({ roles: s.roles.filter((x) => x.id !== id), audit: withAudit(s.audit, 'role.delete', `删除角色「${r.name}」`, byStaffId) })
      return true
    },
  }
}
