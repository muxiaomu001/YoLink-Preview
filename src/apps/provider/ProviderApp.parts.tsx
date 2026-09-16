import { useState } from 'react'
import type { ProviderInstance } from '@/domain/types'
import { useStore } from '@/store/store'
import { Button, Field, Input, Textarea } from '@/ui/primitives'
import { Modal, toast } from '@/ui/overlay'
import { Note } from '@/ui/display'

const today = () => new Date().toISOString().slice(0, 10)

export function BindInstanceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const bind = useStore((state) => state.bindProviderInstance)
  const [form, setForm] = useState({ enterpriseName: '', enterpriseCode: '', deviceCode: '', expiresOn: '' })
  const [error, setError] = useState('')
  const valid = form.enterpriseName.trim().length >= 2 && /^[A-Za-z0-9-]{2,16}$/.test(form.enterpriseCode.trim()) && form.deviceCode.trim().length >= 8 && form.expiresOn >= today()

  const submit = () => {
    const result = bind(form)
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast(`已绑定「${result.instance.enterpriseName}」的企业部署实例`)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="绑定企业部署实例"
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!valid} onClick={submit}>绑定</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Note>设备码用于识别企业部署实例，不是员工电脑，也不是客户注册设备。</Note>
        <div className="grid grid-cols-2 gap-4">
          <Field label="企业名称" required>
            <Input value={form.enterpriseName} onChange={(event) => setForm((value) => ({ ...value, enterpriseName: event.target.value }))} placeholder="例如：恒信财富" />
          </Field>
          <Field label="企业码" required hint="2 到 16 位字母或数字">
            <Input value={form.enterpriseCode} onChange={(event) => setForm((value) => ({ ...value, enterpriseCode: event.target.value.toUpperCase() }))} placeholder="例如：HXWM" />
          </Field>
        </div>
        <Field label="实例设备码" required hint="由客户部署实例生成">
          <Input value={form.deviceCode} onChange={(event) => { setError(''); setForm((value) => ({ ...value, deviceCode: event.target.value.toUpperCase() })) }} placeholder="例如：HX-PROD-7C2A-91F4" className="font-mono" />
        </Field>
        <Field label="首次到期日" required hint="由本次授权确认">
          <Input type="date" min={today()} value={form.expiresOn} onChange={(event) => setForm((value) => ({ ...value, expiresOn: event.target.value }))} />
        </Field>
        {error && <div className="text-xs text-red-600">{error}</div>}
      </div>
    </Modal>
  )
}

export function RenewInstanceModal({ instance, onClose }: { instance: ProviderInstance | null; onClose: () => void }) {
  const renew = useStore((state) => state.renewProviderInstance)
  const [expiresOn, setExpiresOn] = useState('')
  if (!instance) return null
  return (
    <Modal
      open
      onClose={onClose}
      title={`续期：${instance.enterpriseName}`}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={expiresOn < today()} onClick={() => { renew(instance.id, expiresOn); toast(`已更新「${instance.enterpriseName}」的到期日`); onClose() }}>确认续期</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="新到期日" required hint={`当前到期日 ${instance.expiresAt.slice(0, 10)}`}>
          <Input type="date" min={today()} value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} />
        </Field>
        {instance.stoppedAt && <Note tone="amber">这个实例目前已人工停用。续期只更新到期日，不会自动恢复。</Note>}
      </div>
    </Modal>
  )
}

export function StopInstanceModal({ instance, onClose }: { instance: ProviderInstance | null; onClose: () => void }) {
  const stop = useStore((state) => state.stopProviderInstance)
  const [reason, setReason] = useState('')
  if (!instance) return null
  return (
    <Modal
      open
      onClose={onClose}
      title={`人工停用：${instance.enterpriseName}`}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="danger" disabled={reason.trim().length < 2} onClick={() => { stop(instance.id, reason); toast(`已人工停用「${instance.enterpriseName}」`); onClose() }}>确认停用</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Note tone="amber">到期和停用是两种状态。只有在这里确认后，实例才会标记为人工停用。</Note>
        <Field label="停用原因" required hint="至少 2 个字">
          <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="填写客户确认、合同或服务安排等原因" />
        </Field>
      </div>
    </Modal>
  )
}
