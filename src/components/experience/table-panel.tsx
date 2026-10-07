"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Check, CircleCheck, GitCompareArrows, LoaderCircle, ScanEye } from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import type { z } from "zod"

import { submitBookingRequest } from "@/app/[club]/[event]/actions"
import { DemoNotice, FallbackContact } from "@/components/experience/chrome"
import type { TableView } from "@/components/experience/view-model"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getAttribution, track } from "@/lib/analytics/client"
import { formatCapacity, formatEuro } from "@/lib/format"
import { arrivalTimes, bookingRequestInputSchema, type VenueContent } from "@/lib/schema"
import { useExperience } from "@/lib/store"
import { cn } from "@/lib/utils"
import { STATUS, TIERS } from "@/lib/venue/tiers"

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
      <dt className="font-mono text-[10px] tracking-[0.18em] text-white/45 uppercase">{label}</dt>
      <dd className="mt-0.5 text-[15px] font-semibold text-white">{value}</dd>
      {hint ? <dd className="text-[11px] text-white/45">{hint}</dd> : null}
    </div>
  )
}

export function TableDetails({ table, content }: { table: TableView; content: VenueContent }) {
  const view = useExperience((s) => s.view)
  const compareIds = useExperience((s) => s.compareIds)
  const viewFromSeat = useExperience((s) => s.viewFromSeat)
  const leaveSeat = useExperience((s) => s.leaveSeat)
  const toggleCompare = useExperience((s) => s.toggleCompare)
  const openPanel = useExperience((s) => s.openPanel)
  const tier = TIERS[table.tier]
  const status = STATUS[table.status]
  const sold = table.status === "sold"
  const inCompare = compareIds.includes(table.id)

  return (
    <div className="space-y-5 px-5 pt-1 pb-5 lg:pt-6">
      <header className="pr-10">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-white/55 uppercase">
          <span className="size-2 rounded-full" style={{ background: tier.color }} />
          {tier.label} · {table.zoneName} · {table.level === 0 ? "Rez-de-chaussée" : "Mezzanine"}
        </p>
        <h2 className="font-heading mt-1.5 text-2xl font-bold text-white">Table {table.label}</h2>
        <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-white/80">
          <span className="size-1.5 rounded-full" style={{ background: status.color }} />
          {status.label}
        </p>
      </header>

      <dl className="grid grid-cols-3 gap-2">
        <Fact label="Capacité" value={formatCapacity(table.capacity)} />
        <Fact
          label="Minimum"
          value={table.minimumSpend !== null ? formatEuro(table.minimumSpend) : "Sur demande"}
        />
        <Fact
          label="Par pers."
          value={table.perPerson !== null ? `≈ ${formatEuro(table.perPerson)}` : "—"}
          hint="au maximum de pers."
        />
      </dl>

      <p className="text-sm leading-relaxed text-white/75">{table.view}</p>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="h-10 rounded-xl"
          onClick={() => {
            if (view === "seat") leaveSeat()
            else {
              viewFromSeat()
              track("table_view_from_seat", { table_id: table.id })
            }
          }}
        >
          <ScanEye /> {view === "seat" ? "Vue d’ensemble table" : "Vue depuis la table"}
        </Button>
        <Button
          variant="outline"
          className={cn("h-10 rounded-xl", inCompare && "border-white/40 bg-white/10")}
          onClick={() => toggleCompare(table.id)}
        >
          <GitCompareArrows /> {inCompare ? "Dans le comparatif" : "Comparer"}
        </Button>
      </div>

      {table.perks.length ? (
        <section>
          <h3 className="font-mono text-[10px] tracking-[0.2em] text-white/45 uppercase">Inclus</h3>
          <ul className="mt-2 space-y-1.5">
            {table.perks.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm text-white/85">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" /> {p}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="group rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm">
        <summary className="cursor-pointer list-none font-medium text-white/85 marker:hidden">
          Conditions
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] text-white/65">
          {content.conditions.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </details>

      <div className="sticky bottom-0 -mx-5 border-t border-white/[0.06] bg-[#0e0a14]/95 px-5 pt-3 pb-1 backdrop-blur">
        <Button
          size="lg"
          className="h-12 w-full rounded-xl text-base font-semibold"
          disabled={sold}
          onClick={() => openPanel("request")}
        >
          {sold ? "Table complète" : "Demander cette table"}
        </Button>
        <p className="mt-2 text-center text-[11px] leading-snug text-white/50">
          Sans paiement. Le club confirme la table et le minimum, puis vous recontacte.
        </p>
      </div>
    </div>
  )
}

type FormInput = z.input<typeof bookingRequestInputSchema>
type FormOutput = z.output<typeof bookingRequestInputSchema>

const ERROR_COPY: Record<string, string> = {
  rate_limited:
    "Trop de demandes en peu de temps. Réessayez dans quelques minutes ou écrivez au club.",
  unknown_table: "Cette table n’existe plus. Choisissez-en une autre.",
  unavailable: "Cette table n’est plus proposée. Choisissez-en une autre ou écrivez au club.",
  validation: "Vérifiez les champs en rouge.",
  server: "La demande n’a pas pu être envoyée. Réessayez ou écrivez directement au club.",
  network: "Connexion impossible. Vérifiez votre réseau, ou écrivez directement au club.",
}

export function RequestForm({
  table,
  content,
  clubSlug,
  eventSlug,
}: {
  table: TableView
  content: VenueContent
  clubSlug: string
  eventSlug: string
}) {
  const openPanel = useExperience((s) => s.openPanel)
  const requestSent = useExperience((s) => s.requestSent)
  const [serverError, setServerError] = useState<string | null>(null)
  const started = useRef(false)
  // one key per form instance: retries of the same request never create duplicates
  const idempotencyKey = useMemo(() => crypto.randomUUID(), [])

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(bookingRequestInputSchema),
    mode: "onTouched",
    defaultValues: {
      clubSlug,
      eventSlug,
      tableId: table.id,
      fullName: "",
      phone: "",
      email: "",
      partySize: table.capacity.min,
      arrivalTime: arrivalTimes[0],
      message: "",
      idempotencyKey,
      attribution: getAttribution(),
    },
  })
  const { register, handleSubmit, formState, setError } = form
  const errors = formState.errors

  const onFirstInteraction = () => {
    if (started.current) return
    started.current = true
    track("request_started", { table_id: table.id })
  }

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
      for (const [field, message] of Object.entries(res.fieldErrors ?? {})) {
        setError(field as keyof FormInput, { message })
      }
      setServerError(ERROR_COPY[res.error] ?? ERROR_COPY.server)
      track("request_failed", { table_id: table.id, reason: res.error })
    } catch {
      setServerError(ERROR_COPY.network)
      track("request_failed", { table_id: table.id, reason: "network" })
    }
  })

  const partySizes = Array.from({ length: table.capacity.max }, (_, i) => i + 1)
  const field = "h-11 rounded-xl bg-white/[0.04] text-base"

  return (
    <form
      onSubmit={onSubmit}
      onFocus={onFirstInteraction}
      noValidate
      className="space-y-4 px-5 pt-1 pb-5 lg:pt-6"
    >
      <header className="pr-10">
        <button
          type="button"
          onClick={() => openPanel("table")}
          className="text-xs text-white/55 hover:text-white"
        >
          ← Table {table.label}
        </button>
        <h2 className="font-heading mt-1 text-xl font-bold text-white">Vos coordonnées</h2>
        <p className="mt-1 text-sm text-white/60">
          Table {table.label} · {table.zoneName} · minimum{" "}
          {table.minimumSpend !== null ? formatEuro(table.minimumSpend) : "sur demande"}
        </p>
      </header>

      <div className="space-y-1.5">
        <Label htmlFor="fullName">Nom complet</Label>
        <Input
          id="fullName"
          autoComplete="name"
          className={field}
          aria-invalid={Boolean(errors.fullName)}
          {...register("fullName")}
        />
        {errors.fullName ? (
          <p className="text-xs text-rose-300">{errors.fullName.message}</p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Téléphone (WhatsApp)</Label>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="06 12 34 56 78"
          className={field}
          aria-invalid={Boolean(errors.phone)}
          {...register("phone")}
        />
        {errors.phone ? <p className="text-xs text-rose-300">{errors.phone.message}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">
          E-mail <span className="text-white/40">(facultatif)</span>
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          className={field}
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
        {errors.email ? <p className="text-xs text-rose-300">{errors.email.message}</p> : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="partySize">Personnes</Label>
          <select
            id="partySize"
            className={cn(field, "border-input w-full border px-3 text-white")}
            aria-invalid={Boolean(errors.partySize)}
            {...register("partySize", { valueAsNumber: true })}
          >
            {partySizes.map((n) => (
              <option key={n} value={n}>
                {n} {n > 1 ? "personnes" : "personne"}
              </option>
            ))}
          </select>
          {errors.partySize ? (
            <p className="text-xs text-rose-300">{errors.partySize.message}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="arrivalTime">Arrivée</Label>
          <select
            id="arrivalTime"
            className={cn(field, "border-input w-full border px-3 text-white")}
            {...register("arrivalTime")}
          >
            {arrivalTimes.map((t) => (
              <option key={t} value={t}>
                vers {t.replace(":", "h")}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="message">
          Message <span className="text-white/40">(facultatif)</span>
        </Label>
        <Textarea
          id="message"
          rows={3}
          placeholder="Anniversaire, bouteilles souhaitées…"
          className="rounded-xl bg-white/[0.04] text-base"
          {...register("message")}
        />
      </div>
      <label className="flex items-start gap-3 text-sm text-white/75">
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0 accent-amber-300"
          {...register("consent")}
        />
        <span>J’accepte d’être recontacté par le club au sujet de cette demande.</span>
      </label>
      {errors.consent ? (
        <p className="-mt-2 text-xs text-rose-300">{errors.consent.message}</p>
      ) : null}

      {serverError ? (
        <div role="alert" className="space-y-3">
          <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            {serverError}
          </p>
          <FallbackContact club={content.club} context="request_error" />
        </div>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={formState.isSubmitting}
        className="h-12 w-full rounded-xl text-base font-semibold"
      >
        {formState.isSubmitting ? <LoaderCircle className="animate-spin" /> : null}
        Envoyer ma demande
      </Button>
      <p className="text-center text-[11px] leading-snug text-white/50">
        Ceci est une demande, pas une réservation : la table n’est réservée qu’après confirmation du
        club.
      </p>
      {content.club.demo ? (
        <DemoNotice text="Mode démo : aucune demande n’est transmise au club." />
      ) : null}
    </form>
  )
}

export function RequestAck({ table, content }: { table: TableView | null; content: VenueContent }) {
  const last = useExperience((s) => s.lastRequest)
  const resetView = useExperience((s) => s.resetView)
  if (!last) return null
  return (
    <div className="space-y-5 px-5 pt-2 pb-6 text-center lg:pt-10">
      <CircleCheck className="mx-auto size-12 text-emerald-400" />
      <div>
        <h2 className="font-heading text-xl font-bold text-white">
          {last.demo ? "Demande enregistrée (démo)" : "Demande transmise au club"}
        </h2>
        <p className="mt-2 text-sm text-white/65">
          Table {table?.label ?? last.tableId} · référence{" "}
          <span className="font-mono font-semibold tracking-wider text-white">
            {last.requestId}
          </span>
        </p>
      </div>
      <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm leading-relaxed text-white/75">
        Ce n’est pas encore une réservation : l’équipe de {content.club.name} vous recontacte pour
        confirmer la table, le minimum et les modalités. Gardez votre référence.
      </p>
      {last.demo ? <DemoNotice text="Mode démo : aucune demande n’a été envoyée au club." /> : null}
      <Button variant="outline" className="h-11 w-full rounded-xl" onClick={resetView}>
        Revenir à la visite
      </Button>
      <FallbackContact club={content.club} context="ack" className="text-left" />
    </div>
  )
}
