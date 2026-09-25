import { useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { confirm } from '@/ui/confirm'
import { Button, Checkbox, Field, Input, Switch } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, Table, Tabs } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { CsvImportTab } from './ProfileSyncPage.csv'
import { AutomationTab, CustomFieldsTab } from './ProfileSyncPage.parts'
import { DemoLevelTag } from '@/ui/DemoNote'

type TabKey = 'sync' | 'csv' | 'fields' | 'automation'

const DOC_PURCHASE_URL = 'https://docs.yolink.example/api/profile/purchases'
const DOC_REFERRAL_URL = 'https://docs.yolink.example/api/profile/referrals'

/** 客户画像（P0）：同步设置、CSV 导入、通用字段（P1）、自动化规则（P1） */
export function ProfileSyncPage() {
  const s = useStore()
  const [tab, setTab] = useState<TabKey>('sync')
  return (
    <div>
      <PageHeader title="客户画像" desc="把企业自有系统的业务记录与邀请关系同步过来，展示在客户资料中。支持接口推送与 CSV 导入两种方式，金额字段按角色控制可见范围。" />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: 'sync', label: '同步设置' },
          { key: 'csv', label: 'CSV 导入' },
          { key: 'fields', label: <>通用字段<DemoLevelTag level="P1" /></>, count: s.customFields.length },
          { key: 'automation', label: <>自动化规则<DemoLevelTag level="P1" /></>, count: s.automationRules.length },
        ]}
      />
      <div className="mt-4">
        {tab === 'sync' && <SyncSettingsTab />}
        {tab === 'csv' && <CsvImportTab />}
        {tab === 'fields' && <CustomFieldsTab />}
        {tab === 'automation' && <AutomationTab />}
      </div>
    </div>
  )
}

function SyncSettingsTab() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const ps = s.profileSync
  const [roleIds, setRoleIds] = useState<string[]>(ps.amountVisibleRoleIds)
  const [scheduledPull, setScheduledPull] = useState(ps.scheduledPull)
  const [webhookUrl, setWebhookUrl] = useState(ps.webhookUrl)
  const [fullKey, setFullKey] = useState<string | null>(null)
  const webhookOk = !webhookUrl.trim() || /^https:\/\/[^\s]+$/.test(webhookUrl.trim())
  const error = !webhookOk ? '回传地址必须是 https:// 开头' : roleIds.length === 0 ? '至少选一个可见金额的角色' : ''

  const regenerate = async () => {
    const ok = await confirm({ title: '重新生成 API Key', body: '旧 Key 立即失效，业务系统里的配置需要同步更换。新 Key 只显示一次。', okText: '重新生成', danger: true })
    if (!ok) return
    setFullKey(s.regenerateProfileApiKey(admin))
  }
  const save = () => {
    if (error) return
    s.updateProfileSync({ amountVisibleRoleIds: roleIds, scheduledPull, webhookUrl: webhookUrl.trim() }, admin)
    toast('画像同步设置已保存')
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_360px] gap-4">
        <Card title="接口接入" extra={<Button size="sm" variant="primary" disabled={!!error} onClick={save}>保存</Button>}>
          <div className="space-y-3">
            <Field label="API Key" hint="只有画像写入权限，不能读客户、不能发消息">
              <div className="flex h-8 items-center gap-3">
                <span className="font-mono text-[13px] text-zinc-700">{ps.apiKeyConfigured ? `${ps.apiKeyPrefix}••••••••••••` : '未生成'}</span>
                <Button size="sm" onClick={() => void regenerate()}>
                  <RefreshCw size={12} /> {ps.apiKeyConfigured ? '重新生成' : '生成'}
                </Button>
              </div>
            </Field>
            <Field label="接口文档">
              <div className="flex flex-col gap-1 text-[13px]">
                <a className="inline-flex items-center gap-1 text-brand-700 hover:underline" href={DOC_PURCHASE_URL} target="_blank" rel="noreferrer">
                  <ExternalLink size={12} /> POST /profile/purchases 业务记录同步
                </a>
                <a className="inline-flex items-center gap-1 text-brand-700 hover:underline" href={DOC_REFERRAL_URL} target="_blank" rel="noreferrer">
                  <ExternalLink size={12} /> POST /profile/referrals 邀请关系同步
                </a>
              </div>
            </Field>
            <Field label="金额字段可见角色" required hint="其他角色只看到「已入金」不看到数字">
              <div className="flex flex-wrap gap-3">
                {s.roles.map((r) => (
                  <Checkbox key={r.id} checked={roleIds.includes(r.id)} onChange={(v) => setRoleIds((l) => (v ? [...l, r.id] : l.filter((x) => x !== r.id)))} label={r.name} />
                ))}
              </div>
            </Field>
            <div className="rounded-md border border-dashed border-zinc-200 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-800">
                进阶同步<DemoLevelTag level="P1" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs">
                    <div className="text-zinc-800">定时拉取</div>
                    <div className="text-zinc-500">每日 02:00 从业务系统拉增量；字段映射：手机号 → phone，订单号 → product，成交额 → amount，成交日 → at</div>
                  </div>
                  <Switch checked={scheduledPull} onChange={setScheduledPull} />
                </div>
                <Field label="反向回传 webhook URL" hint="坐席改备注、挂头衔时回传给业务系统；留空不回传">
                  <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://crm.example.com/hooks/yolink" />
                </Field>
              </div>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        </Card>
        <Note>
          匹配键：手机号或业务系统 ID。接口推来的数据先按业务系统 ID 找，找不到再按手机号；都找不到计入「未匹配」，不落库。同步成功会触发自动化规则（如入金后挂头衔）。
        </Note>
      </div>
      <Card title="最近同步记录" padded={false}>
        <Table
          rows={s.syncRecords}
          rowKey={(r) => r.id}
          dense
          columns={[
            { key: 'at', title: '时间', render: (r) => <span className="tabular-nums text-zinc-600">{fmtDateTime(r.at)}</span> },
            { key: 'kind', title: '类型', render: (r) => (r.kind === 'purchase' ? <Pill tone="blue">业务记录</Pill> : <Pill tone="purple">邀请关系</Pill>) },
            { key: 'source', title: '来源', render: (r) => (r.source === 'api' ? 'API' : 'CSV') },
            { key: 'count', title: '条数', align: 'right', render: (r) => <span className="tabular-nums">{r.count}</span> },
            {
              key: 'failed',
              title: '失败数与原因',
              render: (r) => (r.failed ? <span className="text-red-600">{r.failed} 条：{r.failReason ?? '未知原因'}</span> : <span className="text-zinc-400">0</span>),
            },
            { key: 'unmatched', title: '未匹配数', align: 'right', render: (r) => <span className={r.unmatched ? 'tabular-nums text-amber-600' : 'tabular-nums text-zinc-400'}>{r.unmatched}</span> },
          ]}
        />
      </Card>
      {fullKey && (
        <Modal
          open
          onClose={() => setFullKey(null)}
          title="新的 API Key（只显示这一次）"
          width={520}
          footer={
            <Button variant="primary" onClick={() => setFullKey(null)}>
              我已保存
            </Button>
          }
        >
          <div className="space-y-3">
            <div className="rounded-md bg-zinc-900 px-3 py-2 font-mono text-[13px] break-all text-emerald-300">{fullKey}</div>
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(fullKey)
                  toast('已复制 API Key')
                }}
              >
                复制
              </Button>
            </div>
            <Note tone="amber">关闭后无法再次查看，只能重新生成。把它配置到业务系统的同步任务里，权限只有画像写入。</Note>
          </div>
        </Modal>
      )}
    </div>
  )
}
