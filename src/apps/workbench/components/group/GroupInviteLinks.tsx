/**
 * 群邀请链接：主链接（复制 / 撤销并重新生成）、附加链接（名称、过期、人数上限）列表与撤销。
 * 走「邀请用户」权限。与注册用的邀请链接不是一回事。
 */
import { useState } from 'react'
import { Copy, RefreshCw } from 'lucide-react'
import type { GroupInviteLink } from '@/domain/types'
import { fmtDate } from '@/domain/time'
import { useStore } from '@/store/store'
import { Pill } from '@/ui/display'
import { Button, Field, Input, Select } from '@/ui/primitives'
import { Modal, toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { copyText, GROUP_LINK_BASE, LINK_EXPIRY_OPTIONS, Section, type GroupPanelProps } from './shared'

const MAX_USES_LIMIT = 99999

function statusOf(l: GroupInviteLink, nowIso: string): { text: string; tone: 'green' | 'zinc' | 'red' | 'amber' } {
  if (l.status === 'revoked') return { text: '已撤销', tone: 'zinc' }
  if (l.status === 'expired' || (l.expiresAt && l.expiresAt < nowIso)) return { text: '已过期', tone: 'red' }
  if (l.maxUses != null && l.uses >= l.maxUses) return { text: '已满', tone: 'amber' }
  return { text: '有效', tone: 'green' }
}

export function GroupInviteLinks({ group: g, actor, perm, compact }: GroupPanelProps) {
  const s = useStore()
  const canInvite = perm('can_invite_users')
  const [creating, setCreating] = useState(false)
  const nowIso = new Date().toISOString()
  const main = g.inviteLinks.find((l) => l.main && l.status === 'active')
  const extras = g.inviteLinks.filter((l) => !l.main)

  const copy = async (code: string) => {
    toast((await copyText(GROUP_LINK_BASE + code)) ? '链接已复制' : '复制失败：浏览器不允许访问剪贴板', 'info')
  }
  const regenerate = async () => {
    const ok = await confirm({ title: '撤销并重新生成主链接？', body: '旧主链接立即失效，已经拿到旧链接的人无法再加入；新链接需要重新分发。', okText: '重新生成', danger: true })
    if (!ok) return
    s.regenerateGroupMainLink(g.id, actor)
    toast('主链接已重新生成，旧链接已失效')
  }
  const revoke = async (l: GroupInviteLink) => {
    const ok = await confirm({ title: `撤销链接「${l.name}」？`, body: '撤销后该链接不能再加入，已加入的成员不受影响。', okText: '撤销', danger: true })
    if (!ok) return
    s.revokeGroupInviteLink(g.id, l.id, actor)
    toast(`已撤销「${l.name}」`)
  }

  return (
    <Section
      title="邀请链接"
      compact={compact}
      locked={!canInvite}
      lockedReason="需要「邀请用户」权限"
      extra={<Button size="sm" variant="ghost" onClick={() => setCreating(true)}>生成新链接</Button>}
    >
      <div className="rounded-md border border-zinc-200 px-2.5 py-2">
        <div className="text-[10px] text-zinc-400">主链接 · 永久 · 已加入 {main?.uses ?? 0} 人</div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <code className="min-w-0 flex-1 truncate text-[11px] text-zinc-800">{main ? GROUP_LINK_BASE + main.code : '（主链接已撤销）'}</code>
          {main && (
            <button type="button" title="复制链接" className="text-zinc-400 hover:text-brand-700" onClick={() => void copy(main.code)}>
              <Copy size={12} />
            </button>
          )}
          <button type="button" title="撤销并重新生成" className="text-zinc-400 hover:text-red-700" onClick={() => void regenerate()}>
            <RefreshCw size={12} />
          </button>
        </div>
      </div>
      <div className="mt-2.5 text-[10px] font-medium text-zinc-500">附加链接（{extras.length}）</div>
      {!extras.length && <div className="text-[11px] text-zinc-400">没有附加链接。每条可设名称、过期时间、人数上限。</div>}
      <ul className="mt-1 divide-y divide-zinc-100">
        {extras.map((l) => {
          const st = statusOf(l, nowIso)
          return (
            <li key={l.id} className="flex items-center gap-2 py-1.5 text-[11px]">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium text-zinc-800">{l.name}</span>
                  <Pill tone={st.tone}>{st.text}</Pill>
                </div>
                <div className="text-[10px] text-zinc-400">
                  {l.expiresAt ? `${fmtDate(l.expiresAt)} 过期` : '永久'} · 已用 {l.uses}/{l.maxUses ?? '不限'} · <code>{l.code}</code>
                </div>
              </div>
              {st.text === '有效' && (
                <>
                  <button type="button" title="复制链接" className="text-zinc-400 hover:text-brand-700" onClick={() => void copy(l.code)}>
                    <Copy size={12} />
                  </button>
                  <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[11px] text-red-700" onClick={() => void revoke(l)}>撤销</Button>
                </>
              )}
            </li>
          )
        })}
      </ul>
      {creating && <CreateLinkModal group={g} actor={actor} onClose={() => setCreating(false)} />}
    </Section>
  )
}

function CreateLinkModal({ group: g, actor, onClose }: Pick<GroupPanelProps, 'group' | 'actor'> & { onClose: () => void }) {
  const s = useStore()
  const [name, setName] = useState('')
  const [expiryIdx, setExpiryIdx] = useState(1)
  const [maxUses, setMaxUses] = useState('')
  const nameOk = name.trim().length > 0 && name.trim().length <= 32
  const maxNum = maxUses.trim() === '' ? null : Number(maxUses)
  const maxOk = maxNum == null || (Number.isInteger(maxNum) && maxNum >= 1 && maxNum <= MAX_USES_LIMIT)
  const submit = () => {
    const days = LINK_EXPIRY_OPTIONS[expiryIdx].days
    const link = s.createGroupInviteLink(g.id, { name: name.trim(), expiresAt: days == null ? null : new Date(Date.now() + days * 86400000).toISOString(), maxUses: maxNum }, actor)
    toast(`已生成链接「${link.name}」：${GROUP_LINK_BASE}${link.code}`)
    onClose()
  }
  return (
    <Modal open onClose={onClose} title="生成附加链接" width={420} footer={<><Button onClick={onClose}>取消</Button><Button variant="primary" disabled={!nameOk || !maxOk} onClick={submit}>生成</Button></>}>
      <div className="space-y-3">
        <Field label="链接名称" required hint="用来区分渠道，例如「9 月直播间」">
          <Input value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="过期时间">
          <Select value={String(expiryIdx)} onChange={(e) => setExpiryIdx(Number(e.target.value))}>
            {LINK_EXPIRY_OPTIONS.map((o, i) => <option key={o.label} value={i}>{o.label}</option>)}
          </Select>
        </Field>
        <Field label="人数上限" hint={`1 到 ${MAX_USES_LIMIT}，空为不限`}>
          <Input value={maxUses} inputMode="numeric" onChange={(e) => setMaxUses(e.target.value)} placeholder="不限" />
        </Field>
        {!maxOk && <div className="text-xs text-red-600">人数上限必须是 1 到 {MAX_USES_LIMIT} 的整数。</div>}
      </div>
    </Modal>
  )
}
