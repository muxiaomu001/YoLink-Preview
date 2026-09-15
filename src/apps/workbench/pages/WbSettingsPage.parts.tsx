/**
 * 工作台设置页的分块：个人设置（staff.prefs）、个人快捷回复（新建 / 编辑 / 删除）、企业共享话术只读。
 */
import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { Language, QuickReply, StaffPrefs } from '@/domain/types'
import { DEFAULT_STAFF_PREFS } from '@/domain/seed-groups'
import { Button, Field, Input, Select, Switch, Textarea } from '@/ui/primitives'
import { Card, Note, Pill } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { useWorkbench } from '../useWorkbench'

const THEME_OPTIONS: { value: StaffPrefs['theme']; label: string }[] = [
  { value: 'auto', label: '自动（跟随系统）' },
  { value: 'light', label: '始终亮色' },
  { value: 'dark', label: '始终暗色' },
]

function PrefRow({ title, desc, level, children }: { title: string; desc: string; level?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-zinc-200 px-3 py-2">
      <div className="text-xs">
        <div className="flex items-center gap-1.5 font-medium text-zinc-800">
          {title}
          {level && <Pill>{level}</Pill>}
        </div>
        <div className="text-zinc-500">{desc}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function PrefsCard() {
  const { s, staff } = useWorkbench()
  if (!staff) return null
  const prefs = { ...DEFAULT_STAFF_PREFS, ...(staff.prefs ?? {}) }
  const set = (patch: Partial<StaffPrefs>, msg: string) => {
    s.updateStaffPrefs(staff.id, patch)
    toast(msg)
  }
  return (
    <Card title="个人设置" extra={<span className="text-[11px] text-zinc-400">跟人走，换坐席不变</span>}>
      <div className="space-y-2">
        <PrefRow title="外观" desc="明暗模式；演示不切换真实主题">
          <Select className="h-7 w-40 text-xs" value={prefs.theme} onChange={(e) => set({ theme: e.target.value as StaffPrefs['theme'] }, `外观：${THEME_OPTIONS.find((o) => o.value === e.target.value)?.label}`)}>
            {THEME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </PrefRow>
        <PrefRow title="桌面通知" desc="新消息弹系统通知">
          <Switch checked={prefs.desktopNotify} onChange={(v) => set({ desktopNotify: v }, v ? '已开启桌面通知' : '已关闭桌面通知')} />
        </PrefRow>
        <PrefRow title="声音提醒" desc="新消息播放提示音" level="P1">
          <Switch checked={prefs.sound} onChange={(v) => set({ sound: v }, v ? '已开启声音提醒' : '已关闭声音提醒')} />
        </PrefRow>
        <PrefRow title="语言" desc="工作台界面语言">
          <Select className="h-7 w-32 text-xs" value={prefs.language} onChange={(e) => set({ language: e.target.value as Language }, e.target.value === 'zh' ? '语言：中文' : 'Language: English')}>
            <option value="zh">中文</option>
            <option value="en">English</option>
          </Select>
        </PrefRow>
        <PrefRow title="AI 回复推荐" desc={`每条客户消息给 2 到 3 条草稿，依据上下文、资料卡与知识库（${s.knowledge.length} 条）；金额字段按角色隐藏，不传给 AI`}>
          <Switch checked={prefs.aiSuggest} onChange={(v) => set({ aiSuggest: v }, v ? '已开启 AI 回复推荐' : '已关闭 AI 回复推荐')} />
        </PrefRow>
      </div>
    </Card>
  )
}

export function QuickRepliesCard() {
  const { s, staff } = useWorkbench()
  const [editing, setEditing] = useState<{ id?: string; title: string; text: string } | null>(null)
  if (!staff) return null
  const personal = s.quickReplies.filter((q) => q.scope === 'personal' && q.staffId === staff.id)
  const shared = s.quickReplies.filter((q) => q.scope === 'enterprise')
  const ok = !!editing?.title.trim() && !!editing?.text.trim()

  const save = () => {
    if (!editing || !ok) return
    s.savePersonalQuickReply(staff.id, { id: editing.id, title: editing.title.trim(), text: editing.text.trim() })
    toast(editing.id ? '已更新' : '已新建个人快捷回复')
    setEditing(null)
  }
  const remove = async (q: QuickReply) => {
    const ok2 = await confirm({ title: `删除快捷回复「${q.title}」？`, okText: '删除', danger: true })
    if (!ok2) return
    s.deletePersonalQuickReply(staff.id, q.id)
    toast('已删除')
  }

  return (
    <Card
      title="快捷回复"
      extra={
        <Button size="sm" onClick={() => setEditing({ title: '', text: '' })}>
          <Plus size={12} /> 新建
        </Button>
      }
    >
      <div className="mb-1 text-[11px] font-medium text-zinc-500">个人（只有你看得到，{personal.length} 条）</div>
      <ul className="space-y-1">
        {personal.map((q) => (
          <li key={q.id} className="flex items-start gap-2 rounded-md border border-zinc-100 px-2 py-1.5 text-xs">
            <div className="min-w-0 flex-1">
              <b className="text-zinc-800">{q.title}</b>
              <div className="truncate text-zinc-500" title={q.text}>
                {q.text}
              </div>
            </div>
            <button type="button" className="text-zinc-400 hover:text-brand-700" title="编辑" onClick={() => setEditing({ id: q.id, title: q.title, text: q.text })}>
              <Pencil size={12} />
            </button>
            <button type="button" className="text-zinc-400 hover:text-red-700" title="删除" onClick={() => void remove(q)}>
              <Trash2 size={12} />
            </button>
          </li>
        ))}
        {personal.length === 0 && <li className="text-xs text-zinc-400">还没有个人快捷回复</li>}
      </ul>
      <div className="mt-3 mb-1 text-[11px] font-medium text-zinc-500">企业共享话术（只读，{shared.length} 条）</div>
      <ul className="space-y-1">
        {shared.map((q) => (
          <li key={q.id} className="text-xs">
            <b className="text-zinc-700">{q.title}</b>
            <span className="ml-1 text-zinc-500">{q.text.slice(0, 40)}…</span>
          </li>
        ))}
      </ul>
      <div className="mt-2">
        <Note>企业共享话术在管理后台维护，工作台只能用不能改。聊天输入框里输「/」可以快速插入两类快捷回复。</Note>
      </div>
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? '编辑快捷回复' : '新建个人快捷回复'}
        width={460}
        footer={
          <>
            <Button onClick={() => setEditing(null)}>取消</Button>
            <Button variant="primary" disabled={!ok} onClick={save}>
              保存
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-3">
            <Field label="标题" required hint="1 到 20 字">
              <Input value={editing.title} maxLength={20} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="如：开户流程" />
            </Field>
            <Field label="内容" required hint="支持 {{customer.nickname}}">
              <Textarea rows={4} value={editing.text} maxLength={500} onChange={(e) => setEditing({ ...editing, text: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
    </Card>
  )
}
