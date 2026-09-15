/**
 * 能力矩阵标签：搜索、分组跳转、可改矩阵（客户 / 坐席两列）、效果预览。
 */
import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useStore } from '@/store/store'
import { Input } from '@/ui/primitives'
import { Card, Note } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { MatrixTable, groupAnchorId } from './PoliciesPage.parts'
import { EffectPreview } from './PoliciesPage.preview'

export function MatrixTab() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [q, setQ] = useState('')

  const groups = useMemo(() => Array.from(new Set(s.policyItems.map((p) => p.group))), [s.policyItems])
  const items = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return s.policyItems.filter((p) => !kw || p.label.toLowerCase().includes(kw) || p.key.toLowerCase().includes(kw) || p.desc.toLowerCase().includes(kw))
  }, [s.policyItems, q])
  const offModules = Object.entries(s.enterprise.modules)
    .filter(([, on]) => !on)
    .map(([k]) => k)

  const jump = (g: string) => document.getElementById(groupAnchorId(g))?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <>
      <Note>
        每一行就是客户 App 与工作台里"能不能"的开关，只有两列：「客户」管客户手机 App 上的入口（加好友、建群、退群、发媒体……），「坐席」管桌面工作台的聊天层。改了立即保存，在线用户立即收到策略更新推送并刷新能力快照。
        {offModules.length > 0 && <span className="ml-1 text-amber-800">当前有模块已停用，其能力键整行灰显不生效。</span>}
      </Note>
      <Card
        className="mt-4"
        padded={false}
        title={
          <span>
            能力矩阵 <span className="ml-1 font-normal text-zinc-400">{items.length} / {s.policyItems.length} 项</span>
          </span>
        }
        extra={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={12} className="pointer-events-none absolute top-2 left-2 text-zinc-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜能力名或键，如 friend" className="h-7 w-52 pl-6 text-xs" />
            </div>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-100 px-4 py-2 text-[11px]">
          <span className="text-zinc-400">跳到分组：</span>
          {groups.map((g) => {
            const n = items.filter((p) => p.group === g).length
            return (
              <button key={g} type="button" disabled={!n} onClick={() => jump(g)} className="rounded-full border border-zinc-200 px-2 py-0.5 text-zinc-600 hover:border-brand-300 hover:text-brand-800 disabled:opacity-40">
                {g} <span className="text-zinc-400">{n}</span>
              </button>
            )
          })}
        </div>
        <MatrixTable
          items={items}
          matrix={s.policyMatrix}
          modules={s.enterprise.modules}
          onToggle={(key, col, value) => {
            s.setPolicyCap(key, col, value, admin)
            const item = s.policyItems.find((p) => p.key === key)
            toast(`「${item?.label ?? key}」已${value ? '开启' : '关闭'}，客户端会立即刷新能力快照`)
          }}
        />
      </Card>
      <div className="mt-4">
        <EffectPreview />
      </div>
    </>
  )
}
