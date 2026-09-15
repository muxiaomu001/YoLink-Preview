/**
 * 企业设置：七个分页，字段与 PRD 05「企业设置」表格一一对应。
 * 本文件放分页壳 + 基本信息 / 外观 / 注册方式；其余分页在 SettingsPage.parts.tsx 与 SettingsPage.webtabs.tsx。
 */
import { useState } from 'react'
import type { Language, RegisterMethod, ThemeKey } from '@/domain/types'
import { THEME_LABEL } from '@/domain/labels'
import { useStore } from '@/store/store'
import { Button, Checkbox, Field, Input, Select, Switch } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, Tabs } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { PushPane, SmsPane, StoragePane } from './SettingsPage.parts'
import { WebTabsPane } from './SettingsPage.webtabs'

type TabKey = 'basic' | 'appearance' | 'register' | 'sms' | 'push' | 'storage' | 'webtabs'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'basic', label: '基本信息' },
  { key: 'appearance', label: '外观' },
  { key: 'register', label: '注册方式' },
  { key: 'sms', label: '短信与邮件服务商' },
  { key: 'push', label: '推送配置' },
  { key: 'storage', label: '对象存储' },
  { key: 'webtabs', label: '网站栏目' },
]

const THEMES: ThemeKey[] = ['classic', 'dark', 'ocean', 'warm']
const HEX_RE = /^#[0-9a-fA-F]{6}$/
const isHttpUrl = (u: string) => /^https?:\/\/\S+$/.test(u)

export function SettingsPage() {
  const [tab, setTab] = useState<TabKey>('basic')
  return (
    <div>
      <PageHeader title="企业设置" desc="客户端启动时按企业码拉取这里的信息。每个分页一张表单，改完点保存才生效，所有改动进审计日志。" />
      <Tabs value={tab} onChange={setTab} items={TABS} className="mb-4" />
      {tab === 'basic' && <BasicPane />}
      {tab === 'appearance' && <AppearancePane />}
      {tab === 'register' && <RegisterPane />}
      {tab === 'sms' && <SmsPane />}
      {tab === 'push' && <PushPane />}
      {tab === 'storage' && <StoragePane />}
      {tab === 'webtabs' && <WebTabsPane />}
    </div>
  )
}

/** 品牌色：色块选择器与十六进制输入框联动 */
function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const valid = HEX_RE.test(value)
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={valid ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-zinc-300 bg-white p-0.5" aria-label="选择品牌色" />
      <Input value={value} maxLength={7} onChange={(e) => onChange(e.target.value.trim())} placeholder="#1f3b73" className="w-32 font-mono" />
      {!valid && <span className="text-[11px] text-red-600">需要 # 加 6 位十六进制</span>}
    </div>
  )
}

function BasicPane() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const e = s.enterprise
  const [form, setForm] = useState({
    name: e.name,
    logoText: e.logoText,
    defaultLanguage: e.defaultLanguage as Language,
    brandColor: e.brandColor,
    agreementUrl: e.agreementUrl,
    privacyUrl: e.privacyUrl,
    faqUrl: e.faqUrl,
  })
  const patch = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const errors: string[] = []
  if (form.name.trim().length < 1 || form.name.trim().length > 64) errors.push('企业名称 1 到 64 字符')
  if (form.logoText.trim().length !== 1) errors.push('Logo 文字取一个字')
  if (!HEX_RE.test(form.brandColor)) errors.push('品牌色格式不对')
  if (![form.agreementUrl, form.privacyUrl, form.faqUrl].every(isHttpUrl)) errors.push('三个链接都要是完整 URL')

  const save = () => {
    if (errors.length) return
    s.updateEnterprise({ ...form, name: form.name.trim(), logoText: form.logoText.trim() }, admin)
    toast('基本信息已保存，客户端下次启动生效')
  }

  return (
    <Card title="基本信息（P0）">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <Field label="企业名称" required hint="1 到 64 字符">
          <Input value={form.name} maxLength={64} onChange={(ev) => patch('name', ev.target.value)} />
        </Field>
        <Field label="默认语言">
          <Select value={form.defaultLanguage} onChange={(ev) => patch('defaultLanguage', ev.target.value)}>
            <option value="zh">中文</option>
            <option value="en">English</option>
          </Select>
        </Field>
        <Field label="企业 Logo" hint="正式产品上传图片：推荐 512×512 PNG，最大 2MB；演示用一个字 + 品牌色代替">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl text-xl font-semibold text-white" style={{ background: HEX_RE.test(form.brandColor) ? form.brandColor : '#71717a' }}>
              {form.logoText.trim().slice(0, 1) || '?'}
            </span>
            <Input value={form.logoText} maxLength={1} onChange={(ev) => patch('logoText', ev.target.value)} className="w-20 text-center" placeholder="恒" />
            <span className="text-[11px] text-zinc-400">预览：叠加在任何主题之上</span>
          </div>
        </Field>
        <Field label="品牌色" hint="十六进制颜色码">
          <ColorPicker value={form.brandColor} onChange={(v) => patch('brandColor', v)} />
        </Field>
        <Field label="用户协议 URL" hint="客户端「关于」读这里">
          <Input value={form.agreementUrl} onChange={(ev) => patch('agreementUrl', ev.target.value)} placeholder="https://" />
        </Field>
        <Field label="隐私政策 URL" hint="客户端「关于」读这里">
          <Input value={form.privacyUrl} onChange={(ev) => patch('privacyUrl', ev.target.value)} placeholder="https://" />
        </Field>
        <Field label="FAQ URL" hint="客户端「帮助」读这里">
          <Input value={form.faqUrl} onChange={(ev) => patch('faqUrl', ev.target.value)} placeholder="https://" />
        </Field>
        <Field label="企业码" hint="客户端启动时输入，解析到本企业实例，不可改">
          <Input value={e.code} disabled />
        </Field>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button variant="primary" disabled={errors.length > 0} onClick={save}>
          保存
        </Button>
        {errors.length > 0 && <span className="text-[11px] text-red-600">{errors.join('；')}</span>}
      </div>
    </Card>
  )
}

function AppearancePane() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const e = s.enterprise
  const [allowed, setAllowed] = useState<ThemeKey[]>(e.allowedThemes)
  const [def, setDef] = useState<ThemeKey>(e.defaultTheme)
  const toggle = (t: ThemeKey, on: boolean) => {
    const next = on ? [...allowed, t] : allowed.filter((x) => x !== t)
    setAllowed(THEMES.filter((x) => next.includes(x)))
    if (!next.includes(def)) setDef(next[0] ?? 'classic')
  }
  const ok = allowed.length > 0 && allowed.includes(def)
  return (
    <Card title="外观（P0，依赖 10 文档）">
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 text-xs font-medium text-zinc-600">允许的主题（内置四款，至少一款）</div>
          <div className="flex flex-wrap gap-4">
            {THEMES.map((t) => (
              <Checkbox key={t} checked={allowed.includes(t)} onChange={(v) => toggle(t, v)} label={THEME_LABEL[t]} />
            ))}
          </div>
          {allowed.length === 0 && <div className="mt-1 text-[11px] text-red-600">至少保留一款主题</div>}
        </div>
        <Field label="默认主题" hint="只能从允许的主题里选">
          <Select value={def} onChange={(ev) => setDef(ev.target.value as ThemeKey)} className="w-60">
            {allowed.map((t) => (
              <option key={t} value={t}>
                {THEME_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-center gap-3 rounded-md border border-zinc-200 px-3 py-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg text-base font-semibold text-white" style={{ background: e.brandColor }}>
            {e.logoText}
          </span>
          <div className="text-xs">
            <div className="font-medium text-zinc-800">Logo 与品牌色</div>
            <div className="text-zinc-500">
              在「基本信息」里改；<b>叠加在任何主题之上</b>，客户换主题也能认出是{e.name}。
            </div>
          </div>
        </div>
        <Button
          variant="primary"
          disabled={!ok}
          onClick={() => {
            s.updateEnterprise({ allowedThemes: allowed, defaultTheme: def }, admin)
            toast(`外观已保存：允许 ${allowed.map((t) => THEME_LABEL[t]).join('、')}，默认 ${THEME_LABEL[def]}`)
          }}
        >
          保存
        </Button>
      </div>
    </Card>
  )
}

function RegisterPane() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const e = s.enterprise
  const [methods, setMethods] = useState<RegisterMethod[]>(e.registerMethods)
  const [inviteRequired, setInviteRequired] = useState(e.inviteCodeRequired)
  const toggle = (m: RegisterMethod, on: boolean) => setMethods((list) => (on ? [...list, m] : list.filter((x) => x !== m)))
  const ok = methods.length > 0
  return (
    <Card title="注册方式（P0）">
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 text-xs font-medium text-zinc-600">允许的注册方式（至少一个；两者都是「账号 + 密码」，无验证码）</div>
          <div className="flex gap-4">
            <Checkbox checked={methods.includes('username')} onChange={(v) => toggle('username', v)} label="用户名 + 密码" />
            <Checkbox checked={methods.includes('phone')} onChange={(v) => toggle('phone', v)} label="手机号 + 密码" />
          </div>
          {!ok && <div className="mt-1 text-[11px] text-red-600">至少保留一种注册方式，否则客户无法注册</div>}
        </div>
        <SwitchRow title="邀请码必填" desc="默认开。关闭即开放注册：没带邀请码也能注册，落到默认邀请组" checked={inviteRequired} onChange={setInviteRequired} />
        <SwitchRow title="邮箱注册与验证码" desc="需先配置短信或邮件服务商；随验证码推到 P2" checked={e.emailVerify} disabled level="P2" />
        <SwitchRow title="强制绑定手机号" desc="开启后未绑定用户在关键操作时被拦截引导绑定；随验证码推到 P2" checked={e.forcePhoneBind} disabled level="P2" />
        <Button
          variant="primary"
          disabled={!ok}
          onClick={() => {
            s.updateEnterprise({ registerMethods: methods, inviteCodeRequired: inviteRequired }, admin)
            toast(inviteRequired ? '已保存：注册必须带邀请码' : '已保存：无码注册走默认邀请组')
          }}
        >
          保存
        </Button>
        <Note>用户 2026-09-15 决定：验证码、邮箱注册、强制绑手机号与短信/邮件服务商一起推到 P2，第一版只做账号 + 密码。</Note>
      </div>
    </Card>
  )
}

function SwitchRow({ title, desc, checked, onChange, disabled, level }: { title: string; desc: string; checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean; level?: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2">
      <div className="text-xs">
        <div className="flex items-center gap-1.5 font-medium text-zinc-800">
          {title}
          {level && <Pill tone="zinc">{level}</Pill>}
        </div>
        <div className="text-zinc-500">{desc}</div>
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}
