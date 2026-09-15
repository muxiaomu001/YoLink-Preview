import { useStore } from '@/store/store'
import { Button, Switch } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill } from '@/ui/display'
import { toast } from '@/ui/overlay'

export function PoliciesPage() {
  const s = useStore()
  const active = s.policyPresets.find((p) => p.id === s.activePresetId)!
  const groups = Array.from(new Set(s.policyItems.map((p) => p.group)))
  return (
    <div>
      <PageHeader title="策略预设与能力矩阵" desc="策略决定客户在 App 里能做什么。预设只是批量填默认值，之后每一项仍可单独改。聊天层能力作用在坐席与客户上，不在员工上。" />
      <div className="mb-4 flex gap-3">
        {s.policyPresets.map((p) => (
          <div key={p.id} className={`flex-1 rounded-lg border p-4 ${p.id === s.activePresetId ? 'border-brand-400 bg-brand-50/40' : 'border-zinc-200 bg-white'}`}>
            <div className="flex items-center justify-between">
              <div className="font-medium text-zinc-900">
                {p.name} {p.builtin && <Pill className="ml-1">系统</Pill>}
              </div>
              {p.id === s.activePresetId ? (
                <Pill tone="blue">当前生效</Pill>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    s.applyPreset(p.id, s.session.adminStaffId!)
                    toast(`已应用「${p.name}」`)
                  }}
                >
                  应用
                </Button>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-500">{p.id === 'preset_cs' ? '客户不能加好友、不能搜索、不能互聊、看不到群成员；只与官方坐席往来。' : '所有角色开放全部社交能力，数值取主流社交 IM 默认值。'}</p>
          </div>
        ))}
      </div>
      <Note>
        裁决顺序：模块授权 → 角色硬边界（经营者只读、客户不进工作台、坐席不能直接登录）→ 策略矩阵（企业默认 → 群级覆盖 → 用户级覆盖）→ 员工角色能力与群内角色。
      </Note>
      <Card className="mt-4" title={`能力矩阵 · 客户角色（当前：${active.name}）`} padded={false}>
        {groups.map((g) => (
          <div key={g}>
            <div className="bg-zinc-50/80 px-4 py-1.5 text-[11px] font-medium text-zinc-500">{g}</div>
            {s.policyItems
              .filter((p) => p.group === g)
              .map((p) => (
                <div key={p.key} className="flex items-center justify-between border-b border-zinc-100 px-4 py-2 last:border-0">
                  <div>
                    <div className="text-[13px] text-zinc-800">{p.label}</div>
                    <div className="font-mono text-[11px] text-zinc-400">{p.key}</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span>坐席：允许</span>
                    <span className="text-zinc-300">|</span>
                    <span>客户：</span>
                    <Switch checked={!!active.customer[p.key]} onChange={() => toast('演示中预设为只读，实际产品可逐项改', 'info')} />
                  </div>
                </div>
              ))}
          </div>
        ))}
      </Card>
    </div>
  )
}
