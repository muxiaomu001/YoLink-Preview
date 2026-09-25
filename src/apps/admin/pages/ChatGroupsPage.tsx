import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ChatGroup, ChatGroupKind } from '@/domain/types'
import { fmtDate } from '@/domain/time'
import { useStore } from '@/store/store'
import { seatById } from '@/store/selectors'
import { Button, Field, Input, Select, Textarea } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, SeatAvatar, Table, type Column } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { GROUP_KIND_LABEL } from './ChatGroupsPage.shared'

type KindFilter = 'all' | ChatGroupKind

export function ChatGroupsPage() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const navigate = useNavigate()
  const [kind, setKind] = useState<KindFilter>('all')
  const [creating, setCreating] = useState(false)

  const rows = useMemo(() => s.chatGroups.filter((g) => kind === 'all' || g.kind === kind), [s.chatGroups, kind])

  const toggleOfficial = async (g: ChatGroup) => {
    const next = !g.official
    const ok = await confirm({
      title: next ? `标记「${g.name}」为官方群？` : `取消「${g.name}」的官方标记？`,
      body: next
        ? '标记后客户不能退出该群（「退出群」能力对客户关闭），群名旁显示橙色「官方」标识。'
        : '取消后客户可以自行退出该群，「官方」标识消失。',
      okText: next ? '标记为官方群' : '取消标记',
      danger: !next,
    })
    if (!ok) return
    s.setGroupOfficial(g.id, next, admin)
    toast(next ? `「${g.name}」已标记为官方群，客户不可退出` : `已取消「${g.name}」的官方标记`)
  }

  const columns: Column<ChatGroup>[] = [
    {
      key: 'name',
      title: '群名称',
      render: (g) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-900">{g.name}</span>
          {g.official && <Pill tone="amber">官方</Pill>}
        </div>
      ),
    },
    { key: 'kind', title: '类型', render: (g) => <span>{GROUP_KIND_LABEL[g.kind]}{g.kind === 'channel' && <span className="ml-1 text-[11px] text-zinc-400">客户只读</span>}</span> },
    { key: 'members', title: '成员数', align: 'right', render: (g) => <span className="tabular-nums">{g.memberCustomerIds.length + g.memberSeatIds.length}</span> },
    {
      key: 'owner',
      title: '创建者（群主坐席）',
      render: (g) => {
        const seat = seatById(s, g.ownerSeatId)
        return seat ? (
          <span className="inline-flex items-center gap-1.5">
            <SeatAvatar seat={seat} size={20} /> {seat.displayName}
          </span>
        ) : (
          <span className="text-zinc-400">-</span>
        )
      },
    },
    { key: 'createdAt', title: '创建时间', render: (g) => <span className="tabular-nums text-zinc-600">{fmtDate(g.createdAt)}</span> },
    { key: 'official', title: '官方群', render: (g) => (g.official ? <span className="text-amber-700">是</span> : <span className="text-zinc-500">否</span>) },
    {
      key: 'ops',
      title: '操作',
      align: 'right',
      render: (g) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/groups/${g.id}`)}>
            进入管理
          </Button>
          <Button size="sm" variant={g.official ? 'ghost' : 'primary'} onClick={() => void toggleOfficial(g)}>
            {g.official ? '取消标记' : '标记为官方群'}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="全部群列表"
        desc="群主和管理员都是坐席，员工以坐席身份在群里。新客户自动加入邀请组和邀请链接附带的群。"
        extra={
          <>
            <Select value={kind} onChange={(e) => setKind(e.target.value as KindFilter)} className="w-32">
              <option value="all">全部类型</option>
              <option value="group">群</option>
              <option value="channel">频道</option>
            </Select>
            <Button variant="primary" onClick={() => setCreating(true)}>新建群 / 频道</Button>
          </>
        }
      />
      {creating && <CreateGroupModal onClose={() => setCreating(false)} onCreated={(id) => navigate(`/admin/groups/${id}`)} />}
      <Note>
        标记为官方群后，客户不能退出该群（「退出群」能力对客户关闭），群名旁显示橙色「官方」。
      </Note>
      <Card className="mt-4" padded={false}>
        <Table rows={rows} columns={columns} rowKey={(g) => g.id} empty="该类型下没有群" />
      </Card>
    </div>
  )
}

const NAME_MAX = 128
const DESC_MAX = 255

/** 新建群 / 频道：名称、简介、类型、群主坐席、入群头衔、人数上限 → createChatGroup */
function CreateGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const seats = s.seats
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [kind, setKind] = useState<ChatGroupKind>('group')
  const [ownerSeatId, setOwnerSeatId] = useState(seats[0]?.id ?? '')
  const [titleId, setTitleId] = useState('')
  const [max, setMax] = useState('')
  const nameOk = name.trim().length >= 1 && name.trim().length <= NAME_MAX
  const maxNum = max.trim() === '' ? null : Number(max)
  const maxOk = maxNum == null || (Number.isInteger(maxNum) && maxNum > 0)
  const dup = s.chatGroups.some((g) => g.name === name.trim())
  const ok = nameOk && maxOk && !!ownerSeatId && !dup

  const submit = () => {
    if (!ok) return
    const g = s.createChatGroup({ name: name.trim(), desc: desc.trim(), kind, ownerSeatId, requiredTitleId: titleId || null, maxMembers: maxNum }, { seatId: ownerSeatId, staffId: admin })
    toast(`已创建${kind === 'channel' ? '频道' : '群'}「${g.name}」，主链接已生成`)
    onClose()
    onCreated(g.id)
  }

  return (
    <Modal open onClose={onClose} title="新建群 / 频道" width={520} footer={<><Button onClick={onClose}>取消</Button><Button variant="primary" disabled={!ok} onClick={submit}>创建</Button></>}>
      <div className="space-y-3">
        <Field label="名称" required hint={`1 到 ${NAME_MAX} 字`}>
          <Input value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder="例如：新用户引导群" />
        </Field>
        {dup && <div className="text-xs text-red-600">已有同名群。</div>}
        <Field label="简介" hint={`0 到 ${DESC_MAX} 字`}>
          <Textarea rows={2} value={desc} maxLength={DESC_MAX} onChange={(e) => setDesc(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="类型" hint={kind === 'channel' ? '客户只读' : `默认上限 ${s.policyNumbers.groupMaxMembers.toLocaleString()} 人`}>
            <Select value={kind} onChange={(e) => setKind(e.target.value as ChatGroupKind)}>
              {(Object.keys(GROUP_KIND_LABEL) as ChatGroupKind[]).map((k) => <option key={k} value={k}>{GROUP_KIND_LABEL[k]}</option>)}
            </Select>
          </Field>
          <Field label="群主坐席" required hint="员工以坐席身份在群里">
            <Select value={ownerSeatId} onChange={(e) => setOwnerSeatId(e.target.value)}>
              {seats.map((x) => <option key={x.id} value={x.id}>{x.displayName}（{x.roleDesc}）</option>)}
            </Select>
          </Field>
          <Field label="入群头衔" hint="不满足的客户拉不进来">
            <Select value={titleId} onChange={(e) => setTitleId(e.target.value)}>
              <option value="">无限制</option>
              {s.titles.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
          <Field label="人数上限" hint={`空 = 策略默认 ${s.policyNumbers.groupMaxMembers}`}>
            <Input value={max} inputMode="numeric" placeholder={String(s.policyNumbers.groupMaxMembers)} onChange={(e) => setMax(e.target.value)} />
          </Field>
        </div>
        {!maxOk && <div className="text-xs text-red-600">人数上限必须是正整数。</div>}
        <Note>创建后自动生成永久主链接；要让新客户注册即入群，去「企业设置」的默认群或邀请组 / 邀请链接里勾上它。</Note>
      </div>
    </Modal>
  )
}
