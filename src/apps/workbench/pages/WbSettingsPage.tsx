/**
 * 工作台设置页：个人设置、快捷键、我的欢迎语（坐席属性）、我的话术、我持有的坐席、企业设置入口（仅有 manage_settings 的角色可见）。
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { Button, Field, Textarea } from '@/ui/primitives'
import { Card, PageHeader, SeatAvatar } from '@/ui/display'
import { HelpTip } from '@/ui/help'
import { toast } from '@/ui/overlay'
import { useWorkbench } from '../useWorkbench'
import { MyQuickRepliesCard, PrefsCard, ShortcutsCard } from './WbSettingsPage.parts'

export function WbSettingsPage() {
  const { s, staff, seat, mySeats, can } = useWorkbench()
  const [welcome, setWelcome] = useState(seat?.welcome ?? '')
  useEffect(() => setWelcome(seat?.welcome ?? ''), [seat?.id, seat?.welcome])
  const role = s.roles.find((r) => r.id === staff?.roleId)
  return (
    <div className="thin-scroll h-full overflow-y-auto p-5">
      <PageHeader title="设置" desc={`登录员工：${staff?.name}（${role?.name ?? '-'}）`} />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-4">
          <PrefsCard />
          <Card
            title={
              <span className="inline-flex items-center gap-1.5">
                「{seat?.displayName ?? '-'}」的欢迎语
                <HelpTip text="欢迎语是坐席的属性：交接后跟着坐席走，不跟人走。客户添加该坐席后立即以坐席身份发出；留空用企业默认。" />
              </span>
            }
          >
            <Field label="模板" hint="支持 {{customer.nickname}}、{{seat.name}}">
              <Textarea rows={4} value={welcome} disabled={!seat} onChange={(e) => setWelcome(e.target.value)} placeholder={s.enterprise.defaultWelcome} />
            </Field>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-zinc-400">企业默认：{s.enterprise.defaultWelcome.slice(0, 40)}…</span>
              <Button
                variant="primary"
                size="sm"
                disabled={!seat || welcome === (seat?.welcome ?? '')}
                onClick={() => {
                  if (seat) s.updateSeatWelcome(seat.id, welcome)
                  toast(welcome.trim() ? '已保存坐席欢迎语' : '已清空，改用企业默认欢迎语')
                }}
              >
                保存
              </Button>
            </div>
          </Card>
          <ShortcutsCard />
        </div>
        <div className="space-y-4">
          <MyQuickRepliesCard />
          <Card title="我持有的坐席">
            <ul className="space-y-2">
              {mySeats.map((x) => (
                <li key={x.id} className="flex items-center gap-2 text-[13px]">
                  <SeatAvatar seat={x} size={24} />
                  <span className="text-zinc-900">{x.displayName}</span>
                  <span className="text-[12px] text-zinc-400">{x.roleDesc}</span>
                  {x.id === seat?.id && <span className="rounded bg-brand-50 px-1 text-[11px] text-brand-700">当前</span>}
                </li>
              ))}
              {mySeats.length === 0 && <li className="text-[12px] text-zinc-400">无</li>}
            </ul>
          </Card>
          {can('manage_settings') && (
            <Card title="企业设置">
              <p className="text-[12px] text-zinc-600">你的角色「{role?.name}」可以维护企业级设置（默认欢迎语、群发频控、模块启停、策略），在管理后台操作。</p>
              <Link to="/admin" target="_blank" className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-brand-700 hover:underline">
                打开管理后台 <ExternalLink size={12} />
              </Link>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
