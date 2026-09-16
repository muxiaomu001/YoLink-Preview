/** 时间工具：演示数据全部相对"现在"生成，所以任何时候打开都是新鲜的 */

export function iso(ms: number): string {
  return new Date(ms).toISOString()
}

export function agoMs(days: number, hours = 0, minutes = 0): number {
  return Date.now() - ((days * 24 + hours) * 60 + minutes) * 60 * 1000
}

export function ago(days: number, hours = 0, minutes = 0): string {
  return iso(agoMs(days, hours, minutes))
}

const pad = (n: number) => String(n).padStart(2, '0')

export function fmtDateTime(s: string): string {
  const d = new Date(s)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fmtDate(s: string): string {
  const d = new Date(s)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fmtTime(s: string): string {
  const d = new Date(s)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 会话列表用的相对时间：今天显示时分，昨天显示"昨天"，更早显示月日 */
export function fmtRelative(s: string): string {
  const d = new Date(s)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return fmtTime(s)
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return '昨天'
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** "X 分钟前 / X 小时前 / X 天前" */
export function fmtAgo(s: string): string {
  const diff = Date.now() - new Date(s).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  return `${d} 天前`
}

export function daysSince(s: string): number {
  return Math.floor((Date.now() - new Date(s).getTime()) / 86400000)
}

/** 等待时长（客户说完话到现在） */
export function fmtWait(s: string): string {
  return fmtAgo(s).replace('前', '')
}

/** 时长口语化：把秒数说成「2 分钟」「1 小时」「3 天」，给用户看的提示用 */
export function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟`
  if (seconds < 86400) return `${Math.round(seconds / 3600)} 小时`
  return `${Math.round(seconds / 86400)} 天`
}
