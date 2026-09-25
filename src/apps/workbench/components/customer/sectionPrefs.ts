/**
 * 客户资料卡分区的键与默认展开状态；实际状态由 CustomerCard 用 useLocalPref 记在本机。
 */
export type SectionKey = 'basic' | 'officials' | 'titles' | 'tags' | 'note' | 'purchases' | 'groups' | 'wallet' | 'checkin' | 'referral' | 'business'

/** 默认展开：备注、内部标签、头衔、购买与邀请；其余默认折叠 */
export const SECTION_DEFAULTS: Record<SectionKey, boolean> = {
  basic: false,
  officials: false,
  titles: true,
  tags: true,
  note: true,
  purchases: true,
  groups: false,
  wallet: false,
  checkin: false,
  referral: false,
  business: true,
}
