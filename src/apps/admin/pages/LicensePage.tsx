/**
 * 版本与许可（PRD 05 1049-1057 行）：信息卡 + 模块授权表 + 上传新许可文件。
 */
import { Upload } from 'lucide-react'
import { fmtDate } from '@/domain/time'
import { useStore } from '@/store/store'
import { Button } from '@/ui/primitives'
import { Card, KV, Note, PageHeader, Pill, Table } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'

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
  const admin = s.session.adminStaffId!
  const lic = s.license
  const left = daysUntil(lic.expiresAt)
  const expiringSoon = left <= WARN_DAYS

  const upload = async () => {
    const ok = await confirm({
      title: '上传新许可文件',
      body: '选择由 YoLink 签发的 .lic 文件，上传后立即生效，无需重启。演示里直接把到期日延长一年并启用全部模块。',
      okText: '上传并生效',
    })
    if (!ok) return
    s.uploadLicense(admin)
    toast('已模拟续期：示例到期日延长一年；不代表正式续费规则')
  }

  return (
    <div>
      <PageHeader
        title="版本与许可"
        desc="展示版本、授权与到期状态。订阅到期如何限制使用尚未决定；此页续期仅模拟，不上传或校验真实许可。"
        extra={
          <Button variant="primary" onClick={() => void upload()}>
            <Upload size={14} /> 上传新许可文件
          </Button>
        }
      />
      {expiringSoon && (
        <div className="mb-4">
          <Note tone="amber">许可将在 {left} 天后到期（{fmtDate(lic.expiresAt)}）。到期后的聊天、查询、模块停用与宽限期规则待产品确认。</Note>
        </div>
      )}
      <div className="grid grid-cols-[360px_1fr] gap-4">
        <Card title="实例信息">
          <KV
            items={[
              { k: '当前版本', v: <span className="font-mono">{lic.version}</span> },
              { k: '实例标识', v: <span className="font-mono text-[11px]">{lic.instanceId}</span> },
              { k: '许可类型', v: lic.type === 'private' ? <Pill tone="blue">私有化部署</Pill> : <Pill tone="purple">SaaS 托管</Pill> },
              { k: '许可到期时间', v: <ExpiryCell at={lic.expiresAt} /> },
              { k: '企业码', v: <span className="font-mono">{s.enterprise.code}</span> },
            ]}
          />
        </Card>
        <Card title="模块授权表" padded={false}>
          <Table
            rows={lic.modules}
            rowKey={(m) => m.key}
            dense
            columns={[
              { key: 'name', title: '模块', render: (m) => <span className="font-medium text-zinc-900">{m.name}</span> },
              { key: 'enabled', title: '启用状态', render: (m) => (m.enabled ? <Pill tone="green">已授权</Pill> : <Pill tone="red">未授权</Pill>) },
              {
                key: 'bots',
                title: '机器人账号 上限 / 已用',
                align: 'right',
                render: (m) => (m.botLimit ? <span className="tabular-nums">{m.botUsed} / {m.botLimit}</span> : <span className="text-zinc-400">不适用</span>),
              },
              { key: 'expires', title: '本期到期日', render: (m) => <ExpiryCell at={m.expiresAt} /> },
            ]}
          />
        </Card>
      </div>
      <div className="mt-4">
        <Note>到期日临近 {WARN_DAYS} 天标黄。模块授权与「模块启停」是两回事：授权是能不能开，启停是企业自己要不要开。</Note>
      </div>
    </div>
  )
}
