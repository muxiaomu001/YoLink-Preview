export type SocialAction = 'group.create' | 'channel.create' | 'friend.add' | 'friend.search_user' | 'group.join_by_link'

export const SOCIAL_ACTIONS: { key: SocialAction; label: string }[] = [
  { key: 'group.create', label: '发起群聊' },
  { key: 'channel.create', label: '创建频道' },
  { key: 'friend.add', label: '添加好友' },
  { key: 'friend.search_user', label: '搜索用户' },
  { key: 'group.join_by_link', label: '扫码 / 链接入群' },
]
