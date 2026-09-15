/**
 * 数值型策略表单：10 个字段（05 文档 8 项 + 最大设备数 + 长期未跟进天数），只提交有变化的。
 */
import { useState } from 'react'
import type { PolicyNumbers } from '@/domain/types'
import { useStore } from '@/store/store'
import { Button, Field, Input } from '@/ui/primitives'
import { Card, Note, Pill } from '@/ui/display'
import { toast } from '@/ui/overlay'

interface NumberField {
  key: keyof PolicyNumbers
  label: string
  unit: string
  defaultValue: number
  hint?: string
  level?: 'P1'
}

/** 顺序与 PRD 05 数值型策略表一致 */
const FIELDS: NumberField[] = [
  { key: 'recallSeconds', label: '消息撤回时限', unit: '秒', defaultValue: 120 },
  { key: 'editSeconds', label: '消息编辑时限', unit: '秒', defaultValue: 900, level: 'P1' },
  { key: 'groupMaxMembers', label: '单群上限', unit: '人', defaultValue: 10000 },
  { key: 'slowModeSeconds', label: '发言限流默认间隔', unit: '秒', defaultValue: 0, hint: '0 为关闭；策略键 group.slow_mode_seconds。群设置里的六档下拉 P2' },
  { key: 'retentionDays', label: '消息保留天数', unit: '天', defaultValue: 0, hint: '0 为永久' },
  { key: 'imageMaxMb', label: '图片最大大小', unit: 'MB', defaultValue: 10 },
  { key: 'videoMaxMb', label: '视频最大大小', unit: 'MB', defaultValue: 100 },
  { key: 'voiceMaxSeconds', label: '语音最大时长', unit: '秒', defaultValue: 60 },
  { key: 'maxDevices', label: '最大同时在线设备数', unit: '台', defaultValue: 2, hint: '03 文档 account.max_devices；超出后最早登录的设备下线' },
  { key: 'idleDays', label: '工作台长期未跟进天数', unit: '天', defaultValue: 14, hint: '04 文档：会话列表「长期未跟进」筛选的阈值' },
]

type Draft = Record<keyof PolicyNumbers, string>

function toDraft(n: PolicyNumbers): Draft {
  return Object.fromEntries(FIELDS.map((f) => [f.key, String(n[f.key])])) as Draft
}

export function NumbersTab() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [draft, setDraft] = useState<Draft>(() => toDraft(s.policyNumbers))

  const invalid = FIELDS.filter((f) => {
    const v = Number(draft[f.key])
    return draft[f.key].trim() === '' || !Number.isInteger(v) || v < 0
  })
  const changed = FIELDS.filter((f) => Number(draft[f.key]) !== s.policyNumbers[f.key])
  const save = () => {
    if (invalid.length || !changed.length) return
    const patch = Object.fromEntries(changed.map((f) => [f.key, Number(draft[f.key])])) as Partial<PolicyNumbers>
    s.setPolicyNumbers(patch, admin)
    toast(`已保存 ${changed.length} 项数值型策略，在线用户收到策略更新推送`)
  }
  const reset = () => setDraft(toDraft(s.policyNumbers))

  return (
    <Card
      title="数值型策略"
      extra={
        <div className="flex gap-2">
          <Button size="sm" disabled={!changed.length} onClick={reset}>
            还原
          </Button>
          <Button size="sm" variant="primary" disabled={!!invalid.length || !changed.length} onClick={save}>
            保存{changed.length ? `（${changed.length} 项）` : ''}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        {FIELDS.map((f) => {
          const dirty = Number(draft[f.key]) !== s.policyNumbers[f.key]
          const bad = invalid.includes(f)
          return (
            <Field
              key={f.key}
              label={`${f.label}（${f.unit}）${f.level ? ` ${f.level}` : ''}`}
              hint={`默认 ${f.defaultValue}${dirty ? ` · 当前 ${s.policyNumbers[f.key]}` : ''}`}
            >
              <div className="flex items-center gap-2">
                <Input type="number" min={0} value={draft[f.key]} className={bad ? 'border-red-400' : dirty ? 'border-brand-400' : ''} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} />
                {f.level && <Pill>{f.level}</Pill>}
              </div>
              {f.hint && <p className="mt-1 text-[11px] text-zinc-400">{f.hint}</p>}
              {bad && <p className="mt-1 text-[11px] text-red-600">须为 0 或正整数</p>}
            </Field>
          )
        })}
      </div>
      <div className="mt-4">
        <Note>只提交有变化的字段，每次保存进变更记录。单群上限是企业默认值，群设置里可单独覆盖。</Note>
      </div>
    </Card>
  )
}
