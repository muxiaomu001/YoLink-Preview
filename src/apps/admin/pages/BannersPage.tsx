import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import type { Announcement, Banner, BannerAction } from '@/domain/types'
import { fmtDate } from '@/domain/time'
import { useStore } from '@/store/store'
import { confirm } from '@/ui/confirm'
import { Button } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, Table, Tabs } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { AnnouncementModal, BannerModal, ColorThumb } from './BannersPage.parts'
import { DemoLevelTag, DemoNote } from '@/ui/DemoNote'

type TabKey = 'banners' | 'announcements'

const BANNER_ACTION_LABEL: Record<BannerAction, string> = { link: '打开链接', checkin: '打开签到', wallet: '打开钱包', group: '打开群或频道' }

/** 按起止时间判断状态 */
function timeStatus(startAt: string, endAt: string) {
  const now = new Date().toISOString()
  if (now < startAt) return <Pill>未开始</Pill>
  if (now > endAt) return <Pill tone="red">已过期</Pill>
  return <Pill tone="green">有效</Pill>
}

/** 公告与横幅：横幅 P0、公告 P1 */
export function BannersPage() {
  const s = useStore()
  const [tab, setTab] = useState<TabKey>('banners')
  return (
    <div>
      <PageHeader title="公告与横幅" desc="客户 App 首页顶部的轮播横幅，以及启动弹窗、顶部通知条式公告。只在活动期内向客户显示，过期自动下线。" />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: 'banners', label: <>横幅<DemoLevelTag level="P0" /></>, count: s.banners.length },
          { key: 'announcements', label: <>公告<DemoLevelTag level="P1" /></>, count: s.announcements.length },
        ]}
      />
      <div className="mt-4">{tab === 'banners' ? <BannersTab /> : <AnnouncementsTab />}</div>
    </div>
  )
}

function BannersTab() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [editing, setEditing] = useState<Banner | null>(null)
  const [creating, setCreating] = useState(false)
  const rows = [...s.banners].sort((a, b) => a.order - b.order)

  const remove = async (b: Banner) => {
    const ok = await confirm({ title: `删除横幅「${b.title}」`, body: '删除后客户端首页立即不再显示，曝光与点击数据一并删除。', okText: '删除', danger: true })
    if (!ok) return
    s.deleteBanner(b.id, admin)
    toast(`横幅「${b.title}」已删除`)
  }
  /** 上移 / 下移：与相邻横幅交换 order */
  const move = (b: Banner, dir: -1 | 1) => {
    const i = rows.findIndex((x) => x.id === b.id)
    const other = rows[i + dir]
    if (!other) return
    // 交换两者的排序值；若相同则按位置重新编号
    const [mine, theirs] = b.order === other.order ? (dir < 0 ? [other.order, other.order + 1] : [other.order + 1, other.order]) : [other.order, b.order]
    s.saveBanner({ ...b, order: mine }, admin)
    s.saveBanner({ ...other, order: theirs }, admin)
  }
  const actionCell = (b: Banner) => {
    const target = b.action === 'link' ? b.url : b.action === 'group' ? s.chatGroups.find((g) => g.id === b.chatGroupId)?.name : ''
    return (
      <div>
        <div className="whitespace-nowrap">{BANNER_ACTION_LABEL[b.action]}</div>
        {target && <div className="max-w-40 truncate text-[11px] text-zinc-400">{target}</div>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Note>排序数字越小越靠前，同一位置只展示排在最前的一条。</Note>
      <DemoNote>正式产品的排序可以直接拖动，演示里用上移 / 下移代替。目标人群按内部标签投放、曝光与点击统计排在第二版<DemoLevelTag level="P1" />。</DemoNote>
      <Card
        title="横幅列表"
        padded={false}
        extra={
          <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
            <Plus size={13} /> 创建横幅
          </Button>
        }
      >
        <Table
          rows={rows}
          rowKey={(b) => b.id}
          columns={[
            { key: 'title', title: '标题', render: (b) => <span className="block max-w-56 truncate font-medium whitespace-nowrap text-zinc-900" title={b.title}>{b.title}</span> },
            { key: 'thumb', title: '缩略图', render: (b) => <ColorThumb color={b.imageColor} text={b.title} /> },
            { key: 'action', title: '点击动作', render: actionCell },
            {
              key: 'order',
              title: '排序',
              align: 'center',
              render: (b) => {
                const i = rows.findIndex((x) => x.id === b.id)
                return (
                  <div className="flex items-center justify-center gap-0.5">
                    <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(b, -1)} title="上移">
                      <ArrowUp size={12} />
                    </Button>
                    <span className="w-6 text-center tabular-nums">{b.order}</span>
                    <Button size="sm" variant="ghost" disabled={i === rows.length - 1} onClick={() => move(b, 1)} title="下移">
                      <ArrowDown size={12} />
                    </Button>
                  </div>
                )
              },
            },
            { key: 'time', title: '起止时间', render: (b) => <span className="tabular-nums whitespace-nowrap text-zinc-600">{fmtDate(b.startAt)} 至 {fmtDate(b.endAt)}</span> },
            {
              key: 'audience',
              title: <>目标人群<DemoLevelTag level="P1" /></>,
              render: (b) => <span className="whitespace-nowrap">{b.audience === 'all' ? '全部' : `按内部标签：${b.tagIds.map((id) => s.tags.find((t) => t.id === id)?.name ?? id).join('、') || '未选'}`}</span>,
            },
            { key: 'status', title: '状态', render: (b) => timeStatus(b.startAt, b.endAt) },
            { key: 'imp', title: <>曝光<DemoLevelTag level="P1" /></>, align: 'right', render: (b) => <span className="tabular-nums">{b.impressions.toLocaleString('zh-CN')}</span> },
            { key: 'clk', title: <>点击<DemoLevelTag level="P1" /></>, align: 'right', render: (b) => <span className="tabular-nums">{b.clicks.toLocaleString('zh-CN')}</span> },
            {
              key: 'ops',
              title: '操作',
              align: 'right',
              render: (b) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(b)}>编辑</Button>
                  <Button size="sm" variant="danger" onClick={() => void remove(b)}>删除</Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      {editing && <BannerModal banner={editing} onClose={() => setEditing(null)} />}
      {creating && <BannerModal onClose={() => setCreating(false)} />}
    </div>
  )
}

function AnnouncementsTab() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [creating, setCreating] = useState(false)
  const remove = async (a: Announcement) => {
    const ok = await confirm({ title: `删除公告「${a.title}」`, body: '删除后客户端立即不再展示。', okText: '删除', danger: true })
    if (!ok) return
    s.deleteAnnouncement(a.id, admin)
    toast(`公告「${a.title}」已删除`)
  }
  return (
    <div className="space-y-4">
      <Note>启动弹窗在客户打开 App 时全屏弹出，顶部通知条常驻在会话列表上方。展示次数可选「一次」或「每次启动」。</Note>
      <DemoNote>
        公告<DemoLevelTag level="P1" />排在第二版，横幅是第一版范围。
      </DemoNote>
      <Card
        title="公告列表"
        padded={false}
        extra={
          <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
            <Plus size={13} /> 创建公告
          </Button>
        }
      >
        <Table
          rows={s.announcements}
          rowKey={(a) => a.id}
          columns={[
            {
              key: 'title',
              title: '标题',
              render: (a) => (
                <div className="flex items-center gap-2">
                  {a.imageColor && <ColorThumb color={a.imageColor} text={a.title} small />}
                  <div>
                    <div className="font-medium text-zinc-900">{a.title}</div>
                    <div className="max-w-md truncate text-[11px] text-zinc-400">{a.body}</div>
                  </div>
                </div>
              ),
            },
            { key: 'kind', title: '类型', render: (a) => (a.kind === 'popup' ? <Pill tone="purple">启动弹窗</Pill> : <Pill tone="blue">顶部通知条</Pill>) },
            { key: 'time', title: '起止时间', render: (a) => <span className="tabular-nums whitespace-nowrap text-zinc-600">{fmtDate(a.startAt)} 至 {fmtDate(a.endAt)}</span> },
            { key: 'status', title: '状态', render: (a) => timeStatus(a.startAt, a.endAt) },
            { key: 'imp', title: '曝光', align: 'right', render: (a) => <span className="tabular-nums">{a.impressions.toLocaleString('zh-CN')}</span> },
            {
              key: 'ops',
              title: '操作',
              align: 'right',
              render: (a) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>编辑</Button>
                  <Button size="sm" variant="danger" onClick={() => void remove(a)}>删除</Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      {editing && <AnnouncementModal announcement={editing} onClose={() => setEditing(null)} />}
      {creating && <AnnouncementModal onClose={() => setCreating(false)} />}
    </div>
  )
}
