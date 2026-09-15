import { useState } from 'react'
import type { PolicyChange, PolicyPreset } from '@/domain/types'
import { fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { staffById } from '@/store/selectors'
import { Button } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, Table, Tabs } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { PresetDetailModal } from './PoliciesPage.parts'
import { MatrixTab } from './PoliciesPage.matrix'
import { NumbersTab } from './PoliciesPage.numbers'
import { OverridesTab } from './PoliciesPage.overrides'

type Tab = 'matrix' | 'presets' | 'numbers' | 'overrides' | 'changes'

const CHANGE_LABEL: Record<PolicyChange['kind'], { name: string; tone: 'blue' | 'green' | 'amber' | 'purple' }> = {
  preset: { name: '应用预设', tone: 'blue' },
  cap: { name: '修改能力', tone: 'green' },
  number: { name: '修改数值', tone: 'amber' },
  override: { name: '群级 / 用户级覆盖', tone: 'purple' },
}

export function PoliciesPage() {
  const s = useStore()
  const [tab, setTab] = useState<Tab>('matrix')
  const active = s.policyPresets.find((p) => p.id === s.activePresetId)
  return (
    <div>
      <PageHeader title="策略与能力开关" desc={`客户与坐席在 App 里能做什么，全在这一页。预设只是批量填默认值，之后每一项仍可单独改。当前生效：${active?.name ?? '自定义'}`} />
      <Note>
        这里的每一行就是客户 App 与工作台里"能不能"的开关。改了，在线用户立即收到策略更新推送。裁决顺序：模块授权 → 角色硬边界 → 策略矩阵（企业默认 → 群级覆盖 → 用户级覆盖）→ 员工角色能力与群内角色。
      </Note>
      <Tabs
        className="mt-4 mb-4"
        value={tab}
        onChange={setTab}
        items={[
          { key: 'matrix', label: '能力矩阵', count: s.policyItems.length },
          { key: 'presets', label: '预设列表', count: s.policyPresets.length },
          { key: 'numbers', label: '数值型策略' },
          { key: 'overrides', label: '群级 / 用户级覆盖（P1）', count: s.policyOverrides.length },
          { key: 'changes', label: '变更记录', count: s.policyChanges.length },
        ]}
      />
      {tab === 'matrix' && <MatrixTab />}
      {tab === 'presets' && <PresetsTab />}
      {tab === 'numbers' && <NumbersTab />}
      {tab === 'overrides' && <OverridesTab />}
      {tab === 'changes' && <ChangesTab />}
    </div>
  )
}

function PresetsTab() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [detail, setDetail] = useState<PolicyPreset | null>(null)

  const apply = async (p: PolicyPreset) => {
    const ok = await confirm({ title: `应用预设「${p.name}」`, body: '应用此预设将覆盖当前策略，是否继续？', okText: '应用' })
    if (!ok) return
    s.applyPreset(p.id, admin)
    toast(`已应用「${p.name}」，能力矩阵已覆盖，在线用户收到策略更新推送`)
  }
  const copy = (p: PolicyPreset) => {
    const c = s.copyPreset(p.id, admin)
    if (c) toast(`已复制为「${c.name}」，可在详情里查看；复制件不是内置，可删除`)
  }
  const remove = async (p: PolicyPreset) => {
    const ok = await confirm({ title: `删除预设「${p.name}」？`, body: '删除后不可恢复。内置预设与当前生效的预设不能删除。', okText: '删除', danger: true })
    if (!ok) return
    if (s.deletePreset(p.id, admin)) toast(`已删除预设「${p.name}」`)
    else toast('内置或当前生效的预设不能删除', 'warn')
  }

  return (
    <>
      <Note>内置「客服预设」：客户不能加好友、搜索、互聊、看群成员、建群建频道、@ 所有人、转发；坐席全部开放。「社交预设」：所有角色全部开放。复制后得到一份可删除的副本。应用后回到「能力矩阵」逐项微调。</Note>
      <Card className="mt-4" padded={false}>
        <Table
          rows={s.policyPresets}
          rowKey={(p) => p.id}
          columns={[
            {
              key: 'name',
              title: '预设名称',
              render: (p) => (
                <span className="font-medium text-zinc-900">
                  {p.name}
                  {p.builtin && <Pill className="ml-1.5">系统</Pill>}
                  {p.id === s.activePresetId && (
                    <Pill tone="blue" className="ml-1.5">
                      当前生效
                    </Pill>
                  )}
                </span>
              ),
            },
            { key: 'desc', title: '说明', render: (p) => <span className="text-zinc-500">{p.desc}</span> },
            {
              key: 'ops',
              title: '操作',
              align: 'right',
              render: (p) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setDetail(p)}>
                    查看详情
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => copy(p)}>
                    复制
                  </Button>
                  <Button size="sm" variant="secondary" disabled={p.id === s.activePresetId} onClick={() => void apply(p)}>
                    应用
                  </Button>
                  <Button size="sm" variant="danger" disabled={p.builtin || p.id === s.activePresetId} title={p.builtin ? '内置预设不可删除' : p.id === s.activePresetId ? '当前生效的预设不可删除' : undefined} onClick={() => void remove(p)}>
                    删除
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      {detail && <PresetDetailModal preset={detail} items={s.policyItems} onClose={() => setDetail(null)} />}
    </>
  )
}

function ChangesTab() {
  const s = useStore()
  return (
    <Card title="变更记录" padded={false}>
      <Table
        rows={s.policyChanges}
        rowKey={(c) => c.id}
        dense
        columns={[
          { key: 'at', title: '时间', width: '160px', render: (c) => <span className="tabular-nums text-zinc-600">{fmtDateTime(c.at)}</span> },
          { key: 'by', title: '操作人', render: (c) => staffById(s, c.byStaffId)?.name ?? '-' },
          { key: 'kind', title: '变更类型', render: (c) => <Pill tone={CHANGE_LABEL[c.kind].tone}>{CHANGE_LABEL[c.kind].name}</Pill> },
          { key: 'detail', title: '详情', render: (c) => <span className="text-zinc-700">{c.detail}</span> },
        ]}
      />
    </Card>
  )
}
