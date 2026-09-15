import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { Title } from '@/domain/types'
import { fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { customerById, staffById } from '@/store/selectors'
import { Button, Field, Input, Switch } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, Table, TitleChip } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { TITLE_ICONS, TitleIcon } from '@/ui/titleIcons'

const COLORS = ['#b45309', '#1d4ed8', '#15803d', '#7e22ce', '#be123c', '#0f766e', '#4d7c0f', '#52525b']
/** PRD：一家企业十来种够用，上限 50 */
const TITLE_MAX = 50

export function TitlesPage() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Title | null>(null)
  const full = s.titles.length >= TITLE_MAX

  return (
    <div>
      <PageHeader
        title="头衔库"
        desc="头衔是官方发给客户、所有人都看得到的身份。员工只能从这里选，不能现打字。名字旁显示一个主头衔，资料卡显示全部。"
        extra={
          <Button variant="primary" disabled={full} title={full ? `已达上限 ${TITLE_MAX} 个` : undefined} onClick={() => setCreating(true)}>
            <Plus size={14} /> 新增头衔
          </Button>
        }
      />
      <Note>
        「官方」徽标不在这个库里，是系统级的，只有坐席有，任何人不能挂给客户。头衔与<b>内部标签</b>是两样东西：内部标签客户永远看不到，头衔全群可见。名称企业内唯一、1 到 8 字，<b>上限 {TITLE_MAX} 个</b>（当前 {s.titles.length} 个）。
      </Note>
      <Card className="mt-4" padded={false}>
        <Table
          rows={s.titles}
          rowKey={(t) => t.id}
          columns={[
            { key: 'chip', title: '头衔', render: (t) => <TitleChip title={t} /> },
            {
              key: 'icon',
              title: '图标',
              render: (t) => {
                const meta = TITLE_ICONS.find((x) => x.name === t.icon)
                return meta ? (
                  <span className="inline-flex items-center gap-1 text-zinc-700">
                    <TitleIcon name={t.icon} size={14} /> {meta.label}
                  </span>
                ) : (
                  <span className="text-zinc-400">无</span>
                )
              },
            },
            { key: 'color', title: '颜色', render: (t) => <span className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-600"><span className="h-3.5 w-3.5 rounded-full" style={{ background: t.color }} />{t.color}</span> },
            { key: 'desc', title: '说明（资料卡上点开显示）', render: (t) => <span className="text-zinc-600">{t.desc}</span> },
            { key: 'count', title: '客户数', align: 'right', render: (t) => <span className="tabular-nums">{s.customers.filter((c) => c.titleIds.includes(t.id)).length}</span> },
            {
              key: 'enabled',
              title: '启用',
              render: (t) => (
                <Switch
                  checked={t.enabled}
                  onChange={(v) => {
                    s.updateTitle(t.id, { enabled: v }, admin)
                    toast(v ? '已启用，客户身上的头衔恢复显示' : '已停用，客户身上的头衔隐藏但不删')
                  }}
                />
              ),
            },
            {
              key: 'ops',
              title: '操作',
              align: 'right',
              render: (t) => (
                <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                  编辑
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Card className="mt-4" title="最近挂、摘记录（进审计日志）" padded={false}>
        <Table
          rows={[...s.titleAssignments].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12)}
          rowKey={(a) => a.id}
          dense
          columns={[
            { key: 'at', title: '时间', render: (a) => <span className="tabular-nums text-zinc-500">{fmtDateTime(a.at)}</span> },
            { key: 'action', title: '动作', render: (a) => (a.action === 'assign' ? <Pill tone="green">挂</Pill> : <Pill>摘</Pill>) },
            { key: 'customer', title: '客户', render: (a) => customerById(s, a.customerId)?.nickname },
            { key: 'title', title: '头衔', render: (a) => s.titles.find((t) => t.id === a.titleId)?.name },
            { key: 'by', title: '操作人', render: (a) => staffById(s, a.byStaffId)?.name },
          ]}
        />
      </Card>

      {creating && <TitleEditor onClose={() => setCreating(false)} />}
      {editing && <TitleEditor title={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

/** 新增 / 编辑头衔弹窗：名称唯一、不含「官方」、1-8 字；颜色色板；图标单选可不选；说明 0-64 字 */
function TitleEditor({ title, onClose }: { title?: Title; onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [name, setName] = useState(title?.name ?? '')
  const [desc, setDesc] = useState(title?.desc ?? '')
  const [color, setColor] = useState(title?.color ?? COLORS[0])
  const [icon, setIcon] = useState(title?.icon ?? '')
  const trimmed = name.trim()
  const hasOfficial = trimmed.includes('官方')
  const duplicate = s.titles.some((t) => t.id !== title?.id && t.name === trimmed)
  const lengthOk = trimmed.length >= 1 && trimmed.length <= 8
  const error = hasOfficial ? '名称不能含「官方」：官方徽标是系统级的，不允许冒充。' : duplicate ? '已有同名头衔，企业内名称必须唯一。' : !lengthOk && name.length > 0 ? '名称 1 到 8 字。' : ''
  const ok = lengthOk && !hasOfficial && !duplicate

  const submit = () => {
    if (!ok) return
    const patch = { name: trimmed, desc: desc.trim(), color, icon: icon || undefined }
    if (title) {
      s.updateTitle(title.id, patch, admin)
      toast(`头衔「${trimmed}」已更新，客户身上的显示同步变化`)
    } else {
      s.createTitle({ ...patch, enabled: true }, admin)
      toast(`头衔「${trimmed}」已入库`)
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title ? `编辑头衔：${title.name}` : '新增头衔'}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!ok} onClick={submit}>
            {title ? '保存' : '入库'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="名称" required hint="1 到 8 字，企业内唯一，显示在昵称旁">
          <Input value={name} maxLength={8} onChange={(e) => setName(e.target.value)} placeholder="如：私享会员" />
        </Field>
        {error && <div className="text-xs text-red-600">{error}</div>}
        <Field label="颜色">
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} className="h-6 w-6 rounded-full" style={{ background: c, boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined }} aria-label={c} />
            ))}
          </div>
        </Field>
        <Field label="图标" hint="内置图标单选，可不选">
          <div className="flex flex-wrap gap-2">
            <IconOption active={icon === ''} onClick={() => setIcon('')} label="不选" />
            {TITLE_ICONS.map((it) => (
              <IconOption key={it.name} active={icon === it.name} onClick={() => setIcon(it.name)} label={it.label} iconName={it.name} />
            ))}
          </div>
        </Field>
        <Field label="说明" hint="0 到 64 字，资料卡上点开显示">
          <Input value={desc} maxLength={64} onChange={(e) => setDesc(e.target.value)} />
        </Field>
        <div className="text-xs text-zinc-500">
          预览：<TitleChip title={{ id: 'x', name: trimmed || '头衔', color, icon: icon || undefined, desc, enabled: true }} />
        </div>
      </div>
    </Modal>
  )
}

function IconOption({ active, onClick, label, iconName }: { active: boolean; onClick: () => void; label: string; iconName?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? 'inline-flex items-center gap-1 rounded-md border border-brand-500 bg-brand-50 px-2 py-1 text-xs text-brand-800' : 'inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50'}
    >
      {iconName && <TitleIcon name={iconName} size={13} />}
      {label}
    </button>
  )
}
