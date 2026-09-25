import { useState } from 'react'
import { clsx } from 'clsx'
import type { Announcement, Banner, BannerAction } from '@/domain/types'
import { newId } from '@/domain/ids'
import { fmtDate } from '@/domain/time'
import { useStore } from '@/store/store'
import { Button, Checkbox, Field, Input, Select, Textarea } from '@/ui/primitives'
import { Modal, toast } from '@/ui/overlay'
import { DemoLevelTag, DemoNote } from '@/ui/DemoNote'

/** 演示用色板，代替图片上传 */
const PALETTE = ['#1f3b73', '#0f766e', '#7e22ce', '#b45309', '#be123c', '#0369a1', '#4d7c0f', '#334155']

const isHttps = (u: string) => /^https:\/\/[^\s]+$/.test(u.trim())
const dateToIso = (d: string, end = false) => new Date(`${d}T${end ? '23:59:59' : '00:00:00'}`).toISOString()
const dateOf = (iso?: string) => (iso ? fmtDate(iso) : '')
const today = () => fmtDate(new Date().toISOString())
const plusDays = (n: number) => fmtDate(new Date(Date.now() + n * 86400000).toISOString())

/** 色块缩略图：色块 + 标题首字 */
export function ColorThumb({ color, text, small }: { color: string; text: string; small?: boolean }) {
  return (
    <span className={clsx('inline-flex items-center justify-center rounded text-white font-medium', small ? 'h-6 w-10 text-[11px]' : 'h-9 w-16 text-sm')} style={{ background: color }} title="横幅图片">
      {text.slice(0, 1)}
    </span>
  )
}

function ColorPicker({ value, onChange, allowNone }: { value: string; onChange: (v: string) => void; allowNone?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {allowNone && (
        <button type="button" onClick={() => onChange('')} className={clsx('h-7 rounded border px-2 text-[11px]', !value ? 'border-brand-600 text-brand-700' : 'border-zinc-200 text-zinc-500')}>
          不用图
        </button>
      )}
      {PALETTE.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} className={clsx('h-7 w-7 rounded border-2', value === c ? 'border-zinc-900' : 'border-transparent')} style={{ background: c }} aria-label={c} />
      ))}
    </div>
  )
}

export function BannerModal({ banner, onClose }: { banner?: Banner; onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [form, setForm] = useState({
    title: banner?.title ?? '',
    imageColor: banner?.imageColor ?? PALETTE[0],
    action: banner?.action ?? ('link' as BannerAction),
    url: banner?.url ?? '',
    chatGroupId: banner?.chatGroupId ?? s.chatGroups[0]?.id ?? '',
    order: banner?.order ?? (s.banners.length ? Math.max(...s.banners.map((b) => b.order)) + 1 : 1),
    start: dateOf(banner?.startAt) || today(),
    end: dateOf(banner?.endAt) || plusDays(30),
    audience: banner?.audience ?? ('all' as Banner['audience']),
    tagIds: banner?.tagIds ?? [],
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const moduleOff = (m: 'checkin' | 'wallet') => !s.enterprise.modules[m]

  const error = !form.title.trim()
    ? '标题不能为空'
    : form.title.length > 32
      ? '标题最多 32 字符'
      : form.action === 'link' && !isHttps(form.url)
        ? '链接必须是 https:// 开头的完整地址'
        : form.action === 'group' && !form.chatGroupId
          ? '请选择目标群或频道'
          : !form.start || !form.end || form.start > form.end
            ? '起止时间不合法'
            : form.audience === 'tags' && form.tagIds.length === 0
              ? '按内部标签投放至少选一个内部标签'
              : ''

  const submit = () => {
    if (error) return
    const next: Banner = {
      id: banner?.id ?? newId('bn'),
      title: form.title.trim(),
      imageColor: form.imageColor,
      action: form.action,
      url: form.action === 'link' ? form.url.trim() : undefined,
      chatGroupId: form.action === 'group' ? form.chatGroupId : undefined,
      order: form.order,
      startAt: dateToIso(form.start),
      endAt: dateToIso(form.end, true),
      audience: form.audience,
      tagIds: form.audience === 'tags' ? form.tagIds : [],
      impressions: banner?.impressions ?? 0,
      clicks: banner?.clicks ?? 0,
    }
    s.saveBanner(next, admin)
    toast(banner ? `横幅「${next.title}」已更新` : `横幅「${next.title}」已创建，活动期内客户端首页可见`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={banner ? `编辑横幅：${banner.title}` : '创建横幅'}
      width={600}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!!error} onClick={submit}>{banner ? '保存' : '创建'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="标题" required hint={`${form.title.length}/32`}>
          <Input value={form.title} maxLength={32} onChange={(e) => set('title', e.target.value)} placeholder="如：四季度全球配置展望" />
        </Field>
        <Field label="图片" hint="推荐 750×400，最大 2MB" demoHint="演示里用色板代替图片上传">
          <div className="flex items-center gap-3">
            <ColorThumb color={form.imageColor} text={form.title || '图'} />
            <ColorPicker value={form.imageColor} onChange={(v) => set('imageColor', v)} />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="点击动作">
            <Select value={form.action} onChange={(e) => set('action', e.target.value as BannerAction)}>
              <option value="link">打开链接</option>
              <option value="checkin" disabled={moduleOff('checkin')}>打开签到{moduleOff('checkin') ? '（签到模块未启用）' : ''}</option>
              <option value="wallet" disabled={moduleOff('wallet')}>打开钱包{moduleOff('wallet') ? '（钱包模块未启用）' : ''}</option>
              <option value="group">打开群或频道</option>
            </Select>
          </Field>
          <Field label="排序" hint="数字，越小越靠前">
            <Input type="number" min={1} value={form.order} onChange={(e) => set('order', Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
          </Field>
        </div>
        {form.action === 'link' && (
          <Field label="链接 URL" required hint="https 开头">
            <Input value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://" />
          </Field>
        )}
        {form.action === 'group' && (
          <Field label="目标群 / 频道" required>
            <Select value={form.chatGroupId} onChange={(e) => set('chatGroupId', e.target.value)}>
              {s.chatGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}（{g.kind === 'channel' ? '频道' : '群'}）
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="开始日期" required>
            <Input type="date" value={form.start} onChange={(e) => set('start', e.target.value)} />
          </Field>
          <Field label="结束日期" required>
            <Input type="date" value={form.end} onChange={(e) => set('end', e.target.value)} />
          </Field>
        </div>
        <Field label={<>目标人群<DemoLevelTag level="P1" /></>}>
          <div className="flex h-8 items-center gap-5 text-[13px] text-zinc-700">
            <label className="flex items-center gap-1.5">
              <input type="radio" className="accent-brand-700" checked={form.audience === 'all'} onChange={() => set('audience', 'all')} /> 全部
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" className="accent-brand-700" checked={form.audience === 'tags'} onChange={() => set('audience', 'tags')} /> 按内部标签
            </label>
          </div>
        </Field>
        {form.audience === 'tags' && (
          <Field label={<>标签（内部标签，客户看不到）<DemoLevelTag level="P1" /></>} hint="多选">
            <div className="flex flex-wrap gap-3">
              {s.tags.map((t) => (
                <Checkbox key={t.id} checked={form.tagIds.includes(t.id)} onChange={(v) => set('tagIds', v ? [...form.tagIds, t.id] : form.tagIds.filter((x) => x !== t.id))} label={t.name} />
              ))}
            </div>
          </Field>
        )}
        {error && form.title && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}

export function AnnouncementModal({ announcement, onClose }: { announcement?: Announcement; onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [form, setForm] = useState({
    title: announcement?.title ?? '',
    body: announcement?.body ?? '',
    imageColor: announcement?.imageColor ?? '',
    buttonText: announcement?.buttonText ?? '我知道了',
    buttonAction: announcement?.buttonAction ?? ('close' as Announcement['buttonAction']),
    url: announcement?.url ?? '',
    kind: announcement?.kind ?? ('popup' as Announcement['kind']),
    start: dateOf(announcement?.startAt) || today(),
    end: dateOf(announcement?.endAt) || plusDays(7),
    showMode: announcement?.showMode ?? ('once' as Announcement['showMode']),
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const error = !form.title.trim()
    ? '标题不能为空'
    : form.title.length > 64
      ? '标题最多 64 字符'
      : !form.body.trim()
        ? '正文不能为空'
        : form.body.length > 1024
          ? '正文最多 1024 字符'
          : !form.buttonText.trim()
            ? '按钮文字不能为空'
            : form.buttonAction === 'link' && !isHttps(form.url)
              ? '链接必须是 https:// 开头的完整地址'
              : !form.start || !form.end || form.start > form.end
                ? '起止时间不合法'
                : ''
  const submit = () => {
    if (error) return
    const next: Announcement = {
      id: announcement?.id ?? newId('an'),
      title: form.title.trim(),
      body: form.body.trim(),
      imageColor: form.imageColor || undefined,
      buttonText: form.buttonText.trim(),
      buttonAction: form.buttonAction,
      url: form.buttonAction === 'link' ? form.url.trim() : undefined,
      kind: form.kind,
      startAt: dateToIso(form.start),
      endAt: dateToIso(form.end, true),
      showMode: form.showMode,
      impressions: announcement?.impressions ?? 0,
    }
    s.saveAnnouncement(next, admin)
    toast(announcement ? `公告「${next.title}」已更新` : `公告「${next.title}」已创建`)
    onClose()
  }
  const radio = <T extends string>(name: string, value: T, cur: T, label: string, onPick: (v: T) => void) => (
    <label className="flex items-center gap-1.5">
      <input type="radio" name={name} className="accent-brand-700" checked={cur === value} onChange={() => onPick(value)} /> {label}
    </label>
  )

  return (
    <Modal
      open
      onClose={onClose}
      title={announcement ? `编辑公告：${announcement.title}` : '创建公告'}
      width={600}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!!error} onClick={submit}>{announcement ? '保存' : '创建'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="标题" required hint={`${form.title.length}/64`}>
          <Input value={form.title} maxLength={64} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="正文" required hint={`${form.body.length}/1024`} demoHint="正式产品这里是富文本编辑器，演示用纯文本">
          <Textarea rows={4} maxLength={1024} value={form.body} onChange={(e) => set('body', e.target.value)} />
        </Field>
        <Field label="图片（可选）" demoHint="演示里用色板代替图片上传">
          <ColorPicker value={form.imageColor} onChange={(v) => set('imageColor', v)} allowNone />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="按钮文字" required>
            <Input value={form.buttonText} maxLength={16} onChange={(e) => set('buttonText', e.target.value)} placeholder="我知道了" />
          </Field>
          <Field label="按钮动作">
            <Select value={form.buttonAction} onChange={(e) => set('buttonAction', e.target.value as Announcement['buttonAction'])}>
              <option value="close">关闭</option>
              <option value="link">打开链接</option>
              <option value="checkin" disabled>打开签到（签到模块未开放）</option>
              <option value="wallet" disabled>打开钱包（钱包模块未开放）</option>
            </Select>
          </Field>
        </div>
        {form.buttonAction === 'link' && (
          <Field label="链接 URL" required hint="https 开头">
            <Input value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://" />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="类型">
            <div className="flex h-8 items-center gap-4 text-[13px] text-zinc-700">
              {radio('kind', 'popup', form.kind, '启动弹窗', (v) => set('kind', v))}
              {radio('kind', 'bar', form.kind, '顶部通知条', (v) => set('kind', v))}
            </div>
          </Field>
          <Field label="展示次数">
            <div className="flex h-8 items-center gap-4 text-[13px] text-zinc-700">
              {radio('show', 'once', form.showMode, '一次', (v) => set('showMode', v))}
              {radio('show', 'every', form.showMode, '每次启动', (v) => set('showMode', v))}
            </div>
          </Field>
          <Field label="开始日期" required>
            <Input type="date" value={form.start} onChange={(e) => set('start', e.target.value)} />
          </Field>
          <Field label="结束日期" required>
            <Input type="date" value={form.end} onChange={(e) => set('end', e.target.value)} />
          </Field>
        </div>
        {error && form.title && <p className="text-xs text-red-600">{error}</p>}
        <DemoNote>
          「打开签到」「打开钱包」两个按钮动作随对应模块开放<DemoLevelTag level="P2" />，这里先禁用。
        </DemoNote>
      </div>
    </Modal>
  )
}
