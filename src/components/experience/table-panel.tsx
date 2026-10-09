"use client"

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { zodResolver } from "@hookform/resolvers/zod"
import { Check, ChevronDown, Copy, GitCompareArrows, LoaderCircle, ScanEye, X } from "lucide-react"
import { motion } from "motion/react"
import { useMemo, useRef, useState, type ReactNode } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import type { z } from "zod"

import { submitBookingRequest } from "@/app/[club]/[event]/actions"
import { FallbackContact } from "@/components/experience/hud"
import {
  Btn,
  Eyebrow,
  IconBtn,
  Kbd,
  Stat,
  StatusIcon,
  Stepper,
  SwitchTrack,
  ZoneTile,
} from "@/components/experience/ui"
import { depositLabel, supplementLabel, type TableView } from "@/components/experience/view-model"
import { getAttribution, track } from "@/lib/analytics/client"
import { formatCapacity, formatEuro } from "@/lib/format"
import {
  arrivalTimes,
  bookingRequestInputSchema,
  type VenueContent,
  type ZoneIcon,
} from "@/lib/schema"
import { useExperience } from "@/lib/store"
import { cn } from "@/lib/utils"
import { defaultGuests, quoteFor } from "@/lib/venue/offers"
import { STATUS, TIERS, tierColor, withAlpha } from "@/lib/venue/tiers"

const levelLabel = (level: 0 | 1) => (level === 0 ? "Rez-de-chaussée" : "Mezzanine")

/** Group size within the table's capacity. */
function clampGuests(guests: number, { min, max }: TableView["capacity"]): number {
  return Math.min(max, Math.max(min, guests))
}

/** Group size of the selected table: chosen by the buyer, or the one proposed first. */
function useGuests(table: TableView): number {
  const guests = useExperience((s) => s.guests)
  return clampGuests(guests ?? defaultGuests(table), table.capacity)
}

export function StatusChip({
  status,
  className,
}: {
  status: TableView["status"]
  className?: string
}) {
  const { color, label } = STATUS[status]
  return (
    <span
      className={cn(
        "text-caption inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 font-medium",
        className,
      )}
      style={{ color, background: `${color}1f`, boxShadow: `inset 0 0 0 1px ${color}33` }}
    >
      <StatusIcon status={status} className="size-3" />
      {label}
    </span>
  )
}

export function TableDetails({
  table,
  siblings,
  icon,
  content,
}: {
  table: TableView
  /** Every table of the same space, this one included. */
  siblings: TableView[]
  icon: ZoneIcon
  content: VenueContent
}) {
  const selectTable = useExperience((s) => s.selectTable)
  const hoverTable = useExperience((s) => s.hoverTable)
  const view = useExperience((s) => s.view)
  const compareIds = useExperience((s) => s.compareIds)
  const viewFromSeat = useExperience((s) => s.viewFromSeat)
  const leaveSeat = useExperience((s) => s.leaveSeat)
  const toggleCompare = useExperience((s) => s.toggleCompare)
  const setGuests = useExperience((s) => s.setGuests)
  const guests = useGuests(table)
  const quote = quoteFor(table, guests)
  const supplement = supplementLabel(table)
  const deposit = depositLabel(table, quote)
  const inCompare = compareIds.includes(table.id)
  const tier = TIERS[table.tier]
  const tint = tierColor(table.tier)

  return (
    <div className="pb-4">
      <header
        className="relative px-5 pt-5 pb-5"
        style={{
          background: `radial-gradient(130% 100% at 0% 0%, ${withAlpha(tint, 0x3d / 255)} 0%, ${withAlpha(tint, 0x0f / 255)} 45%, transparent 75%)`,
        }}
      >
        <div className="flex items-center gap-3 pr-10">
          <ZoneTile tier={table.tier} icon={icon} className="size-11" />
          <div className="min-w-0">
            <Eyebrow style={{ color: tint }}>
              {tier.label} · {levelLabel(table.level)}
            </Eyebrow>
            <p className="text-footnote text-label-2 mt-1 truncate">{table.zoneName}</p>
          </div>
        </div>
        <motion.h2
          key={table.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="text-display text-label mt-5"
        >
          Table {table.label}
        </motion.h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusChip status={table.status} />
          {inCompare ? (
            <span className="text-caption text-brand inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 font-medium shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--brand)_40%,transparent)]">
              <GitCompareArrows className="size-3" /> Dans le comparatif
            </span>
          ) : null}
        </div>
      </header>

      <div className="px-4">
        <div className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-white/[0.045] py-2 pr-2 pl-4 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.05)]">
          <div>
            <p className="text-ui text-label">Personnes</p>
            <p className="text-caption text-label-3">{formatCapacity(table.capacity)}</p>
          </div>
          {table.capacity.min === table.capacity.max ? (
            <p className="num text-ui text-label pr-2 font-medium">{guests}</p>
          ) : (
            <Stepper
              label="Nombre de personnes"
              value={guests}
              min={table.capacity.min}
              max={table.capacity.max}
              onChange={setGuests}
            />
          )}
        </div>
        <div
          className={cn("mt-2 grid gap-2", quote.deposit !== null ? "grid-cols-3" : "grid-cols-2")}
        >
          <Stat
            value={
              quote.minimumSpend !== null ? (
                formatEuro(quote.minimumSpend)
              ) : (
                <span className="text-[15px]">Sur demande</span>
              )
            }
            label={quote.minimumSpend !== null ? `minimum pour ${guests}` : "prix"}
            accent
          />
          <Stat
            value={quote.perPerson !== null ? `≈ ${formatEuro(quote.perPerson)}` : "—"}
            label="par personne"
          />
          {quote.deposit !== null ? (
            <Stat value={formatEuro(quote.deposit)} label="acompte" />
          ) : null}
        </div>
        {supplement || deposit ? (
          <div className="text-footnote text-label-2 mt-3 space-y-1 px-1">
            {supplement ? <p>{supplement}</p> : null}
            {deposit ? <p>{deposit}</p> : null}
          </div>
        ) : null}
      </div>

      {siblings.length > 1 ? (
        <section className="px-5 pt-6">
          <Eyebrow>Dans cet espace</Eyebrow>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {siblings.map((t) => {
              const current = t.id === table.id
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-current={current || undefined}
                  aria-label={`Table ${t.label}, ${STATUS[t.status].label}`}
                  onClick={() => selectTable(t.id)}
                  onPointerEnter={() => hoverTable(t.id)}
                  onPointerLeave={() => hoverTable(null)}
                  onFocus={() => hoverTable(t.id)}
                  onBlur={() => hoverTable(null)}
                  className={cn(
                    "text-footnote focus-visible:ring-brand/70 inline-flex h-8 items-center gap-1.5 rounded-full px-3 font-medium transition-colors outline-none focus-visible:ring-2",
                    current
                      ? "text-label bg-white/[0.16] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.18)]"
                      : "text-label-2 hover:text-label bg-white/[0.06] hover:bg-white/[0.1]",
                  )}
                >
                  <StatusIcon status={t.status} className="size-3" />
                  {t.label}
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      <section className="px-5 pt-6">
        <Eyebrow>La vue</Eyebrow>
        <p className="text-callout text-label-2 mt-2">{table.view}</p>
      </section>

      {table.perks.length ? (
        <section className="px-5 pt-6">
          <Eyebrow>Inclus</Eyebrow>
          <ul className="mt-2.5 space-y-2">
            {table.perks.map((p) => (
              <li key={p} className="text-ui text-label flex items-start gap-2.5">
                <span className="bg-brand/15 text-brand mt-[3px] grid size-4 shrink-0 place-items-center rounded-full">
                  <Check className="size-2.5" strokeWidth={3} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="group mx-4 mt-6 rounded-2xl bg-white/[0.04] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.05)]">
        <summary className="text-footnote text-label-2 hover:text-label flex h-11 cursor-pointer list-none items-center justify-between px-4 font-medium transition-colors">
          Conditions de la soirée
          <ChevronDown className="text-label-3 size-4 transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <ul className="space-y-2 px-4 pb-4">
          {content.conditions.map((c) => (
            <li key={c} className="text-footnote text-label-2">
              {c}
            </li>
          ))}
        </ul>
      </details>

      <div className="grid grid-cols-2 gap-2 px-4 pt-3">
        <Btn
          size="md"
          onClick={() => {
            if (view === "seat") leaveSeat()
            else {
              viewFromSeat()
              track("table_view_from_seat", { table_id: table.id })
            }
          }}
        >
          <ScanEye /> {view === "seat" ? "Vue d’ensemble" : "Vue de la table"}
        </Btn>
        <Btn
          size="md"
          onClick={() => toggleCompare(table.id, table.label)}
          className={cn(
            inCompare &&
              "text-brand shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--brand)_45%,transparent)]",
          )}
        >
          <GitCompareArrows /> {inCompare ? "Comparée" : "Comparer"}
        </Btn>
      </div>
    </div>
  )
}

export function TableFooter({ table }: { table: TableView }) {
  const openDialog = useExperience((s) => s.openDialog)
  const sold = table.status === "sold"
  return (
    <div>
      <Btn
        variant="brand"
        size="lg"
        className="w-full"
        disabled={sold}
        onClick={() => openDialog("request")}
      >
        {sold ? "Table complète" : "Demander cette table"}
        {!sold ? (
          <Kbd className="hidden bg-black/10 text-black/55 shadow-none lg:inline-flex">↵</Kbd>
        ) : null}
      </Btn>
      <p className="text-caption text-label-3 mt-2 text-center">
        Sans paiement · le club confirme puis vous recontacte
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------------------------------ */

type FormInput = z.input<typeof bookingRequestInputSchema>
type FormOutput = z.output<typeof bookingRequestInputSchema>

const ERROR_COPY: Record<string, string> = {
  rate_limited:
    "Trop de demandes en peu de temps. Réessayez dans quelques minutes ou écrivez au club.",
  unknown_table: "Cette table n’existe plus. Choisissez-en une autre.",
  unavailable: "Cette table n’est plus proposée. Choisissez-en une autre ou écrivez au club.",
  validation: "Vérifiez les champs signalés.",
  server: "La demande n’a pas pu être envoyée. Réessayez ou écrivez directement au club.",
  network: "Connexion impossible. Vérifiez votre réseau ou écrivez directement au club.",
}

/** Inset grouped list, iOS Settings style. */
function Group({
  title,
  children,
  footer,
}: {
  title?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <section>
      {title ? <Eyebrow className="mb-2 px-1">{title}</Eyebrow> : null}
      <div className="divide-y divide-white/[0.07] overflow-hidden rounded-2xl bg-white/[0.05] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.05)]">
        {children}
      </div>
      {footer ? <div className="mt-1.5 px-1">{footer}</div> : null}
    </section>
  )
}

function Row({
  id,
  label,
  error,
  children,
  stacked,
}: {
  id?: string
  label: string
  error?: string
  children: ReactNode
  stacked?: boolean
}) {
  return (
    <div className="transition-colors focus-within:bg-white/[0.035]">
      <div
        className={cn(
          "flex min-h-12 px-4",
          stacked ? "flex-col justify-center gap-2 py-3" : "items-center gap-3",
        )}
      >
        <label
          htmlFor={id}
          className={cn("text-ui text-label-2 shrink-0", !stacked && "w-[104px]")}
        >
          {label}
        </label>
        <div className={cn("min-w-0", stacked ? "w-full" : "flex flex-1 justify-end")}>
          {children}
        </div>
      </div>
      {error ? <p className="text-caption -mt-1 px-4 pb-2.5 text-[#ff6961]">{error}</p> : null}
    </div>
  )
}

const input =
  "h-12 w-full bg-transparent text-right text-ui text-label caret-brand outline-none placeholder:text-label-3 aria-invalid:text-[#ff6961]"

function RequestForm({
  table,
  icon,
  content,
  clubSlug,
  eventSlug,
  isDesktop,
}: {
  table: TableView
  icon: ZoneIcon
  content: VenueContent
  clubSlug: string
  eventSlug: string
  isDesktop: boolean
}) {
  const requestSent = useExperience((s) => s.requestSent)
  const setGuests = useExperience((s) => s.setGuests)
  const guests = useGuests(table)
  const [serverError, setServerError] = useState<string | null>(null)
  const started = useRef(false)
  // one key per form instance: retries of the same request never create duplicates
  const idempotencyKey = useMemo(() => crypto.randomUUID(), [])

  const { register, control, handleSubmit, formState, setError } = useForm<
    FormInput,
    unknown,
    FormOutput
  >({
    resolver: zodResolver(bookingRequestInputSchema),
    mode: "onTouched",
    defaultValues: {
      clubSlug,
      eventSlug,
      tableId: table.id,
      fullName: "",
      phone: "",
      email: "",
      partySize: guests,
      arrivalTime: arrivalTimes[0],
      message: "",
      idempotencyKey,
      attribution: getAttribution(),
    },
  })
  const errors = formState.errors
  const partySize = Number(useWatch({ control, name: "partySize" }))
  const quote = quoteFor(table, clampGuests(partySize, table.capacity))
  const deposit = depositLabel(table, quote)

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      const res = await submitBookingRequest(values)
      if (res.ok) {
        track("request_submitted", {
          request_id: res.requestId,
          table_id: table.id,
          party_size: values.partySize,
          demo: res.demo,
        })
        requestSent({ requestId: res.requestId, tableId: table.id, demo: res.demo })
        return
      }
      for (const [name, message] of Object.entries(res.fieldErrors ?? {})) {
        setError(name as keyof FormInput, { message })
      }
      setServerError(ERROR_COPY[res.error] ?? ERROR_COPY.server)
      track("request_failed", { table_id: table.id, reason: res.error })
    } catch {
      setServerError(ERROR_COPY.network)
      track("request_failed", { table_id: table.id, reason: "network" })
    }
  })

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      onFocus={() => {
        if (started.current) return
        started.current = true
        track("request_started", { table_id: table.id })
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          void onSubmit()
        }
      }}
      className="flex max-h-[inherit] min-h-0 flex-col"
    >
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 pr-3 pl-5 max-lg:pt-2">
        <DialogPrimitive.Title className="text-headline text-label">
          Demande de table
        </DialogPrimitive.Title>
        <DialogPrimitive.Close
          render={
            <IconBtn
              label="Fermer"
              keys={isDesktop ? ["Esc"] : undefined}
              className="text-label-2 bg-white/[0.08]"
            />
          }
        >
          <X />
        </DialogPrimitive.Close>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 pb-5">
        <div className="flex items-center gap-3.5 rounded-2xl bg-white/[0.05] p-3 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.05)]">
          <ZoneTile tier={table.tier} icon={icon} className="size-12" />
          <div className="min-w-0 flex-1">
            <p className="text-headline text-label">Table {table.label}</p>
            <p className="text-footnote text-label-2 truncate">
              {table.zoneName} · {levelLabel(table.level)}
            </p>
          </div>
          <div className="text-right">
            <p className="num text-headline text-foil">
              {quote.minimumSpend !== null ? formatEuro(quote.minimumSpend) : "Sur demande"}
            </p>
            <p className="text-caption text-label-3">
              {quote.minimumSpend !== null ? `minimum pour ${quote.guests}` : "prix"}
            </p>
          </div>
        </div>
        <DialogPrimitive.Description className="text-footnote text-label-3 -mt-3 px-1">
          Le club confirme la table et le minimum, puis vous recontacte. Aucun paiement maintenant.
          {deposit ? ` ${deposit}` : null}
        </DialogPrimitive.Description>

        <Group title="Votre soirée">
          <Row label="Personnes" error={errors.partySize?.message}>
            <Controller
              control={control}
              name="partySize"
              render={({ field }) => (
                <Stepper
                  label="Nombre de personnes"
                  value={Number(field.value)}
                  min={table.capacity.min}
                  max={table.capacity.max}
                  onChange={(value) => {
                    field.onChange(value)
                    setGuests(value)
                  }}
                />
              )}
            />
          </Row>
          <Row label="Arrivée" stacked>
            <Controller
              control={control}
              name="arrivalTime"
              render={({ field }) => (
                <div
                  role="radiogroup"
                  aria-label="Heure d’arrivée"
                  className="flex flex-wrap gap-1.5"
                >
                  {arrivalTimes.map((t) => {
                    const active = field.value === t
                    return (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => field.onChange(t)}
                        className={cn(
                          "num text-footnote h-8 rounded-full px-3.5 font-medium transition-[background-color,color,box-shadow] duration-150",
                          active
                            ? "bg-brand/[0.16] text-brand shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--brand)_55%,transparent)]"
                            : "text-label-2 hover:text-label bg-white/[0.07] hover:bg-white/[0.12]",
                        )}
                      >
                        {t.replace(":", "h")}
                      </button>
                    )
                  })}
                </div>
              )}
            />
          </Row>
        </Group>

        <Group title="Vos coordonnées">
          <Row id="fullName" label="Nom" error={errors.fullName?.message}>
            <input
              id="fullName"
              autoComplete="name"
              placeholder="Prénom Nom"
              className={input}
              aria-invalid={Boolean(errors.fullName)}
              {...register("fullName")}
            />
          </Row>
          <Row id="phone" label="Téléphone" error={errors.phone?.message}>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="06 12 34 56 78"
              className={input}
              aria-invalid={Boolean(errors.phone)}
              {...register("phone")}
            />
          </Row>
          <Row id="email" label="E-mail" error={errors.email?.message}>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="facultatif"
              className={input}
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
          </Row>
        </Group>

        <Group title="Message">
          <textarea
            id="message"
            aria-label="Message (facultatif)"
            rows={3}
            placeholder="Anniversaire, bouteilles souhaitées… (facultatif)"
            className="text-ui text-label caret-brand placeholder:text-label-3 block w-full resize-none bg-transparent px-4 py-3 outline-none"
            {...register("message")}
          />
        </Group>

        <Group
          footer={
            errors.consent ? (
              <p className="text-caption text-[#ff6961]">{errors.consent.message}</p>
            ) : null
          }
        >
          <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 px-4 py-2.5">
            <span className="text-ui text-label">
              J’accepte d’être recontacté par le club au sujet de cette demande
            </span>
            <input
              type="checkbox"
              role="switch"
              className="peer sr-only"
              {...register("consent")}
            />
            <SwitchTrack />
          </label>
        </Group>

        {serverError ? (
          <div
            role="alert"
            className="space-y-2 rounded-2xl bg-[#ff453a]/[0.1] px-4 py-3 shadow-[inset_0_0_0_1px_rgb(255_69_58/0.3)]"
          >
            <p className="text-ui text-label">{serverError}</p>
            <FallbackContact
              club={content.club}
              eventName={content.event.name}
              tableLabel={table.label}
              context="request_error"
            />
          </div>
        ) : null}
      </div>

      <div className="shrink-0 space-y-2.5 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Btn
          type="submit"
          variant="brand"
          size="lg"
          className="w-full"
          disabled={formState.isSubmitting}
        >
          {formState.isSubmitting ? <LoaderCircle className="animate-spin" /> : null}
          Envoyer la demande
          <span className="hidden gap-0.5 lg:flex">
            <Kbd className="bg-black/10 text-black/55 shadow-none">⌘</Kbd>
            <Kbd className="bg-black/10 text-black/55 shadow-none">↵</Kbd>
          </span>
        </Btn>
        {content.club.demo ? (
          <p className="text-caption text-label-3 flex items-center justify-center gap-2">
            <span className="bg-brand size-1.5 rounded-full" /> Mode démo — rien n’est transmis au
            club
          </p>
        ) : null}
      </div>
    </form>
  )
}

function RequestSuccess({
  table,
  content,
  isDesktop,
}: {
  table: TableView | null
  content: VenueContent
  isDesktop: boolean
}) {
  const last = useExperience((s) => s.lastRequest)
  const resetView = useExperience((s) => s.resetView)
  const notify = useExperience((s) => s.notify)
  if (!last) return null
  return (
    <div className="flex flex-col">
      <div className="flex h-14 items-center justify-end pr-3">
        <DialogPrimitive.Close
          render={
            <IconBtn
              label="Fermer"
              keys={isDesktop ? ["Esc"] : undefined}
              className="text-label-2 bg-white/[0.08]"
            />
          }
        >
          <X />
        </DialogPrimitive.Close>
      </div>
      <div className="flex flex-col items-center px-6 pb-6 text-center">
        <motion.span
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
          className="brand-pill grid size-16 place-items-center rounded-full"
        >
          <svg viewBox="0 0 24 24" className="size-8" fill="none" aria-hidden>
            <motion.path
              d="M5 12.5 10 17.5 19 7"
              stroke="#1d1406"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.25, duration: 0.45, ease: "easeOut" }}
            />
          </svg>
        </motion.span>
        <DialogPrimitive.Title className="text-title text-label mt-5">
          {last.demo ? "Demande enregistrée" : "Demande transmise"}
        </DialogPrimitive.Title>
        <DialogPrimitive.Description className="text-callout text-label-2 mt-1.5">
          Table {table?.label ?? last.tableId} · {content.club.name}
        </DialogPrimitive.Description>

        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(last.requestId)
            notify({ title: "Référence copiée", detail: last.requestId, tone: "ok" })
          }}
          className="group mt-5 flex h-11 items-center gap-3 rounded-full bg-white/[0.06] pr-2 pl-4 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.07)] transition-colors hover:bg-white/[0.1]"
        >
          <span className="eyebrow text-label-3">Réf.</span>
          <span className="num text-callout text-label font-medium tracking-[0.08em]">
            {last.requestId}
          </span>
          <span className="text-label-2 group-hover:text-label grid size-7 place-items-center rounded-full bg-white/[0.08] transition-colors">
            <Copy className="size-3.5" />
          </span>
        </button>

        <p className="text-ui text-label-2 mt-5 max-w-sm">
          Ce n’est pas encore une réservation : l’équipe de {content.club.name} vous recontacte pour
          confirmer la table, le minimum et les modalités.
        </p>
        {last.demo ? (
          <p className="text-caption text-label-3 mt-3 flex items-center gap-2">
            <span className="bg-brand size-1.5 rounded-full" /> Mode démo — aucune demande n’a été
            envoyée au club.
          </p>
        ) : null}
      </div>
      <div className="space-y-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Btn variant="brand" size="lg" className="w-full" onClick={resetView}>
          Revenir à la visite
        </Btn>
        <FallbackContact
          club={content.club}
          eventName={content.event.name}
          tableLabel={table?.label}
          context="ack"
          className="justify-center"
        />
      </div>
    </div>
  )
}

/** Modal flow (form → acknowledgement): centred glass dialog on wide screens, full sheet on phones. */
export function RequestDialog(props: {
  table: TableView | null
  icon: ZoneIcon
  content: VenueContent
  clubSlug: string
  eventSlug: string
  isDesktop: boolean
  /** Centred dialog (tablets, desktops) instead of a full-height sheet (phones). */
  centered?: boolean
}) {
  const dialog = useExperience((s) => s.dialog)
  const openDialog = useExperience((s) => s.openDialog)
  const { table, isDesktop, centered = isDesktop } = props
  return (
    <DialogPrimitive.Root
      open={dialog !== null && (dialog === "ack" || table !== null)}
      onOpenChange={(open) => {
        if (!open) openDialog(null)
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[6px] transition-opacity duration-300 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <DialogPrimitive.Popup
          className={cn(
            "glass-thick glass-rim text-label fixed z-[61] flex flex-col overflow-hidden transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] outline-none data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
            centered
              ? "top-1/2 left-1/2 max-h-[min(88vh,calc(100dvh-1.5rem))] w-[min(540px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[32px] data-[ending-style]:scale-[0.96] data-[starting-style]:scale-[0.96]"
              : "inset-x-0 bottom-0 max-h-[94dvh] rounded-t-[32px] data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full",
          )}
        >
          {dialog === "request" && table ? <RequestForm {...props} table={table} /> : null}
          {dialog === "ack" ? (
            <RequestSuccess table={table} content={props.content} isDesktop={isDesktop} />
          ) : null}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
