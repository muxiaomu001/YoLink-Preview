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
