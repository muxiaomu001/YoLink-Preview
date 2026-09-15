/**
 * 「我的」页的子页：个人资料、外观、通知、以及若干说明型页面。每个入口的可见性在 MeScreen 里按策略判。
 */
import { useState } from 'react'
import type { ThemeKey } from '@/domain/types'
import { THEME_LABEL } from '@/domain/labels'
import { useStore } from '@/store/store'
import { customerById } from '@/store/selectors'
import { customerCan } from '@/store/policy'
import { Avatar, TitleChip } from '@/ui/display'
import { Button, Input, Switch } from '@/ui/primitives'
import { toast } from '@/ui/overlay'
import { DemoHint, Row, ScreenHeader, SectionLabel } from '../parts'

export function ProfileScreen({ customerId, onBack }: { customerId: string; onBack: () => void }) {
  const s = useStore()
  const c = customerById(s, customerId)!
  const canEdit = customerCan(s, customerId, 'account.edit_profile')
  const [nick, setNick] = useState(c.nickname)
  const titles = c.titleIds.map((id) => s.titles.find((t) => t.id === id && t.enabled)).filter((t) => !!t)
  const valid = nick.trim().length >= 1 && nick.trim().length <= 32
  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <ScreenHeader onBack={onBack} title="个人资料" />
      <div className="flex flex-col items-center bg-white py-4">
        <Avatar text={c.nickname} size={64} />
        {canEdit && (
          <button type="button" onClick={() => toast('演示不保存头像', 'info')} className="mt-1 text-[11px] text-brand-700">
            更换头像
          </button>
        )}
      </div>
      <div className="mt-2 bg-white">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-2.5 text-[13px]">
          <span className="w-16 text-zinc-600">昵称</span>
          {canEdit ? <Input value={nick} onChange={(e) => setNick(e.target.value)} className="h-8 flex-1" maxLength={32} /> : <span className="flex-1 text-right text-zinc-900">{c.nickname}</span>}
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
        <Row label="手机号" level="P2" value={c.phone ?? '未绑定'} hint="换绑需验证码，P2" />
        <Row label="邮箱" level="P2" value={c.email ?? '未绑定'} />
      </div>
      <div className="px-4 py-3">
        {canEdit ? (
          <>
            {!valid && <p className="mb-1 text-[11px] text-red-600">昵称 1 到 32 字符</p>}
            <Button variant="primary" className="h-9 w-full" disabled={!valid || nick.trim() === c.nickname} onClick={() => toast('演示不保存资料修改', 'info')}>
              保存
            </Button>
          </>
        ) : (
          <DemoHint>当前策略不允许修改昵称与头像（account.edit_profile 关），所以这里只读。</DemoHint>
        )}
      </div>
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
          <DemoHint>当前策略不允许切换主题（appearance.change_theme 关），只能用企业默认主题「{THEME_LABEL[s.enterprise.defaultTheme]}」。</DemoHint>
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
                  {k === 'schedule' && <span className="ml-1 rounded bg-zinc-100 px-1 text-[9px] text-zinc-500">P1</span>}
                </span>
                <span className="text-brand-700">{dark === k ? '✓' : ''}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="px-4 pt-2">
          <DemoHint>暗色模式入口未显示：appearance.dark_mode 关。</DemoHint>
        </div>
      )}
      <SectionLabel>聊天外观（P1）</SectionLabel>
      <div className="bg-white">
        <Row label="文字大小" level="P1" value="100%" onClick={() => toast('演示不调整', 'info')} />
        <Row label="聊天背景" level="P1" value="纯色" onClick={() => toast('演示不调整', 'info')} />
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
        <Row label="例外列表" level="P1" value="0 个" onClick={() => toast('演示不配置', 'info')} />
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
          <Row key={r.label} label={r.label} level={r.level} value={r.value} onClick={() => toast('演示不操作', 'info')} />
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
