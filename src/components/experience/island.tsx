"use client"

import { Check, Info, Sparkles } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useEffect } from "react"

import { useExperience } from "@/lib/store"
import { cn } from "@/lib/utils"

const HOLD_MS = 2600

/**
 * Dynamic-Island-style notifications: a black capsule at the top that morphs open with the
 * message, then folds away. Replaces toasts for the few confirmations the visit needs.
 */
export function Island() {
  const notice = useExperience((s) => s.notice)
  const dismiss = useExperience((s) => s.dismissNotice)

  useEffect(() => {
    if (!notice) return
    const id = window.setTimeout(() => dismiss(notice.key), HOLD_MS)
    return () => window.clearTimeout(id)
  }, [notice, dismiss])

  const Icon = notice?.tone === "ok" ? Check : notice?.tone === "brand" ? Sparkles : Info

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.625rem,env(safe-area-inset-top))] z-[90] flex justify-center px-3">
      <AnimatePresence mode="popLayout">
        {notice ? (
          <motion.div
            key={notice.key}
            role="status"
            aria-live="polite"
            layout
            initial={{ opacity: 0, scale: 0.6, width: 120, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, width: "auto", filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.7, width: 120, filter: "blur(4px)" }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="flex max-w-[min(440px,calc(100vw-1.5rem))] items-center gap-3 overflow-hidden rounded-[22px] bg-black py-2 pr-4 pl-2 shadow-[0_0_0_1px_rgb(255_255_255/0.07),0_14px_40px_rgb(0_0_0/0.6)]"
          >
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full [&_svg]:size-4",
                notice.tone === "brand"
                  ? "brand-pill"
                  : notice.tone === "ok"
                    ? "bg-[#30d158] text-black"
                    : "text-label bg-white/[0.14]",
              )}
            >
              <Icon strokeWidth={2.4} />
            </span>
            <span className="min-w-0">
              <span className="text-footnote text-label block truncate font-semibold">
                {notice.title}
              </span>
              {notice.detail ? (
                <span className="text-caption text-label-2 block truncate">{notice.detail}</span>
              ) : null}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
