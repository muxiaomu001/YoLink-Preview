/**
 * 桌面通知：包一层浏览器 Notification API。不支持 / 被拒时返回 false，调用方退回 toast。
 */

export type NotifyPermission = 'granted' | 'denied' | 'default' | 'unsupported'

export function notifyPermission(): NotifyPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

/** 请求授权；不支持时直接返回 'unsupported' */
export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (notifyPermission() === 'unsupported') return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

/** 已授权时发一条原生通知；点击通知聚焦窗口并执行 onClick。发不出去返回 false */
export function sendDesktopNotification(title: string, body: string, onClick: () => void): boolean {
  if (notifyPermission() !== 'granted') return false
  try {
    const n = new Notification(title, { body, tag: 'yolink-wb' })
    n.onclick = () => {
      window.focus()
      onClick()
      n.close()
    }
    return true
  } catch {
    return false
  }
}
