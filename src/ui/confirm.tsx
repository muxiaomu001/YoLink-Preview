/**
 * 全局二次确认：confirm({ title, body }) 返回 Promise<boolean>，
 * 页面里不用各自维护弹窗状态。<Confirmer /> 挂在根上。
 */
import type { ReactNode } from 'react'
import { create } from 'zustand'
import { Button } from './primitives'
import { Modal } from './overlay'

interface ConfirmRequest {
  title: ReactNode
  body?: ReactNode
  okText?: string
  danger?: boolean
}

interface ConfirmState {
  current: (ConfirmRequest & { resolve: (ok: boolean) => void }) | null
  ask: (req: ConfirmRequest) => Promise<boolean>
  settle: (ok: boolean) => void
}

export const useConfirm = create<ConfirmState>((set, get) => ({
  current: null,
  ask: (req) =>
    new Promise<boolean>((resolve) => {
      set({ current: { ...req, resolve } })
    }),
  settle: (ok) => {
    get().current?.resolve(ok)
    set({ current: null })
  },
}))

export function confirm(req: ConfirmRequest): Promise<boolean> {
  return useConfirm.getState().ask(req)
}

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
