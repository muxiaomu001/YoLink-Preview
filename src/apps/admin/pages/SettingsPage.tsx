/**
 * 企业设置：八个分页，字段与 PRD 05「企业设置」表格一一对应（群发频控来自 04 文档）。
 * 本文件放分页壳 + 基本信息 / 外观 / 注册与风控；其余分页在 SettingsPage.parts.tsx 与 SettingsPage.webtabs.tsx。
 */
import { useState } from 'react'
import { clsx } from 'clsx'
import type { Language, RegisterMethod, ThemeKey } from '@/domain/types'
import { THEME_LABEL } from '@/domain/labels'
import { DEFAULT_NICKNAME_TEMPLATE, NICKNAME_MAX, NICKNAME_POLICY_OPTIONS, NICKNAME_TOKEN, WATCH_LIMIT_TEXT, nicknamePolicyLabel, renderDefaultNickname, type NicknamePolicy } from '@/domain/register'
import { useStore } from '@/store/store'
import { Button, Checkbox, Field, Input, Select, Switch } from '@/ui/primitives'
import { Avatar, Card, Note, PageHeader, Pill, Tabs } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { BroadcastPane, PushPane, QuickReplyPane, SmsPane, StoragePane } from './SettingsPage.parts'
import { WebTabsPane } from './SettingsPage.webtabs'
import { DemoLevelTag, DemoNote } from '@/ui/DemoNote'

type TabKey = 'basic' | 'appearance' | 'register' | 'sms' | 'push' | 'storage' | 'webtabs' | 'broadcast'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'basic', label: '基本信息' },
  { key: 'appearance', label: '外观' },
  { key: 'register', label: '注册与风控' },
  { key: 'sms', label: '短信与邮件服务商' },
  { key: 'push', label: '推送配置' },
  { key: 'storage', label: '对象存储' },
  { key: 'webtabs', label: '网站栏目' },
  { key: 'broadcast', label: '群发与话术' },
]

const THEMES: ThemeKey[] = ['classic', 'dark', 'ocean', 'warm']
const HEX_RE = /^#[0-9a-fA-F]{6}$/
const isHttpUrl = (u: string) => /^https?:\/\/\S+$/.test(u)

export function SettingsPage() {
  const [tab, setTab] = useState<TabKey>('basic')
  return (
    <div>
      <PageHeader title="企业设置" desc="客户端启动时按企业码拉取这里的配置。每个分页独立保存，保存后对新启动的客户端生效。" />
      <Tabs value={tab} onChange={setTab} items={TABS} className="mb-4" />
      {tab === 'basic' && <BasicPane />}
      {tab === 'appearance' && <AppearancePane />}
      {tab === 'register' && <RegisterPane />}
      {tab === 'sms' && <SmsPane />}
      {tab === 'push' && <PushPane />}
      {tab === 'storage' && <StoragePane />}
      {tab === 'webtabs' && <WebTabsPane />}
      {tab === 'broadcast' && (
        <>
          <BroadcastPane />
          <QuickReplyPane />
        </>
      )}
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
    <Card title="基本信息" level="P0">
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
        <Field label="企业 Logo" hint="推荐 512×512 PNG，最大 2MB" demoHint="演示里用一个字加品牌色代替上传的图片">
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
    <div className="space-y-4">
      <Card title="主题">
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
      <StartupBrandCard />
    </div>
  )
}

function StartupBrandCard() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const enterprise = s.enterprise
  const [form, setForm] = useState(enterprise.startupBrand)
  const colorOk = HEX_RE.test(form.backgroundColor)
  const taglineOk = form.tagline.trim().length >= 2 && form.tagline.trim().length <= 32

  return (
    <Card title="品牌启动页">
      <div className="grid grid-cols-[1fr_220px] gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2">
            <div>
              <div className="text-xs font-medium text-zinc-700">显示品牌启动页</div>
              <div className="mt-0.5 text-[11px] text-zinc-500">客户每次冷启动 App 时先看到企业品牌画面。</div>
            </div>
            <Switch checked={form.enabled} onChange={(enabled) => setForm((value) => ({ ...value, enabled }))} />
          </div>
          <Field label="启动页文案" hint="2 到 32 字">
            <Input value={form.tagline} maxLength={32} disabled={!form.enabled} onChange={(event) => setForm((value) => ({ ...value, tagline: event.target.value }))} />
          </Field>
          <Field label="背景色" hint="使用独立颜色，不跟随客户主题">
            <ColorPicker value={form.backgroundColor} onChange={(backgroundColor) => setForm((value) => ({ ...value, backgroundColor }))} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="展示时长">
              <Select value={form.durationSeconds} disabled={!form.enabled} onChange={(event) => setForm((value) => ({ ...value, durationSeconds: Number(event.target.value) as 1 | 2 | 3 }))}>
                <option value={1}>1 秒</option>
                <option value={2}>2 秒</option>
                <option value={3}>3 秒</option>
              </Select>
            </Field>
            <div className="flex items-end pb-1">
              <Checkbox checked={form.allowSkip} disabled={!form.enabled} onChange={(allowSkip) => setForm((value) => ({ ...value, allowSkip }))} label="允许客户跳过" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              disabled={!colorOk || !taglineOk}
              onClick={() => {
                s.updateEnterprise({ startupBrand: { ...form, tagline: form.tagline.trim() } }, admin)
                toast('品牌启动页已保存，客户下次启动生效')
              }}
            >
              保存
            </Button>
            {(!colorOk || !taglineOk) && <span className="text-[11px] text-red-600">请填写有效背景色和启动页文案</span>}
          </div>
        </div>
        <div className="overflow-hidden rounded-[24px] border-[6px] border-zinc-900 shadow-lg">
          <div className="flex h-80 flex-col items-center justify-center px-5 text-center text-white" style={{ background: colorOk ? form.backgroundColor : enterprise.brandColor }}>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-3xl font-semibold ring-1 ring-white/25">{enterprise.logoText}</div>
            <div className="mt-5 text-xl font-semibold tracking-wide">{enterprise.name}</div>
            <div className="mt-2 text-xs text-white/70">{form.tagline || '启动页文案'}</div>
          </div>
        </div>
      </div>
    </Card>
  )
}

function RegisterPane() {
  return (
    <div className="space-y-4">
      <RegisterMethodCard />
      <RegisterProfileCard />
      <RegisterRiskCard />
    </div>
  )
}

function RegisterMethodCard() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const e = s.enterprise
  const [methods, setMethods] = useState<RegisterMethod[]>(e.registerMethods)
  const [inviteRequired, setInviteRequired] = useState(e.inviteCodeRequired)
  const toggle = (m: RegisterMethod, on: boolean) => setMethods((list) => (on ? [...list, m] : list.filter((x) => x !== m)))
  const ok = methods.length > 0
  return (
    <Card title="注册方式" level="P0">
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
        <DemoNote>
          第一版只做账号 + 密码；验证码、邮箱注册、强制绑手机号跟短信与邮件服务商一起排在后续版本<DemoLevelTag level="P2" />。
        </DemoNote>
      </div>
    </Card>
  )
}

/** 注册资料规则：昵称三档 + 默认昵称模板 + 默认头像口径 */
function RegisterProfileCard() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const e = s.enterprise
  const [policy, setPolicy] = useState<NicknamePolicy>(e.nicknamePolicy)
  const [tpl, setTpl] = useState(e.defaultNicknameTemplate)
  const preview = renderDefaultNickname(tpl, 'HX098231')
  const tplNeeded = policy !== 'required'
  const tplOk = !tplNeeded || (tpl.trim().length > 0 && tpl.includes(NICKNAME_TOKEN))
  return (
    <Card title="注册资料规则" level="P0">
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 text-xs font-medium text-zinc-600">昵称怎么问</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {NICKNAME_POLICY_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setPolicy(o.value)}
                className={clsx(
                  'rounded-md border px-3 py-2 text-left transition-colors',
                  policy === o.value ? 'border-brand-400 bg-brand-50/70 text-brand-900' : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50',
                )}
              >
                <div className="text-xs font-medium">{o.label}</div>
                <div className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{o.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <Field label="默认昵称模板" hint={`${NICKNAME_TOKEN} = 账号 ID 后四位`}>
          <Input value={tpl} maxLength={NICKNAME_MAX} disabled={!tplNeeded} onChange={(ev) => setTpl(ev.target.value)} className="w-56" placeholder={DEFAULT_NICKNAME_TEMPLATE} />
        </Field>
        <div className="flex items-center gap-2.5 rounded-md border border-zinc-200 px-3 py-2">
          <Avatar text={preview} size={32} />
          <div className="text-xs">
            <div className="font-medium text-zinc-800">{tplNeeded ? `预览：${preview}` : '昵称必填时不发默认昵称'}</div>
            <div className="text-[11px] text-zinc-500">默认头像按昵称首字生成固定色块，注册不要求上传；客户进 App 后随时能换。</div>
          </div>
        </div>
        {tplNeeded && !tplOk && <div className="text-[11px] text-red-600">模板不能为空，且要含 {NICKNAME_TOKEN}，否则所有默认昵称会撞成同一个词</div>}
        <Button
          variant="primary"
          disabled={!tplOk}
          onClick={() => {
            s.updateEnterprise({ nicknamePolicy: policy, defaultNicknameTemplate: tpl.trim() || DEFAULT_NICKNAME_TEMPLATE }, admin)
            toast(`已保存：昵称${nicknamePolicyLabel(policy)}${tplNeeded ? `，默认昵称如「${preview}」` : ''}`)
          }}
        >
          保存
        </Button>
        <DemoNote>
          注册页会立刻跟着变：「不问」档下客户端连昵称框都不渲染。改规则只作用于之后注册的客户，已注册的昵称不动。
        </DemoNote>
      </div>
    </Card>
  )
}

/** 注册风控：同设备注册上限 + 新号观察期 */
function RegisterRiskCard() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const e = s.enterprise
  const [perDevice, setPerDevice] = useState(String(e.registerPerDevicePerDay))
  const [watchHours, setWatchHours] = useState(String(e.newAccountWatchHours))
  const d = Number(perDevice)
  const h = Number(watchHours)
  const ok = Number.isInteger(d) && d >= 0 && d <= 50 && Number.isInteger(h) && h >= 0 && h <= 168
  return (
    <Card title="注册风控" level="P0">
      <div className="space-y-4">
        <Field label="同设备 24 小时注册上限" hint="0 = 不限">
          <Input type="number" min={0} max={50} value={perDevice} onChange={(ev) => setPerDevice(ev.target.value)} className="w-32" />
        </Field>
        <Field label="新号观察期（小时）" hint="0 = 关闭">
          <Input type="number" min={0} max={168} value={watchHours} onChange={(ev) => setWatchHours(ev.target.value)} className="w-32" />
        </Field>
        <Note>观察期内的客户{WATCH_LIMIT_TEXT}，客户列表的状态列会显示「新号观察期」，可按它筛选。观察期按注册那一刻的设置算死，改这里不追溯已注册的客户。</Note>
        {!ok && <div className="text-[11px] text-red-600">注册上限填 0-50 的整数，观察期填 0-168 小时的整数</div>}
        <Button
          variant="primary"
          disabled={!ok}
          onClick={() => {
            s.updateEnterprise({ registerPerDevicePerDay: d, newAccountWatchHours: h }, admin)
            toast(`已保存：同设备每天最多 ${d === 0 ? '不限' : `${d} 个`}，新号观察期 ${h === 0 ? '关闭' : `${h} 小时`}`)
          }}
        >
          保存
        </Button>
        <DemoNote>
          提速和风控必须一起开：注册门槛降下去之后，拦批量注册的活儿就全压在这两项上。
          风控拦下的每一次注册都会记一条审计日志（注册被风控拦截），演示时在「系统 › 审计日志」能翻到。
        </DemoNote>
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
