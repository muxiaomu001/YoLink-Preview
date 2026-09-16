/** 复制到剪贴板；浏览器不允许访问剪贴板时返回 false，由调用方给提示 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
