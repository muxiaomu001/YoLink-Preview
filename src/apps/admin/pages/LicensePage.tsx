/**
 * 版本与许可（PRD 05 1049-1057 行）：整个系统的许可信息与到期提醒。
 */
import { fmtDate } from '@/domain/time'
import { PROVIDER_STATUS_LABEL, providerInstanceStatus } from '@/domain/providerLicense'
import { useStore } from '@/store/store'
import { Card, KV, Note, PageHeader, Pill } from '@/ui/display'
import { DemoNote } from '@/ui/DemoNote'

const WARN_DAYS = 30
const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)

function ExpiryCell({ at }: { at: string }) {
  const d = daysUntil(at)
  if (d < 0) return <Pill tone="red">已过期 {fmtDate(at)}</Pill>
  if (d <= WARN_DAYS) return <Pill tone="amber">{fmtDate(at)} · 剩 {d} 天</Pill>
  return <span className="tabular-nums text-zinc-700">{fmtDate(at)}</span>
}

export function LicensePage() {
  const s = useStore()
  const lic = s.license
  const providerInstance = s.providerInstances.find((instance) => instance.instanceId === lic.instanceId)
  const providerStatus = providerInstance ? providerInstanceStatus(providerInstance) : 'active'
  const left = daysUntil(lic.expiresAt)
  const expiringSoon = left <= WARN_DAYS

  return (
    <div>
      <PageHeader
        title="版本与许可"
        desc="展示当前版本、授权范围与到期状态。续期、暂停服务和恢复服务由 YoLink 供应方处理。"
      />
      {expiringSoon && (
        <div className="mb-4">
          <Note tone="amber">{left < 0 ? `许可已于 ${fmtDate(lic.expiresAt)} 到期。到期不会自动暂停服务，请联系 YoLink 供应方续期。` : `许可将在 ${left} 天后到期（${fmtDate(lic.expiresAt)}），请联系 YoLink 供应方续期。`}</Note>
        </div>
      )}
      {providerStatus === 'stopped' && <Note tone="amber" className="mb-4">此实例已由 YoLink 供应方暂停服务。原因：{providerInstance?.stopReason}</Note>}
      <DemoNote className="mb-4">供应方续期和暂停服务操作在独立授权中心演示；请从演示首页切换到供应方身份进入。企业管理员在这里不能给自己续期或恢复服务。</DemoNote>
      <div className="grid grid-cols-1 gap-4">
        <Card title="实例信息">
          <KV
            items={[
              { k: '当前版本', v: <span className="font-mono">{lic.version}</span> },
              { k: '实例标识', v: <span className="font-mono text-[11px]">{lic.instanceId}</span> },
              { k: '许可类型', v: lic.type === 'private' ? <Pill tone="blue">私有化部署</Pill> : <Pill tone="purple">SaaS 托管</Pill> },
              { k: '许可到期时间', v: <ExpiryCell at={lic.expiresAt} /> },
              { k: '企业码', v: <span className="font-mono">{s.enterprise.code}</span> },
              { k: '实例设备码', v: <span className="font-mono text-[11px]">{providerInstance?.deviceCode ?? '-'}</span> },
              { k: '供应方状态', v: providerStatus === 'stopped' ? <Pill tone="red">{PROVIDER_STATUS_LABEL.stopped}</Pill> : <Pill tone="green">{PROVIDER_STATUS_LABEL.active}</Pill> },
            ]}
          />
        </Card>
      </div>
      <div className="mt-4">
        <Note>到期日临近 {WARN_DAYS} 天标黄。许可覆盖整个系统，模块由企业在「模块启停」中自行开关。</Note>
      </div>
    </div>
  )
}
