/**
 * 客户资料卡「更多」菜单：重置密码、强制下线、封禁 / 解除、群聊禁言 / 全部禁言 / 解除、注销。
 * 确认框文案取自 domain/customerControl，与管理后台客户详情里的同名动作共用一份。
 * 危险项红字，二次确认保留。每项的可用性都有依据：主归属坐席的实操员工、员工角色能力 delete_user。
 */
import { useState } from 'react'
import { Ban, KeyRound, LogOut, MicOff, UserX } from 'lucide-react'
import type { Customer } from '@/domain/types'
import { CONTROL_COPY, MUTE_OPTIONS, muteLabel } from '@/domain/customerControl'
import { isAllGroupsMutedNow, isGlobalMutedNow } from '@/domain/customerStatus'
import { primarySeatOfCustomer } from '@/store/selectors'
import { Button } from '@/ui/primitives'
import { Modal, toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { useWorkbench } from '../useWorkbench'
import { MenuItem, PopoverPanel } from './customer/Popover'

export function CustomerActions({ c, open, onClose }: { c: Customer; open: boolean; onClose: () => void }) {
  const { s, staff, can } = useWorkbench()
  const [pwd, setPwd] = useState<string | null>(null)
  const [muting, setMuting] = useState<'allGroups' | 'global' | null>(null)
  if (!staff) return null
  const primary = primarySeatOfCustomer(s, c.id)
  const canReset = primary?.operatorStaffId === staff.id
  const canDelete = can('delete_user')
  const allGroupsMuted = isAllGroupsMutedNow(c)
  const globallyMuted = isGlobalMutedNow(c)
  const banned = !!c.bannedAt

  const reset = async () => {
    onClose()
    const ok = await confirm({ title: `重置「${c.nickname}」的密码？`, body: CONTROL_COPY.resetPassword, okText: '生成' })
    if (!ok) return
    setPwd(s.resetCustomerPassword(c.id, staff.id))
  }
  const kick = async () => {
    onClose()
    const ok = await confirm({ title: `强制下线「${c.nickname}」？`, body: CONTROL_COPY.forceLogout, okText: '强制下线', danger: true })
    if (!ok) return
    s.forceLogoutCustomer(c.id, staff.id)
    toast('已强制下线，客户所有设备被登出')
  }
  const toggleBan = async () => {
    onClose()
    const ok = await confirm({
      title: banned ? `解除「${c.nickname}」的封禁？` : `封禁「${c.nickname}」？`,
      body: banned ? CONTROL_COPY.banOff : CONTROL_COPY.banOn,
      okText: banned ? '解除' : '封禁',
      danger: !banned,
    })
    if (!ok) return
    s.setCustomerBan(c.id, !banned, staff.id)
    toast(banned ? '已解除封禁' : '已封禁，客户无法登录')
  }
  const mute = (kind: 'allGroups' | 'global', hours: number | null) => {
    if (kind === 'allGroups') s.muteCustomerAllGroups(c.id, hours, staff.id)
    else s.muteCustomerGlobally(c.id, hours, staff.id)
    toast(`已${kind === 'allGroups' ? '群聊禁言' : '全部禁言'}「${c.nickname}」${muteLabel(hours)}`)
    setMuting(null)
  }
  const unmute = (kind: 'allGroups' | 'global') => {
    onClose()
    if (kind === 'allGroups') s.muteCustomerAllGroups(c.id, 0, staff.id)
    else s.muteCustomerGlobally(c.id, 0, staff.id)
    toast(`已解除${kind === 'allGroups' ? '群聊禁言' : '全部禁言'}`)
  }
  const del = async () => {
    onClose()
    const ok = await confirm({ title: `注销「${c.nickname}」（${c.accountId}）？`, body: CONTROL_COPY.delete, okText: '注销', danger: true })
    if (!ok) return
    s.deleteCustomer(c.id, staff.id)
    toast('已注销，数据保留')
  }

  return (
    <>
      {open && (
        <PopoverPanel align="right" width={184} className="py-1">
          <MenuItem disabled={!canReset} title={canReset ? '生成一次性新密码' : `只有主归属坐席「${primary?.displayName ?? '无'}」的实操员工可以重置`} onClick={() => void reset()}>
            <KeyRound size={14} /> 重置密码
          </MenuItem>
          <MenuItem title="让该客户的所有设备退出登录" onClick={() => void kick()}>
            <LogOut size={14} /> 强制下线
          </MenuItem>
          {allGroupsMuted ? (
            <MenuItem onClick={() => unmute('allGroups')}>
              <MicOff size={14} /> 解除群聊禁言
            </MenuItem>
          ) : (
            <MenuItem
              onClick={() => {
                onClose()
                setMuting('allGroups')
              }}
            >
              <MicOff size={14} /> 群聊禁言
            </MenuItem>
          )}
          {globallyMuted ? (
            <MenuItem onClick={() => unmute('global')}>
              <MicOff size={14} /> 解除全部禁言
            </MenuItem>
          ) : (
            <MenuItem
              onClick={() => {
                onClose()
                setMuting('global')
              }}
            >
              <MicOff size={14} /> 全部禁言
            </MenuItem>
          )}
          <div className="my-1 border-t border-zinc-100" />
          <MenuItem danger={!banned} onClick={() => void toggleBan()}>
            <Ban size={14} /> {banned ? '解除封禁' : '封禁'}
          </MenuItem>
          <MenuItem danger disabled={!canDelete} title={canDelete ? '注销客户账号' : '需员工角色能力 delete_user'} onClick={() => void del()}>
            <UserX size={14} /> 注销账号
          </MenuItem>
        </PopoverPanel>
      )}

      <Modal open={!!pwd} onClose={() => setPwd(null)} title="一次性密码" width={400} footer={<Button variant="primary" onClick={() => setPwd(null)}>我已告知客户</Button>}>
        <div className="rounded-md bg-zinc-50 px-3 py-3 text-center font-mono text-lg tracking-widest text-zinc-900">{pwd}</div>
        <p className="mt-3 text-[12px] text-amber-700">{CONTROL_COPY.password}</p>
      </Modal>

      <Modal open={!!muting} onClose={() => setMuting(null)} title={`${muting === 'allGroups' ? '群聊禁言' : '全部禁言'}「${c.nickname}」`} width={400}>
        <div className="grid grid-cols-2 gap-2">
          {MUTE_OPTIONS.map((o) => (
            <Button key={o.label} onClick={() => muting && mute(muting, o.hours)}>
              {o.label}
            </Button>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-zinc-500">{muting === 'allGroups' ? CONTROL_COPY.muteAllGroups : CONTROL_COPY.muteGlobal}</p>
      </Modal>
    </>
  )
}
