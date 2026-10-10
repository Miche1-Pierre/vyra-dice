"use client"

import { useEffect } from "react"

import { track } from "@/lib/analytics/client"
import { useExperience } from "@/lib/store"

function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable
}

/**
 * Keyboard layer. Esc goes back one level on every screen (tablets and phones with a keyboard
 * too). On desktops: ⌘K / Ctrl K or / search · L list · C compare (when the club offers it) ·
 * V view from the seat · R overview · ↵ request the selected table · 1 2 3 levels.
 */
export function useShortcuts(isDesktop: boolean, compare = true) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useExperience.getState()
      if (e.key === "Escape") {
        // dialogs and the palette handle their own Escape
        if (!s.commandOpen && !s.dialog) s.back()
        return
      }
      if (!isDesktop) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault()
        s.setCommandOpen(!s.commandOpen)
        return
      }
      if (mod || e.altKey || typing(e.target) || s.commandOpen || s.dialog || s.view === "intro")
        return
      const key = e.key.toLowerCase()
      if (key === "/") {
        e.preventDefault()
        s.setCommandOpen(true)
      } else if (key === "l") {
        s.openPanel(s.panel === "list" ? null : "list")
        if (s.panel !== "list") track("list_view_opened", {})
      } else if (key === "r") {
        s.resetView()
      } else if (key === "v" && s.selectedTableId) {
        if (s.view === "seat") s.leaveSeat()
        else {
          s.viewFromSeat()
          track("table_view_from_seat", { table_id: s.selectedTableId })
        }
      } else if (key === "c" && compare) {
        if (s.selectedTableId && s.panel === "table") s.toggleCompare(s.selectedTableId)
        else if (s.compareIds.length > 0) s.openPanel(s.panel === "compare" ? null : "compare")
      } else if (
        key === "enter" &&
        s.selectedTableId &&
        (s.panel === "table" || s.view === "seat")
      ) {
        e.preventDefault()
        s.openDialog("request")
      } else if (key === "1" || key === "2" || key === "3") {
        const level = key === "1" ? "all" : key === "2" ? 0 : 1
        s.setLevelFilter(level)
        track("level_filter_changed", { level: String(level) as "all" | "0" | "1" })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isDesktop, compare])
}
