import { Link } from 'react-router-dom'
import { ArrowRight, MonitorSmartphone, RotateCcw, Settings2, Smartphone } from 'lucide-react'
import { useStore } from '@/store/store'
import { Button } from '@/ui/primitives'
import { toast } from '@/ui/overlay'

const CARDS = [
  {
    to: '/admin',
    icon: Settings2,
    title: '管理后台',
    who: '管理员 周敏',
    desc: '坐席、员工、邀请组、头衔库、策略、审计。整个产品的模型在这里定义。',
  },
  {
    to: '/workbench',
    icon: MonitorSmartphone,
    title: '客服工作台',
    who: '顾问 林薇（以「林顾问」身份）',
    desc: '三栏接待：待我回复、聊天区与 AI 草稿、客户资料卡。顶部可切换坐席身份。',
  },
  {
    to: '/phone',
    icon: Smartphone,
    title: '客户手机屏',
    who: '模拟客户 App',
    desc: '输邀请码注册，看官方联系人如何自动出现；交接后客户这边一个字不变。',
  },
]

const FLOWS = [
  {
    title: '流程一 · 注册即分配',
    steps: [
      '管理后台 → 邀请组，看「直播间组」放了哪两个坐席，记下邀请码',
      '客户屏 → 输入邀请码注册「张先生」',
      '客户屏立刻出现林顾问、恒信合规通知两条会话和欢迎语，并进了「恒信财富社群」；给林顾问回一句话',
      '工作台（林薇）→ 待我回复里多了张先生，AI 已给出草稿；资料卡显示主归属林顾问、来源直播间组',
    ],
  },
  {
    title: '流程二 · 换人零感知',
    steps: [
      '管理后台 → 坐席 → 「林顾问」→ 交接给 王芳，填原因',
      '工作台右上角切换登录员工为王芳：顶部身份变成林顾问，张先生的历史全在',
      '客户屏张先生这边：名字、头像、历史一个字没变',
      '管理后台 → 消息审计：交接前的消息背后是林薇，之后是王芳',
    ],
  },
]

export function Landing() {
  const enterprise = useStore((s) => s.enterprise)
  const reset = useStore((s) => s.resetDemo)
  return (
    <div className="min-h-full bg-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <header className="mb-10 flex items-end justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-700 px-3 py-1 text-xs font-medium text-white">
              YoLink · AI 私域运营系统 · 交互演示
            </div>
            <h1 className="text-2xl font-semibold text-zinc-900">{enterprise.name}</h1>
            <p className="mt-1 text-sm text-zinc-500">{enterprise.slogan}。演示企业与所有人物、对话、金额均为虚构。</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              reset()
              toast('演示数据已重置')
            }}
          >
            <RotateCcw size={14} /> 重置演示数据
          </Button>
        </header>

        <div className="mb-10 grid grid-cols-3 gap-4">
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

        <div className="grid grid-cols-2 gap-4">
          {FLOWS.map((f) => (
            <section key={f.title} className="rounded-xl border border-zinc-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold text-zinc-900">{f.title}</h3>
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
