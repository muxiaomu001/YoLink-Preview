/**
 * 备份与恢复（PRD 05 1059-1077 行）：备份列表、立即备份、恢复二次确认。
 */
import { DatabaseBackup, Download, RotateCcw } from 'lucide-react'
import type { Backup } from '@/domain/types'
import { fmtAgo } from '@/domain/time'
import { useStore } from '@/store/store'
import { Button } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, Table } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { DemoLevelTag, DemoNote } from '@/ui/DemoNote'
import { confirm } from '@/ui/confirm'

const pad = (n: number) => String(n).padStart(2, '0')
/** PRD 要求到秒：YYYY-MM-DD HH:MM:SS */
function fmtSeconds(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
function fmtSize(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb} MB`
}

export function BackupsPage() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const rows = [...s.backups].sort((a, b) => b.at.localeCompare(a.at))
  const latest = rows[0]

  const run = () => {
    s.triggerBackup(admin)
    toast('备份任务已提交，请稍后在列表中查看', 'info')
  }
  const restore = async (b: Backup) => {
    const ok = await confirm({
      title: `从 ${fmtSeconds(b.at)} 的备份恢复`,
      body: '恢复将覆盖当前数据，是否继续？恢复期间服务不可用，建议在低峰期操作。',
      okText: '确认恢复',
      danger: true,
    })
    if (!ok) return
    s.restoreBackup(b.id, admin)
    toast(`已提交恢复任务：${fmtSeconds(b.at)} 的备份`, 'warn')
  }
  const download = (b: Backup) => toast(`开始下载 ${fmtSeconds(b.at)} 的备份（${fmtSize(b.sizeMb)}），链接 15 分钟内有效`, 'info')

  return (
    <div>
      <PageHeader
        title="备份与恢复"
        desc="每日自动全量备份。实际执行由部署脚本完成，后台按钮只是触发。"
        extra={
          <Button variant="primary" onClick={run}>
            <DatabaseBackup size={14} /> 立即备份
          </Button>
        }
      />
      <Note>
        恢复前会二次确认，恢复会覆盖当前数据并记入审计日志。
        {latest && (
          <>
            {' '}
            最近一次备份：{fmtAgo(latest.at)}，{fmtSize(latest.sizeMb)}。
          </>
        )}
      </Note>
      <DemoNote className="mt-2">
        备份脚本第一版就有；后台里的备份与恢复按钮排在第二版<DemoLevelTag level="P1" />。
      </DemoNote>
      <Card className="mt-4" padded={false}>
        <Table
          rows={rows}
          rowKey={(b) => b.id}
          empty="还没有备份"
          columns={[
            { key: 'at', title: '备份时间', render: (b) => <span className="font-mono tabular-nums text-zinc-800">{fmtSeconds(b.at)}</span> },
            { key: 'size', title: '备份大小', align: 'right', render: (b) => <span className="tabular-nums">{fmtSize(b.sizeMb)}</span> },
            { key: 'status', title: '状态', render: (b) => (b.status === 'done' ? <Pill tone="green">完成</Pill> : <Pill tone="amber">进行中</Pill>) },
            {
              key: 'ops',
              title: '操作',
              align: 'right',
              render: (b) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" disabled={b.status !== 'done'} onClick={() => download(b)}>
                    <Download size={12} /> 下载
                  </Button>
                  <Button size="sm" variant="danger" disabled={b.status !== 'done'} onClick={() => void restore(b)}>
                    <RotateCcw size={12} /> 恢复
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
