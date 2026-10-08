import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { isDraft, listClubs } from "@/lib/clubs/registry"

export default function Home() {
  const demos = listClubs().filter((club) => club.content.club.demo)
  return (
    <main className="bg-ink relative grid min-h-dvh place-items-center overflow-hidden px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_0%,rgb(191_90_242/0.2),transparent_70%),radial-gradient(40%_40%_at_88%_88%,rgb(255_61_154/0.14),transparent_70%),radial-gradient(35%_35%_at_8%_82%,rgb(58_155_255/0.12),transparent_70%)]"
      />
      <div className="relative max-w-2xl text-center">
        <p className="eyebrow text-brand">VYRA · visites 3D de clubs</p>
        <h1 className="text-label mt-6 text-[42px] leading-[1.04] font-medium tracking-[-0.03em] sm:text-[64px]">
          Faites visiter le club avant de vendre la table.
        </h1>
        <p className="text-callout text-label-2 mx-auto mt-6 max-w-xl sm:text-[18px] sm:leading-7">
          Vos clients explorent la salle en 3D sur leur téléphone, comparent les tables, leur vue et
          leur prix, puis envoient une demande à votre équipe — qui confirme et encaisse comme
          d’habitude.
        </p>
        <div className="mt-10 flex flex-col items-center gap-3">
          {demos.map(({ slug, content }) => (
            <Link
              key={slug}
              href={`/${slug}/${content.event.slug}`}
              className="brand-pill text-callout inline-flex h-12 items-center gap-2 rounded-full px-7 font-medium transition-[filter,transform] hover:brightness-105 active:scale-[0.98]"
            >
              Voir la démo — {content.club.name}
              {isDraft(slug) ? " (brouillon)" : ""} <ArrowRight className="size-4" />
            </Link>
          ))}
          <p className="text-caption text-label-3">
            Démo de prospection : plan, tables et prix provisoires.
          </p>
        </div>
      </div>
    </main>
  )
}
