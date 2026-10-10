import { ArrowRight } from "lucide-react"
import Link from "next/link"
import type { CSSProperties } from "react"

import { Tagline, Wordmark } from "@/components/experience/brand"
import { brandVars } from "@/lib/clubs/brand"
import { isDraft, listClubs } from "@/lib/clubs/registry"

export default function Home() {
  const demos = listClubs().filter((club) => club.content.club.demo)
  return (
    <main className="bg-ink relative grid min-h-dvh place-items-center overflow-hidden px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_0%,rgb(191_90_242/0.2),transparent_70%),radial-gradient(40%_40%_at_88%_88%,rgb(255_61_154/0.14),transparent_70%),radial-gradient(35%_35%_at_8%_82%,rgb(58_155_255/0.12),transparent_70%)]"
      />
      <div className="relative w-full max-w-3xl text-center">
        <p className="eyebrow text-brand">VYRA · visites 3D de clubs</p>
        <h1 className="text-label mt-6 text-[42px] leading-[1.04] font-medium tracking-[-0.03em] sm:text-[64px]">
          Faites visiter le club avant de vendre la table.
        </h1>
        <p className="text-callout text-label-2 mx-auto mt-6 max-w-xl sm:text-[18px] sm:leading-7">
          Vos clients explorent la salle en 3D sur leur téléphone, comparent les tables, leur vue et
          leur prix, puis envoient une demande à votre équipe — qui confirme et encaisse comme
          d’habitude.
        </p>
        {/* one block per demo club of the registry, in its own colours */}
        <ul className="mt-12 grid gap-4 text-left sm:grid-cols-2">
          {demos.map(({ slug, content, brand }) => (
            <li
              key={slug}
              style={brandVars(brand) as CSSProperties}
              className="glass glass-rim relative flex flex-col gap-6 rounded-[28px] p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="text-label flex min-h-10 flex-col items-start justify-center gap-2">
                  <Wordmark
                    name={content.club.name}
                    wordmark={brand.wordmark}
                    foil
                    className="h-6"
                  />
                  <Tagline text={brand.tagline} className="text-label-3" />
                </div>
                <span className="eyebrow text-brand shrink-0 rounded-full px-2 py-[3px] text-[9px] leading-3 tracking-[0.22em] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--brand)_40%,transparent)]">
                  Démo{isDraft(slug) ? " · brouillon" : ""}
                </span>
              </div>
              <div>
                <h2 className="text-headline text-label">{content.club.name}</h2>
                <p className="text-footnote text-label-2 mt-1">
                  {content.event.subtitle
                    ? content.club.city
                    : `${content.club.city} · ${content.event.name}`}
                </p>
              </div>
              {/* a billed night (DJ, artist): its name in large capitals, like its poster */}
              {content.event.subtitle ? (
                <div>
                  <p className="text-label text-[30px] leading-none font-semibold tracking-[0.06em] uppercase">
                    {content.event.name}
                  </p>
                  <p className="eyebrow text-brand mt-2">{content.event.subtitle}</p>
                </div>
              ) : null}
              <Link
                href={`/${slug}/${content.event.slug}`}
                className="brand-pill text-callout mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 font-medium transition-[filter,transform] hover:brightness-105 active:scale-[0.98]"
              >
                Voir la démo<span className="sr-only"> — {content.club.name}</span>
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-caption text-label-3 mt-5">
          Démo de prospection : plan, tables et prix provisoires.
        </p>
      </div>
    </main>
  )
}
