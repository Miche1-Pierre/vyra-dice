"use client"

import { create } from "zustand"

export type LevelFilter = "all" | 0 | 1
export type View = "intro" | "overview" | "zone" | "table" | "seat"
export type Panel = "table" | "request" | "ack" | "compare" | "list" | null

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
  lastRequest: LastRequest | null
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
  toggleCompare: (tableId: string) => void
  clearCompare: () => void
  openPanel: (panel: Panel) => void
  closePanel: () => void
  requestSent: (request: LastRequest) => void
  resetView: () => void
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
  lastRequest: null,
  resetNonce: 0,

  setSceneReady: () => set({ sceneReady: true }),
  setFallback2d: () => set({ fallback2d: true, view: "overview" }),
  finishIntro: () => {
    if (get().view === "intro") set({ view: "overview" })
  },
  focusZone: (zoneId) =>
    set({ view: "zone", focusedZoneId: zoneId, selectedTableId: null, panel: null }),
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
  toggleCompare: (tableId) =>
    set((s) => {
      const has = s.compareIds.includes(tableId)
      const next = has
        ? s.compareIds.filter((id) => id !== tableId)
        : [...s.compareIds, tableId].slice(-3)
      return { compareIds: next }
    }),
  clearCompare: () => set({ compareIds: [] }),
  openPanel: (panel) => set({ panel }),
  closePanel: () =>
    set((s) => ({
      panel: null,
      view:
        s.view === "table" || s.view === "seat" ? (s.focusedZoneId ? "zone" : "overview") : s.view,
      selectedTableId: s.view === "table" || s.view === "seat" ? null : s.selectedTableId,
    })),
  requestSent: (lastRequest) => set({ lastRequest, panel: "ack" }),
  resetView: () =>
    set((s) => ({
      view: "overview",
      focusedZoneId: null,
      selectedTableId: null,
      panel: s.panel === "list" ? "list" : null,
      resetNonce: s.resetNonce + 1,
    })),
}))
