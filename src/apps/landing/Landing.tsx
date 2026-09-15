import { Link } from 'react-router-dom'
import { ArrowRight, MonitorSmartphone, RotateCcw, Settings2, Smartphone } from 'lucide-react'
import { useStore } from '@/store/store'
import { Button } from '@/ui/primitives'
import { confirm } from '@/ui/confirm'
import { toast } from '@/ui/overlay'

const CARDS = [
  { to: '/phone', icon: Smartphone, title: '客户手机屏', who: '以客户身份进入', desc: '邀请注册、官方联系人、聊天和资料。当前只覆盖部分客户 App 页面。' },
  { to: '/workbench', icon: MonitorSmartphone, title: '客服工作台', who: '员工操作，官方身份对外', desc: '待回复、AI 推荐、话术、客户资料和群发。右下角演示控制可切换员工。' },
  { to: '/admin', icon: Settings2, title: '管理后台', who: '管理员配置与经营展示', desc: '邀请组、员工与坐席、知识、权限、交接和看板。后续功能保留 P1/P2 标记。' },
]

const FLOWS = [
  { title: '01 · 客户进入与接待', to: '/admin/invite-groups', steps: ['邀请组查看直播间组与 LIVE88；客户屏注册一个新昵称。', '客户看到林顾问、恒信合规通知；向林顾问发送“开户需要什么材料”。', '工作台以林薇登录，从待我回复找到该客户，发送一条回复；回到客户屏确认收到。'] },
  { title: '02 · AI 与知识依据', to: '/admin/ai', steps: ['知识库新建条目，填写标题、正文和匹配标签；先存草稿，再发布。', '客户问对应问题；员工点击输入栏的 AI 推荐，查看原文，再确认发送。', '修改正文后重新推荐，检查采用新内容；下线条目后不再引用。没有相关知识时提示人工核对。'] },
  { title: '03 · 话术与客户运营', to: '/workbench', steps: ['工作台右栏切到话术，搜索材料清单，发送文字或附件。', '查看客户资料，区分购买记录、内部标签与公开头衔；按条件选择群发人群。', '检查目标与发送身份，发送后在对应客户屏核对消息；样例回执不代表真实触达效果。'] },
  { title: '04 · 人员交接', to: '/admin/seats', steps: ['后台把林顾问交接给王芳，填写原因。', '工作台右下角演示控制切换为王芳，继续使用林顾问回复同一客户。', '客户侧名字、头像、历史不变；消息审计能区分交接前后的真实员工。'] },
  { title: '05 · 老板看见什么', to: '/admin/home', steps: ['经营首页查看六项样例指标，解释客户、员工与机器人分别如何统计。', '日报与提醒查看内容预览，点击模拟发送，只新增本地模拟记录。', '当前手机屏尚无经营入口；不演示真实 App 推送、飞书发送、计费或客户成效。'] },
  { title: '讨论区 · 后续与待定', to: '/admin/ai', steps: ['P1/P2 页面用于讨论后续需求，不自动纳入第一版。', '群活跃助手保留现有演示，触发、节奏和审核等细节待确认。', '订阅到期规则待决策；续期按钮只改变样例状态，不代表正式商业规则。'] },
]

export function Landing() {
  const enterprise = useStore((s) => s.enterprise)
  const reset = useStore((s) => s.resetDemo)
  return (
    <div className="min-h-full bg-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-700 px-3 py-1 text-xs font-medium text-white">
              YoLink · AI 私域运营系统 · 交互演示
            </div>
            <h1 className="text-2xl font-semibold text-zinc-900">{enterprise.name}</h1>
            <p className="mt-1 text-sm text-zinc-500">{enterprise.slogan}。演示企业与所有人物、对话、金额均为虚构。</p>
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              if (!await confirm({ title: '重置演示数据', body: '清除当前浏览器中的演示编辑、客户和消息，恢复虚构样例。此操作不能撤回。', okText: '确认重置', danger: true })) return
              reset()
              toast('演示数据已重置')
            }}
          >
            <RotateCcw size={14} /> 重置演示数据
          </Button>
        </header>

        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          {CARDS.map((c) => (
            <Link key={c.to} to={c.to} className="group rounded-xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-md">
              <c.icon className="mb-3 text-brand-700" size={22} />
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-zinc-900">{c.title}</h2>
                <ArrowRight size={16} className="text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-700" />
              </div>
              <div className="mt-0.5 text-xs text-brand-700">{c.who}</div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">{c.desc}</p>
            </Link>
          ))}
        </div>

        <p className="mb-4 text-xs leading-relaxed text-zinc-600">建议按 01—05 顺序演示同一个客户。全部数据为虚构；AI 使用本地知识匹配，连接、推送、账单与报表为模拟或样例，不代表真实接入和效果。</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {FLOWS.map((f) => (
            <section key={f.title} className="rounded-xl border border-zinc-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-zinc-900">{f.title}</h3><Link to={f.to} className="shrink-0 text-xs text-brand-700 hover:underline">进入演示 →</Link></div>
              <ol className="space-y-2">
                {f.steps.map((st, i) => (
                  <li key={st} className="flex gap-2.5 text-xs leading-relaxed text-zinc-600">
                    <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-800">{i + 1}</span>
                    {st}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>

        <p className="mt-8 text-[11px] leading-relaxed text-zinc-400">
          提示：三个入口可以在不同窗口同时打开，数据实时同步。建议把客户屏放在一侧，管理后台或工作台放在另一侧，边操作边看客户侧的变化。
        </p>
      </div>
    </div>
  )
}
