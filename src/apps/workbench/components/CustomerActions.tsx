/**
 * 客户资料卡「更多」菜单：重置密码、拉黑 / 解除、禁言（所有群）/ 解除、注销。
 * 危险项红字，二次确认保留。每项的可用性都有依据：主归属坐席的实操员工、员工角色能力 delete_user。
 */
import { useState } from 'react'
import { Ban, KeyRound, MicOff, UserX } from 'lucide-react'
import type { Customer } from '@/domain/types'
import { primarySeatOfCustomer } from '@/store/selectors'
import { Button } from '@/ui/primitives'
import { Modal, toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { useWorkbench } from '../useWorkbench'
import { MenuItem, PopoverPanel } from './customer/Popover'

const MUTE_OPTIONS: { label: string; hours: number | null }[] = [
  { label: '1 小时', hours: 1 },
  { label: '24 小时', hours: 24 },
  { label: '7 天', hours: 168 },
  { label: '永久', hours: null },
]

export function CustomerActions({ c, open, onClose }: { c: Customer; open: boolean; onClose: () => void }) {
  const { s, staff, can } = useWorkbench()
  const [pwd, setPwd] = useState<string | null>(null)
  const [muting, setMuting] = useState(false)
  if (!staff) return null
  const primary = primarySeatOfCustomer(s, c.id)
  const canReset = primary?.operatorStaffId === staff.id
  const canDelete = can('delete_user')
  const muted = !!c.mutedAllUntil && c.mutedAllUntil > new Date().toISOString()
  const blacklisted = !!c.blacklistedAt

  const reset = async () => {
    onClose()
    const ok = await confirm({ title: `重置「${c.nickname}」的密码？`, body: '生成一次性新密码，只显示一次；客户首次登录强制修改。此操作记审计。', okText: '生成' })
    if (!ok) return
    setPwd(s.resetCustomerPassword(c.id, staff.id))
  }
  const toggleBlack = async () => {
    onClose()
    const ok = await confirm({
      title: blacklisted ? `解除「${c.nickname}」的拉黑？` : `拉黑「${c.nickname}」？`,
      body: blacklisted ? '解除后客户可以重新发消息。' : '拉黑后客户在所有官方号与群里都发不出消息，群发也会自动跳过他。',
      okText: blacklisted ? '解除' : '拉黑',
      danger: !blacklisted,
    })
    if (!ok) return
    s.setCustomerBlacklist(c.id, !blacklisted, staff.id)
    toast(blacklisted ? '已解除拉黑' : '已拉黑，客户无法发消息')
  }
  const mute = (hours: number | null) => {
    s.muteCustomerAll(c.id, hours, staff.id)
    toast(`已禁言「${c.nickname}」（所有群）${hours == null ? '永久' : `${hours} 小时`}`)
    setMuting(false)
  }
  const unmute = () => {
    onClose()
    s.muteCustomerAll(c.id, 0, staff.id)
    toast('已解除全群禁言')
  }
  const del = async () => {
    onClose()
    const ok = await confirm({ title: `注销「${c.nickname}」（${c.accountId}）？`, body: '账号不再出现在工作台，从所有群移出；数据保留供审计。此操作不可撤销。', okText: '注销', danger: true })
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
          {muted ? (
            <MenuItem onClick={unmute}>
              <MicOff size={14} /> 解除全群禁言
            </MenuItem>
          ) : (
            <MenuItem
              onClick={() => {
                onClose()
                setMuting(true)
              }}
            >
              <MicOff size={14} /> 禁言（所有群）
            </MenuItem>
          )}
          <div className="my-1 border-t border-zinc-100" />
          <MenuItem danger={!blacklisted} onClick={() => void toggleBlack()}>
            <Ban size={14} /> {blacklisted ? '解除拉黑' : '拉黑'}
          </MenuItem>
          <MenuItem danger disabled={!canDelete} title={canDelete ? '注销客户账号' : '需员工角色能力 delete_user'} onClick={() => void del()}>
            <UserX size={14} /> 注销账号
          </MenuItem>
        </PopoverPanel>
      )}

      <Modal open={!!pwd} onClose={() => setPwd(null)} title="一次性密码" width={400} footer={<Button variant="primary" onClick={() => setPwd(null)}>我已告知客户</Button>}>
        <div className="rounded-md bg-zinc-50 px-3 py-3 text-center font-mono text-lg tracking-widest text-zinc-900">{pwd}</div>
        <p className="mt-3 text-[12px] text-amber-700">只显示这一次，关闭后不能再查看。客户用它登录后会被强制修改密码。</p>
      </Modal>

      <Modal open={muting} onClose={() => setMuting(false)} title={`禁言「${c.nickname}」（所有群）`} width={400}>
        <div className="grid grid-cols-2 gap-2">
          {MUTE_OPTIONS.map((o) => (
            <Button key={o.label} onClick={() => mute(o.hours)}>
              {o.label}
            </Button>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-zinc-500">禁言期间客户在任何群与频道都发不了言，私聊不受影响。单个群的禁言在群信息卡里做。</p>
      </Modal>
    </>
  )
}
