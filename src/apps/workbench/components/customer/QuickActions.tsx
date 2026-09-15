/**
 * 客户资料卡顶部的 4 个快捷动作：加标签、挂头衔、拉进群、更多（危险操作收进下拉菜单）。
 */
import { useCallback, useState, type ComponentType } from 'react'
import { clsx } from 'clsx'
import { Award, MoreHorizontal, Tags, UserPlus } from 'lucide-react'
import type { Customer } from '@/domain/types'
import { useWorkbench } from '../../useWorkbench'
import { CustomerActions } from '../CustomerActions'
import { JoinGroupModal } from './JoinGroupModal'
import { PopoverAnchor } from './Popover'
import { TagPopover, TitlePopover } from './QuickActions.parts'

type OpenKey = 'tag' | 'title' | 'more' | null

function QuickButton({ icon: Icon, label, active, disabled, title, onClick }: { icon: ComponentType<{ size?: number }>; label: string; active?: boolean; disabled?: boolean; title?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={clsx('flex w-full flex-col items-center gap-0.5 rounded-md py-1.5 text-[12px] transition-colors', active ? 'bg-brand-50 text-brand-700' : 'text-zinc-600 hover:bg-zinc-50', 'disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-transparent')}
    >
      <Icon size={16} />
      {label}
    </button>
  )
}

export function QuickActions({ c }: { c: Customer }) {
  const { s, can } = useWorkbench()
  const [open, setOpen] = useState<OpenKey>(null)
  const [joining, setJoining] = useState(false)
  const close = useCallback(() => setOpen(null), [])
  const toggle = (k: Exclude<OpenKey, null>) => setOpen((prev) => (prev === k ? null : k))
  const canTitle = can('assign_title')
  const hasCandidates = s.chatGroups.some((g) => !g.memberCustomerIds.includes(c.id))

  return (
    <div className="mt-3 grid grid-cols-4 gap-1">
      <PopoverAnchor open={open === 'tag'} onClose={close}>
        <QuickButton icon={Tags} label="加标签" active={open === 'tag'} onClick={() => toggle('tag')} />
        {open === 'tag' && <TagPopover c={c} />}
      </PopoverAnchor>
      <PopoverAnchor open={open === 'title'} onClose={close}>
        <QuickButton icon={Award} label="挂头衔" active={open === 'title'} disabled={!canTitle} title={canTitle ? undefined : '需员工角色能力 assign_title'} onClick={() => toggle('title')} />
        {open === 'title' && <TitlePopover c={c} />}
      </PopoverAnchor>
      <QuickButton icon={UserPlus} label="拉进群" disabled={!hasCandidates} title={hasCandidates ? undefined : '客户已在所有群里'} onClick={() => setJoining(true)} />
      <PopoverAnchor open={open === 'more'} onClose={close}>
        <QuickButton icon={MoreHorizontal} label="更多" active={open === 'more'} onClick={() => toggle('more')} />
        <CustomerActions c={c} open={open === 'more'} onClose={close} />
      </PopoverAnchor>
      <JoinGroupModal c={c} open={joining} onClose={() => setJoining(false)} />
    </div>
  )
}
