import type { ChatGroup, DemoState, InviteLink } from '@/domain/types'

export type AttachLayer = 'group' | 'link'
export const LINK_HOST = 'https://hxwm.example/i/'
export const MAX_USES_LIMIT = 99999

export function attachedGroups(s: DemoState, link: Pick<InviteLink, 'inviteGroupId' | 'chatGroupIds'>): { group: ChatGroup; layer: AttachLayer }[] {
  const ig = s.inviteGroups.find((g) => g.id === link.inviteGroupId)
  const layers: [string, AttachLayer][] = [...(ig?.chatGroupIds ?? []).map((id): [string, AttachLayer] => [id, 'group']), ...link.chatGroupIds.map((id): [string, AttachLayer] => [id, 'link'])]
  const seen = new Set<string>()
  return layers
    .filter(([id]) => (seen.has(id) ? false : (seen.add(id), true)))
    .map(([id, layer]) => ({ group: s.chatGroups.find((g) => g.id === id), layer }))
    .filter((x): x is { group: ChatGroup; layer: AttachLayer } => !!x.group)
}

export function effectiveStatus(l: InviteLink): InviteLink['status'] | 'exhausted' {
  if (l.status !== 'active') return l.status
  if (l.expiresAt && l.expiresAt < new Date().toISOString()) return 'expired'
  if (l.maxUses != null && l.uses >= l.maxUses) return 'exhausted'
  return 'active'
}
