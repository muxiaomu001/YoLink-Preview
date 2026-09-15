/**
 * 策略页共用：矩阵表（只读 / 可改）、预设详情弹窗。
 */
import type { PolicyCol, PolicyItem, PolicyMatrix, PolicyPreset } from '@/domain/types'
import { POLICY_COLS } from '@/domain/seed-admin'
import { Button, Switch } from '@/ui/primitives'
import { Pill } from '@/ui/display'
import { Modal } from '@/ui/overlay'

/** 行按 group 分组，列为 POLICY_COLS；onToggle 为空时只读 */
export function MatrixTable({ items, matrix, onToggle }: { items: PolicyItem[]; matrix: PolicyMatrix; onToggle?: (key: string, col: PolicyCol, value: boolean) => void }) {
  const groups = Array.from(new Set(items.map((p) => p.group)))
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/80">
            <th className="px-4 py-2 text-left text-[11px] font-medium text-zinc-500">能力键</th>
            {POLICY_COLS.map((c) => (
              <th key={c.key} className="px-3 py-2 text-center text-[11px] font-medium text-zinc-700 whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <GroupRows key={g} group={g} items={items.filter((p) => p.group === g)} matrix={matrix} onToggle={onToggle} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GroupRows({ group, items, matrix, onToggle }: { group: string; items: PolicyItem[]; matrix: PolicyMatrix; onToggle?: (key: string, col: PolicyCol, value: boolean) => void }) {
  return (
    <>
      <tr className="bg-zinc-50/60">
        <td colSpan={POLICY_COLS.length + 1} className="px-4 py-1 text-[11px] font-medium text-zinc-500">
          {group}
        </td>
      </tr>
      {items.map((p) => (
        <tr key={p.key} className="border-b border-zinc-100 bg-white last:border-0">
          <td className="px-4 py-2">
            <div className="text-[13px] text-zinc-800">
              {p.label}
              {p.key === 'message.edit' && <Pill className="ml-1.5">P1</Pill>}
            </div>
            <div className="font-mono text-[11px] text-zinc-400">{p.key}</div>
          </td>
          {POLICY_COLS.map((c) => {
            const on = !!matrix[p.key]?.[c.key]
            return (
              <td key={c.key} className="px-3 py-2 text-center">
                {onToggle ? (
                  <Switch checked={on} onChange={(v) => onToggle(p.key, c.key, v)} />
                ) : on ? (
                  <Pill tone="green">开</Pill>
                ) : (
                  <Pill tone="red">关</Pill>
                )}
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}

export function PresetDetailModal({ preset, items, onClose }: { preset: PolicyPreset; items: PolicyItem[]; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={`预设详情：${preset.name}`} width={760} footer={<Button onClick={onClose}>关闭</Button>}>
      <p className="mb-3 text-xs text-zinc-500">{preset.desc}</p>
      <div className="rounded-md border border-zinc-200">
        <MatrixTable items={items} matrix={preset.matrix} />
      </div>
    </Modal>
  )
}
