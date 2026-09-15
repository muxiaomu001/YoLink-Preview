/**
 * 能力矩阵标签：搜索、列筛选、分组跳转、可改矩阵、效果预览。
 */
import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { clsx } from 'clsx'
import { useStore } from '@/store/store'
import { Input } from '@/ui/primitives'
import { Card, Note } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { MatrixTable, groupAnchorId, type ColFilter } from './PoliciesPage.parts'
import { EffectPreview } from './PoliciesPage.preview'

const COL_FILTERS: { v: ColFilter; label: string }[] = [
  { v: 'all', label: '全部列' },
  { v: 'customer', label: '只看客户端' },
  { v: 'staff', label: '只看坐席端' },
]

export function MatrixTab() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [q, setQ] = useState('')
  const [colFilter, setColFilter] = useState<ColFilter>('all')

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
        每一行就是客户 App 与工作台里"能不能"的开关：客户列管手机屏上的入口（加好友、建群、退群、发媒体……），坐席列管工作台聊天层。改了立即保存，在线用户立即收到策略更新推送并刷新能力快照。
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
            <div className="flex overflow-hidden rounded-md border border-zinc-200 text-[11px]">
              {COL_FILTERS.map((f) => (
                <button key={f.v} type="button" onClick={() => setColFilter(f.v)} className={clsx('px-2 py-1', colFilter === f.v ? 'bg-brand-50 font-medium text-brand-800' : 'text-zinc-500 hover:bg-zinc-50')}>
                  {f.label}
                </button>
              ))}
            </div>
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
          colFilter={colFilter}
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
