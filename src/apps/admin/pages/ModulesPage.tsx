/**
 * 模块启停（PRD 05 713-735 行）：八个模块各一行，开关即生效，停用不删数据。
 */
import type { ModuleKey } from '@/domain/types'
import { MODULE_LABEL } from '@/domain/labels'
import { useStore } from '@/store/store'
import { Switch } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, Table } from '@/ui/display'
import { toast } from '@/ui/overlay'

const MODULE_KEYS = Object.keys(MODULE_LABEL) as ModuleKey[]

export function ModulesPage() {
  const s = useStore()
  const admin = s.session.adminStaffId!
  const rows = MODULE_KEYS.map((key) => ({ key, ...MODULE_LABEL[key], on: s.enterprise.modules[key], licensed: s.license.modules.find((m) => m.key === key)?.enabled ?? true }))
  const onCount = rows.filter((r) => r.on).length

  return (
    <div>
      <PageHeader title="模块启停" desc="按企业需要开关功能模块。关掉的模块，管理后台侧边栏与客户端对应入口一起隐藏。" extra={<span className="text-xs text-zinc-500">已启用 {onCount} / {rows.length}</span>} />
      <Note>
        <b>停用不删数据</b>：关掉钱包，积分与提现记录都还在，重新启用后数据仍可见。侧边栏对应入口隐藏，客户端对应页面也不再显示。未获许可授权的模块不能启用，去「版本与许可」上传新许可。
      </Note>
      <Card className="mt-4" padded={false}>
        <Table
          rows={rows}
          rowKey={(r) => r.key}
          columns={[
            { key: 'name', title: '模块名称', render: (r) => <span className="font-medium text-zinc-900">{r.name}</span> },
            { key: 'desc', title: '说明', render: (r) => <span className="text-zinc-600">{r.desc}</span> },
            { key: 'level', title: '层级', width: '80px', render: (r) => <Pill tone={r.level === 'P0' ? 'blue' : r.level === 'P1' ? 'purple' : 'zinc'}>{r.level}</Pill> },
            {
              key: 'status',
              title: '状态',
              width: '120px',
              render: (r) => (!r.licensed ? <Pill tone="red">未授权</Pill> : r.on ? <Pill tone="green">已启用</Pill> : <Pill tone="zinc">未启用（数据保留）</Pill>),
            },
            {
              key: 'ops',
              title: '操作',
              width: '80px',
              align: 'right',
              render: (r) => (
                <Switch
                  checked={r.on && r.licensed}
                  disabled={!r.licensed}
                  onChange={(v) => {
                    s.toggleModule(r.key, v, admin)
                    toast(v ? `已启用「${r.name}」，侧边栏入口恢复` : `已停用「${r.name}」，数据保留，侧边栏入口隐藏`)
                  }}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
