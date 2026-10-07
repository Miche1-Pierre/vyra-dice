"use client"

import { useId } from "react"

import { Button } from "@/components/ui/button"
import { setConsent } from "@/lib/analytics/client"

const TITLE = "Mesure d'audience"
const BODY =
  "Nous mesurons l'usage de cette démo (pages vues, tables consultées, replays de navigation anonymisés) pour l'améliorer. Aucune donnée de contact n'est utilisée."

/** Analytics consent card, bottom left. Refusing is as easy and as visible as accepting. */
export function ConsentBanner() {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className="bg-background/90 text-foreground fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-xl border p-4 shadow-lg backdrop-blur"
    >
      <h2 id={titleId} className="text-sm font-medium">
        {TITLE}
      </h2>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{BODY}</p>
      <div className="mt-3 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => setConsent(false)}>
          Refuser
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => setConsent(true)}>
          Accepter
        </Button>
      </div>
    </section>
  )
}
