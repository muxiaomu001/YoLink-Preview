/**
 * 「仅一次」启动公告的已读标记：按客户 + 公告分别存 localStorage，不进业务 store。
 * 不走 store 是因为它跟着浏览器走、不属于演示数据；但演示要能反复放，所以清除入口必须共用这里的前缀。
 */
const PREFIX = 'yolink-announcement-seen:'

export function startupSeenKey(customerId: string, announcementId: string) {
  return `${PREFIX}${customerId}:${announcementId}`
}

export function startupSeen(customerId: string, announcementId: string) {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(startupSeenKey(customerId, announcementId)) === 'yes'
}

export function markStartupSeen(customerId: string, announcementId: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(startupSeenKey(customerId, announcementId), 'yes')
}

/** 重播开屏和重置演示数据都要调这里，否则「仅一次」的公告一个浏览器只能看到一次 */
export function clearStartupSeen() {
  if (typeof window === 'undefined') return
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(PREFIX)) localStorage.removeItem(key)
  }
}
