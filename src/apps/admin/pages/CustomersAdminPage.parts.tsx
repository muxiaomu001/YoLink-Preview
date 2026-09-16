/**
 * 客户列表的详情弹窗：基本信息、官方联系人、账号管控（重置密码 / 强制下线 / 全局禁言 / 封禁）、
 * 改主归属坐席（P1）、注销客户（P1）。状态标记与列表同一口径，见 domain/customerStatus。
 */
import { useState } from 'react'
import { Star, UserX } from 'lucide-react'
import type { CustomerSeat } from '@/domain/types'
import { fmtDateTime } from '@/domain/time'
import { customerStatusFlags } from '@/domain/customerStatus'
import { useStore } from '@/store/store'
import { customerById, seatsOfCustomer } from '@/store/selectors'
import { Button, Field, Select } from '@/ui/primitives'
import { KV, Note, Pill, SeatAvatar, TagChip, TitleChip } from '@/ui/display'
import { Modal, toast } from '@/ui/overlay'
import { confirm } from '@/ui/confirm'
import { DemoLevelTag } from '@/ui/DemoNote'
import { CustomerControlSection } from './CustomersAdminPage.controls'

const SOURCE_LABEL: Record<CustomerSeat['source'], string> = { register: '注册时添加', backfill: '补加', reassign: '改主归属时添加' }

export function CustomerDetailModal({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const c = customerById(s, customerId)
  const seats = seatsOfCustomer(s, customerId)
  const primary = seats.find((x) => x.primary)
  // 改主归属只能选未停用的坐席，排除当前主归属
  const candidates = s.seats.filter((x) => x.status !== 'disabled' && x.id !== primary?.seatId)
  const [newSeatId, setNewSeatId] = useState('')

  if (!c) return null
  const deleted = !!c.deletedAt
  const group = s.inviteGroups.find((g) => g.id === c.inviteGroupId)
  const flags = customerStatusFlags(c)
  const titles = c.titleIds.map((id) => s.titles.find((t) => t.id === id)).filter((t) => !!t)
  const tags = c.tagIds.map((id) => s.tags.find((t) => t.id === id)).filter((t) => !!t)

  const reassign = async () => {
    const seat = s.seats.find((x) => x.id === newSeatId)
    if (!seat) return
    const ok = await confirm({
      title: `把「${c.nickname}」的主归属改为「${seat.displayName}」？`,
      body: (
        <>
          客户会看到主联系人变了：「{seat.displayName}」会排到会话列表最前，若之前没加过会自动添加并发欢迎语。<b>这是纠错手段，不是日常操作</b>。记审计日志。
        </>
      ),
      okText: '改主归属',
    })
    if (!ok) return
    s.reassignPrimarySeat(customerId, newSeatId, admin)
    setNewSeatId('')
    toast(`「${c.nickname}」主归属已改为「${seat.displayName}」，客户侧主联系人随之变化`)
  }

  const remove = async () => {
    const ok = await confirm({
      title: `注销客户「${c.nickname}」？`,
      body: `账号 ${c.accountId} 将无法登录，从所有群里移出，不再出现在工作台。数据保留，审计仍可查。此操作不可撤销，记审计日志。`,
      okText: '注销',
      danger: true,
    })
    if (!ok) return
    s.deleteCustomer(customerId, admin)
    toast(`客户「${c.nickname}」已注销，数据保留、不再出现在工作台`)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`客户详情：${c.nickname}`} width={640}>
      <div className="space-y-4">
        {deleted && <Note tone="amber">该客户已于 {fmtDateTime(c.deletedAt!)} 注销：无法登录，不在工作台显示，数据保留。</Note>}

        <section>
          <h4 className="mb-2 text-xs font-semibold text-zinc-700">基本信息</h4>
          <KV
            items={[
              { k: '昵称', v: c.nickname },
              { k: '账号 ID', v: <span className="tabular-nums">{c.accountId}</span> },
              { k: '手机号', v: c.phone ?? <span className="text-zinc-400">未绑定</span> },
              { k: '邮箱', v: c.email ?? <span className="text-zinc-400">未绑定</span> },
              { k: '邀请组', v: group?.name ?? '-' },
              { k: '注册时间', v: fmtDateTime(c.registeredAt) },
              { k: '最近活跃', v: fmtDateTime(c.lastActiveAt) },
              { k: '设备', v: c.device },
              { k: '头衔', v: titles.length ? <span className="flex flex-wrap gap-1">{titles.map((t) => <TitleChip key={t.id} title={t} size="xs" />)}{c.primaryTitleId && <span className="text-[11px] text-zinc-400">（主头衔：{titles.find((t) => t.id === c.primaryTitleId)?.name}）</span>}</span> : <span className="text-zinc-400">无</span> },
              { k: '内部标签', v: tags.length ? <span className="flex flex-wrap gap-1">{tags.map((t) => <TagChip key={t.id} tag={t} />)}</span> : <span className="text-zinc-400">无</span> },
              { k: '备注', v: c.note || <span className="text-zinc-400">无</span> },
              {
                k: '状态',
                v: flags.length ? (
                  <span className="flex flex-wrap gap-1">
                    {flags.map((f) => (
                      <span key={f.key} title={f.title}>
                        <Pill tone={f.tone}>{f.label}</Pill>
                      </span>
                    ))}
                  </span>
                ) : (
                  <Pill tone="green">正常</Pill>
                ),
              },
            ]}
          />
        </section>

        <section>
          <h4 className="mb-2 text-xs font-semibold text-zinc-700">官方联系人（{seats.length}）</h4>
          <div className="space-y-1.5">
            {seats.map((x) => (
              <div key={x.seatId} className="flex items-center gap-2.5 rounded-md border border-zinc-200 px-3 py-2 text-xs">
                <SeatAvatar seat={x.seat} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-zinc-900">{x.seat.displayName}</span>
                    {x.primary && (
                      <span className="inline-flex items-center gap-0.5 text-amber-600" title="主归属">
                        <Star size={12} fill="currentColor" /> 主归属
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-500">{x.seat.roleDesc}</div>
                </div>
                <div className="text-right text-[11px] text-zinc-400">
                  <div>{SOURCE_LABEL[x.source]}</div>
                  <div>{fmtDateTime(x.addedAt)}</div>
                </div>
              </div>
            ))}
            {!seats.length && <div className="text-xs text-zinc-400">没有官方联系人</div>}
          </div>
        </section>

        <CustomerControlSection c={c} />

        <section className="rounded-md border border-zinc-200 p-3">
          <h4 className="text-xs font-semibold text-zinc-700">改主归属坐席<DemoLevelTag level="P1" /></h4>
          <p className="mt-1 text-[11px] text-zinc-500">分配错了才用。客户会看到主联系人变了，所以这是纠错手段，不是日常操作。</p>
          <div className="mt-2 flex items-end gap-2">
            <Field label="新主归属坐席">
              <Select value={newSeatId} onChange={(e) => setNewSeatId(e.target.value)} disabled={deleted} className="w-56">
                <option value="">选择坐席</option>
                {candidates.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.displayName}（{x.roleDesc}）
                  </option>
                ))}
              </Select>
            </Field>
            <Button variant="secondary" disabled={!newSeatId || deleted} onClick={() => void reassign()}>
              改主归属
            </Button>
          </div>
        </section>

        <section className="flex items-center justify-between rounded-md border border-red-200 bg-red-50/40 p-3">
          <div>
            <h4 className="text-xs font-semibold text-red-800">注销客户<DemoLevelTag level="P1" /></h4>
            <p className="mt-0.5 text-[11px] text-red-700/80">无法登录、移出所有群、不再出现在工作台。数据保留，审计仍可查。</p>
          </div>
          <Button variant="danger" disabled={deleted} onClick={() => void remove()}>
            <UserX size={14} /> {deleted ? '已注销' : '注销客户'}
          </Button>
        </section>
      </div>
    </Modal>
  )
}
