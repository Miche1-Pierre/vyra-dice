"use client"

import { ChevronRight, X } from "lucide-react"

import { Btn, Eyebrow, StatusIcon, ZoneTile } from "@/components/experience/ui"
import type { TableView, ZoneView } from "@/components/experience/view-model"
import { formatEuro } from "@/lib/format"
import { useExperience } from "@/lib/store"
import { cn } from "@/lib/utils"
import { TIERS } from "@/lib/venue/tiers"

/** Every table, grouped by space in inset lists — also the fallback when 3D isn't available. */
export function TableList({ zones }: { zones: ZoneView[] }) {
  const selectTable = useExperience((s) => s.selectTable)
  const focusZone = useExperience((s) => s.focusZone)
  const levelFilter = useExperience((s) => s.levelFilter)
  return (
    <div className="space-y-6 px-4 pt-1 pb-6">
      {zones
        .filter((z) => levelFilter === "all" || z.level === levelFilter)
        .map((z) => (
          <section key={z.id}>
            <button
              type="button"
              onClick={() => focusZone(z.id)}
              className="group mb-2 flex w-full items-center gap-3 rounded-xl px-1 text-left"
            >
              <ZoneTile tier={z.tier} icon={z.icon} className="size-8" />
              <span className="min-w-0 flex-1">
                <span className="text-ui text-label block truncate font-medium group-hover:text-white">
                  {z.name}
                </span>
                <span className="text-caption text-label-3 block">
                  {TIERS[z.tier].label} · {z.level === 0 ? "Rez-de-chaussée" : "Mezzanine"}
                </span>
              </span>
              <span className="num text-footnote text-label-2 shrink-0">
                {z.fromMinimum !== null ? `dès ${formatEuro(z.fromMinimum)}` : "complet"}
              </span>
            </button>
            <ul className="divide-y divide-white/[0.07] overflow-hidden rounded-2xl bg-white/[0.05] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.05)]">
              {z.tables.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => selectTable(t.id)}
                    className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-white/[0.05]"
                  >
                    <StatusIcon status={t.status} />
                    <span className="text-ui text-label w-9 shrink-0 font-semibold">{t.label}</span>
                    <span className="text-footnote text-label-3 min-w-0 flex-1 truncate">
                      {t.view}
                    </span>
                    <span
                      className={cn(
                        "num text-ui shrink-0 text-right",
                        t.status === "sold" ? "text-label-3 line-through" : "text-label",
                      )}
                    >
                      {t.minimumSpend !== null ? formatEuro(t.minimumSpend) : "—"}
                    </span>
                    <ChevronRight className="text-label-3 size-4 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  )
}

const ROWS: { label: string; render: (t: TableView) => React.ReactNode }[] = [
  { label: "Espace", render: (t) => t.zoneName },
  { label: "Niveau", render: (t) => (t.level === 0 ? "RDC" : "Mezzanine") },
  { label: "Personnes", render: (t) => `${t.capacity.min}–${t.capacity.max}` },
  { label: "Minimum", render: (t) => (t.minimumSpend !== null ? formatEuro(t.minimumSpend) : "—") },
  {
    label: "Par pers.",
    render: (t) => (t.perPerson !== null ? `≈ ${formatEuro(t.perPerson)}` : "—"),
  },
]

export function CompareView({
  tables,
  zones,
}: {
  tables: Record<string, TableView>
  zones: ZoneView[]
}) {
  const compareIds = useExperience((s) => s.compareIds)
  const selectTable = useExperience((s) => s.selectTable)
  const toggleCompare = useExperience((s) => s.toggleCompare)
  const rows = compareIds.map((id) => tables[id]).filter(Boolean)
  const best = Math.min(...rows.map((t) => t.perPerson ?? Infinity))
  const iconOf = (t: TableView) => zones.find((z) => z.id === t.zoneId)?.icon ?? "sofa"

  if (rows.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-callout text-label">Rien à comparer pour l’instant</p>
        <p className="text-footnote text-label-3 mt-1.5">
          Ouvrez une table et touchez « Comparer » — jusqu’à trois tables.
        </p>
      </div>
    )
  }
  return (
    <div className="px-4 pb-6">
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}
      >
        {rows.map((t) => (
          <div
            key={t.id}
            className="relative flex flex-col items-center rounded-2xl bg-white/[0.05] px-2 pt-4 pb-3 text-center shadow-[inset_0_0_0_1px_rgb(255_255_255/0.05)]"
          >
            <button
              type="button"
              aria-label={`Retirer la table ${t.label}`}
              onClick={() => toggleCompare(t.id, t.label)}
              className="text-label-3 hover:text-label absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full transition-colors hover:bg-white/[0.08]"
            >
              <X className="size-3.5" />
            </button>
            <ZoneTile tier={t.tier} icon={iconOf(t)} className="size-10" />
            <p className="text-headline text-label mt-2.5">{t.label}</p>
            <p className="text-caption text-label-3 mt-0.5 flex items-center gap-1">
              <StatusIcon status={t.status} className="size-3" />
              {t.status === "available"
                ? "Dispo"
                : t.status === "on_request"
                  ? "Sur demande"
                  : "Complet"}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 divide-y divide-white/[0.07] overflow-hidden rounded-2xl bg-white/[0.05] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.05)]">
        {ROWS.map((row) => (
          <div key={row.label} className="px-4 py-2.5">
            <Eyebrow className="text-[10px]">{row.label}</Eyebrow>
            <div
              className="mt-1 grid gap-2"
              style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}
            >
              {rows.map((t) => (
                <p
                  key={t.id}
                  className={cn(
                    "num text-footnote text-label truncate text-center",
                    row.label === "Par pers." &&
                      t.perPerson === best &&
                      rows.length > 1 &&
                      "text-gold font-semibold",
                  )}
                >
                  {row.render(t)}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div
        className="mt-3 grid gap-2"
        style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}
      >
        {rows.map((t) => (
          <Btn
            key={t.id}
            size="sm"
            disabled={t.status === "sold"}
            onClick={() => selectTable(t.id)}
          >
            Voir {t.label}
          </Btn>
        ))}
      </div>
      {rows.length > 1 ? (
        <p className="text-caption text-label-3 mt-4 text-center">
          Prix par personne à capacité maximale — le meilleur est{" "}
          <span className="text-gold">en or</span>.
        </p>
      ) : null}
    </div>
  )
}
