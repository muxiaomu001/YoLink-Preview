/**
 * 工作台设置页的分块：个人设置（staff.prefs + 本机界面偏好重置）、快捷键说明、我的话术（只看 / 删，新建编辑在聊天页右栏）、企业话术只读。
 */
import { Link } from 'react-router-dom'
import { ArrowRight, Trash2 } from 'lucide-react'
import type { Language, QuickReply, QuickReplyKind, StaffPrefs } from '@/domain/types'
import { DEFAULT_STAFF_PREFS } from '@/domain/seed-groups'
import { Button, Select, Switch } from '@/ui/primitives'
import { Card } from '@/ui/display'
import { HelpTip } from '@/ui/help'
import { toast } from '@/ui/overlay'
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

const KIND_LABEL: Record<QuickReplyKind, string> = { text: '文字', image: '图片', file: '文件' }

const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: '⌘⌥↑ / ⌘⌥↓', desc: '切换上一条 / 下一条会话' },
  { keys: '⌘⇧F', desc: '搜索会话列表' },
  { keys: '⌘F', desc: '搜索当前会话内的消息' },
  { keys: '⌘⌥R', desc: '把当前会话标记为已读' },
  { keys: 'Enter / Shift+Enter', desc: '发送 / 换行' },
  { keys: '/', desc: '在输入框浏览话术；@ 提及成员' },
  { keys: 'Tab', desc: '选中打字自动匹配到的话术' },
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
        <PrefRow title="打字自动匹配话术" desc="输入满 2 个字就在标题、正文、文件名里全文查找，浮在输入框上方，Tab 选中；关闭后只能用「/」或右栏话术页签">
          <Switch checked={prefs.quickMatch} onChange={(v) => set({ quickMatch: v }, v ? '已开启打字自动匹配话术' : '已关闭自动匹配，仍可输「/」或用右栏话术页签')} />
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

export function MyQuickRepliesCard() {
  const { s, staff } = useWorkbench()
  if (!staff) return null
  const personal = s.quickReplies.filter((q) => q.scope === 'personal' && q.staffId === staff.id)
  const shared = s.quickReplies.filter((q) => q.scope === 'enterprise' && q.enabled)
  const catName = (id: string | null) => (id && s.quickReplyCategories.find((c) => c.id === id)?.name) || '未分类'

  const remove = async (q: QuickReply) => {
    const ok = await confirm({ title: `删除话术「${q.title}」？`, okText: '删除', danger: true })
    if (!ok) return
    s.deleteQuickReply('personal', q.id, staff.id)
    toast('已删除')
  }

  return (
    <Card
      title={
        <span className="inline-flex items-center gap-1.5">
          我的话术
          <HelpTip text="只有你自己看得到。聊天输入框里打字满 2 个字会自动匹配（可在个人设置关闭），输「/」或点工具栏闪电图标可浏览全部。企业话术在管理后台维护，工作台只能用不能改。" />
        </span>
      }
      extra={
        <Link to="/workbench/chat" className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-700 hover:underline">
          去聊天页 <ArrowRight size={12} />
        </Link>
      }
    >
      <p className="mb-2 text-[12px] text-zinc-500">
        {s.enterprise.allowPersonalQuickReply ? '在聊天页右栏「话术」页签里新建和编辑；这里只看和删。' : '企业已关闭「员工建个人话术」，只能用企业话术。'}
      </p>
      <div className="mb-1 text-[11px] font-medium text-zinc-500">个人（{personal.length} 条）</div>
      <ul className="space-y-1">
        {personal.map((q) => (
          <li key={q.id} className="flex items-center gap-2 rounded-md border border-zinc-100 px-2 py-1.5 text-[12px]">
            <span className="min-w-0 flex-1 truncate font-medium text-zinc-800" title={q.text || q.media?.name}>{q.title}</span>
            <span className="shrink-0 text-zinc-500">{KIND_LABEL[q.kind]}</span>
            <span className="shrink-0 text-zinc-400">{catName(q.categoryId)}</span>
            <span className="shrink-0 text-zinc-400 tabular-nums" title="使用次数">用过 {q.useCount} 次</span>
            <button type="button" className="text-zinc-400 hover:text-red-700" title="删除" onClick={() => void remove(q)}>
              <Trash2 size={13} />
            </button>
          </li>
        ))}
        {personal.length === 0 && <li className="text-[12px] text-zinc-400">还没有个人话术</li>}
      </ul>
      <div className="mt-3 mb-1 text-[11px] font-medium text-zinc-500">企业话术（只读，{shared.length} 条）</div>
      <ul className="space-y-0.5">
        {shared.map((q) => (
          <li key={q.id} className="flex items-center gap-2 text-[12px]">
            <span className="min-w-0 flex-1 truncate text-zinc-700">{q.title}</span>
            <span className="shrink-0 text-zinc-500">{KIND_LABEL[q.kind]}</span>
            <span className="shrink-0 text-zinc-400">{catName(q.categoryId)}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
