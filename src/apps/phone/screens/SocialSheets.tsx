/**
 * 消息页「+」菜单背后的动作弹层：建群、建频道、加好友、搜索用户、扫码入群。
 * 核心是入口随策略开关出现与消失；动作本身在演示环境里只做校验与提示（提示统一走 demoToast）。
 */
import { useState } from 'react'
import { useStore } from '@/store/store'
import { Button, Input } from '@/ui/primitives'
import { demoToast } from '@/ui/DemoNote'
import { DemoHint, Sheet } from '../parts'
import type { SocialAction } from './SocialSheets.shared'

export function SocialSheet({ action, onClose }: { action: SocialAction; onClose: () => void }) {
  if (action === 'group.create' || action === 'channel.create') return <CreateSheet kind={action === 'group.create' ? '群聊' : '频道'} onClose={onClose} />
  if (action === 'group.join_by_link') return <JoinByLinkSheet onClose={onClose} />
  return <FriendSheet mode={action === 'friend.add' ? 'add' : 'search'} onClose={onClose} />
}

function CreateSheet({ kind, onClose }: { kind: '群聊' | '频道'; onClose: () => void }) {
  const [name, setName] = useState('')
  const submit = () => {
    demoToast(`创建${kind}`)
    onClose()
  }
  return (
    <Sheet
      title={`发起${kind}`}
      onClose={onClose}
      footer={
        <Button variant="primary" className="h-9 w-full" disabled={!name.trim()} onClick={submit}>
          创建
        </Button>
      }
    >
      <div className="mb-1 text-[11px] text-zinc-500">{kind}名称</div>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`给${kind}起个名字`} className="h-9" />
      <div className="mt-3">
        <DemoHint>正式产品里客户建{kind}走与工作台相同的一条链路，{kind === '群聊' ? '群主' : '频道主'}为客户本人。这里只演示入口随策略出现与消失。</DemoHint>
      </div>
    </Sheet>
  )
}

function FriendSheet({ mode, onClose }: { mode: 'add' | 'search'; onClose: () => void }) {
  const s = useStore()
  const [q, setQ] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const kw = q.trim().toLowerCase()
  const search = () => {
    const hit = s.customers.filter((c) => !c.deletedAt && (c.nickname.toLowerCase().includes(kw) || c.accountId.toLowerCase() === kw))
    setResult(hit.length ? `找到 ${hit.length} 位：${hit.slice(0, 3).map((c) => c.nickname).join('、')}` : '没有匹配的用户')
  }
  const apply = () => {
    demoToast('发送好友申请')
    onClose()
  }
  return (
    <Sheet
      title={mode === 'add' ? '添加好友' : '搜索用户'}
      onClose={onClose}
      footer={
        mode === 'add' ? (
          <Button variant="primary" className="h-9 w-full" disabled={!kw} onClick={apply}>
            发送申请
          </Button>
        ) : (
          <Button variant="primary" className="h-9 w-full" disabled={!kw} onClick={search}>
            搜索
          </Button>
        )
      }
    >
      <div className="mb-1 text-[11px] text-zinc-500">昵称或账号 ID</div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="输入昵称或账号 ID" className="h-9" />
      {result && <p className="mt-2 text-xs text-zinc-600">{result}</p>}
      <div className="mt-3">
        <DemoHint>{mode === 'add' ? '对方同意后才成为好友，是否需要同意由对方的策略决定。演示只到提交申请为止。' : '搜索结果来自演示客户数据；客服预设下这个入口本来不出现。'}</DemoHint>
      </div>
    </Sheet>
  )
}

function JoinByLinkSheet({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const check = () => {
    const c = code.trim().toUpperCase()
    const hit = s.chatGroups.flatMap((g) => g.inviteLinks.map((l) => ({ g, l }))).find((x) => x.l.code.toUpperCase() === c)
    if (!hit) return setMsg('链接无效')
    if (hit.l.status !== 'active') return setMsg(`链接已${hit.l.status === 'expired' ? '过期' : '撤销'}`)
    setMsg(`链接有效：${hit.g.kind === 'channel' ? '频道' : '群'}「${hit.g.name}」。入群前还会校验人数上限与头衔要求。`)
  }
  return (
    <Sheet
      title="扫码 / 链接入群"
      onClose={onClose}
      footer={
        <Button variant="primary" className="h-9 w-full" disabled={!code.trim()} onClick={check}>
          校验链接
        </Button>
      }
    >
      <div className="mb-1 text-[11px] text-zinc-500">群邀请链接码</div>
      <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="如 GP-HXWM" className="h-9 font-mono uppercase" />
      {msg && <p className="mt-2 text-xs text-zinc-600">{msg}</p>}
      <div className="mt-3">
        <DemoHint>链接码来自工作台群设置里的「群邀请链接」；过期、撤销、用满的链接会被拒绝。演示只走到校验这一步，不真正入群。</DemoHint>
      </div>
    </Sheet>
  )
}
