import { useEffect, useState } from 'react'
import { Button, Field, Textarea } from '@/ui/primitives'
import { Card, Note, PageHeader, SeatAvatar } from '@/ui/display'
import { toast } from '@/ui/overlay'
import { useWorkbench } from '../useWorkbench'

export function WbSettingsPage() {
  const { s, staff, seat, mySeats } = useWorkbench()
  const [welcome, setWelcome] = useState(seat?.welcome ?? '')
  useEffect(() => setWelcome(seat?.welcome ?? ''), [seat?.id, seat?.welcome])
  return (
    <div className="thin-scroll h-full overflow-y-auto p-5">
      <PageHeader title="设置" desc={`登录员工：${staff?.name}。个人设置跟人走，欢迎语跟坐席走。`} />
      <div className="grid grid-cols-2 gap-4">
        <Card title={`「${seat?.displayName}」的欢迎语`}>
          <Note>欢迎语是坐席的属性：交接后跟着坐席走，不跟人走。客户添加该坐席后立即以坐席身份发出。</Note>
          <div className="mt-3">
            <Field label="模板" hint="支持 {{customer.nickname}}、{{seat.name}}；留空用企业默认">
              <Textarea rows={4} value={welcome} onChange={(e) => setWelcome(e.target.value)} />
            </Field>
            <div className="mt-2 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (seat) s.updateSeatWelcome(seat.id, welcome)
                  toast('已保存')
                }}
              >
                保存
              </Button>
            </div>
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="我持有的坐席">
            <ul className="space-y-2">
              {mySeats.map((x) => (
                <li key={x.id} className="flex items-center gap-2 text-xs">
                  <SeatAvatar seat={x} size={24} />
                  <span className="text-zinc-900">{x.displayName}</span>
                  <span className="text-zinc-400">{x.roleDesc}</span>
                </li>
              ))}
              {mySeats.length === 0 && <li className="text-xs text-zinc-400">无</li>}
            </ul>
          </Card>
          <Card title="快捷回复">
            <ul className="space-y-1.5">
              {s.quickReplies.map((q) => (
                <li key={q.id} className="text-xs">
                  <span className="mr-1 rounded bg-zinc-100 px-1 text-[10px] text-zinc-500">{q.scope === 'enterprise' ? '企业' : '个人'}</span>
                  <b className="text-zinc-800">{q.title}</b>
                  <span className="ml-1 text-zinc-500">{q.text.slice(0, 40)}…</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="AI 回复推荐">
            <p className="text-xs text-zinc-600">已开启。每条客户消息在输入框上方给 2 到 3 条草稿，依据最近上下文、资料卡与企业知识库（{s.knowledge.length} 条）。金额字段按角色隐藏，不传给 AI。</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
