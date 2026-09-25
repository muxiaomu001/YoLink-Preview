/**
 * 「我的」页的子页：个人资料、外观、通知、以及若干说明型页面。每个入口的可见性在 MeScreen 里按策略判。
 */
import { useState } from 'react'
import type { ThemeKey } from '@/domain/types'
import { THEME_LABEL } from '@/domain/labels'
import { useStore } from '@/store/store'
import { customerById } from '@/store/selectors'
import { customerCan } from '@/store/policy'
import { NICKNAME_MAX, NICKNAME_MIN } from '@/domain/register'
import { Avatar, SeatAvatar, TitleChip } from '@/ui/display'
import { Button, Input, Switch } from '@/ui/primitives'
import { toast } from '@/ui/overlay'
import { demoToast } from '@/ui/DemoNote'
import { DemoHint, LevelTag, Row, ScreenHeader, SectionLabel } from '../parts'

export function ProfileScreen({ customerId, onBack }: { customerId: string; onBack: () => void }) {
  const s = useStore()
  const c = customerById(s, customerId)!
  const canEdit = customerCan(s, customerId, 'account.edit_profile')
  const [nick, setNick] = useState(c.nickname)
  const titles = c.titleIds.map((id) => s.titles.find((t) => t.id === id && t.enabled)).filter((t) => !!t)
  const valid = nick.trim().length >= NICKNAME_MIN && nick.trim().length <= NICKNAME_MAX
  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <ScreenHeader onBack={onBack} title="个人资料" />
      <div className="flex flex-col items-center bg-white py-4">
        <Avatar text={c.nickname} color={c.avatarUpdatedAt ? '#2563eb' : undefined} size={64} />
        {c.nicknameAuto && <p className="mt-2 px-6 text-center text-[10px] text-zinc-400">当前昵称是注册时系统发的，改成你自己的名字客服更好认。</p>}
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              s.updateCustomerAvatar(customerId)
              toast('头像已更新')
            }}
            className="mt-1 text-[11px] text-brand-700"
          >
            更换头像
          </button>
        )}
      </div>
      <div className="mt-2 bg-white">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-2.5 text-[13px]">
          <span className="w-16 text-zinc-600">昵称</span>
          {canEdit ? <Input value={nick} onChange={(e) => setNick(e.target.value)} className="h-8 flex-1" maxLength={NICKNAME_MAX} /> : <span className="flex-1 text-right text-zinc-900">{c.nickname}</span>}
        </div>
        <Row label="账号 ID" value={c.accountId} hint="注册时生成，不可修改" />
        <Row label="用户名" value={c.phone ?? c.accountId} hint="注册时填写或即手机号，不可修改" />
        <Row
          label="头衔"
          value={
            titles.length ? (
              <span className="inline-flex flex-wrap justify-end gap-1">
                {titles.map((t) => (
                  <TitleChip key={t.id} title={t} size="xs" />
                ))}
              </span>
            ) : (
              '无'
            )
          }
          hint="企业发的，不可编辑、不可隐藏"
        />
        <Row label="手机号" level="P2" value={c.phone ?? '未填写'} hint="当前不支持绑定或更换" />
        <Row label="邮箱" level="P2" value={c.email ?? '未绑定'} />
      </div>
      <div className="px-4 py-3">
        {canEdit ? (
          <>
            {!valid && <p className="mb-1 text-[11px] text-red-600">昵称 {NICKNAME_MIN} 到 {NICKNAME_MAX} 字符</p>}
            <Button
              variant="primary"
              className="h-9 w-full"
              disabled={!valid || nick.trim() === c.nickname}
              onClick={() => {
                // 改昵称是真写回去的：软引导刚把客户领到这一页，这里再假保存就是自己拆自己的台
                const r = s.renameCustomer(customerId, nick)
                toast(r.ok ? '昵称已更新' : (r.error ?? '保存失败'), r.ok ? 'ok' : 'warn')
              }}
            >
              保存
            </Button>
          </>
        ) : (
          <DemoHint>企业策略未开放修改昵称与头像，所以这里只读（account.edit_profile）。</DemoHint>
        )}
      </div>
    </div>
  )
}

export function BlockedListScreen({ customerId, onBack }: { customerId: string; onBack: () => void }) {
  const s = useStore()
  const c = customerById(s, customerId)!
  const canBlock = customerCan(s, customerId, 'friend.block')
  const blocked = c.blockedSeatIds.map((id) => s.seats.find((seat) => seat.id === id)).filter((seat): seat is NonNullable<typeof seat> => !!seat)

  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <ScreenHeader onBack={onBack} title="阻止列表" />
      <SectionLabel>已阻止的官方联系人</SectionLabel>
      <div className="bg-white">
        {blocked.length === 0 && <p className="px-4 py-4 text-sm text-zinc-400">还没有阻止任何官方联系人</p>}
        {blocked.map((seat) => (
          <div key={seat.id} className="flex items-center gap-3 border-b border-zinc-100 px-4 py-2.5 last:border-0">
            <SeatAvatar seat={seat} size={36} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] text-zinc-900">{seat.displayName}</div>
              <div className="truncate text-[11px] text-zinc-500">官方</div>
            </div>
            <button type="button" className="text-[12px] text-brand-700" onClick={() => { const result = s.customerBlockSeat(customerId, seat.id, false); toast(result.ok ? '已解除拉黑' : (result.reason ?? '操作失败'), result.ok ? 'ok' : 'warn') }}>解除</button>
          </div>
        ))}
      </div>
      {!canBlock && blocked.length === 0 && <div className="px-4 py-3"><DemoHint>当前企业未开放阻止官方联系人的功能。</DemoHint></div>}
    </div>
  )
}

export function AppearanceScreen({ customerId, onBack }: { customerId: string; onBack: () => void }) {
  const s = useStore()
  const canTheme = customerCan(s, customerId, 'appearance.change_theme')
  const canDark = customerCan(s, customerId, 'appearance.dark_mode')
  const [theme, setTheme] = useState<ThemeKey>(s.enterprise.defaultTheme)
  const [dark, setDark] = useState<'off' | 'system' | 'schedule' | 'on'>('off')
  const themes = s.enterprise.allowedThemes
  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <ScreenHeader onBack={onBack} title="外观" />
      <SectionLabel>主题（企业允许 {themes.length} 款）</SectionLabel>
      <div className="bg-white">
        {themes.map((t) => (
          <button key={t} type="button" disabled={!canTheme} onClick={() => setTheme(t)} className="flex w-full items-center justify-between border-b border-zinc-100 px-4 py-2.5 text-[13px] last:border-0 disabled:opacity-60">
            <span className="text-zinc-800">{THEME_LABEL[t] ?? t}</span>
            <span className={theme === t ? 'text-brand-700' : 'text-zinc-300'}>{theme === t ? '✓ 使用中' : ''}</span>
          </button>
        ))}
      </div>
      {!canTheme && (
        <div className="px-4 pt-2">
          <DemoHint>企业策略未开放切换主题，只能用企业默认主题「{THEME_LABEL[s.enterprise.defaultTheme]}」（appearance.change_theme）。</DemoHint>
        </div>
      )}
      {canDark ? (
        <>
          <SectionLabel>明暗模式</SectionLabel>
          <div className="bg-white">
            {(
              [
                ['off', '关闭'],
                ['system', '跟随系统'],
                ['schedule', '定时自动'],
                ['on', '始终暗色'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setDark(k)} className="flex w-full items-center justify-between border-b border-zinc-100 px-4 py-2.5 text-[13px] last:border-0">
                <span className="text-zinc-800">
                  {label}
                  {k === 'schedule' && <LevelTag level="P1" />}
                </span>
                <span className="text-brand-700">{dark === k ? '✓' : ''}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="px-4 pt-2">
          <DemoHint>企业策略未开放暗色模式，入口不显示（appearance.dark_mode）。</DemoHint>
        </div>
      )}
      <SectionLabel>聊天外观</SectionLabel>
      <div className="bg-white">
        <Row label="文字大小" level="P1" value="100%" onClick={() => demoToast('调整文字大小')} />
        <Row label="聊天背景" level="P1" value="纯色" onClick={() => demoToast('更换聊天背景')} />
      </div>
    </div>
  )
}

export function NotificationScreen({ onBack }: { onBack: () => void }) {
  const [v, setV] = useState({ dm: true, group: true, channel: true, preview: true, mentionException: true })
  const toggle = (k: keyof typeof v) => (on: boolean) => setV((x) => ({ ...x, [k]: on }))
  const line = (label: string, k: keyof typeof v, level?: 'P1') => <Row label={label} level={level} value={<Switch checked={v[k]} onChange={toggle(k)} />} />
  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <ScreenHeader onBack={onBack} title="通知" />
      <SectionLabel>按会话类型</SectionLabel>
      <div className="bg-white">
        {line('私聊', 'dm')}
        {line('群聊', 'group')}
        {line('群聊 @ 提及例外', 'mentionException')}
        {line('频道', 'channel')}
      </div>
      <SectionLabel>推送内容</SectionLabel>
      <div className="bg-white">
        {line('消息预览', 'preview')}
        <Row label="角标计数" level="P1" value="按会话" />
        <Row label="例外列表" level="P1" value="0 个" onClick={() => demoToast('配置例外列表')} />
        <Row label="应用内声音 / 震动" level="P1" value="开" />
      </div>
    </div>
  )
}

/** 说明型子页：只列条目 */
export function InfoScreen({ title, rows, onBack, note }: { title: string; rows: { label: string; value?: string; level?: 'P1' | 'P2' }[]; onBack: () => void; note?: string }) {
  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <ScreenHeader onBack={onBack} title={title} />
      <div className="mt-2 bg-white">
        {rows.map((r) => (
          <Row key={r.label} label={r.label} level={r.level} value={r.value} onClick={() => demoToast(r.label)} />
        ))}
      </div>
      {note && (
        <div className="px-4 pt-3">
          <DemoHint>{note}</DemoHint>
        </div>
      )}
    </div>
  )
}
