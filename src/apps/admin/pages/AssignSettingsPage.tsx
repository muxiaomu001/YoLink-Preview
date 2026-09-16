/**
 * 分配设置：企业默认欢迎语、企业默认官方群与频道（PRD 05 446-455 行）。
 */
import { useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { ChatGroup } from '@/domain/types'
import { useStore } from '@/store/store'
import { Button, Checkbox, Field, Textarea } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill } from '@/ui/display'
import { toast } from '@/ui/overlay'

const KIND_LABEL: Record<ChatGroup['kind'], string> = { group: '群', channel: '频道' }

export function AssignSettingsPage() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  return (
    <div>
      <PageHeader title="分配设置" desc="新客户注册后自动收到的欢迎语，以及自动加入的官方群与频道。邀请组自己附带的群在这之上叠加。" />
      <div className="grid grid-cols-2 gap-4">
        <WelcomeCard admin={admin} />
        <DefaultGroupsCard admin={admin} />
      </div>
    </div>
  )
}

function WelcomeCard({ admin }: { admin: string }) {
  const s = useStore()
  const [welcome, setWelcome] = useState(s.enterprise.defaultWelcome)
  const ok = welcome.trim().length > 0 && welcome.length <= 500
  const seatsUsingDefault = s.seats.filter((x) => !x.welcome && x.status !== 'disabled')
  return (
    <Card title="企业默认欢迎语" level="P0">
      <div className="space-y-3">
        <Field label="模板" required hint="坐席没单独配欢迎语时用这条，最多 500 字">
          <Textarea rows={5} maxLength={500} value={welcome} onChange={(ev) => setWelcome(ev.target.value)} />
        </Field>
        <div className="rounded-md bg-zinc-50 px-3 py-2 text-[11px] leading-relaxed text-zinc-600">
          变量：<code className="font-mono text-zinc-800">{'{{customer.nickname}}'}</code> 客户昵称、<code className="font-mono text-zinc-800">{'{{seat.name}}'}</code> 坐席显示名。坐席欢迎语在「坐席」里配，交接后跟着坐席走，不跟人走。
        </div>
        <div className="text-[11px] text-zinc-500">
          当前用这条默认欢迎语的坐席：{seatsUsingDefault.length ? seatsUsingDefault.map((x) => x.displayName).join('、') : '无（全部单独配了）'}
        </div>
        <Button
          variant="primary"
          disabled={!ok}
          onClick={() => {
            s.updateEnterprise({ defaultWelcome: welcome }, admin)
            toast('企业默认欢迎语已保存，只影响之后注册的客户')
          }}
        >
          保存
        </Button>
      </div>
    </Card>
  )
}

function DefaultGroupsCard({ admin }: { admin: string }) {
  const s = useStore()
  const [ids, setIds] = useState<string[]>(s.enterprise.defaultChatGroupIds)
  const capOf = (g: ChatGroup) => g.maxMembers ?? s.policyNumbers.groupMaxMembers
  const memberCount = (g: ChatGroup) => g.memberCustomerIds.length + g.memberSeatIds.length
  const toggle = (id: string, on: boolean) => setIds((list) => (on ? [...list, id] : list.filter((x) => x !== id)))
  const move = (id: string, dir: -1 | 1) =>
    setIds((list) => {
      const i = list.indexOf(id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= list.length) return list
      const next = [...list]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  const selected = ids.map((id) => s.chatGroups.find((g) => g.id === id)).filter((g): g is ChatGroup => !!g)
  const unselected = s.chatGroups.filter((g) => !ids.includes(g.id))
  const firstOpen = selected.find((g) => memberCount(g) < capOf(g))
  const dirty = ids.join(',') !== s.enterprise.defaultChatGroupIds.join(',')

  const row = (g: ChatGroup, idx: number) => {
    const on = ids.includes(g.id)
    const full = memberCount(g) >= capOf(g)
    return (
      <div key={g.id} className="flex items-center gap-3 px-3 py-2">
        <Checkbox checked={on} onChange={(v) => toggle(g.id, v)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[13px] text-zinc-900">
            {on && <span className="w-4 text-[11px] tabular-nums text-zinc-400">{idx + 1}.</span>}
            {g.name}
            <Pill tone="zinc">{KIND_LABEL[g.kind]}</Pill>
            {g.official && <Pill tone="blue">官方</Pill>}
            {on && firstOpen?.id === g.id && <Pill tone="green">新客户进这个</Pill>}
            {on && full && <Pill tone="red">已满</Pill>}
          </div>
          <div className="text-[11px] text-zinc-500">
            成员 {memberCount(g)} / 上限 {capOf(g)}
            {g.maxMembers === null && '（用数值策略的单群上限）'}
          </div>
        </div>
        {on && (
          <div className="flex gap-0.5">
            <Button size="sm" variant="ghost" disabled={idx === 0} onClick={() => move(g.id, -1)} aria-label="上移">
              <ArrowUp size={12} />
            </Button>
            <Button size="sm" variant="ghost" disabled={idx === ids.length - 1} onClick={() => move(g.id, 1)} aria-label="下移">
              <ArrowDown size={12} />
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <Card title="企业默认官方群与频道" level="P0">
      <div className="space-y-3">
        <Note>
          所有新客户注册后加入列表里<b>第一个未满的群</b>；全部满时不加入并提醒管理员建新群。可按顺序配多个同类官方群，与邀请组附带的群叠加。
        </Note>
        <div className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
          {selected.map((g, i) => row(g, i))}
          {unselected.map((g) => row(g, -1))}
        </div>
        {selected.length > 0 && !firstOpen && <div className="text-[11px] text-red-600">列表里的群全部已满，新客户不会入群，请建新群加进来。</div>}
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            disabled={!dirty}
            onClick={() => {
              s.setDefaultChatGroups(ids, admin)
              toast(ids.length ? `已保存：新客户按顺序进 ${selected.map((g) => g.name).join(' → ')} 中第一个未满的` : '已保存：新客户不自动入群')
            }}
          >
            保存
          </Button>
          <span className="text-[11px] text-zinc-400">改动不追溯老客户</span>
        </div>
      </div>
    </Card>
  )
}
