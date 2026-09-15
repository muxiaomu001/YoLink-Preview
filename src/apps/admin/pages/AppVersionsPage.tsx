/**
 * App 版本管理（PRD 05 1038-1047 行）：Android / iOS / Windows 工作台各一行，可编辑。
 */
import { useState } from 'react'
import type { AppPlatform, AppVersion } from '@/domain/types'
import { useStore } from '@/store/store'
import { Button, Field, Input, Textarea } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill } from '@/ui/display'
import { toast } from '@/ui/overlay'

const PLATFORM_LABEL: Record<AppPlatform, string> = { android: 'Android', ios: 'iOS', windows: 'Windows 工作台' }
const VERSION_RE = /^\d+\.\d+\.\d+$/
const ORDER: AppPlatform[] = ['android', 'ios', 'windows']

/** 语义化版本比较：a 是否 >= b */
function gte(a: string, b: string): boolean {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] > pb[i]
  }
  return true
}

export function AppVersionsPage() {
  const s = useStore()
  const versions = ORDER.map((p) => s.appVersions.find((v) => v.platform === p)).filter((v): v is AppVersion => !!v)
  return (
    <div>
      <PageHeader title="App 版本管理" desc="客户端「关于」页的「检查更新」读这里。每个平台一组：最新版本、下载地址、更新说明、最低版本。" />
      <Note>
        <b>低于最低版本的客户端启动即强制更新</b>，不能进入。热更新不做。品牌 App 每个品牌包各一组（P1，演示只有主包）。
      </Note>
      <div className="mt-4 grid grid-cols-3 gap-4">
        {versions.map((v) => (
          <VersionCard key={v.platform} version={v} />
        ))}
      </div>
    </div>
  )
}

function VersionCard({ version }: { version: AppVersion }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [form, setForm] = useState({ latest: version.latest, downloadUrl: version.downloadUrl, notes: version.notes, minVersion: version.minVersion })
  const patch = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const errors: string[] = []
  if (!VERSION_RE.test(form.latest)) errors.push('最新版本号格式 x.y.z')
  if (!VERSION_RE.test(form.minVersion)) errors.push('最低版本号格式 x.y.z')
  if (!errors.length && !gte(form.latest, form.minVersion)) errors.push('最低版本不能高于最新版本')
  if (!/^https:\/\/\S+$/.test(form.downloadUrl.trim())) errors.push('下载地址必须是 https')
  const dirty = form.latest !== version.latest || form.downloadUrl !== version.downloadUrl || form.notes !== version.notes || form.minVersion !== version.minVersion

  return (
    <Card
      title={PLATFORM_LABEL[version.platform]}
      extra={
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          当前 <Pill tone="blue">v{version.latest}</Pill> 最低 <Pill tone="amber">v{version.minVersion}</Pill>
        </span>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="最新版本号" required hint="x.y.z">
            <Input value={form.latest} onChange={(e) => patch('latest', e.target.value.trim())} className="font-mono" />
          </Field>
          <Field label="最低版本号" required hint="低于此版本强制更新">
            <Input value={form.minVersion} onChange={(e) => patch('minVersion', e.target.value.trim())} className="font-mono" />
          </Field>
        </div>
        <Field label="下载地址" required hint={version.platform === 'ios' ? 'App Store 链接' : '安装包地址'}>
          <Input value={form.downloadUrl} onChange={(e) => patch('downloadUrl', e.target.value)} className="font-mono text-[12px]" />
        </Field>
        <Field label="更新说明" hint="客户端「检查更新」里展示">
          <Textarea rows={3} maxLength={500} value={form.notes} onChange={(e) => patch('notes', e.target.value)} />
        </Field>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled={errors.length > 0 || !dirty}
            onClick={() => {
              s.updateAppVersion(version.platform, { ...form, downloadUrl: form.downloadUrl.trim() }, admin)
              toast(`${PLATFORM_LABEL[version.platform]} 已更新到 v${form.latest}，低于 v${form.minVersion} 的客户端启动即强制更新`)
            }}
          >
            保存
          </Button>
          {errors.length > 0 && <span className="text-[11px] text-red-600">{errors[0]}</span>}
        </div>
      </div>
    </Card>
  )
}
