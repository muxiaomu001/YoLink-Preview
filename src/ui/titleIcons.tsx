/**
 * 头衔的内置图标：Title.icon 存 lucide 图标名，这里映射成组件。
 * 头衔库与 TitleChip 共用，未知或空名字不渲染。
 */
import { createElement } from 'react'
import { Award, Crown, Gem, Heart, ShieldCheck, Star, type LucideIcon } from 'lucide-react'

export const TITLE_ICONS: { name: string; label: string; icon: LucideIcon }[] = [
  { name: 'crown', label: '皇冠', icon: Crown },
  { name: 'shield-check', label: '盾牌', icon: ShieldCheck },
  { name: 'star', label: '星', icon: Star },
  { name: 'gem', label: '宝石', icon: Gem },
  { name: 'award', label: '奖章', icon: Award },
  { name: 'heart', label: '爱心', icon: Heart },
]

export function findTitleIcon(name?: string): LucideIcon | undefined {
  return TITLE_ICONS.find((x) => x.name === name)?.icon
}

export function TitleIcon({ name, size = 10, className }: { name?: string; size?: number; className?: string }) {
  const icon = findTitleIcon(name)
  if (!icon) return null
  return createElement(icon, { size, className, strokeWidth: 2.5 })
}
