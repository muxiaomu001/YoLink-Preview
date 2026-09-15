import { useState } from 'react'
import { useStore } from '@/store/store'
import { Button, Field, Input, Switch, Textarea } from '@/ui/primitives'
import { Card, Note, PageHeader } from '@/ui/display'
import { toast } from '@/ui/overlay'

export function SettingsPage() {
  const s = useStore()
  const e = s.enterprise
  const [name, setName] = useState(e.name)
  const [slogan, setSlogan] = useState(e.slogan)
  const [welcome, setWelcome] = useState(e.defaultWelcome)
  const admin = s.session.adminStaffId!
  return (
    <div>
      <PageHeader title="企业设置" desc="基本信息、注册方式、企业默认欢迎语。" />
      <div className="grid grid-cols-2 gap-4">
        <Card title="基本信息">
          <div className="space-y-3">
            <Field label="企业名称">
              <Input value={name} onChange={(ev) => setName(ev.target.value)} />
            </Field>
            <Field label="一句话介绍">
              <Input value={slogan} onChange={(ev) => setSlogan(ev.target.value)} />
            </Field>
            <Field label="企业码" hint="客户端启动时输入，解析到本企业实例">
              <Input value={e.code} disabled />
            </Field>
            <Field label="时区">
              <Input value={e.timezone} disabled />
            </Field>
            <Button
              variant="primary"
              onClick={() => {
                s.updateEnterprise({ name, slogan }, admin)
                toast('已保存')
              }}
            >
              保存
            </Button>
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="注册方式">
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-zinc-800">允许的注册方式</div>
                  <div className="text-zinc-500">用户名 + 密码，或手机号 + 密码；第一版无验证码</div>
                </div>
                <span className="text-zinc-600">用户名、手机号</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-zinc-800">邀请码必填</div>
                  <div className="text-zinc-500">关闭即开放注册，没带码的走默认邀请组</div>
                </div>
                <Switch
                  checked={e.inviteCodeRequired}
                  onChange={(v) => {
                    s.updateEnterprise({ inviteCodeRequired: v }, admin)
                    toast(v ? '已开启：注册必须带邀请码' : '已关闭：无码注册走默认组')
                  }}
                />
              </div>
            </div>
          </Card>
          <Card title="企业默认欢迎语">
            <Field label="模板" hint="坐席没单独配欢迎语时用这条">
              <Textarea rows={3} value={welcome} onChange={(ev) => setWelcome(ev.target.value)} />
            </Field>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-zinc-400">变量：{'{{customer.nickname}}'}、{'{{seat.name}}'}</span>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  s.updateEnterprise({ defaultWelcome: welcome }, admin)
                  toast('已保存')
                }}
              >
                保存
              </Button>
            </div>
          </Card>
        </div>
      </div>
      <div className="mt-4">
        <Note>推送配置、对象存储、网站栏目、App 版本管理等页面在正式产品里，演示不展开。</Note>
      </div>
    </div>
  )
}
