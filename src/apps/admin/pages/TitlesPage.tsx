import { useState } from 'react'
import { Plus } from 'lucide-react'
import { fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { customerById, staffById } from '@/store/selectors'
import { Button, Field, Input, Switch } from '@/ui/primitives'
import { Card, Note, PageHeader, Table, TitleChip } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'

const COLORS = ['#b45309', '#1d4ed8', '#15803d', '#7e22ce', '#be123c', '#0f766e', '#4d7c0f', '#52525b']

export function TitlesPage() {
  const s = useStore()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const admin = s.session.adminStaffId!
  const invalid = name.includes('官方')

  const submit = () => {
    if (!name.trim() || invalid || name.length > 8) return
    s.createTitle({ name: name.trim(), desc: desc.trim(), color, enabled: true }, admin)
    toast(`头衔「${name.trim()}」已入库`)
    setCreating(false)
    setName('')
    setDesc('')
  }

  return (
    <div>
      <PageHeader
        title="头衔库"
        desc="头衔是官方发给客户、所有人都看得到的身份。员工只能从这里选，不能现打字。名字旁显示一个主头衔，资料卡显示全部。"
        extra={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={14} /> 新增头衔
          </Button>
        }
      />
      <Note>
        「官方」徽标不在这个库里，是系统级的，只有坐席有，任何人不能挂给客户。头衔与<b>内部标签</b>是两样东西：内部标签客户永远看不到，头衔全群可见。
      </Note>
      <Card className="mt-4" padded={false}>
        <Table
          rows={s.titles}
          rowKey={(t) => t.id}
          columns={[
            { key: 'chip', title: '头衔', render: (t) => <TitleChip title={t} /> },
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
            { key: 'action', title: '动作', render: (a) => (a.action === 'assign' ? '挂' : '摘') },
            { key: 'customer', title: '客户', render: (a) => customerById(s, a.customerId)?.nickname },
            { key: 'title', title: '头衔', render: (a) => s.titles.find((t) => t.id === a.titleId)?.name },
            { key: 'by', title: '操作人', render: (a) => staffById(s, a.byStaffId)?.name },
          ]}
        />
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="新增头衔"
        footer={
          <>
            <Button onClick={() => setCreating(false)}>取消</Button>
            <Button variant="primary" disabled={!name.trim() || invalid || name.length > 8} onClick={submit}>
              入库
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="名称" required hint="1 到 8 字，显示在昵称旁">
            <Input value={name} maxLength={8} onChange={(e) => setName(e.target.value)} placeholder="如：私享会员" />
          </Field>
          {invalid && <div className="text-xs text-red-600">名称不能含「官方」：官方徽标是系统级的，不允许冒充。</div>}
          <Field label="颜色">
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} className="h-6 w-6 rounded-full ring-offset-2" style={{ background: c, boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined }} aria-label={c} />
              ))}
            </div>
          </Field>
          <Field label="说明" hint="0 到 64 字">
            <Input value={desc} maxLength={64} onChange={(e) => setDesc(e.target.value)} />
          </Field>
          <div className="text-xs text-zinc-500">
            预览：<TitleChip title={{ id: 'x', name: name || '头衔', color, desc, enabled: true }} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
