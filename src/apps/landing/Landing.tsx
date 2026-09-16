import { Link } from 'react-router-dom'
import { ArrowRight, KeyRound, MonitorSmartphone, RotateCcw, Settings2, Smartphone } from 'lucide-react'
import { useStore } from '@/store/store'
import { Button } from '@/ui/primitives'
import { confirm } from '@/ui/confirm'
import { toast } from '@/ui/overlay'
import { DemoNoteToggle, useDemoNotes } from '@/ui/DemoNote'
import { PROVIDER_DEMO_ACCESS_KEY } from '@/domain/demoAccess'

const CARDS = [
  { to: '/phone', icon: Smartphone, title: '客户手机屏', who: '客户这边看到什么', desc: '扫码注册、加上官方联系人、聊天和查资料。客户全程只看到「顾问」，看不到背后是谁在操作。' },
  { to: '/workbench', icon: MonitorSmartphone, title: '客服工作台', who: '员工每天在这里干活', desc: '待我回复、AI 推荐回复、话术一键发、客户资料和群发。右下角可以切换成别的员工试。' },
  { to: '/admin', icon: Settings2, title: '管理后台', who: '老板和管理员管什么', desc: '邀请组、员工与坐席、知识库、权限开关、人员交接、经营看板。这里改一个开关，前面两屏立刻生效。' },
]

const FLOWS = [
  { title: '01 · 客户进入与接待', to: '/admin/invite-groups', steps: ['邀请组查看直播间组与 LIVE88；客户屏注册一个新昵称。', '客户看到林顾问和恒信官方通知频道；向林顾问发送“开户需要什么材料”。', '工作台以林薇登录，从待我回复找到该客户，发送一条回复；回到客户屏确认收到。'] },
  { title: '02 · AI 与知识依据', to: '/admin/ai', steps: ['知识库新建条目，填写标题、正文和匹配标签；先存草稿，再发布。', '客户问对应问题；员工点击输入栏的 AI 推荐，查看原文，再确认发送。', '修改正文后重新推荐，检查采用新内容；下线条目后不再引用。没有相关知识时提示人工核对。'] },
  { title: '03 · 话术与客户运营', to: '/workbench', steps: ['工作台右栏切到话术，搜索材料清单，发送文字或附件。', '查看客户资料，区分购买记录、内部标签与公开头衔；按条件选择群发人群。', '检查目标与发送身份，发送后在对应客户屏核对消息；样例回执不代表真实触达效果。'] },
  { title: '04 · 人员交接', to: '/admin/seats', steps: ['后台把林顾问交接给王芳，填写原因。', '工作台右下角演示控制切换为王芳，继续使用林顾问回复同一客户。', '客户侧名字、头像、历史不变；消息审计能区分交接前后的真实员工。'] },
  { title: '05 · 老板看见什么', to: '/admin/home', steps: ['经营首页查看六项样例指标，解释客户、员工与活跃角色分别如何统计。', '日报与提醒查看内容预览，点击模拟发送，只新增本地模拟记录。', '当前手机屏尚无经营入口；不演示真实 App 推送、飞书发送、计费或客户成效。'] },
  { title: '讨论区 · 后续与待定', to: '/admin/ai', steps: ['P1/P2 页面用于讨论后续需求，不自动纳入第一版。', '群活跃助手保留现有演示，触发、节奏和审核等细节待确认。', '订阅到期不会自动停用；续期、停用与恢复在供应方授权中心演示，人工停用的影响范围仍待确认。'] },
]

export function Landing() {
  const enterprise = useStore((s) => s.enterprise)
  const reset = useStore((s) => s.resetDemo)
  const notes = useDemoNotes()
  return (
    <div className="min-h-full bg-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-zinc-900">YoLink 交互演示</h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-zinc-600">一套自己的客户沟通系统：客户在手机上聊，员工在工作台接，老板在后台管。三个入口下面都打开，改一边看另一边。</p>
            <p className="mt-1 text-xs text-zinc-400">演示环境以虚构企业「{enterprise.name}」为例（{enterprise.slogan}）。</p>
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

        {/* 演示批注开关：这一层不属于产品，关掉后各入口就是正式产品应有的样子 */}
        <div className="mb-6 flex flex-col gap-2 rounded-lg border border-dashed border-zinc-300 bg-white/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs leading-relaxed text-zinc-500">
            <span className="font-medium text-zinc-700">演示批注</span>
            <span className="mx-1.5 text-zinc-300">|</span>
            {notes
              ? '灰色虚线框里的说明、标题旁的 P1 / P2 排期标记，都是给看演示的人看的，不属于产品。关掉即可看到正式产品应有的界面。'
              : '已关闭。现在三个入口显示的每一个字，都是正式产品应该有的样子。'}
          </div>
          <DemoNoteToggle className="self-start sm:self-auto" />
        </div>

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

        <h2 className="mt-8 mb-1 text-sm font-semibold text-zinc-900">五条动线，按顺序用同一个客户走一遍</h2>
        <p className="mb-4 text-xs text-zinc-500">每条都是真实业务里会发生的一段，点右上角直接跳到对应位置。</p>
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

        {/* 供应方授权中心是 YoLink 自己用的后台，不是企业客户买到的东西：单独一条，不进上面那三张卡 */}
        <Link
          to="/provider"
          onClick={() => sessionStorage.setItem(PROVIDER_DEMO_ACCESS_KEY, 'yes')}
          className="group mt-8 flex items-center gap-3 rounded-lg border border-zinc-200 bg-white/60 px-4 py-3 transition-colors hover:bg-white"
        >
          <KeyRound size={16} className="shrink-0 text-zinc-400 group-hover:text-zinc-600" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-zinc-700">供应方授权中心<span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-normal text-zinc-500">YoLink 内部</span></div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">绑定企业部署实例、查看到期状态、续期与人工停用。企业客户看不到这一层，给客户演示时不用打开。</p>
          </div>
          <ArrowRight size={14} className="shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-500" />
        </Link>

        <footer className="mt-10 border-t border-zinc-200 pt-4 text-[11px] leading-relaxed text-zinc-400">
          <p>用法：三个入口可以在不同窗口同时打开，数据实时同步。建议把客户屏放一侧，工作台或后台放另一侧，边操作边看客户侧的变化。</p>
          <p className="mt-1.5">关于本演示：企业、人物、对话、金额全部虚构。AI 用本地知识库匹配，不连外部模型；App 推送、账单与经营报表为样例数据，不代表真实接入效果。标题旁带 P1 / P2 排期标记的页面是后续需求的讨论稿，不属于第一版范围。</p>
        </footer>
      </div>
    </div>
  )
}
