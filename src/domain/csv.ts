/**
 * 浏览器端文件下载：CSV / JSON 用 Blob 生成后触发下载。
 * CSV 带 UTF-8 BOM，Excel 直接打开中文不乱码。
 */

export type CsvCell = string | number | boolean | null | undefined

/** 单元格转义：含逗号、引号、换行时加引号，内部引号翻倍 */
function escapeCell(v: CsvCell): string {
  const s = v == null ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(header: string[], rows: CsvCell[][]): string {
  return [header, ...rows].map((r) => r.map(escapeCell).join(',')).join('\r\n')
}

export function downloadText(filename: string, content: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 下载已触发后再释放对象 URL
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadCsv(filename: string, header: string[], rows: CsvCell[][]): void {
  downloadText(filename, `\uFEFF${toCsv(header, rows)}`, 'text/csv;charset=utf-8')
}

export function downloadJson(filename: string, data: unknown): void {
  downloadText(filename, JSON.stringify(data, null, 2), 'application/json;charset=utf-8')
}

/** 文件名用的时间戳：20260915-1430 */
export function fileStamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}
