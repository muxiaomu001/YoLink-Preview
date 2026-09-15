/**
 * 健康状态（P1，PRD 05 1079-1091 行）：五张卡 + 测试连接。
 */
import { Activity } from 'lucide-react'
import { fmtAgo, fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { Button } from '@/ui/primitives'
import { Note, PageHeader, Pill, Stat } from '@/ui/display'
import { toast } from '@/ui/overlay'

const LATENCY_WARN_MS = 200

function StatusValue({ ok }: { ok: boolean }) {
  return ok ? <Pill tone="green" className="text-sm">正常</Pill> : <Pill tone="red" className="text-sm">异常</Pill>
}

export function HealthPage() {
  const s = useStore()
  const h = s.health
  const test = () => {
    s.runHealthCheck()
    const next = useStore.getState().health
    const bad = [next.db === 'error' && '数据库', next.redis === 'error' && 'Redis', next.storage === 'error' && '对象存储'].filter(Boolean)
    toast(bad.length ? `检测完成：${bad.join('、')}异常，请检查配置` : `检测完成：全部组件正常，延迟 ${next.latencyMs} ms`, bad.length ? 'warn' : 'ok')
  }
  return (
    <div>
      <PageHeader
        title="健康状态"
        desc="各组件连通性与实时指标。点「测试连接」逐个测试并更新状态。"
        extra={
          <>
            <span className="text-[11px] text-zinc-500">{h.checkedAt ? `上次检测 ${fmtDateTime(h.checkedAt)}（${fmtAgo(h.checkedAt)}）` : '尚未检测'}</span>
            <Button variant="primary" onClick={test}>
              <Activity size={14} /> 测试连接
            </Button>
          </>
        }
      />
      <Note>
        P1。数据库、Redis、对象存储三项是连通性检查；在线连接数是当前 WebSocket 连接；消息延迟是平均投递延迟，超过 {LATENCY_WARN_MS} ms 标黄。对象存储异常时先去「企业设置 → 对象存储」测试连接。
      </Note>
      <div className="mt-4 grid grid-cols-5 gap-3">
        <Stat label="数据库" value={<StatusValue ok={h.db === 'ok'} />} sub="PostgreSQL 连通性" />
        <Stat label="Redis" value={<StatusValue ok={h.redis === 'ok'} />} sub="Redis 连通性" />
        <Stat label="对象存储" value={<StatusValue ok={h.storage === 'ok'} />} sub="S3 兼容接口连通性" />
        <Stat label="在线连接数" value={h.connections} sub="当前 WebSocket 连接数" />
        <Stat label="消息延迟" value={`${h.latencyMs} ms`} tone={h.latencyMs > LATENCY_WARN_MS ? 'warn' : 'default'} sub="平均消息投递延迟" />
      </div>
    </div>
  )
}
