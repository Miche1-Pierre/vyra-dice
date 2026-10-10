"use client"

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Command } from "cmdk"
import { Box, GitCompareArrows, Layers2, MessageCircle, Rows3, Search, Ticket } from "lucide-react"
import type { ReactNode } from "react"

import { ClubMark } from "@/components/experience/brand"
import { Kbd, StatusIcon, Tile, ZoneTile } from "@/components/experience/ui"
import {
  minimumLabel,
  zonePriceLabel,
  type TableView,
  type TicketView,
  type ZoneView,
} from "@/components/experience/view-model"
import { track } from "@/lib/analytics/client"
import { contactMessage, instagramUrl, whatsappUrl } from "@/lib/contact"
import { formatEuro } from "@/lib/format"
import type { ClubBrand } from "@/lib/clubs/brand"
import type { VenueContent } from "@/lib/schema"
import { useExperience } from "@/lib/store"
import { cn } from "@/lib/utils"
import { STATUS, TIERS } from "@/lib/venue/tiers"

function Item({
  value,
  keywords,
  onSelect,
  icon,
  children,
  aside,
}: {
  value: string
  keywords?: string[]
  onSelect: () => void
  icon: ReactNode
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <Command.Item
      value={value}
      keywords={keywords}
      onSelect={onSelect}
      className="text-ui text-label-2 data-[selected=true]:text-label flex h-11 cursor-pointer items-center gap-3 rounded-xl px-2.5 outline-none data-[selected=true]:bg-white/[0.09]"
    >
      <span className="grid size-7 shrink-0 place-items-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {aside ? <span className="num text-footnote text-label-3 shrink-0">{aside}</span> : null}
    </Command.Item>
  )
}

const group =
  "[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-label-3"

function ActionTile({ children }: { children: ReactNode }) {
  return (
    <Tile tone="graphite" className="size-7 rounded-[8px] [&_svg]:size-3.5">
      {children}
    </Tile>
  )
}

/** Spotlight: jump to any table or space, or run a view action. */
export function CommandMenu({
  content,
  brand,
  zones,
  tables,
  tickets = [],
  isDesktop,
}: {
  content: VenueContent
  brand: ClubBrand
  zones: ZoneView[]
  tables: Record<string, TableView>
  tickets?: TicketView[]
  isDesktop: boolean
}) {
  const open = useExperience((s) => s.commandOpen)
  const setOpen = useExperience((s) => s.setCommandOpen)
  const compareCount = useExperience((s) => (brand.ui.compare ? s.compareIds.length : 0))
  const run = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }
  const s = useExperience.getState
  const zoneIcon = (zoneId: string) => zones.find((z) => z.id === zoneId)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-[3px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <DialogPrimitive.Popup
          className={cn(
            "glass-thick glass-rim sober:rounded-[16px] fixed left-1/2 z-[71] w-[min(680px,calc(100vw-1.25rem))] -translate-x-1/2 overflow-hidden rounded-[26px] transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] outline-none data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0",
            isDesktop ? "top-[16vh]" : "top-[max(0.625rem,env(safe-area-inset-top))]",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Rechercher</DialogPrimitive.Title>
          <Command label="Rechercher une table ou un espace" loop className="flex flex-col">
            <div className="flex h-[60px] items-center gap-3 px-5">
              <Search className="text-label-2 size-[22px] shrink-0" strokeWidth={1.75} />
              <Command.Input
                autoFocus
                placeholder="Une table, un espace, une action…"
                className="text-label caret-brand placeholder:text-label-3 h-full flex-1 bg-transparent text-[20px] font-light outline-none"
              />
              {isDesktop ? <Kbd>Esc</Kbd> : null}
            </div>
            <div className="h-px bg-white/[0.08]" />
            <Command.List className="max-h-[min(440px,58dvh)] overflow-y-auto overscroll-contain p-2">
              <Command.Empty className="text-ui text-label-3 px-3 py-10 text-center">
                Aucun résultat.
              </Command.Empty>

              <Command.Group heading="Espaces" className={group}>
                {zones.map((z) => (
                  <Item
                    key={z.id}
                    value={`espace ${z.name}`}
                    keywords={[
                      z.shortName,
                      TIERS[z.tier].label,
                      z.level === 0 ? "rdc rez" : "mezzanine étage",
                    ]}
                    icon={<ZoneTile tier={z.tier} icon={z.icon} className="size-7 rounded-[8px]" />}
                    aside={zonePriceLabel(z)}
                    onSelect={run(() => s().focusZone(z.id))}
                  >
                    <span className="text-label">{z.name}</span>
                    <span className="text-label-3 ml-2">
                      {z.level === 0 ? "Rez-de-chaussée" : "Mezzanine"}
                    </span>
                  </Item>
                ))}
                {tickets.map((t) => (
                  <Item
                    key={`ticket-${t.id}`}
                    value={`billet ${t.name}`}
                    keywords={[t.shortName, "billet", "debout", "entrée", t.site]}
                    icon={
                      <Tile tone="graphite" className="size-7 rounded-[8px]">
                        <Ticket />
                      </Tile>
                    }
                    aside={`dès ${formatEuro(t.fromPrice)}`}
                    onSelect={run(() => s().focusTicket(t.id))}
                  >
                    <span className="text-label">{t.name}</span>
                    <span className="text-label-3 ml-2">Billet</span>
                  </Item>
                ))}
              </Command.Group>

              <Command.Group heading="Tables" className={group}>
                {Object.values(tables).map((t) => {
                  const zone = zoneIcon(t.zoneId)
                  return (
                    <Item
                      key={t.id}
                      value={`table ${t.label} ${t.zoneName}`}
                      keywords={[
                        t.label.toLowerCase(),
                        STATUS[t.status].label,
                        String(t.minimumSpend ?? ""),
                      ]}
                      icon={
                        <span className="grid size-7 place-items-center rounded-[8px] bg-white/[0.07]">
                          <StatusIcon status={t.status} />
                        </span>
                      }
                      aside={`${t.capacity.min}–${t.capacity.max} p. · ${minimumLabel(t.minimumSpend)}`}
                      onSelect={run(() => s().selectTable(t.id))}
                    >
                      <span className="text-label font-medium">{t.label}</span>
                      <span className="text-label-3 ml-2">{zone?.name ?? t.zoneName}</span>
                    </Item>
                  )
                })}
              </Command.Group>

              <Command.Group heading="Actions" className={group}>
                <Item
                  value="vue d'ensemble club"
                  icon={
                    <Tile tone="ink" className="size-7 rounded-[8px] [&_svg]:size-4">
                      <ClubMark brand={brand} name={content.club.name} className="h-2.5" />
                    </Tile>
                  }
                  aside={isDesktop ? "R" : undefined}
                  onSelect={run(() => s().resetView())}
                >
                  Vue d’ensemble du club
                </Item>
                <Item
                  value="toutes les tables liste"
                  icon={
                    <ActionTile>
                      <Rows3 />
                    </ActionTile>
                  }
                  aside={isDesktop ? "L" : undefined}
                  onSelect={run(() => {
                    s().openPanel("list")
                    track("list_view_opened", {})
                  })}
                >
                  Toutes les tables
                </Item>
                {compareCount >= 1 ? (
                  <Item
                    value="comparer comparatif"
                    icon={
                      <ActionTile>
                        <GitCompareArrows />
                      </ActionTile>
                    }
                    onSelect={run(() => s().openPanel("compare"))}
                  >
                    Comparatif ({compareCount})
                  </Item>
                ) : null}
                <Item
                  value="afficher tout le club niveaux"
                  icon={
                    <ActionTile>
                      <Box />
                    </ActionTile>
                  }
                  aside={isDesktop ? "1" : undefined}
                  onSelect={run(() => s().setLevelFilter("all"))}
                >
                  Afficher tout le club
                </Item>
                <Item
                  value="rez-de-chaussée rdc"
                  icon={
                    <ActionTile>
                      <Layers2 />
                    </ActionTile>
                  }
                  aside={isDesktop ? "2" : undefined}
                  onSelect={run(() => s().setLevelFilter(0))}
                >
                  Afficher le rez-de-chaussée
                </Item>
                <Item
                  value="mezzanine étage"
                  icon={
                    <ActionTile>
                      <Layers2 className="rotate-180" />
                    </ActionTile>
                  }
                  aside={isDesktop ? "3" : undefined}
                  onSelect={run(() => s().setLevelFilter(1))}
                >
                  Afficher la mezzanine
                </Item>
                {content.event.ticketUrl ? (
                  <Item
                    value="billets entrée shotgun"
                    icon={
                      <ActionTile>
                        <Ticket />
                      </ActionTile>
                    }
                    onSelect={run(() => {
                      track("ticket_link_clicked", { url: content.event.ticketUrl! })
                      window.open(content.event.ticketUrl, "_blank", "noreferrer")
                    })}
                  >
                    Billets d’entrée
                  </Item>
                ) : null}
                {content.club.contact.whatsapp ? (
                  <Item
                    value="contacter le club whatsapp"
                    icon={
                      <ActionTile>
                        <MessageCircle />
                      </ActionTile>
                    }
                    onSelect={run(() => {
                      track("fallback_contact_clicked", {
                        channel: "whatsapp",
                        context: "command_menu",
                      })
                      window.open(
                        whatsappUrl(
                          content.club.contact.whatsapp!,
                          contactMessage({
                            clubName: content.club.name,
                            eventName: content.event.name,
                          }),
                        ),
                        "_blank",
                        "noreferrer",
                      )
                    })}
                  >
                    Écrire au club sur WhatsApp
                  </Item>
                ) : null}
                {content.club.contact.instagram ? (
                  <Item
                    value="contacter le club instagram"
                    icon={
                      <ActionTile>
                        <MessageCircle />
                      </ActionTile>
                    }
                    onSelect={run(() => {
                      track("fallback_contact_clicked", {
                        channel: "instagram",
                        context: "command_menu",
                      })
                      window.open(
                        instagramUrl(content.club.contact.instagram!),
                        "_blank",
                        "noreferrer",
                      )
                    })}
                  >
                    Écrire au club sur Instagram
                  </Item>
                ) : null}
              </Command.Group>
            </Command.List>
            {isDesktop ? (
              <div className="text-caption text-label-3 flex h-10 items-center gap-4 border-t border-white/[0.07] px-5">
                <span className="flex items-center gap-1.5">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd> naviguer
                </span>
                <span className="flex items-center gap-1.5">
                  <Kbd>↵</Kbd> ouvrir
                </span>
                <span className="eyebrow ml-auto text-[10px]">{content.club.name}</span>
              </div>
            ) : null}
          </Command>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
