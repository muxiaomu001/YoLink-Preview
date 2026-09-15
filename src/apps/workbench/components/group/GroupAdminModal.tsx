/**
 * 任命 / 修改管理员：勾选 12 文档的 8 项权限（频道发布仅频道有意义）。
 * 客户也可以被设为管理员（PRD 允许，用于"助教"）。
 */
import { useState } from 'react'
import type { GroupAdminPerm, GroupMemberKind } from '@/domain/types'
import { useStore } from '@/store/store'
import { Button, Checkbox } from '@/ui/primitives'
import { Modal, toast } from '@/ui/overlay'
import { PERM_META } from './groupRules'
import type { GroupPanelProps } from './shared'

const MAX_ADMINS = 50

export function GroupAdminModal({
  group: g,
  actor,
  target,
  onClose,
}: Pick<GroupPanelProps, 'group' | 'actor'> & { target: { kind: GroupMemberKind; id: string; name: string }; onClose: () => void }) {
  const s = useStore()
  const existing = g.admins.find((a) => a.memberKind === target.kind && a.memberId === target.id)
  const [perms, setPerms] = useState<GroupAdminPerm[]>(existing?.perms ?? (g.kind === 'channel' ? ['can_post_messages'] : ['can_delete_messages', 'can_pin_messages']))
  const full = !existing && g.admins.length >= MAX_ADMINS
  const toggle = (k: GroupAdminPerm, v: boolean) => setPerms((p) => (v ? Array.from(new Set([...p, k])) : p.filter((x) => x !== k)))

  const save = () => {
    s.promoteGroupAdmin(g.id, target.kind, target.id, perms, actor)
    toast(existing ? `已更新「${target.name}」的管理员权限` : `已把「${target.name}」设为管理员`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? `修改管理员权限：${target.name}` : `设为管理员：${target.name}`}
      width={480}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={full || !perms.length} onClick={save}>{existing ? '保存' : '任命'}</Button>
        </>
      }
    >
      <div className="space-y-2">
        {PERM_META.map((p) => {
          const na = p.channelOnly && g.kind !== 'channel'
          return (
            <div key={p.key} className="flex items-start gap-2">
              <Checkbox checked={perms.includes(p.key)} disabled={na} onChange={(v) => toggle(p.key, v)} label={<span className="font-medium">{p.label}</span>} />
              <span className="text-[11px] text-zinc-400">{p.desc}{na ? '，本群不是频道' : ''}</span>
            </div>
          )
        })}
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="ghost" onClick={() => setPerms(PERM_META.filter((p) => !(p.channelOnly && g.kind !== 'channel')).map((p) => p.key))}>全选</Button>
          <Button size="sm" variant="ghost" onClick={() => setPerms([])}>清空</Button>
        </div>
        {full && <div className="text-xs text-red-600">管理员已达上限 {MAX_ADMINS} 人（group.max_admins）。</div>}
        {!perms.length && !full && <div className="text-xs text-red-600">至少勾选一项权限。</div>}
      </div>
    </Modal>
  )
}
