/**
 * 快捷动作弹层：加标签（标签库多选 + 新建）、挂头衔（头衔库多选 + 设主头衔）。
 */
import { useState } from 'react'
import type { Customer } from '@/domain/types'
import { seatCan } from '@/store/policy'
import { Pill, TagChip, TitleChip } from '@/ui/display'
import { Button, Checkbox, Input } from '@/ui/primitives'
import { toast } from '@/ui/overlay'
import { useWorkbench } from '../../useWorkbench'
import { PopoverPanel } from './Popover'

const TAG_COLORS = ['#2563eb', '#0f766e', '#b45309', '#7e22ce', '#be123c', '#4d7c0f']
const TAG_NAME_MAX = 16
const TITLE_MAX = 5

function pickColor(name: string): string {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TAG_COLORS[h % TAG_COLORS.length]
}

export function TagPopover({ c }: { c: Customer }) {
  const { s, seat } = useWorkbench()
  const [name, setName] = useState('')
  const canCreate = seatCan(s, seat?.id, 'tag.create')

  const toggle = (tagId: string, on: boolean) => (on ? s.addTag(c.id, tagId) : s.removeTag(c.id, tagId))
  const create = () => {
    const n = name.trim()
    if (!n) return
    const existing = s.tags.find((t) => t.name === n)
    const tag = existing ?? s.createTag(n, pickColor(n), 'staff')
    s.addTag(c.id, tag.id)
    toast(existing ? `已添加已有标签「${n}」` : `已新建内部标签「${n}」并加到客户身上`)
    setName('')
  }

  return (
    <PopoverPanel width={232}>
      <div className="px-3 pt-2 pb-1 text-[11px] text-zinc-400">内部标签，客户看不到</div>
      <ul className="thin-scroll max-h-52 overflow-y-auto px-2 pb-1">
        {s.tags.map((t) => (
          <li key={t.id} className="rounded px-1 py-1 hover:bg-zinc-50">
            <Checkbox checked={c.tagIds.includes(t.id)} onChange={(v) => toggle(t.id, v)} label={<TagChip tag={t} />} />
          </li>
        ))}
        {s.tags.length === 0 && <li className="px-1 py-2 text-[12px] text-zinc-400">标签库为空</li>}
      </ul>
      {canCreate && (
        <div className="flex gap-1 border-t border-zinc-100 px-2 py-2">
          <Input className="h-7 text-[12px]" value={name} maxLength={TAG_NAME_MAX} placeholder="新建标签，回车确认" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
          <Button size="sm" disabled={!name.trim()} onClick={create}>
            新建
          </Button>
        </div>
      )}
    </PopoverPanel>
  )
}

export function TitlePopover({ c }: { c: Customer }) {
  const { s, staff } = useWorkbench()
  if (!staff) return null
  const titles = s.titles.filter((t) => t.enabled || c.titleIds.includes(t.id))
  const full = c.titleIds.length >= TITLE_MAX

  const toggle = (titleId: string, on: boolean) => {
    if (on) {
      s.assignTitle(c.id, titleId, staff.id)
      toast(`已挂头衔「${s.titles.find((t) => t.id === titleId)?.name}」，客户和群里的人都能看到`)
    } else {
      s.removeTitle(c.id, titleId, staff.id)
    }
  }

  return (
    <PopoverPanel width={240} align="center">
      <div className="px-3 pt-2 pb-1 text-[11px] text-zinc-400">
        官方头衔，所有人可见 · 最多 {TITLE_MAX} 个
      </div>
      <ul className="thin-scroll max-h-56 overflow-y-auto px-2 pb-2">
        {titles.map((t) => {
          const on = c.titleIds.includes(t.id)
          const primary = c.primaryTitleId === t.id
          return (
            <li key={t.id} className="flex items-center gap-1 rounded px-1 py-1 hover:bg-zinc-50">
              <Checkbox checked={on} disabled={!on && full} onChange={(v) => toggle(t.id, v)} label={<TitleChip title={t} />} />
              <span className="ml-auto shrink-0">
                {on && primary && <Pill tone="amber">主</Pill>}
                {on && !primary && (
                  <button type="button" className="text-[11px] text-zinc-400 hover:text-brand-700" title="设为主头衔（昵称旁只显示主头衔）" onClick={() => s.setPrimaryTitle(c.id, t.id)}>
                    设主
                  </button>
                )}
              </span>
            </li>
          )
        })}
        {titles.length === 0 && <li className="px-1 py-2 text-[12px] text-zinc-400">头衔库为空</li>}
      </ul>
    </PopoverPanel>
  )
}
