/**
 * 群发管理（管理后台，P0）：今日任务 / 送达 / 待发送三个数，全部坐席的群发记录，
 * 管理员可直接以某坐席身份给其全部好友新建一次群发。频控读企业设置。
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import type { Broadcast } from '@/domain/types'
import { useStore } from '@/store/store'
import { Button } from '@/ui/primitives'
import { Card, Note, PageHeader, Stat } from '@/ui/display'
import { HelpTip } from '@/ui/help'
import { BroadcastAdminDetailModal, BroadcastCreateModal, BroadcastsAdminTable } from './BroadcastsAdminPage.parts'

export function BroadcastsAdminPage() {
  const s = useStore()
  const [detail, setDetail] = useState<Broadcast | null>(null)
  const [creating, setCreating] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const rows = useMemo(() => [...s.broadcasts].sort((a, b) => b.sentAt.localeCompare(a.sentAt)), [s.broadcasts])
  const todayRows = rows.filter((b) => b.sentAt.slice(0, 10) === today)
  const todaySent = todayRows.reduce((sum, b) => sum + b.sentCount, 0)
  const scheduled = rows.filter((b) => b.status === 'scheduled').length
  const perStaff = s.enterprise.broadcastPerStaffPerDay
  const perCustomer = s.enterprise.broadcastPerCustomerPerDay

  if (!s.enterprise.modules.broadcast) return <Note tone="amber">企业已停用「群发」模块，在「模块启停」里开启后再用。</Note>

  return (
    <div>
      <PageHeader
        title="群发管理"
        desc={
          <span className="inline-flex items-center gap-1.5">
            全部坐席的群发记录；新建群发以所选坐席身份发给它的全部好友。
            <HelpTip
              text={
                <span>
                  频控：每个实操员工每天 {perStaff} 个任务（跨其持有的坐席合并），每客户每天最多收 {perCustomer} 条（跨坐席、跨任务合并）。目标人群在发送时计算；自动跳过已注销、已拉黑、屏蔽该坐席、当日已达频控的客户。
                  <Link to="/admin/settings" className="ml-1 text-brand-700 hover:underline">
                    去企业设置 › 群发与话术 改
                  </Link>
                </span>
              }
            />
          </span>
        }
        extra={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={14} /> 新建群发
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="今日群发任务" value={todayRows.length} sub="按创建时间算，含定时任务" />
        <Stat label="今日送达人数" value={todaySent} sub="各任务送达数之和" />
        <Stat label="待发送" value={scheduled} tone={scheduled ? 'warn' : 'default'} sub="定时任务，到点按当时人群发" />
      </div>
      <Card title={`群发记录（${rows.length} 条）`} padded={false}>
        <BroadcastsAdminTable s={s} rows={rows} onDetail={setDetail} />
      </Card>
      {detail && <BroadcastAdminDetailModal s={s} b={detail} onClose={() => setDetail(null)} />}
      {creating && <BroadcastCreateModal s={s} onClose={() => setCreating(false)} />}
    </div>
  )
}
