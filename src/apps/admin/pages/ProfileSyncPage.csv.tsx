import { useMemo, useState } from 'react'
import { Download, Upload, Wand2 } from 'lucide-react'
import type { SyncRecord } from '@/domain/types'
import { fmtDate } from '@/domain/time'
import { useStore } from '@/store/store'
import type { CsvPurchaseRow, CsvReferralRow } from '@/store/actions/integrations'
import { confirm } from '@/ui/confirm'
import { Button, Field, Select, Textarea } from '@/ui/primitives'
import { Card, KV, Note, Pill, Table } from '@/ui/display'
import { DemoNote } from '@/ui/DemoNote'
import { toast } from '@/ui/overlay'

type Template = 'purchase' | 'referral'

const TEMPLATES: Record<Template, { name: string; header: string[]; desc: string[] }> = {
  purchase: {
    name: '业务记录',
    header: ['手机号', '产品', '金额', '日期'],
    desc: ['手机号：匹配键，与客户注册手机号一致（空格可有可无）', '产品：产品名称，最多 64 字', '金额：数字，单位随钱包币种', '日期：YYYY-MM-DD'],
  },
  referral: {
    name: '邀请关系',
    header: ['手机号', '推荐人手机号'],
    desc: ['手机号：被推荐人的注册手机号', '推荐人手机号：推荐人的注册手机号，必须已在客户库中'],
  },
}

interface ParsedRow {
  line: number
  cells: string[]
  matched?: string
  error?: string
}

const norm = (p: string) => p.replace(/\s/g, '')

/** 解析 CSV 文本：逗号分隔，自动跳过表头行 */
function parseCsv(text: string, tpl: Template, findName: (phone: string) => string | undefined): ParsedRow[] {
  const cols = TEMPLATES[tpl].header.length
  return text
    .split(/\r?\n/)
    .map((raw, i) => ({ raw: raw.trim(), line: i + 1 }))
    .filter((r) => r.raw && !r.raw.startsWith(TEMPLATES[tpl].header[0]))
    .map(({ raw, line }) => {
      const cells = raw.split(/[,，]/).map((c) => c.trim())
      if (cells.length < cols) return { line, cells, error: `列数不足，需要 ${cols} 列` }
      if (tpl === 'purchase') {
        if (!(Number(cells[2]) > 0)) return { line, cells, error: '金额必须是正数' }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(cells[3])) return { line, cells, error: '日期格式应为 YYYY-MM-DD' }
      }
      if (tpl === 'referral' && norm(cells[0]) === norm(cells[1])) return { line, cells, error: '推荐人不能是自己' }
      return { line, cells, matched: findName(cells[0]) }
    })
}

function downloadTemplate(tpl: Template) {
  // 带 BOM，Excel 打开中文表头不乱码
  const csv = `\uFEFF${TEMPLATES[tpl].header.join(',')}\n`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `yolink-${tpl}-template.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/** CSV 导入：演示不做文件上传，粘贴文本 */
export function CsvImportTab() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [tpl, setTpl] = useState<Template>('purchase')
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<ParsedRow[] | null>(null)
  const [result, setResult] = useState<SyncRecord | null>(null)
  const meta = TEMPLATES[tpl]

  const findName = (phone: string) => s.customers.find((c) => c.phone && norm(c.phone) === norm(phone) && !c.deletedAt)?.nickname
  const withPhone = useMemo(() => s.customers.filter((c) => c.phone && !c.deletedAt), [s.customers])

  const fillExample = () => {
    const [a, b, c] = withPhone
    if (!a || !b) return
    const fake = '+852 0000 0000'
    const lines =
      tpl === 'purchase'
        ? [`${a.phone},环球精选债券基金,25000,${fmtDate(new Date().toISOString())}`, `${b.phone},稳健增长组合,8000,${fmtDate(new Date(Date.now() - 86400000 * 3).toISOString())}`, `${fake},美元货币基金,3000,${fmtDate(new Date().toISOString())}`]
        : [`${a.phone},${b.phone}`, `${c?.phone ?? b.phone},${a.phone}`, `${fake},${a.phone}`]
    setText(`${meta.header.join(',')}\n${lines.join('\n')}`)
    setPreview(null)
    setResult(null)
  }
  const doPreview = () => {
    const rows = parseCsv(text, tpl, findName)
    setPreview(rows)
    setResult(null)
    if (!rows.length) toast('没有解析到数据行', 'warn')
  }
  const valid = (preview ?? []).filter((r) => !r.error)
  const matchedCount = valid.filter((r) => r.matched).length

  const run = async () => {
    if (!preview || !valid.length) return
    const ok = await confirm({ title: `执行导入：${meta.name}`, body: `共 ${valid.length} 行有效数据，其中 ${matchedCount} 行匹配到客户，${valid.length - matchedCount} 行未匹配将被跳过。导入后写入客户画像并记审计。`, okText: '执行导入' })
    if (!ok) return
    const rec =
      tpl === 'purchase'
        ? s.importPurchasesCsv(valid.map<CsvPurchaseRow>((r) => ({ phone: r.cells[0], product: r.cells[1], amount: Number(r.cells[2]), at: new Date(`${r.cells[3]}T12:00:00`).toISOString() })), admin)
        : s.importReferralsCsv(valid.map<CsvReferralRow>((r) => ({ phone: r.cells[0], referrerPhone: r.cells[1] })), admin)
    setResult(rec)
    setPreview(null)
    toast(`导入完成：成功 ${rec.count} 条，失败 ${rec.failed} 条，未匹配 ${rec.unmatched} 条`)
  }

  return (
    <div className="space-y-4">
      <Note>按手机号匹配客户，匹配不上的行不入库，只计入统计。</Note>
      <DemoNote>演示不做文件上传，把 CSV 文本直接粘进来即可；正式产品还支持按业务系统 ID 匹配。</DemoNote>
      <div className="grid grid-cols-[1fr_320px] gap-4">
        <Card title="粘贴 CSV">
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <Field label="选择模板">
                <Select className="w-40" value={tpl} onChange={(e) => { setTpl(e.target.value as Template); setPreview(null); setResult(null) }}>
                  <option value="purchase">业务记录</option>
                  <option value="referral">邀请关系</option>
                </Select>
              </Field>
              <Button onClick={() => downloadTemplate(tpl)}>
                <Download size={13} /> 下载模板
              </Button>
              <Button onClick={fillExample} disabled={withPhone.length < 2}>
                <Wand2 size={13} /> 填入示例
              </Button>
            </div>
            <Field label="CSV 文本" hint={`列：${meta.header.join(',')}`}>
              <Textarea rows={8} className="font-mono text-xs" value={text} onChange={(e) => { setText(e.target.value); setPreview(null) }} placeholder={`${meta.header.join(',')}\n...`} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" disabled={!text.trim()} onClick={doPreview}>预览</Button>
              <Button variant="primary" disabled={!preview || !valid.length} onClick={() => void run()}>
                <Upload size={13} /> 执行导入
              </Button>
            </div>
          </div>
        </Card>
        <Card title={`模板说明：${meta.name}`}>
          <ol className="list-decimal space-y-1 pl-4 text-xs text-zinc-700">
            {meta.desc.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ol>
          <p className="mt-3 text-[11px] text-zinc-400">第一行为表头时自动跳过；支持中英文逗号。</p>
        </Card>
      </div>
      {preview && (
        <Card title={`预览（${preview.length} 行，有效 ${valid.length}，匹配 ${matchedCount}）`} padded={false}>
          <Table
            rows={preview}
            rowKey={(r) => String(r.line)}
            dense
            columns={[
              { key: 'line', title: '行', align: 'right', render: (r) => <span className="tabular-nums text-zinc-400">{r.line}</span> },
              ...meta.header.map((h, i) => ({ key: h, title: h, render: (r: ParsedRow) => <span className="font-mono text-xs">{r.cells[i] ?? ''}</span> })),
              {
                key: 'match',
                title: '匹配结果',
                render: (r) => (r.error ? <Pill tone="red">{r.error}</Pill> : r.matched ? <Pill tone="green">匹配到 {r.matched}</Pill> : <Pill tone="amber">未匹配</Pill>),
              },
            ]}
          />
        </Card>
      )}
      {result && (
        <Card title="导入结果">
          <KV
            items={[
              { k: '类型', v: result.kind === 'purchase' ? '业务记录' : '邀请关系' },
              { k: '成功', v: <span className="font-medium text-emerald-700">{result.count} 条</span> },
              { k: '失败', v: result.failed ? <span className="text-red-600">{result.failed} 条：{result.failReason}</span> : '0' },
              { k: '未匹配', v: result.unmatched ? <span className="text-amber-600">{result.unmatched} 条（手机号不在客户库中，已跳过）</span> : '0' },
            ]}
          />
          <p className="mt-2 text-[11px] text-zinc-400">这条记录已出现在「同步设置」页的最近同步记录里；匹配到的客户已加上「已入金」标签，可到客户列表查看。</p>
        </Card>
      )}
    </div>
  )
}
