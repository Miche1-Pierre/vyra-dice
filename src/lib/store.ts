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
  tone?: "brand" | "ok" | "neutral"
}

/**
 * What the buyer typed in the request form, kept in memory while the form is closed and reopened
 * (never stored on the device). The idempotency key belongs to the table it was created for.
 */
export interface RequestDraft {
  tableId: string
  idempotencyKey: string
  fullName?: string
  phone?: string
  email?: string
  message?: string
  arrivalTime?: string
  consent?: boolean
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
  /** The buyer chose the list without the 3D (lighter, easier to read). */
  listMode: boolean
  view: View
  levelFilter: LevelFilter
  focusedZoneId: string | null
  selectedTableId: string | null
  hoveredTableId: string | null
  /** Group size chosen for the selected table; null until the buyer changes it. */
  guests: number | null
  compareIds: string[]
  panel: Panel
  /** Panel to show again when the table card closes (the table was opened from it). */
  returnTo: "list" | "compare" | null
  draft: RequestDraft | null
  dialog: Dialog
  commandOpen: boolean
  lastRequest: LastRequest | null
  notice: Notice | null
  /** Bumped to ask the camera to go back to the overview even if the view didn't change. */
  resetNonce: number

  setSceneReady: () => void
  setFallback2d: () => void
  setListMode: (on: boolean) => void
  finishIntro: () => void
  focusZone: (zoneId: string) => void
  selectTable: (tableId: string, opts?: { openPanel?: boolean; from?: "list" | "compare" }) => void
  viewFromSeat: () => void
  leaveSeat: () => void
  hoverTable: (tableId: string | null) => void
  setGuests: (guests: number) => void
  setLevelFilter: (level: LevelFilter) => void
  toggleCompare: (tableId: string, label?: string) => void
  clearCompare: () => void
  openPanel: (panel: Panel) => void
  closePanel: () => void
  openDialog: (dialog: Dialog) => void
  saveDraft: (draft: RequestDraft) => void
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
  listMode: false,
  view: "intro",
  levelFilter: "all",
  focusedZoneId: null,
  selectedTableId: null,
  hoveredTableId: null,
  guests: null,
  compareIds: [],
  panel: null,
  returnTo: null,
  draft: null,
  dialog: null,
  commandOpen: false,
  lastRequest: null,
  notice: null,
  resetNonce: 0,

  setSceneReady: () => set({ sceneReady: true }),
  setFallback2d: () => set({ fallback2d: true, view: "overview" }),
  setListMode: (listMode) =>
    set((s) => ({
      listMode,
      view: s.view === "seat" || s.view === "intro" ? "overview" : s.view,
      panel: listMode ? "list" : s.panel,
      // the 3D comes back without replaying the intro, behind its loading screen
      sceneReady: listMode ? s.sceneReady : false,
    })),
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
      // another table starts again from its own proposed group size
      guests: tableId === s.selectedTableId ? s.guests : null,
      panel: opts?.openPanel === false ? s.panel : "table",
      // switching tables inside the card keeps the way back
      returnTo: opts?.from ?? (s.panel === "table" ? s.returnTo : null),
    })),
  viewFromSeat: () => {
    if (get().selectedTableId) set({ view: "seat" })
  },
  leaveSeat: () => {
    if (get().view === "seat") set({ view: "table" })
  },
  hoverTable: (tableId) => set({ hoveredTableId: tableId }),
  setGuests: (guests) => set({ guests }),
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
            tone: "brand",
          },
    )
  },
  clearCompare: () => set({ compareIds: [] }),
  openPanel: (panel) => set({ panel }),
  closePanel: () =>
    set((s) => {
      const leavingTable = s.view === "table" || s.view === "seat"
      return {
        // a table opened from the list (or the comparison) goes back to it
        panel: s.panel === "table" ? s.returnTo : null,
        returnTo: null,
        view: leavingTable ? (s.focusedZoneId ? "zone" : "overview") : s.view,
        selectedTableId: leavingTable ? null : s.selectedTableId,
      }
    }),
  openDialog: (dialog) => set({ dialog }),
  saveDraft: (draft) => set({ draft }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  requestSent: (lastRequest) => set({ lastRequest, dialog: "ack", draft: null }),
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
