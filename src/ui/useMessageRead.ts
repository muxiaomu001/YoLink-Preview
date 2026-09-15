import { useEffect } from 'react'
import { useStore } from '@/store/store'

/** 只有前台页面里进入可视区域的消息才推进已读位置；停在别的会话不会产生回执。 */
export function useMessageRead(convId: string, viewerId: string, viewer: 'seat' | 'customer', messageIds: string, rootId: string, enabled = true) {
  useEffect(() => {
    // DOM 已完成布局后再观察，避免初次滚动前把尚未进入视口的消息算已读。
    if (!enabled) return
    const root = document.getElementById(rootId)
    if (!root) return
    const visible = new Set<string>()
    const commit = () => {
      if (document.visibilityState !== 'visible' || document.querySelector('[aria-modal="true"]') || !visible.size) return
      const s = useStore.getState()
      const latest = s.messages.filter((m) => m.convId === convId && visible.has(m.id)).sort((a, b) => b.at.localeCompare(a.at))[0]
      if (!latest) return
      if (viewer === 'seat') s.markRead(convId, viewerId, latest.at)
      else s.customerMarkRead(convId, viewerId, latest.at)
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const id = (e.target as HTMLElement).dataset.messageId!
        if (e.isIntersecting) visible.add(id)
        else visible.delete(id)
      })
      commit()
    }, { root, threshold: 0.1 })
    root.querySelectorAll('[data-message-id]').forEach((el) => observer.observe(el))
    document.addEventListener('visibilitychange', commit)
    window.addEventListener('yolink:dialog-change', commit)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', commit)
      window.removeEventListener('yolink:dialog-change', commit)
    }
  }, [convId, viewerId, viewer, messageIds, rootId, enabled])
}
