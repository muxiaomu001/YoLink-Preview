import { create } from 'zustand'

export interface ToastItem {
  id: number
  text: string
  tone: 'ok' | 'warn' | 'info'
}

interface ToastState {
  items: ToastItem[]
  push: (text: string, tone?: ToastItem['tone']) => void
  remove: (id: number) => void
}

let toastSeq = 0
export const useToast = create<ToastState>((set) => ({
  items: [],
  push: (text, tone = 'ok') => {
    toastSeq += 1
    const id = toastSeq
    set((s) => ({ items: [...s.items, { id, text, tone }] }))
    setTimeout(() => set((s) => ({ items: s.items.filter((i) => i.id !== id) })), 3200)
  },
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}))

export function toast(text: string, tone?: ToastItem['tone']) {
  useToast.getState().push(text, tone)
}
