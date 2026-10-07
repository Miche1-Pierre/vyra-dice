"use client"

import { X } from "lucide-react"
import { AnimatePresence, motion, useDragControls } from "motion/react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Non-modal panel: floating card on the right on desktop, draggable bottom sheet on phones.
 * The 3D view stays interactive around it.
 */
export function Panel({
  open,
  onClose,
  isDesktop,
  children,
  label,
  className,
}: {
  open: boolean
  onClose: () => void
  isDesktop: boolean
  children: ReactNode
  label: string
  className?: string
}) {
  const drag = useDragControls()
  return (
    <AnimatePresence>
      {open ? (
        isDesktop ? (
          <motion.section
            key="panel-desktop"
            role="dialog"
            aria-label={label}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className={cn(
              "absolute top-20 right-5 bottom-5 z-40 flex w-[400px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0e0a14]/90 shadow-2xl backdrop-blur-xl",
              className,
            )}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="absolute top-3 right-3 z-10 grid size-8 place-items-center rounded-full bg-white/[0.06] text-white/80 hover:bg-white/15"
            >
              <X className="size-4" />
            </button>
            <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
          </motion.section>
        ) : (
          <motion.section
            key="panel-mobile"
            role="dialog"
            aria-label={label}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            drag="y"
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose()
            }}
            className={cn(
              "absolute inset-x-0 bottom-0 z-40 flex max-h-[78dvh] flex-col rounded-t-3xl border-t border-white/10 bg-[#0e0a14]/95 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl",
              className,
            )}
          >
            <div
              onPointerDown={(e) => drag.start(e)}
              className="flex shrink-0 cursor-grab touch-none justify-center pt-3 pb-2"
            >
              <span className="h-1.5 w-12 rounded-full bg-white/25" />
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="absolute top-2.5 right-3 z-10 grid size-8 place-items-center rounded-full bg-white/[0.06] text-white/80"
            >
              <X className="size-4" />
            </button>
            <div className="flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
              {children}
            </div>
          </motion.section>
        )
      ) : null}
    </AnimatePresence>
  )
}
