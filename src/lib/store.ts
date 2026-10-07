"use client"

import { create } from "zustand"

export type LevelFilter = "all" | 0 | 1
export type View = "intro" | "overview" | "zone" | "table" | "seat"
/** Side panel (desktop) / bottom sheet (phone). */
export type Panel = "table" | "compare" | "list" | null
/** Modal flow on top of everything: the request form, then its acknowledgement. */
export type Dialog = "request" | "ack" | null

/** Transient message in the Dynamic-Island-style pill at the top of the screen. */
export interface Notice {
  /** Changes on every notification so the island replays its morph. */
  key: number
  title: string
  detail?: string
  tone?: "gold" | "ok" | "neutral"
}

export interface LastRequest {
  requestId: string
  tableId: string
  demo: boolean
}

interface ExperienceState {
  /** Scene geometry + lightmaps are on the GPU. */
  sceneReady: boolean
  /** WebGL unavailable or the scene failed: show the list fallback. */
  fallback2d: boolean
  view: View
  levelFilter: LevelFilter
  focusedZoneId: string | null
  selectedTableId: string | null
  hoveredTableId: string | null
  compareIds: string[]
  panel: Panel
  dialog: Dialog
  commandOpen: boolean
  lastRequest: LastRequest | null
  notice: Notice | null
  /** Bumped to ask the camera to go back to the overview even if the view didn't change. */
  resetNonce: number

  setSceneReady: () => void
  setFallback2d: () => void
  finishIntro: () => void
  focusZone: (zoneId: string) => void
  selectTable: (tableId: string, opts?: { openPanel?: boolean }) => void
  viewFromSeat: () => void
  leaveSeat: () => void
  hoverTable: (tableId: string | null) => void
  setLevelFilter: (level: LevelFilter) => void
  toggleCompare: (tableId: string, label?: string) => void
  clearCompare: () => void
  openPanel: (panel: Panel) => void
  closePanel: () => void
  openDialog: (dialog: Dialog) => void
  setCommandOpen: (open: boolean) => void
  requestSent: (request: LastRequest) => void
  resetView: () => void
  notify: (notice: Omit<Notice, "key">) => void
  dismissNotice: (key: number) => void
  /** Esc: close the innermost layer (palette → dialog → seat → panel → zone). */
  back: () => void
}

export const useExperience = create<ExperienceState>()((set, get) => ({
  sceneReady: false,
  fallback2d: false,
  view: "intro",
  levelFilter: "all",
  focusedZoneId: null,
  selectedTableId: null,
  hoveredTableId: null,
  compareIds: [],
  panel: null,
  dialog: null,
  commandOpen: false,
  lastRequest: null,
  notice: null,
  resetNonce: 0,

  setSceneReady: () => set({ sceneReady: true }),
  setFallback2d: () => set({ fallback2d: true, view: "overview" }),
  finishIntro: () => {
    if (get().view === "intro") set({ view: "overview" })
  },
  focusZone: (zoneId) =>
    set((s) => ({
      view: "zone",
      focusedZoneId: zoneId,
      selectedTableId: null,
      panel: s.panel === "list" || s.panel === "compare" ? s.panel : null,
    })),
  selectTable: (tableId, opts) =>
    set((s) => ({
      view: "table",
      selectedTableId: tableId,
      panel: opts?.openPanel === false ? s.panel : "table",
    })),
  viewFromSeat: () => {
    if (get().selectedTableId) set({ view: "seat" })
  },
  leaveSeat: () => {
    if (get().view === "seat") set({ view: "table" })
  },
  hoverTable: (tableId) => set({ hoveredTableId: tableId }),
  setLevelFilter: (levelFilter) => set({ levelFilter }),
  toggleCompare: (tableId, label = tableId.toUpperCase()) => {
    const s = get()
    const has = s.compareIds.includes(tableId)
    const next = has
      ? s.compareIds.filter((id) => id !== tableId)
      : [...s.compareIds, tableId].slice(-3)
    set({ compareIds: next })
    get().notify(
      has
        ? { title: `Table ${label} retirée du comparatif`, tone: "neutral" }
        : {
            title: `Table ${label} ajoutée au comparatif`,
            detail:
              next.length >= 2
                ? `${next.length} / 3 · prêt à comparer`
                : "Ajoutez-en une autre pour comparer",
            tone: "gold",
          },
    )
  },
  clearCompare: () => set({ compareIds: [] }),
  openPanel: (panel) => set({ panel }),
  closePanel: () =>
    set((s) => {
      const leavingTable = s.view === "table" || s.view === "seat"
      return {
        panel: null,
        view: leavingTable ? (s.focusedZoneId ? "zone" : "overview") : s.view,
        selectedTableId: leavingTable ? null : s.selectedTableId,
      }
    }),
  openDialog: (dialog) => set({ dialog }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  requestSent: (lastRequest) => set({ lastRequest, dialog: "ack" }),
  resetView: () =>
    set({
      view: "overview",
      focusedZoneId: null,
      selectedTableId: null,
      panel: null,
      dialog: null,
      resetNonce: get().resetNonce + 1,
    }),
  notify: (notice) => set((s) => ({ notice: { ...notice, key: (s.notice?.key ?? 0) + 1 } })),
  dismissNotice: (key) => {
    if (get().notice?.key === key) set({ notice: null })
  },
  back: () => {
    const s = get()
    if (s.commandOpen) return set({ commandOpen: false })
    if (s.dialog) return set({ dialog: null })
    if (s.view === "seat") return set({ view: "table" })
    if (s.panel) return get().closePanel()
    if (s.view === "zone") return get().resetView()
  },
}))
