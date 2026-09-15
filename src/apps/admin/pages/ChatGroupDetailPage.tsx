/**
 * 群管理页：与工作台"右侧：群信息卡"一致的字段，管理员从全部群列表「进入管理」到这里。
 */
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Crown } from 'lucide-react'
import type { ChatGroup, ChatGroupKind, Customer } from '@/domain/types'
import { fmtDateTime } from '@/domain/time'
import { useStore } from '@/store/store'
import { customerById, messagesOf, seatById } from '@/store/selectors'
import { Button, Field, Input, Select, Switch, Textarea } from '@/ui/primitives'
import { Avatar, Card, Empty, PageHeader, Pill, SeatAvatar, Table, TitleChip, type Column } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { GROUP_KIND_LABEL } from './ChatGroupsPage'

export function ChatGroupDetailPage() {
  const { groupId } = useParams()
  const s = useStore()
  const group = s.chatGroups.find((g) => g.id === groupId)

  if (!group) {
    return (
      <div>
        <BackLink />
        <Empty text="群不存在或已被删除" />
      </div>
    )
  }
  return (
    <div>
      <BackLink />
      <PageHeader title={`群管理：${group.name}`} desc="与工作台的群信息卡是同一套字段。群主和管理员都是坐席，客户成员由注册自动加入或管理员补加。" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <BasicInfoCard key={group.id} group={group} />
        <RecentMessagesCard group={group} />
      </div>
      <MembersCard group={group} />
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/admin/groups" className="mb-3 inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">
      <ArrowLeft size={13} /> 返回全部群列表
    </Link>
  )
}

/** 基本信息：名称、说明、类型、入群条件、人数上限、官方标记 */
function BasicInfoCard({ group }: { group: ChatGroup }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [name, setName] = useState(group.name)
  const [desc, setDesc] = useState(group.desc)
  const [kind, setKind] = useState<ChatGroupKind>(group.kind)
  const [requiredTitleId, setRequiredTitleId] = useState(group.requiredTitleId ?? '')
  const [maxMembers, setMaxMembers] = useState(group.maxMembers == null ? '' : String(group.maxMembers))
  const owner = seatById(s, group.ownerSeatId)
  const nameOk = name.trim().length >= 1 && name.trim().length <= 32
  const maxNum = maxMembers.trim() === '' ? null : Number(maxMembers)
  const maxOk = maxNum == null || (Number.isInteger(maxNum) && maxNum > 0)
  const dirty = name !== group.name || desc !== group.desc || kind !== group.kind || (requiredTitleId || null) !== group.requiredTitleId || maxNum !== group.maxMembers

  const save = () => {
    if (!nameOk || !maxOk || !dirty) return
    s.updateChatGroup(group.id, { name: name.trim(), desc: desc.trim(), kind, requiredTitleId: requiredTitleId || null, maxMembers: maxNum }, admin)
    toast(`群「${name.trim()}」基本信息已保存`)
  }
  const toggleOfficial = async (v: boolean) => {
    const ok = await confirm({
      title: v ? '标记为官方群？' : '取消官方标记？',
      body: v ? '标记后 group.leave 策略对客户关闭，客户不可退出。' : '取消后客户可自行退出该群。',
      okText: v ? '标记' : '取消标记',
      danger: !v,
    })
    if (!ok) return
    s.setGroupOfficial(group.id, v, admin)
    toast(v ? '已标记为官方群，客户不可退出' : '已取消官方标记')
  }

  return (
    <Card
      title="基本信息"
      extra={
        <Button size="sm" variant="primary" disabled={!nameOk || !maxOk || !dirty} onClick={save}>
          保存
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Avatar text={group.name} size={44} />
          <div className="text-xs text-zinc-500">
            <div>
              创建者：{owner ? <span className="inline-flex items-center gap-1 text-zinc-800"><SeatAvatar seat={owner} size={16} /> {owner.displayName}</span> : '-'}
            </div>
            <div className="mt-0.5 tabular-nums">创建时间：{fmtDateTime(group.createdAt)}</div>
            <div className="mt-0.5">成员：{group.memberSeatIds.length} 个坐席 + {group.memberCustomerIds.length} 位客户</div>
          </div>
        </div>
        <Field label="群名称" required hint="1 到 32 字">
          <Input value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
        </Field>
        {!nameOk && <div className="text-xs text-red-600">群名称不能为空。</div>}
        <Field label="群简介" hint="0 到 128 字">
          <Textarea value={desc} maxLength={128} rows={2} onChange={(e) => setDesc(e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="类型">
            <Select value={kind} onChange={(e) => setKind(e.target.value as ChatGroupKind)}>
              {(Object.keys(GROUP_KIND_LABEL) as ChatGroupKind[]).map((k) => (
                <option key={k} value={k}>
                  {GROUP_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="入群条件（头衔）">
            <Select value={requiredTitleId} onChange={(e) => setRequiredTitleId(e.target.value)}>
              <option value="">无限制</option>
              {s.titles.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="人数上限" hint={`空 = 用策略默认 ${s.policyNumbers.groupMaxMembers}`}>
            <Input value={maxMembers} inputMode="numeric" placeholder={String(s.policyNumbers.groupMaxMembers)} onChange={(e) => setMaxMembers(e.target.value)} />
          </Field>
        </div>
        {!maxOk && <div className="text-xs text-red-600">人数上限必须是正整数。</div>}
        <div className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2">
          <div>
            <div className="text-[13px] text-zinc-800">
              官方群标记 {group.official && <Pill tone="amber">官方</Pill>}
            </div>
            <div className="text-[11px] text-zinc-500">开启后客户不可退出（group.leave 对客户关闭）</div>
          </div>
          <Switch checked={group.official} onChange={(v) => void toggleOfficial(v)} />
        </div>
      </div>
    </Card>
  )
}

/** 成员：坐席成员 + 客户成员表 */
function MembersCard({ group }: { group: ChatGroup }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [q, setQ] = useState('')
  const seats = group.memberSeatIds.map((id) => seatById(s, id)).filter((x) => !!x)
  const autoJoinIds = useMemo(() => {
    const viaInvite = s.inviteGroups.filter((ig) => ig.chatGroupIds.includes(group.id)).map((ig) => ig.id)
    return { viaInvite, isDefault: s.enterprise.defaultChatGroupIds.includes(group.id) }
  }, [s.inviteGroups, s.enterprise.defaultChatGroupIds, group.id])
  const customers = group.memberCustomerIds
    .map((id) => customerById(s, id))
    .filter((c): c is Customer => !!c && !c.deletedAt)
    .filter((c) => !q.trim() || c.nickname.includes(q.trim()))

  const remove = async (c: Customer) => {
    const ok = await confirm({ title: `把「${c.nickname}」移出群？`, body: '移出后客户不再收到该群消息；如果该群是注册自动加入的，客户不会被再次拉回。', okText: '移出', danger: true })
    if (!ok) return
    s.removeGroupMember(group.id, c.id, admin)
    toast(`已把「${c.nickname}」移出「${group.name}」`)
  }

  const columns: Column<Customer>[] = [
    { key: 'avatar', title: '头像', width: '48px', render: (c) => <Avatar text={c.nickname} size={28} /> },
    { key: 'nick', title: '昵称', render: (c) => <span className="font-medium text-zinc-900">{c.nickname}</span> },
    {
      key: 'title',
      title: '主头衔',
      render: (c) => {
        const t = s.titles.find((x) => x.id === c.primaryTitleId)
        return t ? <TitleChip title={t} /> : <span className="text-zinc-400">无</span>
      },
    },
    {
      key: 'source',
      title: '入群来源',
      render: (c) => (autoJoinIds.isDefault || autoJoinIds.viaInvite.includes(c.inviteGroupId) ? <Pill tone="blue">注册自动加入</Pill> : <Pill>补加</Pill>),
    },
    {
      key: 'ops',
      title: '操作',
      align: 'right',
      render: (c) => (
        <Button size="sm" variant="danger" onClick={() => void remove(c)}>
          移出群
        </Button>
      ),
    },
  ]

  return (
    <Card className="mt-4" title={`成员（${seats.length} 个坐席 + ${group.memberCustomerIds.length} 位客户）`} extra={<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索客户昵称" className="h-7 w-44 text-xs" />} padded={false}>
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-4 py-3">
        <span className="text-[11px] text-zinc-500">坐席成员：</span>
        {seats.map((seat) => (
          <span key={seat.id} className="inline-flex items-center gap-1 rounded-full border border-zinc-200 py-0.5 pr-2 pl-0.5 text-xs">
            <SeatAvatar seat={seat} size={18} />
            {seat.displayName}
            {seat.id === group.ownerSeatId && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700">
                <Crown size={10} /> 群主
              </span>
            )}
            {seat.id !== group.ownerSeatId && <span className="text-[10px] text-zinc-400">管理员</span>}
          </span>
        ))}
      </div>
      <Table rows={customers} columns={columns} rowKey={(c) => c.id} dense empty={q ? '没有匹配的客户' : '还没有客户成员'} />
    </Card>
  )
}

/** 最近消息：该群会话最近 20 条 */
function RecentMessagesCard({ group }: { group: ChatGroup }) {
  const s = useStore()
  const conv = s.conversations.find((c) => c.chatGroupId === group.id)
  const list = conv ? messagesOf(s, conv.id).slice(-20).reverse() : []
  return (
    <Card title="最近消息（最近 20 条）" padded={false}>
      {!list.length && <Empty text="该群还没有消息" />}
      <ul className="thin-scroll max-h-[520px] divide-y divide-zinc-100 overflow-y-auto">
        {list.map((m) => {
          const who = m.senderKind === 'seat' ? seatById(s, m.seatId)?.displayName : m.senderKind === 'customer' ? customerById(s, m.senderId)?.nickname : '系统'
          return (
            <li key={m.id} className="px-4 py-2 text-xs">
              <div className="flex items-center justify-between">
                <span className={m.senderKind === 'seat' ? 'font-medium text-brand-800' : 'font-medium text-zinc-700'}>
                  {who ?? '-'}
                  {m.senderKind === 'seat' && <Pill tone="blue" className="ml-1">坐席</Pill>}
                </span>
                <span className="tabular-nums text-zinc-400">{fmtDateTime(m.at)}</span>
              </div>
              <div className={m.deletedAt ? 'mt-0.5 text-zinc-400 line-through' : 'mt-0.5 text-zinc-700'}>{m.text}</div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
