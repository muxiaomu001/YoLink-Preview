import { createElement } from 'react'
import { findTitleIcon } from './titleIconData'

export function TitleIcon({ name, size = 10, className }: { name?: string; size?: number; className?: string }) {
  const icon = findTitleIcon(name)
  if (!icon) return null
  return createElement(icon, { size, className, strokeWidth: 2.5 })
}
