import { Button } from './primitives'
import { Modal } from './OverlayComponents'
import { useConfirm } from './confirmState'

export function Confirmer() {
  const current = useConfirm((s) => s.current)
  const settle = useConfirm((s) => s.settle)
  if (!current) return null
  return (
    <Modal
      open
      onClose={() => settle(false)}
      title={current.title}
      width={440}
      footer={
        <>
          <Button onClick={() => settle(false)}>取消</Button>
          <Button variant={current.danger ? 'danger' : 'primary'} onClick={() => settle(true)}>
            {current.okText ?? '确定'}
          </Button>
        </>
      }
    >
      <div className="text-[13px] leading-relaxed text-zinc-700">{current.body ?? '是否继续？'}</div>
    </Modal>
  )
}
