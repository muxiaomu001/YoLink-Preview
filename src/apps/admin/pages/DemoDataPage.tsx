/**
 * 演示数据：重新生成、清空客户数据。
 * 整页属于演示批注层，正式产品没有这一页；导航里的入口也跟着批注开关走（见 nav.ts 的 demoOnly）。
 */
import { Eraser, RefreshCw } from 'lucide-react'
import { fmtAgo, fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { Button } from '@/ui/primitives'
import { Card, PageHeader, Stat } from '@/ui/display'
import { DemoNote } from '@/ui/DemoNote'
import { toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'

export function DemoDataPage() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const customers = s.customers.filter((c) => !c.deletedAt).length
  const messages = s.messages.length
  const dmConvs = s.conversations.filter((c) => c.kind === 'dm').length

  const regenerate = async () => {
    const ok = await confirm({
      title: '重新生成演示数据',
      body: '所有数据回到初始种子：客户、会话、消息、设置、审计日志全部重置，这次演示里做的改动都会丢失。三个窗口（管理后台 / 工作台 / 客户屏）同步刷新。',
      okText: '重新生成',
    })
    if (!ok) return
    s.resetDemo()
    toast('演示数据已重新生成，回到初始种子')
  }
  const clear = async () => {
    const ok = await confirm({
      title: '清空客户数据',
      body: '删除全部客户、私聊会话与客户消息、头衔记录、积分流水、提现、签到与举报；群里的客户成员清空。企业设置、坐席、员工、邀请组、策略等配置保留。',
      okText: '清空客户数据',
      danger: true,
    })
    if (!ok) return
    s.clearDemoCustomers(admin)
    toast('客户数据已清空，配置保留。到客户屏用邀请码注册一个新客户试试', 'warn')
  }

  return (
    <div>
      <PageHeader title="演示数据" />
      <DemoNote>正式产品没有这一页。它是给演示用的：给客户看之前把数据恢复干净，或者从零演示「注册即分配」。关掉演示批注后，左侧导航里的这一项也会消失。</DemoNote>
      <div className="mt-4 grid grid-cols-4 gap-3">
        <Stat label="当前客户数" value={customers} sub={`私聊会话 ${dmConvs} 条`} />
        <Stat label="消息数" value={messages} sub="含群与频道" />
        <Stat label="审计条目" value={s.audit.length} sub="重新生成后清零" />
        <Stat label="种子生成于" value={fmtAgo(s.seededAt)} sub={fmtDateTime(s.seededAt)} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Card title="重新生成">
          <p className="text-xs leading-relaxed text-zinc-600">
            回到初始种子：{s.enterprise.name}的 30 多位虚构客户、三个坐席、两个官方群、近 30 天的日报与统计。所有时间相对「现在」生成，任何时候打开都是新鲜的。
          </p>
          <Button className="mt-3" variant="primary" onClick={() => void regenerate()}>
            <RefreshCw size={14} /> 重新生成
          </Button>
        </Card>
        <Card title="清空客户数据">
          <p className="text-xs leading-relaxed text-zinc-600">
            只清客户侧：客户、私聊、客户消息、头衔记录、钱包与签到记录、举报。<b>保留配置</b>：企业设置、坐席、员工与角色、邀请组、策略、模块启停。适合从零演示注册流程。
          </p>
          <Button className="mt-3" variant="danger" disabled={!customers} onClick={() => void clear()}>
            <Eraser size={14} /> 清空客户数据
          </Button>
        </Card>
      </div>
    </div>
  )
}
