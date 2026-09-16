import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, ShieldCheck, X } from 'lucide-react'
import type { Announcement } from '@/domain/types'
import { useStore } from '@/store/store'

function activeAnnouncements(items: Announcement[]) {
  const now = new Date().toISOString()
  return items.filter((item) => item.startAt <= now && item.endAt >= now)
}

function seenKey(customerId: string, announcementId: string) {
  return `yolink-announcement-seen:${customerId}:${announcementId}`
}

function canShowToCustomer(item: Announcement, customerId: string) {
  return item.showMode === 'every' || localStorage.getItem(seenKey(customerId, item.id)) !== 'yes'
}

function popupFor(items: Announcement[], customerId?: string) {
  if (!customerId) return undefined
  return activeAnnouncements(items).find((item) => item.kind === 'popup' && canShowToCustomer(item, customerId))
}

export function StartupExperience({ customerId, onAnnouncementShown }: { customerId?: string; onAnnouncementShown: (id: string) => void }) {
  const enterprise = useStore((state) => state.enterprise)
  const announcements = useStore((state) => state.announcements)
  const popup = useMemo(() => popupFor(announcements, customerId), [announcements, customerId])
  const [stage, setStage] = useState<'brand' | 'popup' | 'done'>(() => (enterprise.startupBrand.enabled ? 'brand' : popup ? 'popup' : 'done'))

  const finishBrand = useCallback(() => setStage(popup ? 'popup' : 'done'), [popup])
  const closePopup = useCallback(() => {
    if (popup && customerId && popup.showMode === 'once') localStorage.setItem(seenKey(customerId, popup.id), 'yes')
    setStage('done')
  }, [customerId, popup])

  useEffect(() => {
    if (stage !== 'brand') return
    const timer = window.setTimeout(finishBrand, enterprise.startupBrand.durationSeconds * 1000)
    return () => window.clearTimeout(timer)
  }, [enterprise.startupBrand.durationSeconds, finishBrand, stage])

  useEffect(() => {
    if (stage === 'popup' && popup) onAnnouncementShown(popup.id)
  }, [onAnnouncementShown, popup, stage])

  if (stage === 'done') return null

  if (stage === 'brand') {
    return (
      <div className="absolute inset-0 z-40 flex flex-col items-center justify-center overflow-hidden text-white" style={{ background: enterprise.startupBrand.backgroundColor }}>
        <div className="absolute -top-20 -right-16 h-64 w-64 rounded-full bg-white/6" />
        <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full border border-white/10" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-[24px] bg-white/14 text-4xl font-semibold shadow-2xl ring-1 ring-white/25 backdrop-blur-sm">
          {enterprise.logoText}
        </div>
        <h1 className="relative mt-6 text-2xl font-semibold tracking-[0.14em]">{enterprise.name}</h1>
        <p className="relative mt-3 text-xs tracking-[0.08em] text-white/65">{enterprise.startupBrand.tagline}</p>
        <div className="absolute bottom-10 flex flex-col items-center gap-4">
          <div className="h-1 w-24 overflow-hidden rounded-full bg-white/15">
            <div className="h-full animate-pulse rounded-full bg-white/55" style={{ width: '64%' }} />
          </div>
          {enterprise.startupBrand.allowSkip && (
            <button type="button" onClick={finishBrand} className="rounded-full border border-white/20 px-4 py-1.5 text-[11px] text-white/75 hover:bg-white/10 hover:text-white">
              跳过
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!popup) return null
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-zinc-950/55 px-5 backdrop-blur-[2px]">
      <section className="w-full overflow-hidden rounded-2xl bg-white shadow-2xl" aria-modal="true" role="dialog" aria-labelledby="startup-announcement-title">
        <div className="relative flex h-36 items-center justify-center text-white" style={{ background: popup.imageColor || enterprise.brandColor }}>
          <ShieldCheck size={48} strokeWidth={1.5} />
          <button type="button" onClick={closePopup} className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/15 text-white/80 hover:bg-black/25" aria-label="关闭启动公告">
            <X size={15} />
          </button>
        </div>
        <div className="px-5 pt-5 pb-6 text-center">
          <h2 id="startup-announcement-title" className="text-base font-semibold text-zinc-900">{popup.title}</h2>
          <p className="mt-2 text-xs leading-6 text-zinc-600">{popup.body}</p>
          <button
            type="button"
            className="mt-5 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-brand-700 text-xs font-medium text-white hover:bg-brand-800"
            onClick={() => {
              if (popup.buttonAction === 'link' && popup.url) window.open(popup.url, '_blank', 'noopener,noreferrer')
              closePopup()
            }}
          >
            {popup.buttonText}{popup.buttonAction === 'link' && <ExternalLink size={12} />}
          </button>
        </div>
      </section>
    </div>
  )
}

export function ActiveAnnouncementBar({ customerId, dismissedIds, onDismiss, onAnnouncementShown }: { customerId: string; dismissedIds: string[]; onDismiss: (id: string) => void; onAnnouncementShown: (id: string) => void }) {
  const announcements = useStore((state) => state.announcements)
  const item = useMemo(() => activeAnnouncements(announcements).find((announcement) => announcement.kind === 'bar' && canShowToCustomer(announcement, customerId)), [announcements, customerId])
  const dismissed = !!item && dismissedIds.includes(item.id)

  useEffect(() => {
    if (item && !dismissed) onAnnouncementShown(item.id)
  }, [dismissed, item, onAnnouncementShown])

  if (!item || dismissed) return null

  const close = () => {
    if (item.showMode === 'once') localStorage.setItem(seenKey(customerId, item.id), 'yes')
    onDismiss(item.id)
  }

  return (
    <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-950">
      <ShieldCheck size={14} className="mt-0.5 shrink-0 text-amber-700" />
      <div className="min-w-0 flex-1">
        <span className="font-medium">{item.title}</span>
        <span className="ml-1 text-amber-800">{item.body}</span>
        <button
          type="button"
          className="ml-1 font-medium text-amber-950 underline underline-offset-2"
          onClick={() => {
            if (item.buttonAction === 'link' && item.url) window.open(item.url, '_blank', 'noopener,noreferrer')
            close()
          }}
        >
          {item.buttonText}
        </button>
      </div>
      <button type="button" onClick={close} className="mt-0.5 text-amber-700 hover:text-amber-950" aria-label="关闭顶部公告">
        <X size={13} />
      </button>
    </div>
  )
}
