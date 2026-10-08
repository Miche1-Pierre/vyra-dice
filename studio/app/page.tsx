import { ArrowUpRight, Plus, Sparkles } from "lucide-react"
import Link from "next/link"

import { RepoSync } from "@studio/components/repo-sync"
import { ago, Chip, fileUrl, StateIcon } from "@studio/components/ui"
import { clubState, listClubSlugs } from "@studio/lib/state"

export const dynamic = "force-dynamic"

export default function ClubsPage() {
  const clubs = listClubSlugs().map((slug) => clubState(slug))
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_20%_0%,rgb(191_90_242/0.16),transparent_70%),radial-gradient(40%_35%_at_90%_10%,color-mix(in_srgb,var(--brand)_14%,transparent),transparent_70%)]"
      />
      <div className="relative mx-auto max-w-6xl px-6 pt-14 pb-24">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow text-brand">VYRA Studio · local</p>
            <h1 className="text-display text-label mt-3">Clubs</h1>
            <p className="text-callout text-label-2 mt-2 max-w-xl">
              Des photos, un plan, un brief : l&apos;agent écrit le club, Blender le construit et
              l&apos;éclaire, la démo part en revue puis en ligne.
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <RepoSync />
            <Link
              href="/clubs/new"
              className="brand-pill text-callout inline-flex h-12 items-center gap-2 rounded-full px-6 font-medium transition-[filter,transform] hover:brightness-105 active:scale-[0.98]"
            >
              <Plus className="size-4" /> Nouveau club
            </Link>
          </div>
        </header>

        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((club) => {
            const done = club.steps.filter((s) => s.state === "done").length
            const running = club.steps.find((s) => s.state === "running")
            return (
              <li key={club.slug}>
                <Link
                  href={`/clubs/${club.slug}`}
                  className="glass glass-rim group relative block overflow-hidden rounded-[28px] transition-transform duration-300 hover:-translate-y-0.5"
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-[radial-gradient(80%_80%_at_30%_20%,#2a2232,#0b090e)]">
                    {club.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={fileUrl(club.slug, club.thumbnail)}
                        alt=""
                        className="size-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="text-label-3 grid size-full place-items-center">
                        <Sparkles className="size-6" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
                    {running ? (
                      <Chip tone="brand" className="absolute top-3 left-3 backdrop-blur-md">
                        <StateIcon state="running" className="size-3.5" /> {running.label}
                      </Chip>
                    ) : null}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-headline text-label truncate">{club.name}</p>
                        <p className="text-footnote text-label-3">{club.city || club.slug}</p>
                      </div>
                      <ArrowUpRight className="text-label-3 group-hover:text-label size-5 shrink-0 transition-colors" />
                    </div>
                    <div
                      className="mt-4 flex gap-1"
                      aria-label={`${done} étapes sur ${club.steps.length}`}
                    >
                      {club.steps.map((s) => (
                        <span
                          key={s.id}
                          title={`${s.label} : ${s.state}`}
                          className={
                            s.state === "done"
                              ? "bg-ok h-1 flex-1 rounded-full"
                              : s.state === "running"
                                ? "bg-brand h-1 flex-1 animate-pulse rounded-full"
                                : s.state === "failed"
                                  ? "h-1 flex-1 rounded-full bg-[#ff6961]"
                                  : s.state === "stale"
                                    ? "bg-wait/70 h-1 flex-1 rounded-full"
                                    : s.state === "skipped"
                                      ? "h-1 flex-1 rounded-full bg-white/[0.04]"
                                      : "h-1 flex-1 rounded-full bg-white/[0.1]"
                          }
                        />
                      ))}
                    </div>
                    <p className="text-caption text-label-3 mt-3">
                      {club.next
                        ? `Prochaine étape : ${club.steps.find((s) => s.id === club.next)?.label.toLowerCase()}`
                        : "Complet"}
                      {club.lastRun
                        ? ` · ${ago(club.lastRun.endedAt ?? club.lastRun.createdAt)}`
                        : ""}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </main>
  )
}
