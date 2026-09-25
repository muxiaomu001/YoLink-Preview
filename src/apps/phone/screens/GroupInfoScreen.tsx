/**
 * 群信息屏：公告、成员列表（群设置 + 策略双重门）、邀请好友、退出群聊 / 频道。
 */
import type { ReactNode } from 'react'
import { Link2, LogOut, UserPlus } from 'lucide-react'
import type { ChatGroup } from '@/domain/types'
import { fmtDate } from '@/domain/time'
import { useStore } from '@/store/store'
import { customerById, seatById } from '@/store/selectors'
import { customerCan, groupRoleOf, resolveCap } from '@/store/policy'
import { Avatar, SeatAvatar, TitleChip } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { copyText } from '@/ui/clipboard'
import { demoToast } from '@/ui/DemoNote'
import { DemoHint, GroupAvatar, ScreenHeader, SectionLabel } from '../parts'
import { PHONE_SOURCE_LABEL, groupKindLabel } from '../shared'

const ROLE_LABEL = { owner: '群主', admin: '管理员', member: '', none: '' } as const

export function GroupInfoScreen({ g, customerId, onBack, onLeft }: { g: ChatGroup; customerId: string; onBack: () => void; onLeft: () => void }) {
  const s = useStore()
  const kindLabel = groupKindLabel(g)
  const membersVisible = g.settings.membersVisible && customerCan(s, customerId, 'group.view_members', g.id)
  const canViewProfile = customerCan(s, customerId, 'group.view_member_profile', g.id)
  const canInvite = customerCan(s, customerId, 'group.invite', g.id)
  const leaveKey = g.kind === 'channel' ? 'channel.leave' : 'group.leave'
  const leave = resolveCap(s, { role: 'customer', key: leaveKey, groupId: g.id, userId: customerId })
  const mainLink = g.inviteLinks.find((l) => l.main && l.status === 'active')
  const myRole = groupRoleOf(g, 'customer', customerId)
  const total = g.memberSeatIds.length + g.memberCustomerIds.length

  const doLeave = async () => {
    const ok = await confirm({ title: g.kind==='channel'?`取消订阅「${g.name}」？`:`退出${kindLabel}「${g.name}」？`, body: '之后不再收到消息，需要重新通过链接加入。', okText: g.kind==='channel'?'取消订阅':'退出', danger: true })
    if (!ok) return
    s.customerLeaveGroup(g.id, customerId)
    toast(g.kind==='channel'?`已取消订阅「${g.name}」`:`已退出${kindLabel}「${g.name}」`)
    onLeft()
  }
  // 真复制，复制不了时按剪贴板口径提示
  const invite = async () => {
    if (!mainLink) return toast(`该${kindLabel}暂无有效邀请链接`, 'warn')
    toast((await copyText(mainLink.code)) ? `邀请链接 ${mainLink.code} 已复制` : '复制失败：浏览器不允许访问剪贴板', mainLink ? 'ok' : 'warn')
  }

  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <ScreenHeader onBack={onBack} title={`${kindLabel}信息`} />
      <div className="thin-scroll flex-1 overflow-y-auto">
        <div className="flex items-center gap-3 bg-white px-4 py-3">
          <GroupAvatar g={g} size={52} />
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-[15px] font-medium text-zinc-900">
              {g.name}
              {g.official && <span className="rounded bg-brand-50 px-1 text-[9px] font-normal text-brand-700">官方</span>}
            </div>
            <div className="text-[11px] text-zinc-500">
              {kindLabel} · {total} 人 · {fmtDate(g.createdAt)} 创建{myRole === 'admin' ? ' · 你是管理员' : ''}
            </div>
            <div className="truncate text-[11px] text-zinc-500">{g.desc}</div>
          </div>
        </div>

        {g.announcement && (
          <>
            <SectionLabel>{kindLabel}公告</SectionLabel>
            <div className="bg-white px-4 py-3">
              <div className="text-[13px] font-medium text-zinc-900">{g.announcement.title}</div>
              <p className="mt-1 text-[12px] leading-relaxed whitespace-pre-wrap text-zinc-700">{g.announcement.content}</p>
              <div className="mt-1 text-[10px] text-zinc-400">
                {seatById(s, g.announcement.bySeatId)?.displayName ?? '官方'} · {fmtDate(g.announcement.at)}
              </div>
            </div>
          </>
        )}

        <SectionLabel>成员（{total}）</SectionLabel>
        {membersVisible ? (
          <MemberList g={g} canViewProfile={canViewProfile} />
        ) : (
          // 群设置关的属于产品自己的规则，客户该知道；企业策略关的不解释给客户，只在演示批注里交代
          g.settings.membersVisible ? (
            <div className="px-4 py-3">
              <DemoHint>企业策略未开放查看群成员列表（group.view_members），所以这块整个不显示。</DemoHint>
            </div>
          ) : (
            <div className="bg-white px-4 py-3 text-[11px] text-zinc-400">本{kindLabel}未开放成员列表</div>
          )
        )}

        <SectionLabel>操作</SectionLabel>
        <div className="bg-white">
          {canInvite ? (
            <button type="button" onClick={invite} className="flex w-full items-center gap-2 border-b border-zinc-100 px-4 py-2.5 text-[13px] text-zinc-800 active:bg-zinc-50">
              <UserPlus size={16} className="text-zinc-500" /> 邀请好友
              {mainLink && (
                <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] text-zinc-400">
                  <Link2 size={10} /> {mainLink.code}
                </span>
              )}
            </button>
          ) : (
            <DemoHint>企业策略未开放邀请好友（group.invite），正式产品里这一行直接不出现。</DemoHint>
          )}
          {leave.allowed ? (
            <button type="button" onClick={() => void doLeave()} className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] text-red-600 active:bg-zinc-50">
              <LogOut size={16} /> {g.kind==='channel'?'取消订阅':'退出群聊'}
            </button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2.5 text-[11px] text-zinc-400">
              <LogOut size={14} />
              {leave.source === 'official_group' ? `官方${kindLabel}，不可退出` : `当前策略不允许退出（${leaveKey} 关 · ${PHONE_SOURCE_LABEL[leave.source]}）`}
            </div>
          )}
        </div>
        <div className="px-4 py-3">
          <DemoHint>
            成员列表要「群设置 · 成员可见」与策略 group.view_members 同时为开；退出受 {leaveKey} 与官方群标记控制；本群覆盖来源：{PHONE_SOURCE_LABEL[resolveCap(s, { role: 'customer', key: 'group.view_members', groupId: g.id, userId: customerId }).source]}。
          </DemoHint>
        </div>
      </div>
    </div>
  )
}

const ROW_CLS = 'flex w-full items-center gap-2 border-b border-zinc-100 px-4 py-2 text-left last:border-0'

/** 成员行：策略允许看资料时可点 */
function Wrap({ name, canTap, children }: { name: string; canTap: boolean; children: ReactNode }) {
  if (!canTap) return <div className={ROW_CLS}>{children}</div>
  return (
    <button type="button" onClick={() => demoToast(`查看「${name}」的资料`)} className={`${ROW_CLS} active:bg-zinc-50`}>
      {children}
    </button>
  )
}

function MemberList({ g, canViewProfile }: { g: ChatGroup; canViewProfile: boolean }) {
  const s = useStore()
  return (
    <div className="bg-white">
      {g.memberSeatIds.map((id) => {
        const seat = seatById(s, id)
        if (!seat) return null
        const role = groupRoleOf(g, 'seat', id)
        return (
          <Wrap key={id} name={seat.displayName} canTap={canViewProfile}>
            <SeatAvatar seat={seat} size={30} />
            <span className="flex-1 text-[13px] text-zinc-900">{seat.displayName}</span>
            <span className="rounded bg-brand-50 px-1 text-[9px] text-brand-700">官方</span>
            {ROLE_LABEL[role] && <span className="rounded bg-amber-50 px-1 text-[9px] text-amber-700">{ROLE_LABEL[role]}</span>}
          </Wrap>
        )
      })}
      {g.memberCustomerIds.map((id) => {
        const c = customerById(s, id)
        if (!c) return null
        const t = c.primaryTitleId ? s.titles.find((x) => x.id === c.primaryTitleId && x.enabled) : undefined
        const role = groupRoleOf(g, 'customer', id)
        return (
          <Wrap key={id} name={c.nickname} canTap={canViewProfile}>
            <Avatar text={c.nickname} size={30} />
            <span className="flex-1 truncate text-[13px] text-zinc-900">{c.nickname}</span>
            {t && <TitleChip title={t} size="xs" />}
            {ROLE_LABEL[role] && <span className="rounded bg-amber-50 px-1 text-[9px] text-amber-700">{ROLE_LABEL[role]}</span>}
          </Wrap>
        )
      })}
    </div>
  )
}
