"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef } from "react"

import { CompareTray, CompareView, TableList, ZoneDock } from "@/components/experience/browse"
import {
  DemoNotice,
  SeatOverlay,
  Sidebar,
  StatusLegend,
  TicketLink,
  TopBar,
} from "@/components/experience/chrome"
import { useIsDesktop, useQuality, useWebGLSupport } from "@/components/experience/hooks"
import { IntroSkip, LoadingScreen } from "@/components/experience/loading-screen"
import { Panel } from "@/components/experience/sheet"
import { RequestAck, RequestForm, TableDetails } from "@/components/experience/table-panel"
import { buildViewModel, type ViewModel } from "@/components/experience/view-model"
import { track } from "@/lib/analytics/client"
import { formatDateFr } from "@/lib/format"
import type { VenueContent } from "@/lib/schema"
import { useExperience } from "@/lib/store"
import { getLayout } from "@/lib/venue/layout"

const VenueCanvas = dynamic(() => import("@/components/scene/venue-canvas"), { ssr: false })

/** Emits the analytics taxonomy (docs/analytics.md) from store transitions. */
function useAnalyticsBridge(vm: ViewModel, webgl: boolean | null) {
  const mountedAt = useRef(0)
  useEffect(() => {
    mountedAt.current = performance.now()
  }, [])
  useEffect(() => {
    if (webgl === null) return
    const source = new URLSearchParams(window.location.search).get("utm_source") ?? undefined
    track("experience_viewed", { source, webgl_supported: webgl })
  }, [webgl])
  useEffect(
    () =>
      useExperience.subscribe((s, prev) => {
        if (s.sceneReady && !prev.sceneReady) {
          track("scene_ready", {
            load_ms: Math.round(performance.now() - mountedAt.current),
            fallback_2d: false,
          })
        }
        if (s.fallback2d && !prev.fallback2d) {
          track("scene_ready", {
            load_ms: Math.round(performance.now() - mountedAt.current),
            fallback_2d: true,
          })
        }
        if (s.focusedZoneId && s.focusedZoneId !== prev.focusedZoneId) {
          const zone = vm.zones.find((z) => z.id === s.focusedZoneId)
          if (zone) track("zone_viewed", { zone_id: zone.id, tier: zone.tier })
        }
        if (s.selectedTableId && s.selectedTableId !== prev.selectedTableId) {
          const t = vm.tables[s.selectedTableId]
          if (t) {
            track("table_viewed", {
              table_id: t.id,
              zone_id: t.zoneId,
              tier: t.tier,
              minimum_spend: t.minimumSpend,
              status: t.status,
            })
          }
        }
      }),
    [vm],
  )
}

export function Experience({
  clubSlug,
  eventSlug,
  content,
}: {
  clubSlug: string
  eventSlug: string
  content: VenueContent
}) {
  const layout = getLayout(clubSlug)
  const vm = useMemo(() => (layout ? buildViewModel(content, layout) : null), [content, layout])
  const isDesktop = useIsDesktop()
  const quality = useQuality()
  const webgl = useWebGLSupport()
  const fallback2d = useExperience((s) => s.fallback2d)
  const setFallback2d = useExperience((s) => s.setFallback2d)
  const panel = useExperience((s) => s.panel)
  const view = useExperience((s) => s.view)
  const selectedTableId = useExperience((s) => s.selectedTableId)
  const closePanel = useExperience((s) => s.closePanel)
  const openPanel = useExperience((s) => s.openPanel)

  useEffect(() => {
    if (webgl === false || !layout) setFallback2d()
  }, [webgl, layout, setFallback2d])

  useEffect(() => {
    if (fallback2d) openPanel("list")
  }, [fallback2d, openPanel])

  useAnalyticsBridge(vm ?? { zones: [], tables: {}, zoneMarkers: [], tableMarkers: [] }, webgl)

  if (!vm || !layout) return null

  const eventLine = `${content.event.name} · ${formatDateFr(content.event.date)} · ${content.event.doors}`
  const table = selectedTableId ? vm.tables[selectedTableId] : null
  const panelOpen =
    panel !== null &&
    (panel === "list" || panel === "compare" || panel === "ack" || table !== null) &&
    // on phones the seat view gets the whole screen; SeatOverlay carries the CTA
    !(view === "seat" && !isDesktop)

  return (
    <div className="text-foreground relative flex h-dvh w-full overflow-hidden bg-[#060408]">
      {isDesktop ? <Sidebar content={content} zones={vm.zones} eventLine={eventLine} /> : null}
      <main className="relative min-w-0 flex-1">
        {!fallback2d && webgl && quality ? (
          <VenueCanvas
            club={clubSlug}
            layout={layout}
            zoneMarkers={vm.zoneMarkers}
            tableMarkers={vm.tableMarkers}
            quality={quality}
            onIntroSkipped={(atMs) => track("intro_skipped", { at_ms: atMs })}
          />
        ) : null}
        <TopBar
          title={isDesktop ? "Choisissez votre table" : content.club.name}
          subtitle={eventLine}
          isDesktop={isDesktop}
        />
        <SeatOverlay
          tableLabel={table?.label ?? null}
          canRequest={!isDesktop && table !== null && table.status !== "sold"}
        />
        <CompareTray />
        {isDesktop ? (
          <div className="pointer-events-none absolute bottom-5 left-5 z-20 rounded-full border border-white/10 bg-black/60 px-3 py-2 backdrop-blur-md 2xl:hidden">
            <StatusLegend />
          </div>
        ) : null}
        {!isDesktop ? <ZoneDock zones={vm.zones} /> : null}
        {!isDesktop && content.club.demo ? (
          <DemoNotice
            text="Démo · données non validées par le club"
            className="pointer-events-none absolute top-[max(4.6rem,calc(env(safe-area-inset-top)+3.6rem))] left-4 z-20 py-1"
          />
        ) : null}
        {fallback2d ? (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/60">
            La visite 3D n’est pas disponible sur cet appareil : voici la liste des tables.
          </div>
        ) : null}
        <Panel
          open={panelOpen}
          onClose={closePanel}
          isDesktop={isDesktop}
          label={
            panel === "list" ? "Liste des tables" : panel === "compare" ? "Comparatif" : "Table"
          }
        >
          {panel === "list" ? (
            <>
              <TableList zones={vm.zones} />
              <div className="px-5 pb-6">
                <TicketLink url={content.event.ticketUrl} />
              </div>
            </>
          ) : null}
          {panel === "compare" ? <CompareView tables={vm.tables} /> : null}
          {panel === "table" && table ? <TableDetails table={table} content={content} /> : null}
          {panel === "request" && table ? (
            <RequestForm
              table={table}
              content={content}
              clubSlug={clubSlug}
              eventSlug={eventSlug}
            />
          ) : null}
          {panel === "ack" ? <RequestAck table={table} content={content} /> : null}
        </Panel>
        <LoadingScreen clubName={content.club.name} eventLine={eventLine} />
        <IntroSkip />
      </main>
    </div>
  )
}
