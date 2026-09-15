/**
 * 策略页共用：能力矩阵表（只读 / 可改）、预设详情弹窗、来源文案。
 * 每一行就是客户 App 与工作台里"能不能"的一个开关。
 */
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import type { ModuleKey, PolicyCol, PolicyItem, PolicyMatrix, PolicyPreset } from '@/domain/types'
import { POLICY_COLS } from '@/domain/seed-admin'
import { MODULE_LABEL } from '@/domain/labels'
import { useStore } from '@/store/store'
import { Button, Switch } from '@/ui/primitives'
import { Pill } from '@/ui/display'
import { Modal } from '@/ui/overlay'
import { groupAnchorId } from './PoliciesPage.shared'

interface MatrixTableProps {
  items: PolicyItem[]
  matrix: PolicyMatrix
  modules: Record<ModuleKey, boolean>
  /** 为空时只读 */
  onToggle?: (key: string, col: PolicyCol, value: boolean) => void
}

/** 行按 group 分组，列只有客户 / 坐席两列（表头下用灰字注明端）；模块停用整行灰显；staffOnly 的客户列显示「—」 */
export function MatrixTable({ items, matrix, modules, onToggle }: MatrixTableProps) {
  const cols = POLICY_COLS
  const groups = Array.from(new Set(items.map((p) => p.group)))
  if (!items.length) return <div className="px-4 py-10 text-center text-xs text-zinc-400">没有匹配的能力键</div>
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/80">
            <th className="px-4 py-2 text-left text-[11px] font-medium text-zinc-500">能力</th>
            {cols.map((c) => (
              <th key={c.key} className="px-3 py-2 text-center whitespace-nowrap">
                <div className="text-[12px] font-medium text-zinc-700">{c.label}</div>
                <div className="text-[11px] font-normal text-zinc-400">{c.hint}</div>
              </th>
            ))}
            <th className="px-3 py-2 text-right text-[11px] font-medium text-zinc-500">状态</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <GroupRows key={g} group={g} items={items.filter((p) => p.group === g)} matrix={matrix} modules={modules} cols={cols} onToggle={onToggle} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GroupRows({ group, items, matrix, modules, cols, onToggle }: { group: string; items: PolicyItem[]; matrix: PolicyMatrix; modules: Record<ModuleKey, boolean>; cols: { key: PolicyCol; label: string; hint: string }[]; onToggle?: MatrixTableProps['onToggle'] }) {
  return (
    <>
      <tr id={groupAnchorId(group)} className="bg-zinc-50/60">
        <td colSpan={cols.length + 2} className="px-4 py-1 text-[11px] font-medium text-zinc-500">
          {group}
        </td>
      </tr>
      {items.map((p) => {
        const moduleOff = !!p.module && !modules[p.module]
        return (
          <tr key={p.key} className={clsx('border-b border-zinc-100 last:border-0', moduleOff ? 'bg-zinc-50 text-zinc-400' : 'bg-white')}>
            <td className="px-4 py-2">
              <div className={clsx('flex items-center gap-1.5 text-[13px]', moduleOff ? 'text-zinc-400' : 'text-zinc-800')}>
                {p.label}
                {p.level !== 'P0' && <Pill>{p.level}</Pill>}
                {p.staffOnly && <Pill tone="blue">仅坐席</Pill>}
              </div>
              <div className="font-mono text-[11px] text-zinc-400">{p.key}</div>
              <div className="text-[11px] text-zinc-500">{p.desc}</div>
            </td>
            {cols.map((c) => (
              <td key={c.key} className="px-3 py-2 text-center">
                <Cell item={p} col={c.key} on={!!matrix[p.key]?.[c.key]} disabled={moduleOff} onToggle={onToggle} />
              </td>
            ))}
            <td className="px-3 py-2 text-right text-[11px] whitespace-nowrap">
              {moduleOff ? (
                <Link to="/admin/modules" className="text-amber-700 hover:underline" title={`模块「${MODULE_LABEL[p.module!].name}」已停用，能力键整体不生效`}>
                  模块已停用 →
                </Link>
              ) : p.module ? (
                <span className="text-zinc-400">模块 · {MODULE_LABEL[p.module].name}</span>
              ) : (
                <span className="text-zinc-300">—</span>
              )}
            </td>
          </tr>
        )
      })}
    </>
  )
}

function Cell({ item, col, on, disabled, onToggle }: { item: PolicyItem; col: PolicyCol; on: boolean; disabled: boolean; onToggle?: MatrixTableProps['onToggle'] }) {
  if (item.staffOnly && col === 'customer') return <span className="text-zinc-300" title="只对坐席有意义">—</span>
  if (onToggle) return <Switch checked={on} disabled={disabled} onChange={(v) => onToggle(item.key, col, v)} />
  return on ? <Pill tone={disabled ? 'zinc' : 'green'}>开</Pill> : <Pill tone={disabled ? 'zinc' : 'red'}>关</Pill>
}

/** 预设详情：只读矩阵 */
export function PresetDetailModal({ preset, items, onClose }: { preset: PolicyPreset; items: PolicyItem[]; onClose: () => void }) {
  const modules = useStore((s) => s.enterprise.modules)
  return (
    <Modal open onClose={onClose} title={`预设详情：${preset.name}`} width={860} footer={<Button onClick={onClose}>关闭</Button>}>
      <p className="mb-3 text-xs text-zinc-500">{preset.desc}</p>
      <div className="rounded-md border border-zinc-200">
        <MatrixTable items={items} matrix={preset.matrix} modules={modules} />
      </div>
    </Modal>
  )
}
