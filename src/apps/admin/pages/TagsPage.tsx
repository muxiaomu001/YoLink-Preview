import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useStore } from '@/store/store'
import { Button, Input } from '@/ui/primitives'
import { Card, Note, PageHeader, Pill, Table, TagChip } from '@/ui/display'
import { toast } from '@/ui/overlay'

export function TagsPage() {
  const s = useStore()
  const [name, setName] = useState('')
  return (
    <div>
      <PageHeader title="内部标签库" desc="内部标签是员工自己用的（高意向、退款风险），客户永远看不到。用于筛选客户与群发定向。" />
      <Note tone="amber">这里的标签绝不对客户显示。要让客户和群里的人看到的身份，用「头衔库」。两者分表，混成一个对象一次误操作就会把「退款风险」挂到客户头上让全群看见。</Note>
      <Card
        className="mt-4"
        padded={false}
        title="标签"
        extra={
          <div className="flex items-center gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="新标签名" className="h-7 w-40 text-xs" />
            <Button
              size="sm"
              variant="primary"
              disabled={!name.trim()}
              onClick={() => {
                s.createTag(name.trim(), '#52525b', 'admin')
                toast(`内部标签「${name.trim()}」已入库`)
                setName('')
              }}
            >
              <Plus size={12} /> 新增
            </Button>
          </div>
        }
      >
        <Table
          rows={s.tags}
          rowKey={(t) => t.id}
          columns={[
            { key: 'chip', title: '标签', render: (t) => <TagChip tag={t} /> },
            { key: 'source', title: '来源', render: (t) => (t.source === 'admin' ? <Pill>后台创建</Pill> : <Pill tone="purple">员工在工作台新建</Pill>) },
            { key: 'count', title: '客户数', align: 'right', render: (t) => <span className="tabular-nums">{s.customers.filter((c) => c.tagIds.includes(t.id)).length}</span> },
            {
              key: 'ops',
              title: '操作',
              align: 'right',
              render: (t) => (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    s.deleteTag(t.id)
                    toast('已删除，并从所有客户身上摘掉')
                  }}
                >
                  删除
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
