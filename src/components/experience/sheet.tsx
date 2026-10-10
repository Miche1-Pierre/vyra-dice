"use client"

import { X } from "lucide-react"
import { AnimatePresence, motion, useDragControls } from "motion/react"
import type { ReactNode } from "react"

import { IconBtn } from "@/components/experience/ui"
import { cn } from "@/lib/utils"

/**
 * Non-modal glass card: floats at the right of the club on desktop (the dock stays reachable
 * below it), rises as a draggable bottom sheet on phones. The 3D stays interactive around it.
 */
export function Panel({
  open,
  onClose,
  isDesktop,
  label,
  title,
  aside,
  children,
  footer,
  className,
  compact = false,
}: {
  open: boolean
  onClose: () => void
  /** Floating card at the right; otherwise a bottom sheet. */
  isDesktop: boolean
  /** Narrower card with tight margins (phones held sideways). */
  compact?: boolean
  /** Accessible name of the region. */
  label: string
  /** Optional header row; without it the content draws its own hero under the close button. */
  title?: ReactNode
  aside?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  const drag = useDragControls()
  const close = (
    <IconBtn
      label="Fermer"
      keys={isDesktop ? ["Esc"] : undefined}
      onClick={onClose}
      className="text-label-2 bg-white/[0.08]"
    >
      <X />
    </IconBtn>
  )
  const header = title ? (
    <div className="flex h-14 shrink-0 items-center justify-between gap-2 pr-3 pl-5">
      <div className="text-headline text-label min-w-0 truncate">{title}</div>
      <div className="flex shrink-0 items-center gap-1">
        {aside}
        {close}
      </div>
    </div>
  ) : (
    <div className="absolute top-3 right-3 z-20 flex items-center gap-1">
      {aside}
      {close}
    </div>
  )
  const body = (
    <>
      {header}
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      {footer ? (
        <div className="relative shrink-0 px-4 pt-3 pb-4 before:pointer-events-none before:absolute before:inset-x-0 before:-top-8 before:h-8 before:bg-gradient-to-t before:from-[rgb(17_15_21/0.82)] before:to-transparent max-lg:pb-[max(1rem,env(safe-area-inset-bottom))]">
          {footer}
        </div>
      ) : null}
    </>
  )

  return (
    <AnimatePresence>
      {open ? (
        isDesktop ? (
          <motion.section
            key="panel-desktop"
            role="complementary"
            aria-label={label}
            initial={{ opacity: 0, x: 56, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 56, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className={cn(
              "glass-thick glass-rim absolute z-40 flex origin-right flex-col overflow-hidden",
              compact
                ? "sober:rounded-[16px] top-2 right-[max(0.5rem,env(safe-area-inset-right))] bottom-2 w-[340px] rounded-[26px]"
                : "sober:rounded-[16px] top-4 right-4 bottom-[100px] w-[400px] rounded-[30px]",
              className,
            )}
          >
            {body}
          </motion.section>
        ) : (
          <motion.section
            key="panel-mobile"
            role="dialog"
            aria-label={label}
            initial={{ y: "105%" }}
            animate={{ y: 0 }}
            exit={{ y: "105%" }}
            transition={{ type: "spring", damping: 36, stiffness: 360 }}
            drag="y"
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose()
            }}
            className={cn(
              "glass-thick glass-rim sober:rounded-[18px] absolute inset-x-2 bottom-2 z-40 flex max-h-[64dvh] flex-col overflow-hidden rounded-[30px] sm:inset-x-0 sm:mx-auto sm:w-[min(560px,calc(100%-1rem))]",
              className,
            )}
          >
            <div
              onPointerDown={(e) => drag.start(e)}
              className="absolute inset-x-0 top-0 z-30 flex h-6 cursor-grab touch-none justify-center pt-2"
            >
              <span className="h-[5px] w-9 rounded-full bg-white/25" />
            </div>
            {body}
          </motion.section>
        )
      ) : null}
    </AnimatePresence>
  )
}
