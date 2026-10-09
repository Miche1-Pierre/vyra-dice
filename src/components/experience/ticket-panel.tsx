"use client"

import { ArrowUpRight, Ticket } from "lucide-react"

import { btn, Eyebrow, Stat, Tile } from "@/components/experience/ui"
import type { TicketView } from "@/components/experience/view-model"
import { track } from "@/lib/analytics/client"
import { formatEuro } from "@/lib/format"
import { cn } from "@/lib/utils"

const levelLabel = (level: 0 | 1) => (level === 0 ? "Rez-de-chaussée" : "Mezzanine")

/** Card of a standing area: where it is, what the ticket gives, its price on the ticketing site. */
export function TicketDetails({ ticket }: { ticket: TicketView }) {
  return (
    <div className="pb-4">
      <header className="relative px-5 pt-5 pb-5">
        <div className="flex items-center gap-3 pr-10">
          <Tile tone="graphite" className="size-11">
            <Ticket />
          </Tile>
          <div className="min-w-0">
            <Eyebrow>Billet · {levelLabel(ticket.level)}</Eyebrow>
            <p className="text-footnote text-label-2 mt-1 truncate">Sans table</p>
          </div>
        </div>
        <h2 className="text-display text-label mt-5">{ticket.name}</h2>
      </header>

      <div className="px-4">
        <Stat value={`dès ${formatEuro(ticket.fromPrice)}`} label="par personne" accent />
      </div>

      <section className="px-5 pt-6">
        <p className="text-callout text-label-2">{ticket.description}</p>
        <p className="text-footnote text-label-3 mt-3">
          Les billets se vendent sur {ticket.site} : cette visite montre seulement où vous serez.
        </p>
      </section>
    </div>
  )
}

/** Way out to the ticketing site, named before the buyer leaves. */
export function TicketFooter({ ticket }: { ticket: TicketView }) {
  return (
    <div>
      <a
        href={ticket.url}
        target="_blank"
        rel="noreferrer"
        onClick={() => track("ticket_link_clicked", { url: ticket.url })}
        className={cn(btn({ variant: "brand", size: "lg" }), "w-full")}
      >
        Acheter sur {ticket.site} <ArrowUpRight aria-hidden />
      </a>
      <p className="text-caption text-label-3 mt-2 text-center">
        S’ouvre sur {ticket.site}, dans un nouvel onglet
      </p>
    </div>
  )
}
