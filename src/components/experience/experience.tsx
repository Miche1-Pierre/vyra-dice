"use client"

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { Box, GitCompareArrows, MessageCircle, Rows3, Search, Ticket } from "lucide-react"
import { MotionConfig } from "motion/react"
import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef, type ReactNode } from "react"

import { ClubMark } from "@/components/experience/brand"
import { CompareView, TableList } from "@/components/experience/browse"
import { CommandMenu } from "@/components/experience/command-menu"
import { Dock, type DockEntry } from "@/components/experience/dock"
import {
  usePrefersReducedMotion,
  useQuality,
  useViewport,
  useWebGLSupport,
} from "@/components/experience/hooks"
import {
  BrandBar,
  LevelSwitch,
  SearchButton,
  SeatOverlay,
  StatusLegend,
  WhatsAppButton,
} from "@/components/experience/hud"
import { Island } from "@/components/experience/island"
import { IntroSkip, LoadingScreen } from "@/components/experience/loading-screen"
import { Panel } from "@/components/experience/sheet"
import { RequestDialog, TableDetails, TableFooter } from "@/components/experience/table-panel"
import { Btn, Tile, ZoneTile } from "@/components/experience/ui"
import { useShortcuts } from "@/components/experience/use-shortcuts"
import { buildViewModel, zonePriceLabel, type ViewModel } from "@/components/experience/view-model"
import { track } from "@/lib/analytics/client"
import { contactMessage, instagramUrl, whatsappUrl } from "@/lib/contact"
import type { ClubBrand } from "@/lib/clubs/brand"
import type { ClubDefinition } from "@/lib/clubs/club"
import { formatDateFr, formatEuro } from "@/lib/format"
import type { VenueContent } from "@/lib/schema"
import { useExperience } from "@/lib/store"
import { cn } from "@/lib/utils"
import { STATUS } from "@/lib/venue/tiers"

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
        if (s.panel === "compare" && prev.panel !== "compare") {
          track("tables_compared", { table_ids: s.compareIds })
        }
      }),
    [vm],
  )
}

/** Says what was just selected to screen readers (the 3D itself is silent). */
function SelectionAnnouncer({ vm }: { vm: ViewModel }) {
  const view = useExperience((s) => s.view)
  const focusedZoneId = useExperience((s) => s.focusedZoneId)
  const selectedTableId = useExperience((s) => s.selectedTableId)
  const table = selectedTableId ? vm.tables[selectedTableId] : null
  const zone = focusedZoneId ? vm.zones.find((z) => z.id === focusedZoneId) : null
  let message = ""
  if (table && (view === "table" || view === "seat")) {
    const price =
      table.minimumSpend !== null ? `minimum ${formatEuro(table.minimumSpend)}` : "prix sur demande"
    message = `Table ${table.label}, ${table.zoneName}, ${STATUS[table.status].label}, ${price}`
    if (view === "seat") message = `Vue depuis la table ${table.label}`
  } else if (zone && view === "zone") {
    message = `${zone.name} : ${zone.availability.label}, ${zonePriceLabel(zone)}`
  } else if (view === "overview") {
    message = "Vue d’ensemble du club"
  }
  return (
    <p aria-live="polite" className="sr-only">
      {message}
    </p>
  )
}

function useDockEntries(
  vm: ViewModel,
  content: VenueContent,
  brand: ClubBrand,
  isDesktop: boolean,
): DockEntry[] {
  const view = useExperience((s) => s.view)
  const panel = useExperience((s) => s.panel)
  const focusedZoneId = useExperience((s) => s.focusedZoneId)
  const compareCount = useExperience((s) => s.compareIds.length)
  const tableCount = Object.keys(vm.tables).length

  return useMemo(() => {
    const s = useExperience.getState
    const graphite = (icon: ReactNode) => <Tile tone="graphite">{icon}</Tile>
    const entries: DockEntry[] = [
      {
        kind: "item",
        id: "club",
        label: "Vue d’ensemble",
        detail: content.club.name,
        short: "Club",
        keys: ["R"],
        active: view === "overview" && panel === null,
        tile: (
          <Tile tone="ink" className="[&_svg]:size-[62%]">
            <ClubMark brand={brand} name={content.club.name} className="h-auto w-[62%]" />
          </Tile>
        ),
        onSelect: () => s().resetView(),
      },
      { kind: "separator", id: "sep-zones" },
      ...vm.zones.map<DockEntry>((z) => ({
        kind: "item",
        id: `zone-${z.id}`,
        label: z.name,
        short: z.shortName,
        detail: zonePriceLabel(z),
        active: focusedZoneId === z.id && view !== "overview",
        tile: <ZoneTile tier={z.tier} icon={z.icon} />,
        onSelect: () => s().focusZone(z.id),
      })),
      { kind: "separator", id: "sep-actions" },
      {
        kind: "item",
        id: "list",
        label: "Toutes les tables",
        short: "Tables",
        detail: String(tableCount),
        keys: ["L"],
        active: panel === "list",
        tile: graphite(<Rows3 />),
        onSelect: () => {
          const open = s().panel !== "list"
          s().openPanel(open ? "list" : null)
          if (open) track("list_view_opened", {})
        },
      },
    ]
    if (compareCount > 0) {
      entries.push({
        kind: "item",
        id: "compare",
        label: "Comparatif",
        short: "Comparer",
        detail: compareCount < 2 ? "ajoutez une 2ᵉ table" : `${compareCount} tables`,
        keys: ["C"],
        badge: compareCount,
        active: panel === "compare",
        tile: graphite(<GitCompareArrows className="text-brand" />),
        onSelect: () => s().openPanel(s().panel === "compare" ? null : "compare"),
      })
    }
    if (isDesktop) {
      entries.push({
        kind: "item",
        id: "search",
        label: "Rechercher",
        keys: ["⌘", "K"],
        tile: graphite(<Search />),
        onSelect: () => s().setCommandOpen(true),
      })
      const tail: DockEntry[] = []
      if (content.event.ticketUrl) {
        tail.push({
          kind: "item",
          id: "tickets",
          label: "Billets d’entrée",
          detail: "Shotgun",
          tile: graphite(<Ticket />),
          href: content.event.ticketUrl,
          onSelect: () => track("ticket_link_clicked", { url: content.event.ticketUrl! }),
        })
      }
      if (content.club.contact.whatsapp) {
        tail.push({
          kind: "item",
          id: "whatsapp",
          label: "Écrire au club",
          detail: "WhatsApp",
          tile: graphite(<MessageCircle />),
          href: whatsappUrl(
            content.club.contact.whatsapp,
            contactMessage({ clubName: content.club.name, eventName: content.event.name }),
          ),
          onSelect: () =>
            track("fallback_contact_clicked", { channel: "whatsapp", context: "dock" }),
        })
      }
      if (content.club.contact.instagram) {
        tail.push({
          kind: "item",
          id: "contact",
          label: "Écrire au club",
          detail: "Instagram",
          tile: graphite(<MessageCircle />),
          href: instagramUrl(content.club.contact.instagram),
          onSelect: () =>
            track("fallback_contact_clicked", { channel: "instagram", context: "dock" }),
        })
      }
      if (tail.length) entries.push({ kind: "separator", id: "sep-links" }, ...tail)
    }
    return entries
  }, [vm.zones, content, brand, isDesktop, view, panel, focusedZoneId, compareCount, tableCount])
}

export function Experience({ club }: { club: ClubDefinition }) {
  const { content, layout } = club
  const vm = useMemo(() => buildViewModel(content, layout), [content, layout])
  const { isDesktop, roomy, wide, shortLandscape } = useViewport()
  // the card floats at the side on desktops and on phones held sideways
  const sidePanel = isDesktop || shortLandscape
  const quality = useQuality()
  const webgl = useWebGLSupport()
  const reducedMotion = usePrefersReducedMotion()
  const fallback2d = useExperience((s) => s.fallback2d)
  const listMode = useExperience((s) => s.listMode)
  const setListMode = useExperience((s) => s.setListMode)
  const setFallback2d = useExperience((s) => s.setFallback2d)
  // the list stands in for the 3D when it cannot run or when the buyer prefers it
  const textOnly = fallback2d || listMode
  const panel = useExperience((s) => s.panel)
  const view = useExperience((s) => s.view)
  const selectedTableId = useExperience((s) => s.selectedTableId)
  const closePanel = useExperience((s) => s.closePanel)
  const openPanel = useExperience((s) => s.openPanel)
  const compareCount = useExperience((s) => s.compareIds.length)

  useEffect(() => {
    if (webgl === false) setFallback2d()
  }, [webgl, setFallback2d])

  useEffect(() => {
    if (fallback2d) openPanel("list")
  }, [fallback2d, openPanel])

  useAnalyticsBridge(vm, webgl)
  useShortcuts(isDesktop)
  const dockEntries = useDockEntries(vm, content, club.brand, isDesktop)

  const dateLabel = formatDateFr(content.event.date)
  const eventLine = `${content.event.name} · ${dateLabel} · ${content.event.doors.replace(":", "h")}`
  const table = selectedTableId ? vm.tables[selectedTableId] : null
  const tableIcon = table ? (vm.zones.find((z) => z.id === table.zoneId)?.icon ?? "sofa") : "sofa"
  const panelOpen =
    panel !== null &&
    (panel !== "table" || table !== null) &&
    // on phones the seat view gets the whole screen; the overlay carries the CTA
    !(view === "seat" && !isDesktop)
  const intro = view === "intro"
  const dockHidden = intro || (!isDesktop && (panelOpen || view === "seat"))
  const tableCount = Object.keys(vm.tables).length

  return (
    // interface animations follow the system's "reduce motion" setting
    <MotionConfig reducedMotion="user">
      <TooltipPrimitive.Provider delay={260}>
        <div className="bg-ink text-label relative h-dvh w-full overflow-hidden">
          <main className="absolute inset-0">
            {!textOnly && webgl && quality ? (
              <VenueCanvas
                club={club.slug}
                assets={club.assets}
                ambiance={club.ambiance}
                tiers={club.brand.tiers}
                layout={layout}
                zoneMarkers={vm.zoneMarkers}
                tableMarkers={vm.tableMarkers}
                quality={quality}
                reducedMotion={reducedMotion}
                onIntroSkipped={(atMs) => track("intro_skipped", { at_ms: atMs })}
              />
            ) : null}
            {textOnly ? (
              <div className="text-ui text-label-3 absolute inset-x-0 top-1/3 flex flex-col items-center gap-4 px-8 text-center">
                {fallback2d
                  ? "La visite 3D n’est pas disponible sur cet appareil. Toutes les tables sont listées."
                  : "Visite 3D masquée. Toutes les tables sont listées."}
                {!fallback2d ? (
                  <Btn size="md" onClick={() => setListMode(false)}>
                    <Box /> Revenir à la visite 3D
                  </Btn>
                ) : null}
              </div>
            ) : null}
          </main>

          {/* top bar: identity + context on the left, level and status on the right */}
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 transition-opacity duration-500",
              isDesktop
                ? "p-4"
                : "px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pl-[max(0.75rem,env(safe-area-inset-left))]",
              intro && "opacity-0",
            )}
          >
            <div
              className={cn(
                "pointer-events-auto flex min-w-0",
                sidePanel ? "items-center gap-2.5" : "flex-1 flex-col items-start gap-2",
              )}
            >
              <BrandBar
                content={content}
                brand={club.brand}
                zones={vm.zones}
                table={table}
                dateLabel={dateLabel}
                isDesktop={isDesktop}
                compact={!roomy}
              />
              {/* next to an open card only when there is room for both */}
              {!intro && view !== "seat" && (!panelOpen || roomy) ? (
                <LevelSwitch size={isDesktop ? "md" : "sm"} />
              ) : null}
            </div>
            <div className="pointer-events-auto flex shrink-0 items-center gap-2">
              {isDesktop && !panelOpen && view !== "seat" ? <StatusLegend /> : null}
              {!isDesktop ? (
                <WhatsAppButton
                  club={content.club}
                  eventName={content.event.name}
                  tableLabel={table?.label}
                  context="hud"
                />
              ) : null}
              {!isDesktop ? <SearchButton isDesktop={false} /> : null}
            </div>
          </div>

          <SeatOverlay
            table={table}
            canRequest={!isDesktop && table !== null && table.status !== "sold"}
          />
          <Dock
            entries={dockEntries}
            hidden={dockHidden}
            isDesktop={isDesktop}
            dense={shortLandscape}
          />

          <Panel
            open={panelOpen}
            onClose={closePanel}
            isDesktop={sidePanel}
            compact={shortLandscape}
            label={
              panel === "table" && table
                ? `Table ${table.label}`
                : panel === "compare"
                  ? "Comparatif"
                  : "Toutes les tables"
            }
            title={
              panel === "list" ? (
                <span>
                  Toutes les tables{" "}
                  <span className="num text-label-3 font-normal">{tableCount}</span>
                </span>
              ) : panel === "compare" ? (
                <span>
                  Comparatif <span className="num text-label-3 font-normal">{compareCount}/3</span>
                </span>
              ) : undefined
            }
            aside={
              panel === "list" && !fallback2d ? (
                <Btn size="sm" variant="plain" onClick={() => setListMode(!listMode)}>
                  {listMode ? "Voir en 3D" : "Sans 3D"}
                </Btn>
              ) : undefined
            }
            footer={panel === "table" && table ? <TableFooter table={table} /> : undefined}
          >
            {panel === "list" ? <TableList zones={vm.zones} /> : null}
            {panel === "compare" ? (
              <CompareView
                tables={vm.tables}
                zones={vm.zones}
                accentName={club.brand.accent.name}
              />
            ) : null}
            {panel === "table" && table ? (
              <TableDetails
                table={table}
                siblings={vm.zones.find((z) => z.id === table.zoneId)?.tables ?? [table]}
                icon={tableIcon}
                content={content}
              />
            ) : null}
          </Panel>

          <LoadingScreen name={content.club.name} brand={club.brand} eventLine={eventLine} />
          <IntroSkip isDesktop={isDesktop} />
          <Island />
          <SelectionAnnouncer vm={vm} />

          <RequestDialog
            table={table}
            icon={tableIcon}
            content={content}
            clubSlug={club.slug}
            eventSlug={content.event.slug}
            isDesktop={isDesktop}
            centered={wide}
          />
          <CommandMenu
            content={content}
            brand={club.brand}
            zones={vm.zones}
            tables={vm.tables}
            isDesktop={isDesktop}
          />
        </div>
      </TooltipPrimitive.Provider>
    </MotionConfig>
  )
}
