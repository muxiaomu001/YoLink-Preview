/**
 * 后台客户详情里的「账号管控」：重置密码、强制下线、拉黑 / 解除、全群禁言 / 解除、影子模式。
 *
 * 这些动作原来只有工作台有，管理员要处理一个闹事的客户得先去工作台、还得是那个客户
 * 主归属坐席的实操员工才点得动。后台是管理员的地盘，不该绕这一圈。
 * 确认框与提示文案取自 domain/customerControl，和工作台是同一份，不会两边说法不一致。
 */
import { useState } from 'react'
import { Ban, EyeOff, KeyRound, LogOut, MicOff } from 'lucide-react'
import type { Customer } from '@/domain/types'
import { CONTROL_COPY, MUTE_OPTIONS, muteLabel } from '@/domain/customerControl'
import { isMutedNow } from '@/domain/customerStatus'
import { fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { Button, Field, Input } from '@/ui/primitives'
import { Modal, toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-zinc-100 py-2 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <div className="text-xs font-medium text-zinc-800">{title}</div>
        <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function CustomerControlSection({ c }: { c: Customer }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [pwd, setPwd] = useState<string | null>(null)
  const [muting, setMuting] = useState(false)
  const [shadowing, setShadowing] = useState(false)
  const [shadowReason, setShadowReason] = useState('')
  const deleted = !!c.deletedAt
  const muted = isMutedNow(c)
  const blacklisted = !!c.blacklistedAt
  const shadowed = !!c.shadowModeAt

  const reset = async () => {
    const ok = await confirm({ title: `重置「${c.nickname}」的密码？`, body: CONTROL_COPY.resetPassword, okText: '生成' })
    if (!ok) return
    setPwd(s.resetCustomerPassword(c.id, admin))
  }
  const kick = async () => {
    const ok = await confirm({ title: `强制下线「${c.nickname}」？`, body: CONTROL_COPY.forceLogout, okText: '强制下线', danger: true })
    if (!ok) return
    s.forceLogoutCustomer(c.id, admin)
    toast('已强制下线，客户所有设备被登出')
  }
  const toggleBlack = async () => {
    const ok = await confirm({
      title: blacklisted ? `解除「${c.nickname}」的拉黑？` : `拉黑「${c.nickname}」？`,
      body: blacklisted ? CONTROL_COPY.blacklistOff : CONTROL_COPY.blacklistOn,
      okText: blacklisted ? '解除' : '拉黑',
      danger: !blacklisted,
    })
    if (!ok) return
    s.setCustomerBlacklist(c.id, !blacklisted, admin)
    toast(blacklisted ? '已解除拉黑' : '已拉黑，客户无法发消息')
  }
  const toggleShadow = async () => {
    if (!shadowed) {
      setShadowReason('')
      setShadowing(true)
      return
    }
    const ok = await confirm({ title: `关闭「${c.nickname}」的影子模式？`, body: CONTROL_COPY.shadowOff, okText: '关闭' })
    if (!ok) return
    s.setCustomerShadowMode(c.id, false, '', admin)
    toast('已关闭影子模式，之后发的消息恢复正常可见')
  }
  const confirmShadow = () => {
    s.setCustomerShadowMode(c.id, true, shadowReason, admin)
    setShadowing(false)
    toast('已开启影子模式，客户端无任何提示')
  }
  const mute = (hours: number | null) => {
    s.muteCustomerAll(c.id, hours, admin)
    toast(`已禁言「${c.nickname}」（所有群）${muteLabel(hours)}`)
    setMuting(false)
  }

  return (
    <section className="rounded-md border border-zinc-200 p-3">
      <h4 className="mb-1.5 text-xs font-semibold text-zinc-700">账号管控</h4>
      <Row title="重置密码" desc={c.mustChangePassword ? '客户还没用新密码登录过，仍处于待首次改密' : '生成一次性新密码，只显示一次；客户首次登录强制改'}>
        <Button size="sm" disabled={deleted} onClick={() => void reset()}>
          <KeyRound size={13} /> 重置
        </Button>
      </Row>
      <Row title="强制下线" desc={c.sessionsRevokedAt ? `上次下线于 ${fmtDateTime(c.sessionsRevokedAt)}；账号未停用，客户可重新登录` : '撤销全部登录 session，所有设备被登出。账号不停用'}>
        <Button size="sm" disabled={deleted} onClick={() => void kick()}>
          <LogOut size={13} /> 下线
        </Button>
      </Row>
      <Row title="全群禁言" desc={muted ? `禁言中${c.mutedAllUntil!.startsWith('9999-') ? '（永久）' : `，至 ${fmtDateTime(c.mutedAllUntil!)}`}；私聊不受影响` : '所有群与频道发不了言，私聊不受影响'}>
        {muted ? (
          <Button size="sm" disabled={deleted} onClick={() => mute(0)}>
            <MicOff size={13} /> 解除禁言
          </Button>
        ) : (
          <Button size="sm" disabled={deleted} onClick={() => setMuting(true)}>
            <MicOff size={13} /> 禁言
          </Button>
        )}
      </Row>
      <Row title="拉黑" desc={blacklisted ? `拉黑于 ${fmtDateTime(c.blacklistedAt!)}；所有官方号与群都发不出消息，群发自动跳过` : '所有官方号与群都发不出消息，群发自动跳过他'}>
        <Button size="sm" variant={blacklisted ? 'secondary' : 'danger'} disabled={deleted} onClick={() => void toggleBlack()}>
          <Ban size={13} /> {blacklisted ? '解除拉黑' : '拉黑'}
        </Button>
      </Row>

      <Row title="影子模式" desc={shadowed ? `开启于 ${fmtDateTime(c.shadowModeAt!)}${c.shadowModeReason ? `：${c.shadowModeReason}` : ''}；群消息只有他自己和坐席看得见` : '他发的群消息只有他自己和坐席看得见，客户端无任何提示'}>
        <Button size="sm" variant={shadowed ? 'secondary' : 'danger'} disabled={deleted} onClick={() => void toggleShadow()}>
          <EyeOff size={13} /> {shadowed ? '关闭影子' : '开启影子'}
        </Button>
      </Row>

      <Modal open={!!pwd} onClose={() => setPwd(null)} title="一次性密码" width={400} footer={<Button variant="primary" onClick={() => setPwd(null)}>我已告知客户</Button>}>
        <div className="rounded-md bg-zinc-50 px-3 py-3 text-center font-mono text-lg tracking-widest text-zinc-900">{pwd}</div>
        <p className="mt-3 text-[12px] text-amber-700">{CONTROL_COPY.password}</p>
      </Modal>

      <Modal
        open={shadowing}
        onClose={() => setShadowing(false)}
        title={`开启「${c.nickname}」的影子模式`}
        width={440}
        footer={
          <>
            <Button onClick={() => setShadowing(false)}>取消</Button>
            <Button variant="danger" onClick={confirmShadow}>
              开启影子模式
            </Button>
          </>
        }
      >
        <p className="text-[12px] leading-relaxed text-zinc-600">{CONTROL_COPY.shadowOn}</p>
        {/* 原因不是走形式：影子模式客户永远不会来申诉，只能靠这一行让后面接手的人知道当初为什么开 */}
        <div className="mt-3">
          <Field label="开启原因" hint="会写进审计记录，也会显示在客户状态上">
            <Input value={shadowReason} onChange={(e) => setShadowReason(e.target.value)} placeholder="例：多次在群里发引流链接" />
          </Field>
        </div>
      </Modal>

      <Modal open={muting} onClose={() => setMuting(false)} title={`禁言「${c.nickname}」（所有群）`} width={400}>
        <div className="grid grid-cols-2 gap-2">
          {MUTE_OPTIONS.map((o) => (
            <Button key={o.label} onClick={() => mute(o.hours)}>
              {o.label}
            </Button>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-zinc-500">{CONTROL_COPY.mute}</p>
      </Modal>
    </section>
  )
}
