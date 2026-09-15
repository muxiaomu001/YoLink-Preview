import type { ReactNode } from 'react'
import { create } from 'zustand'

export interface ConfirmRequest {
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
