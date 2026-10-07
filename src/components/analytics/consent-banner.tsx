"use client"

import { useId } from "react"

import { setConsent } from "@/lib/analytics/client"

const TITLE = "Mesure d'audience"
const BODY =
  "Nous mesurons l'usage de cette démo (pages vues, tables consultées, replays de navigation anonymisés) pour l'améliorer. Aucune donnée de contact n'est utilisée."

const choice =
  "h-10 flex-1 rounded-full bg-white/[0.1] text-ui font-medium text-label shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] transition-colors hover:bg-white/[0.16] focus-visible:ring-2 focus-visible:ring-gold/70 focus-visible:outline-none"

/** Analytics consent card, bottom left. Refusing is as easy and as visible as accepting. */
export function ConsentBanner() {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className="glass-thick glass-rim text-label fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-[95] w-[calc(100%-2rem)] max-w-sm rounded-[26px] p-5"
    >
      <h2 id={titleId} className="text-headline">
        {TITLE}
      </h2>
      <p className="text-footnote text-label-2 mt-1.5">{BODY}</p>
      <div className="mt-4 flex gap-2">
        <button type="button" className={choice} onClick={() => setConsent(false)}>
          Refuser
        </button>
        <button type="button" className={choice} onClick={() => setConsent(true)}>
          Accepter
        </button>
      </div>
    </section>
  )
}
