/**
 * 客户资料卡底部固定操作区：重置密码、拉黑 / 解除、禁言（所有群）、注销（P1）。
 * 每个按钮的可见性都有依据：主归属坐席的实操员工、员工角色能力 delete_user。
 */
import { useState } from 'react'
import { Ban, KeyRound, MicOff, UserX } from 'lucide-react'
import type { Customer } from '@/domain/types'
import { fmtDateTime } from '@/domain/time'
import { primarySeatOfCustomer } from '@/store/selectors'
import { Button } from '@/ui/primitives'
import { Note, Pill } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { useWorkbench } from '../useWorkbench'

const MUTE_OPTIONS: { label: string; hours: number | null }[] = [
  { label: '1 小时', hours: 1 },
  { label: '24 小时', hours: 24 },
  { label: '7 天', hours: 168 },
  { label: '永久', hours: null },
]

/** muteCustomerAll 用这个年份表示永久 */
const FOREVER_PREFIX = '9999-'

export function CustomerActions({ c }: { c: Customer }) {
  const { s, staff, can } = useWorkbench()
  const [pwd, setPwd] = useState<string | null>(null)
  const [muting, setMuting] = useState(false)
  if (!staff) return null
  const primary = primarySeatOfCustomer(s, c.id)
  const canReset = primary?.operatorStaffId === staff.id
  const muted = !!c.mutedAllUntil && c.mutedAllUntil > new Date().toISOString()
  const blacklisted = !!c.blacklistedAt

  const reset = async () => {
    const ok = await confirm({ title: `重置「${c.nickname}」的密码？`, body: '生成一次性新密码，只显示一次；客户首次登录强制修改。此操作记审计。', okText: '生成' })
    if (!ok) return
    setPwd(s.resetCustomerPassword(c.id, staff.id))
  }
  const toggleBlack = async () => {
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
    s.muteCustomerAll(c.id, 0, staff.id)
    toast('已解除全群禁言')
  }
  const del = async () => {
    const ok = await confirm({ title: `注销「${c.nickname}」（${c.accountId}）？`, body: '账号不再出现在工作台，从所有群移出；数据保留供审计。此操作不可撤销。', okText: '注销', danger: true })
    if (!ok) return
    s.deleteCustomer(c.id, staff.id)
    toast('已注销，数据保留')
  }

  return (
    <div className="sticky bottom-0 border-t border-zinc-200 bg-white px-4 py-3">
      {(blacklisted || muted || c.mustChangePassword) && (
        <div className="mb-2 flex flex-wrap gap-1">
          {blacklisted && <Pill tone="red">已拉黑 {fmtDateTime(c.blacklistedAt!)}</Pill>}
          {muted && <Pill tone="amber">全群禁言{c.mutedAllUntil!.startsWith(FOREVER_PREFIX) ? '（永久）' : `至 ${fmtDateTime(c.mutedAllUntil!)}`}</Pill>}
          {c.mustChangePassword && <Pill>待首次改密</Pill>}
        </div>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        <Button size="sm" disabled={!canReset} title={canReset ? '生成一次性新密码' : `只有主归属坐席「${primary?.displayName ?? '无'}」的实操员工可以重置`} onClick={() => void reset()}>
          <KeyRound size={12} /> 重置密码
        </Button>
        <Button size="sm" variant={blacklisted ? 'secondary' : 'danger'} onClick={() => void toggleBlack()}>
          <Ban size={12} /> {blacklisted ? '解除拉黑' : '拉黑'}
        </Button>
        {muted ? (
          <Button size="sm" onClick={unmute}>
            <MicOff size={12} /> 解除禁言
          </Button>
        ) : (
          <Button size="sm" onClick={() => setMuting(true)}>
            <MicOff size={12} /> 禁言（所有群）
          </Button>
        )}
        <Button size="sm" variant="danger" disabled={!can('delete_user')} title={can('delete_user') ? '注销客户账号（P1）' : '需员工角色能力 delete_user'} onClick={() => void del()}>
          <UserX size={12} /> 注销 <Pill>P1</Pill>
        </Button>
      </div>

      <Modal open={!!pwd} onClose={() => setPwd(null)} title="一次性密码" width={400} footer={<Button variant="primary" onClick={() => setPwd(null)}>我已告知客户</Button>}>
        <div className="rounded-md bg-zinc-50 px-3 py-3 text-center font-mono text-lg tracking-widest text-zinc-900">{pwd}</div>
        <Note tone="amber">只显示这一次，关闭后不能再查看。客户用它登录后会被强制修改密码。</Note>
      </Modal>

      <Modal open={muting} onClose={() => setMuting(false)} title={`禁言「${c.nickname}」（所有群）`} width={400}>
        <div className="grid grid-cols-2 gap-2">
          {MUTE_OPTIONS.map((o) => (
            <Button key={o.label} onClick={() => mute(o.hours)}>
              {o.label}
            </Button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-zinc-400">禁言期间客户在任何群与频道都发不了言，私聊不受影响。单个群的禁言在群信息卡里做。</p>
      </Modal>
    </div>
  )
}
