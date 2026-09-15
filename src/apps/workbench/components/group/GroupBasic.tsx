/**
 * 群基础信息：头像、名称 / 简介行内编辑（can_change_info）、成员数（点击跳到成员列表）、
 * 创建者、创建时间、群类型、官方标记；「更多」弹窗改类型 / 入群头衔 / 人数上限。
 */
import { useState } from 'react'
import { Pencil } from 'lucide-react'
import type { ChatGroupKind } from '@/domain/types'
import { fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { seatById } from '@/store/selectors'
import { Avatar, KV, Pill, SeatAvatar } from '@/ui/display'
import { Button, Field, Input, Select, Textarea } from '@/ui/primitives'
import { Modal, toast } from '@/ui/overlay'
import { GROUP_KIND_TEXT, memberTotal } from './groupRules'
import type { GroupPanelProps } from './shared'

const NAME_MAX = 128
const DESC_MAX = 255

export function GroupBasic({ group: g, actor, perm, compact, onJumpMembers }: GroupPanelProps & { onJumpMembers?: () => void }) {
  const s = useStore()
  const canEdit = perm('can_change_info')
  const owner = seatById(s, g.ownerSeatId)
  const [editName, setEditName] = useState(false)
  const [editDesc, setEditDesc] = useState(false)
  const [more, setMore] = useState(false)

  // 同页有成员面板时滚过去；在群管理弹窗里由调用方切到成员 tab
  const jumpMembers = onJumpMembers ?? (() => document.getElementById('group-members')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  const saveName = (v: string) => {
    const name = v.trim()
    if (!name || name.length > NAME_MAX || name === g.name) return
    s.updateChatGroup(g.id, { name }, actor.staffId)
    toast(`群名称已改为「${name}」`)
  }
  const saveDesc = (v: string) => {
    const desc = v.trim()
    if (desc.length > DESC_MAX || desc === g.desc) return
    s.updateChatGroup(g.id, { desc }, actor.staffId)
    toast('群简介已更新')
  }

  return (
    <div className={compact ? 'border-b border-zinc-100 px-4 py-4' : 'rounded-lg border border-zinc-200 bg-white p-4'}>
      <div className="flex flex-col items-center text-center">
        <button type="button" title={canEdit ? '点击上传新头像' : '需要「修改群信息」权限'} onClick={() => (canEdit ? toast('群头像上传暂未开放', 'info') : undefined)} className={canEdit ? 'cursor-pointer' : 'cursor-default'}>
          <Avatar text={g.name} size={56} color={g.kind === 'channel' ? '#b45309' : '#0f766e'} official={g.official} />
        </button>
        <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
          {editName ? (
            <InlineEdit initial={g.name} max={NAME_MAX} onDone={(v) => { setEditName(false); saveName(v) }} />
          ) : (
            <>
              {g.name}
              {g.official && <Pill tone="amber">官方</Pill>}
              {canEdit && (
                <button type="button" className="text-zinc-400 hover:text-brand-700" title="编辑群名称" onClick={() => setEditName(true)}>
                  <Pencil size={11} />
                </button>
              )}
            </>
          )}
        </div>
        <div className="mt-1 flex w-full items-start justify-center gap-1 text-[12px] text-zinc-500">
          {editDesc ? (
            <InlineEdit initial={g.desc} max={DESC_MAX} multiline onDone={(v) => { setEditDesc(false); saveDesc(v) }} />
          ) : (
            <>
              <span className="whitespace-pre-wrap">{g.desc || '（没有简介）'}</span>
              {canEdit && (
                <button type="button" className="shrink-0 text-zinc-400 hover:text-brand-700" title="编辑群简介" onClick={() => setEditDesc(true)}>
                  <Pencil size={11} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <div className="mt-3">
        <KV
          items={[
            { k: '成员', v: <button type="button" className="text-brand-700 hover:underline" onClick={jumpMembers}>{memberTotal(g)} 人（{g.memberCustomerIds.length} 客户 · {g.memberSeatIds.length} 坐席{g.memberBotIds.length ? ` · ${g.memberBotIds.length} 机器人` : ''}）</button> },
            { k: '创建者', v: owner ? <span className="inline-flex items-center gap-1"><SeatAvatar seat={owner} size={16} />{owner.displayName}（群主坐席）</span> : '-' },
            { k: '创建时间', v: <span className="tabular-nums">{fmtDateTime(g.createdAt)}</span> },
            { k: '类型', v: `${GROUP_KIND_TEXT[g.kind]}${g.kind === 'channel' ? '，客户只读' : ''}` },
            { k: '入群条件', v: g.requiredTitleId ? `头衔「${s.titles.find((t) => t.id === g.requiredTitleId)?.name ?? '?'}」` : '无' },
            { k: '人数上限', v: g.maxMembers ?? `策略默认 ${s.policyNumbers.groupMaxMembers}` },
          ]}
        />
        {canEdit && (
          <Button size="sm" variant="ghost" className="mt-2 -ml-2" onClick={() => setMore(true)}>
            改类型 / 入群头衔 / 人数上限
          </Button>
        )}
      </div>
      {more && <MoreModal group={g} actor={actor} onClose={() => setMore(false)} />}
    </div>
  )
}

/** 行内编辑：Enter 保存、Esc 取消、失焦保存 */
function InlineEdit({ initial, max, multiline, onDone }: { initial: string; max: number; multiline?: boolean; onDone: (v: string) => void }) {
  const [v, setV] = useState(initial)
  const common = {
    value: v,
    maxLength: max,
    autoFocus: true,
    onBlur: () => onDone(v),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onDone(initial)
      if (e.key === 'Enter' && !multiline) {
        e.preventDefault()
        onDone(v)
      }
    },
  }
  return multiline ? <Textarea rows={3} className="text-xs" {...common} onChange={(e) => setV(e.target.value)} /> : <Input className="h-7 w-52 text-center text-sm" {...common} onChange={(e) => setV(e.target.value)} />
}

function MoreModal({ group: g, actor, onClose }: { group: GroupPanelProps['group']; actor: GroupPanelProps['actor']; onClose: () => void }) {
  const s = useStore()
  const [kind, setKind] = useState<ChatGroupKind>(g.kind)
  const [titleId, setTitleId] = useState(g.requiredTitleId ?? '')
  const [max, setMax] = useState(g.maxMembers == null ? '' : String(g.maxMembers))
  const maxNum = max.trim() === '' ? null : Number(max)
  const maxOk = maxNum == null || (Number.isInteger(maxNum) && maxNum > 0)
  const dirty = kind !== g.kind || (titleId || null) !== g.requiredTitleId || maxNum !== g.maxMembers
  const save = () => {
    s.updateChatGroup(g.id, { kind, requiredTitleId: titleId || null, maxMembers: maxNum }, actor.staffId)
    toast('群设置已保存')
    onClose()
  }
  return (
    <Modal open onClose={onClose} title="群类型与入群条件" width={440} footer={<><Button onClick={onClose}>取消</Button><Button variant="primary" disabled={!dirty || !maxOk} onClick={save}>保存</Button></>}>
      <div className="space-y-3">
        <Field label="类型" hint="频道：仅有「频道发布」权限的管理员可发言">
          <Select value={kind} onChange={(e) => setKind(e.target.value as ChatGroupKind)}>
            {(Object.keys(GROUP_KIND_TEXT) as ChatGroupKind[]).map((k) => <option key={k} value={k}>{GROUP_KIND_TEXT[k]}</option>)}
          </Select>
        </Field>
        <Field label="入群条件（头衔）" hint="批量拉人时不满足的会被跳过">
          <Select value={titleId} onChange={(e) => setTitleId(e.target.value)}>
            <option value="">无限制</option>
            {s.titles.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Field>
        <Field label="人数上限" hint={`空 = 策略默认 ${s.policyNumbers.groupMaxMembers}`}>
          <Input value={max} inputMode="numeric" placeholder={String(s.policyNumbers.groupMaxMembers)} onChange={(e) => setMax(e.target.value)} />
        </Field>
        {!maxOk && <div className="text-xs text-red-600">人数上限必须是正整数。</div>}
      </div>
    </Modal>
  )
}
