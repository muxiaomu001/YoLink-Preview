/**
 * 企业设置分页：短信与邮件服务商（P2 只读）、推送配置、对象存储、群发频控与话术库开关。
 * SecretField 是「只写不读」密钥的统一呈现：已配置时显示掩码 + 更换按钮。
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { PushConfig, PushMask, StorageConfig, StorageType } from '@/domain/types'
import { fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { Button, Field, Input, Select, Switch } from '@/ui/primitives'
import { Card, Note, Pill } from '@/ui/display'
import { toast } from '@/ui/overlay'

/** 只写不读的密钥输入：configured 为真时不回显，只能「更换」 */
export function SecretField({ label, hint, configured, onConfigured }: { label: string; hint?: string; configured: boolean; onConfigured: (v: boolean) => void }) {
  const [editing, setEditing] = useState(!configured)
  const [value, setValue] = useState('')
  const commit = () => {
    if (!value.trim()) return
    onConfigured(true)
    setValue('')
    setEditing(false)
  }
  return (
    <Field label={label} hint={hint ?? '只写不读，加密存储'}>
      {editing ? (
        <div className="flex items-center gap-2">
          <Input type="password" autoComplete="new-password" value={value} onChange={(e) => setValue(e.target.value)} placeholder="粘贴新的密钥" />
          <Button size="sm" variant="primary" disabled={!value.trim()} onClick={commit}>
            确定
          </Button>
          {configured && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              取消
            </Button>
          )}
        </div>
      ) : (
        <div className="flex h-8 items-center gap-2">
          <span className="font-mono text-[13px] text-zinc-600">已配置 ••••••••</span>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            更换
          </Button>
        </div>
      )}
    </Field>
  )
}

export function SmsPane() {
  return (
    <div className="space-y-4">
      <Note tone="amber">P2：短信与邮件服务商随验证码一起推后（用户 2026-09-15 决定）。本页为占位表单，全部只读，第一版不接任何服务商。</Note>
      <div className="grid grid-cols-2 gap-4">
        <Card title="短信服务商（P2）">
          <div className="space-y-3">
            <Field label="短信服务商">
              <Select disabled defaultValue="">
                <option value="">未配置</option>
                <option value="aliyun">阿里云</option>
                <option value="tencent">腾讯云</option>
                <option value="twilio">Twilio</option>
              </Select>
            </Field>
            <Field label="短信 API Key" hint="只写不读，加密存储">
              <Input type="password" disabled placeholder="未配置" />
            </Field>
            <Field label="短信签名" hint="服务商审核通过的签名">
              <Input disabled placeholder="如：【恒信财富】" />
            </Field>
          </div>
        </Card>
        <Card title="邮件服务商（P2）">
          <div className="space-y-3">
            <Field label="邮件服务商">
              <Select disabled defaultValue="">
                <option value="">未配置</option>
                <option value="smtp">SMTP</option>
                <option value="sendgrid">SendGrid</option>
                <option value="ses">Amazon SES</option>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="SMTP 服务器">
                <Input disabled placeholder="smtp.example.com" />
              </Field>
              <Field label="端口">
                <Input disabled placeholder="465" />
              </Field>
              <Field label="用户名">
                <Input disabled placeholder="" />
              </Field>
              <Field label="密码" hint="只写不读">
                <Input type="password" disabled placeholder="" />
              </Field>
            </div>
            <Field label="发件人地址" hint="邮箱格式校验">
              <Input disabled placeholder="noreply@example.com" />
            </Field>
          </div>
        </Card>
      </div>
    </div>
  )
}

const MASK_LABEL: Record<PushMask, string> = { full: '完整内容', sender_only: '仅发送者', generic: '仅「你有一条新消息」' }

export function PushPane() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [form, setForm] = useState<PushConfig>(s.enterprise.push)
  const patch = (p: Partial<PushConfig>) => setForm((f) => ({ ...f, ...p }))
  const needIds = form.apnsMode === 'p8'
  const error = needIds && (!form.apnsKeyId.trim() || !form.apnsTeamId.trim()) ? '使用 .p8 时 Key ID 与 Team ID 必填' : ''
  return (
    <Card title="推送配置（P0）">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <Field label="APNs 证书" hint="正式产品上传 .p8 文件或 .p12 证书">
          <Select value={form.apnsMode} onChange={(e) => patch({ apnsMode: e.target.value as PushConfig['apnsMode'] })}>
            <option value="p8">.p8 密钥（推荐）</option>
            <option value="p12">.p12 证书</option>
            <option value="none">未配置（iOS 不推送）</option>
          </Select>
        </Field>
        <Field label="推送内容脱敏" hint="锁屏上能看到多少">
          <Select value={form.mask} onChange={(e) => patch({ mask: e.target.value as PushMask })}>
            {(Object.keys(MASK_LABEL) as PushMask[]).map((k) => (
              <option key={k} value={k}>
                {MASK_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        {needIds && (
          <>
            <Field label="APNs Key ID" required hint="使用 .p8 时需要">
              <Input value={form.apnsKeyId} maxLength={10} onChange={(e) => patch({ apnsKeyId: e.target.value.trim() })} className="font-mono" />
            </Field>
            <Field label="APNs Team ID" required hint="使用 .p8 时需要">
              <Input value={form.apnsTeamId} maxLength={10} onChange={(e) => patch({ apnsTeamId: e.target.value.trim() })} className="font-mono" />
            </Field>
          </>
        )}
        <SecretField label="FCM 服务器密钥" configured={form.fcmConfigured} onConfigured={(v) => patch({ fcmConfigured: v })} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button
          variant="primary"
          disabled={!!error}
          onClick={() => {
            s.updateEnterprise({ push: form }, admin)
            toast(`推送配置已保存：APNs ${form.apnsMode === 'none' ? '未配置' : form.apnsMode}，脱敏「${MASK_LABEL[form.mask]}」`)
          }}
        >
          保存
        </Button>
        {error && <span className="text-[11px] text-red-600">{error}</span>}
      </div>
    </Card>
  )
}

/** 话术库开关：是否允许员工在工作台建个人话术；企业话术库始终可用。切换立即生效。 */
export function QuickReplyPane() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const on = s.enterprise.allowPersonalQuickReply
  const toggle = (v: boolean) => {
    s.updateEnterprise({ allowPersonalQuickReply: v }, admin)
    toast(v ? '已允许员工建个人话术' : '已关闭个人话术：员工只能用企业话术库，已建的个人话术保留但不可见', v ? 'ok' : 'warn')
  }
  return (
    <Card title="话术库" className="mt-4">
      <div className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2">
        <div className="text-xs">
          <div className="font-medium text-zinc-800">允许员工建个人话术</div>
          <div className="text-zinc-500">
            开时员工可在工作台「话术」里维护自己的分类与话术（只有本人可见）；关时只能用
            <Link to="/admin/quick-replies" className="mx-0.5 text-brand-700 hover:underline">
              企业话术库
            </Link>
            。切换立即生效。
          </div>
        </div>
        <Switch checked={on} onChange={toggle} />
      </div>
    </Card>
  )
}

const STORAGE_LABEL: Record<StorageType, string> = { s3: 'AWS S3', oss: '阿里云 OSS', cos: '腾讯云 COS', minio: 'MinIO' }

export function StoragePane() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const saved = s.enterprise.storage
  const [form, setForm] = useState<StorageConfig>(saved)
  const patch = (p: Partial<StorageConfig>) => setForm((f) => ({ ...f, ...p }))
  const error = !form.bucket.trim() ? 'Bucket 名称必填' : !form.endpoint.trim() ? '区域/Endpoint 必填' : ''
  const dirty = form.type !== saved.type || form.bucket !== saved.bucket || form.endpoint !== saved.endpoint || form.accessKeyConfigured !== saved.accessKeyConfigured || form.secretKeyConfigured !== saved.secretKeyConfigured

  const save = () => {
    s.updateEnterprise({ storage: { ...form, lastTestAt: saved.lastTestAt, lastTestOk: saved.lastTestOk } }, admin)
    toast('对象存储配置已保存')
  }
  const test = () => {
    if (dirty) s.updateEnterprise({ storage: { ...form, lastTestAt: saved.lastTestAt, lastTestOk: saved.lastTestOk } }, admin)
    const ok = s.testStorageConnection()
    toast(ok ? '测试连接成功：已上传并删除测试文件' : '测试连接失败：请检查 Bucket、Endpoint 与密钥', ok ? 'ok' : 'warn')
  }

  return (
    <Card
      title="对象存储（P0）"
      extra={
        saved.lastTestAt ? (
          <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            最近测试 {fmtDateTime(saved.lastTestAt)}
            {saved.lastTestOk ? <Pill tone="green">成功</Pill> : <Pill tone="red">失败</Pill>}
          </span>
        ) : (
          <span className="text-[11px] text-zinc-400">尚未测试</span>
        )
      }
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <Field label="存储类型">
          <Select value={form.type} onChange={(e) => patch({ type: e.target.value as StorageType })}>
            {(Object.keys(STORAGE_LABEL) as StorageType[]).map((k) => (
              <option key={k} value={k}>
                {STORAGE_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Bucket 名称" required>
          <Input value={form.bucket} onChange={(e) => patch({ bucket: e.target.value.trim() })} className="font-mono" />
        </Field>
        <Field label="区域/Endpoint" required>
          <Input value={form.endpoint} onChange={(e) => patch({ endpoint: e.target.value.trim() })} className="font-mono" placeholder="oss-cn-hongkong.aliyuncs.com" />
        </Field>
        <div />
        <SecretField label="Access Key" configured={form.accessKeyConfigured} onConfigured={(v) => patch({ accessKeyConfigured: v })} />
        <SecretField label="Secret Key" configured={form.secretKeyConfigured} onConfigured={(v) => patch({ secretKeyConfigured: v })} />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Button variant="primary" disabled={!!error || !dirty} onClick={save}>
          保存
        </Button>
        <Button disabled={!!error} onClick={test}>
          测试连接
        </Button>
        {error ? <span className="text-[11px] text-red-600">{error}</span> : <span className="text-[11px] text-zinc-400">测试会先保存当前配置，再上传一个测试文件验证读写</span>}
      </div>
    </Card>
  )
}

/** 群发频控（04 文档）：每个实操员工每天任务数、每客户每天收到的条数 */
const LIMIT_MIN = 1
const LIMIT_MAX = 50

export function BroadcastPane() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const e = s.enterprise
  const [perStaff, setPerStaff] = useState(String(e.broadcastPerStaffPerDay))
  const [perCustomer, setPerCustomer] = useState(String(e.broadcastPerCustomerPerDay))
  const parse = (v: string) => {
    const n = Number(v)
    return Number.isInteger(n) && n >= LIMIT_MIN && n <= LIMIT_MAX ? n : null
  }
  const a = parse(perStaff)
  const b = parse(perCustomer)
  const error = a == null || b == null ? `两项都要是 ${LIMIT_MIN} 到 ${LIMIT_MAX} 的整数` : ''
  const dirty = a !== e.broadcastPerStaffPerDay || b !== e.broadcastPerCustomerPerDay
  return (
    <Card title="群发频控（P0）">
      <Note>两个维度独立生效：员工维度超限时工作台「发送」按钮禁用；客户维度超限的客户本次跳过，计入「跳过」。改动立即对下一次群发生效。</Note>
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
        <Field label="每个实操员工每天群发任务数" required hint="跨其持有的坐席合并计算，默认 3">
          <Input type="number" min={LIMIT_MIN} max={LIMIT_MAX} value={perStaff} onChange={(ev) => setPerStaff(ev.target.value)} className="w-40" />
        </Field>
        <Field label="每客户每天最多收到的群发条数" required hint="跨坐席、跨任务合并计算，默认 2">
          <Input type="number" min={LIMIT_MIN} max={LIMIT_MAX} value={perCustomer} onChange={(ev) => setPerCustomer(ev.target.value)} className="w-40" />
        </Field>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button
          variant="primary"
          disabled={!!error || !dirty}
          onClick={() => {
            if (a == null || b == null) return
            s.updateEnterprise({ broadcastPerStaffPerDay: a, broadcastPerCustomerPerDay: b }, admin)
            toast(`群发频控已保存：每员工每天 ${a} 个任务，每客户每天 ${b} 条`)
          }}
        >
          保存
        </Button>
        {error && <span className="text-[11px] text-red-600">{error}</span>}
      </div>
    </Card>
  )
}
