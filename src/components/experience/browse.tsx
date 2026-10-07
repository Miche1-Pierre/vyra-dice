"use client"

import { GitCompareArrows, X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import type { TableView, ZoneView } from "@/components/experience/view-model"
import { Button } from "@/components/ui/button"
import { track } from "@/lib/analytics/client"
import { formatCapacity, formatEuro } from "@/lib/format"
import { useExperience } from "@/lib/store"
import { cn } from "@/lib/utils"
import { STATUS, TIERS } from "@/lib/venue/tiers"

/** Horizontal zone chips (mobile) — the quickest way to jump around the club. */
export function ZoneDock({ zones }: { zones: ZoneView[] }) {
  const view = useExperience((s) => s.view)
  const panel = useExperience((s) => s.panel)
  const focusedZoneId = useExperience((s) => s.focusedZoneId)
  const levelFilter = useExperience((s) => s.levelFilter)
  const focusZone = useExperience((s) => s.focusZone)
  const hidden = view === "intro" || view === "seat" || panel !== null
  const visible = zones.filter((z) => levelFilter === "all" || z.level === levelFilter)
  return (
    <AnimatePresence>
      {!hidden ? (
        <motion.nav
          key="dock"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          aria-label="Espaces du club"
          className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/80 to-transparent pt-10 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <ul className="flex snap-x [scrollbar-width:none] gap-2 overflow-x-auto px-4">
            {visible.map((z) => (
              <li key={z.id} className="snap-start">
                <button
                  type="button"
                  onClick={() => focusZone(z.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 whitespace-nowrap backdrop-blur-md transition",
                    focusedZoneId === z.id
                      ? "border-white bg-white text-black"
                      : "border-white/15 bg-black/60 text-white",
                  )}
                >
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: TIERS[z.tier].color }}
                  />
                  <span className="text-[13px] font-medium">{z.name}</span>
                  <span
                    className={cn(
                      "text-xs",
                      focusedZoneId === z.id ? "text-black/60" : "text-white/55",
                    )}
                  >
                    {z.fromMinimum !== null ? `dès ${formatEuro(z.fromMinimum)}` : "complet"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </motion.nav>
      ) : null}
    </AnimatePresence>
  )
}

/** Floating "compare" pill, visible once at least one table is in the comparison. */
export function CompareTray() {
  const compareIds = useExperience((s) => s.compareIds)
  const panel = useExperience((s) => s.panel)
  const openPanel = useExperience((s) => s.openPanel)
  const clearCompare = useExperience((s) => s.clearCompare)
  const show =
    compareIds.length > 0 && panel !== "compare" && panel !== "request" && panel !== "ack"
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="tray"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="absolute top-[max(4.25rem,calc(env(safe-area-inset-top)+3.25rem))] left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-black/75 p-1 pl-3 text-sm text-white backdrop-blur-md lg:top-20"
        >
          <GitCompareArrows className="size-4 text-white/70" />
          <span className="px-1">
            {compareIds.length} table{compareIds.length > 1 ? "s" : ""}
          </span>
          <button
            type="button"
            disabled={compareIds.length < 2}
            onClick={() => {
              openPanel("compare")
              track("tables_compared", { table_ids: compareIds })
            }}
            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-black disabled:opacity-40"
          >
            Comparer
          </button>
          <button
            type="button"
            onClick={clearCompare}
            aria-label="Vider le comparatif"
            className="grid size-7 place-items-center rounded-full text-white/60 hover:text-white"
          >
            <X className="size-3.5" />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export function CompareView({ tables }: { tables: Record<string, TableView> }) {
  const compareIds = useExperience((s) => s.compareIds)
  const selectTable = useExperience((s) => s.selectTable)
  const toggleCompare = useExperience((s) => s.toggleCompare)
  const rows = compareIds.map((id) => tables[id]).filter(Boolean)
  const best = Math.min(...rows.map((t) => t.perPerson ?? Infinity))
  return (
    <div className="space-y-4 px-5 pt-1 pb-5 lg:pt-6">
      <h2 className="font-heading pr-10 text-xl font-bold text-white">Comparer les tables</h2>
      <div className={cn("grid gap-2", rows.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {rows.map((t) => (
          <article
            key={t.id}
            className="flex flex-col rounded-xl border border-white/10 bg-white/[0.03] p-3"
          >
            <div className="flex items-start justify-between gap-1">
              <p className="font-heading text-lg font-bold text-white">{t.label}</p>
              <button
                type="button"
                onClick={() => toggleCompare(t.id)}
                aria-label={`Retirer ${t.label}`}
                className="text-white/40 hover:text-white"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <p className="flex items-center gap-1.5 text-[11px] text-white/55">
              <span className="size-1.5 rounded-full" style={{ background: TIERS[t.tier].color }} />
              {t.zoneName}
            </p>
            <dl className="mt-3 space-y-2 text-[13px]">
              <div>
                <dt className="text-[10px] tracking-wider text-white/40 uppercase">Capacité</dt>
                <dd className="text-white">{formatCapacity(t.capacity)}</dd>
              </div>
              <div>
                <dt className="text-[10px] tracking-wider text-white/40 uppercase">Minimum</dt>
                <dd className="text-white">
                  {t.minimumSpend !== null ? formatEuro(t.minimumSpend) : "Sur demande"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] tracking-wider text-white/40 uppercase">Par pers.</dt>
                <dd
                  className={cn(
                    "text-white",
                    t.perPerson === best && rows.length > 1 && "font-semibold text-emerald-300",
                  )}
                >
                  {t.perPerson !== null ? `≈ ${formatEuro(t.perPerson)}` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] tracking-wider text-white/40 uppercase">Statut</dt>
                <dd className="flex items-center gap-1.5 text-white">
                  <span
                    className="size-1.5 rounded-full"
                    style={{ background: STATUS[t.status].color }}
                  />
                  {STATUS[t.status].label}
                </dd>
              </div>
            </dl>
            <p className="mt-3 line-clamp-3 text-[12px] text-white/60">{t.view}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-auto w-full rounded-lg pt-0"
              onClick={() => selectTable(t.id)}
              disabled={t.status === "sold"}
            >
              Choisir
            </Button>
          </article>
        ))}
      </div>
    </div>
  )
}

/** Accessible list of every table, grouped by space. Also the fallback when 3D isn't available. */
export function TableList({ zones }: { zones: ZoneView[] }) {
  const selectTable = useExperience((s) => s.selectTable)
  const levelFilter = useExperience((s) => s.levelFilter)
  return (
    <div className="space-y-6 px-5 pt-1 pb-6 lg:pt-6">
      <h2 className="font-heading pr-10 text-xl font-bold text-white">Toutes les tables</h2>
      {zones
        .filter((z) => levelFilter === "all" || z.level === levelFilter)
        .map((z) => (
          <section key={z.id}>
            <header className="flex items-baseline justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: TIERS[z.tier].color }}
                />
                {z.name}
              </h3>
              <span className="text-[11px] text-white/45">
                {TIERS[z.tier].label} · {z.level === 0 ? "RDC" : "Mezzanine"}
              </span>
            </header>
            <p className="mt-1 text-[12px] text-white/55">{z.description}</p>
            <ul className="mt-2 divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.08]">
              {z.tables.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => selectTable(t.id)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.04]"
                  >
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-black"
                      style={{
                        background: TIERS[t.tier].color,
                        opacity: t.status === "sold" ? 0.45 : 1,
                      }}
                    >
                      {t.label}
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-white">
                      {formatCapacity(t.capacity)}
                      <span className="block truncate text-[11px] text-white/50">{t.view}</span>
                    </span>
                    <span className="text-right text-sm">
                      <span className="block text-white">
                        {t.minimumSpend !== null ? formatEuro(t.minimumSpend) : "Sur demande"}
                      </span>
                      <span className="flex items-center justify-end gap-1 text-[11px] text-white/55">
                        <span
                          className="size-1.5 rounded-full"
                          style={{ background: STATUS[t.status].color }}
                        />
                        {STATUS[t.status].label}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  )
}
