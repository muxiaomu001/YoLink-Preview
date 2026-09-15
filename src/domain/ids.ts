/** 简单 ID 生成：前缀 + 递增 + 随机尾巴，演示用 */
let counter = 1000

export function newId(prefix: string): string {
  counter += 1
  const tail = Math.random().toString(36).slice(2, 6)
  return `${prefix}_${counter}${tail}`
}

/** 邀请码：6 位大写字母数字 */
export function newInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i += 1) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}
