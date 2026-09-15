/**
 * 工作台设置页的分块：个人设置（staff.prefs + 本机界面偏好重置）、快捷键说明、个人快捷回复（新建 / 编辑 / 删除）、企业共享话术只读。
 */
import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { Language, QuickReply, StaffPrefs } from '@/domain/types'
import { DEFAULT_STAFF_PREFS } from '@/domain/seed-groups'
import { Button, Field, Input, Select, Switch, Textarea } from '@/ui/primitives'
import { Card } from '@/ui/display'
import { HelpTip } from '@/ui/help'
import { Modal, toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { useWorkbench } from '../useWorkbench'
import { notifyPermission, requestNotifyPermission } from '../components/layout/notify'

const THEME_OPTIONS: { value: StaffPrefs['theme']; label: string }[] = [
  { value: 'auto', label: '自动（跟随系统）' },
  { value: 'light', label: '始终亮色' },
  { value: 'dark', label: '始终暗色' },
]

/** 本机界面偏好（栏宽、折叠状态）的 localStorage 前缀，与 useLocalPref 一致 */
const UI_PREF_PREFIX = 'yolink-wb-ui:'

const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: '⌘⌥↑ / ⌘⌥↓', desc: '切换上一条 / 下一条会话' },
  { keys: '⌘⇧F', desc: '搜索会话列表' },
  { keys: '⌘F', desc: '搜索当前会话内的消息' },
  { keys: '⌘⌥R', desc: '把当前会话标记为已读' },
  { keys: 'Enter / Shift+Enter', desc: '发送 / 换行' },
  { keys: 'Esc', desc: '关闭弹层' },
]

function PrefRow({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-zinc-200 px-3 py-2.5">
      <div className="text-[13px]">
        <div className="font-medium text-zinc-800">{title}</div>
        <div className="text-[12px] text-zinc-500">{desc}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

/** 清掉本机记住的栏宽与折叠状态 */
function resetUiPrefs(): number {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(UI_PREF_PREFIX))
  keys.forEach((k) => localStorage.removeItem(k))
  return keys.length
}

export function PrefsCard() {
  const { s, staff } = useWorkbench()
  if (!staff) return null
  const prefs = { ...DEFAULT_STAFF_PREFS, ...(staff.prefs ?? {}) }
  const set = (patch: Partial<StaffPrefs>, msg: string) => {
    s.updateStaffPrefs(staff.id, patch)
    toast(msg)
  }

  /** 打开桌面通知时申请浏览器授权；不支持 / 被拒时说明会退回页内提示 */
  const toggleNotify = async (v: boolean) => {
    if (!v) return set({ desktopNotify: false }, '已关闭桌面通知')
    set({ desktopNotify: true }, '已开启桌面通知')
    const perm = notifyPermission() === 'default' ? await requestNotifyPermission() : notifyPermission()
    if (perm === 'unsupported') toast('当前浏览器不支持桌面通知，改用页内提示', 'warn')
    else if (perm === 'denied') toast('浏览器拒绝了通知授权，改用页内提示；可在浏览器站点设置里重新允许', 'warn')
  }

  const reset = () => {
    const n = resetUiPrefs()
    toast(n ? '已重置栏宽与折叠状态，刷新会话页生效' : '没有需要重置的记录')
  }

  return (
    <Card title="个人设置" extra={<span className="text-[11px] text-zinc-400">跟人走，换坐席不变</span>}>
      <div className="space-y-2">
        <PrefRow title="外观" desc="明暗模式">
          <Select className="h-7 w-40 text-[12px]" value={prefs.theme} onChange={(e) => set({ theme: e.target.value as StaffPrefs['theme'] }, `外观：${THEME_OPTIONS.find((o) => o.value === e.target.value)?.label}`)}>
            {THEME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </PrefRow>
        <PrefRow title="界面布局" desc="会话页左右栏宽度与右栏收起状态只记在本机">
          <Button size="sm" onClick={reset}>重置栏宽与折叠状态</Button>
        </PrefRow>
        <PrefRow title="桌面通知" desc="新消息弹系统通知，点击通知直接跳到该会话">
          <Switch checked={prefs.desktopNotify} onChange={(v) => void toggleNotify(v)} />
        </PrefRow>
        <PrefRow title="声音提醒" desc="新消息播放提示音">
          <Switch checked={prefs.sound} onChange={(v) => set({ sound: v }, v ? '已开启声音提醒' : '已关闭声音提醒')} />
        </PrefRow>
        <PrefRow title="语言" desc="工作台界面语言">
          <Select className="h-7 w-32 text-[12px]" value={prefs.language} onChange={(e) => set({ language: e.target.value as Language }, e.target.value === 'zh' ? '语言：中文' : 'Language: English')}>
            <option value="zh">中文</option>
            <option value="en">English</option>
          </Select>
        </PrefRow>
        <PrefRow title="AI 推荐自动弹出" desc="关闭后只在点输入栏的 AI 推荐按钮时生成">
          <Switch checked={prefs.aiSuggest} onChange={(v) => set({ aiSuggest: v }, v ? '已开启 AI 推荐自动弹出' : '已关闭自动弹出，可手动点输入栏的 AI 推荐')} />
        </PrefRow>
      </div>
    </Card>
  )
}

export function ShortcutsCard() {
  return (
    <Card title="快捷键" extra={<HelpTip align="right" text="Windows 上 ⌘ 对应 Ctrl，⌥ 对应 Alt。" />}>
      <ul className="divide-y divide-zinc-100">
        {SHORTCUTS.map((sc) => (
          <li key={sc.keys} className="flex items-center justify-between py-1.5 text-[13px]">
            <span className="text-zinc-600">{sc.desc}</span>
            <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-sans text-[12px] text-zinc-700">{sc.keys}</kbd>
          </li>
        ))}
      </ul>
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
      title={
        <span className="inline-flex items-center gap-1.5">
          快捷回复
          <HelpTip text="聊天输入框里输「/」或点工具栏的闪电图标可以快速插入。企业共享话术在管理后台维护，工作台只能用不能改。" />
        </span>
      }
      extra={
        <Button size="sm" onClick={() => setEditing({ title: '', text: '' })}>
          <Plus size={12} /> 新建
        </Button>
      }
    >
      <div className="mb-1 text-[11px] font-medium text-zinc-500">个人（只有你看得到，{personal.length} 条）</div>
      <ul className="space-y-1">
        {personal.map((q) => (
          <li key={q.id} className="flex items-start gap-2 rounded-md border border-zinc-100 px-2 py-1.5 text-[12px]">
            <div className="min-w-0 flex-1">
              <b className="text-zinc-800">{q.title}</b>
              <div className="truncate text-zinc-500" title={q.text}>
                {q.text}
              </div>
            </div>
            <button type="button" className="text-zinc-400 hover:text-brand-700" title="编辑" onClick={() => setEditing({ id: q.id, title: q.title, text: q.text })}>
              <Pencil size={13} />
            </button>
            <button type="button" className="text-zinc-400 hover:text-red-700" title="删除" onClick={() => void remove(q)}>
              <Trash2 size={13} />
            </button>
          </li>
        ))}
        {personal.length === 0 && <li className="text-[12px] text-zinc-400">还没有个人快捷回复</li>}
      </ul>
      <div className="mt-3 mb-1 text-[11px] font-medium text-zinc-500">企业共享话术（只读，{shared.length} 条）</div>
      <ul className="space-y-1">
        {shared.map((q) => (
          <li key={q.id} className="text-[12px]">
            <b className="text-zinc-700">{q.title}</b>
            <span className="ml-1 text-zinc-500">{q.text.slice(0, 40)}…</span>
          </li>
        ))}
      </ul>
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
