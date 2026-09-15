/**
 * 栏宽拖拽把手：6px 宽，hover / 拖拽中显示 brand 色线。
 * mousedown 后在 window 上监听 mousemove / mouseup，按 side 决定往哪个方向算宽度。
 */
import { useCallback, useState } from 'react'
import { clsx } from 'clsx'

export function ResizeHandle({
  side,
  width,
  min,
  max,
  onResize,
}: {
  /** 'left'：把手在栏的右边，向右拖变宽；'right'：把手在栏的左边，向左拖变宽 */
  side: 'left' | 'right'
  width: number
  min: number
  max: number
  onResize: (w: number) => void
}) {
  const [dragging, setDragging] = useState(false)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startW = width
      setDragging(true)
      const prevCursor = document.body.style.cursor
      const prevSelect = document.body.style.userSelect
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      const onMove = (ev: MouseEvent) => {
        const delta = side === 'left' ? ev.clientX - startX : startX - ev.clientX
        onResize(Math.min(max, Math.max(min, startW + delta)))
      }
      const onUp = () => {
        setDragging(false)
        document.body.style.cursor = prevCursor
        document.body.style.userSelect = prevSelect
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [side, width, min, max, onResize],
  )

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
      className={clsx('group relative z-10 -mx-[3px] w-[6px] shrink-0 cursor-col-resize', dragging && 'is-dragging')}
      title="拖动调整宽度"
    >
      <div className={clsx('absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 transition-colors', dragging ? 'bg-brand-500' : 'bg-transparent group-hover:bg-brand-400')} />
    </div>
  )
}
