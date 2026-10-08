"use client"

import {
  ChevronLeft,
  ExternalLink,
  FileJson,
  GitPullRequest,
  ImagePlus,
  Monitor,
  Play,
  RotateCcw,
  Smartphone,
  Star,
} from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"
import { Markdown } from "@studio/components/markdown"
import {
  ago,
  Chip,
  CloseButton,
  duration,
  Empty,
  fileUrl,
  Panel,
  StateIcon,
  STATE_STYLE,
} from "@studio/components/ui"
import type { ClubDetail } from "@studio/lib/detail"
import type { StepId } from "@studio/lib/jobs"
import type { StepView } from "@studio/lib/state"

type Tab = "renders" | "preview" | "log" | "research" | "spec" | "feedback" | "lessons" | "sources"

const TABS: { id: Tab; label: string }[] = [
  { id: "renders", label: "Rendus" },
  { id: "preview", label: "Aperçu" },
  { id: "log", label: "Journal" },
  { id: "research", label: "Recherche" },
  { id: "spec", label: "Spécification" },
  { id: "feedback", label: "Retours" },
  { id: "lessons", label: "Leçons" },
  { id: "sources", label: "Sources" },
]

/** What each step does, shown under its name. */
const ABOUT: Record<StepView["id"], string> = {
  brief: "Identité, liens, brief et photos du club.",
  research: "L'agent lit les sources et sépare faits, suppositions et manques.",
  spec: "L'agent écrit plan, offre, identité, ambiance et scène ; le Studio valide et lui renvoie les erreurs.",
  build: "Blender construit la salle depuis les données, avec rapport et rendus de revue.",
  review: "L'agent compare les rendus aux sources et aux retours, corrige, puis on reconstruit.",
  bake: "Cycles précalcule la lumière, puis le bundle web est optimisé.",
  preview: "Le club rejoint le registre, passe les tests de contrat, et la démo est capturée.",
  lessons: "L'agent propose ce que le prochain club devrait savoir.",
  publish: "Branche depuis main, dossier du club et captures, pull request.",
  auto: "Toutes les étapes restantes, de la recherche aux leçons, sans s’arrêter.",
}

const stepLabel = (steps: StepView[], id: string) =>
  id === "auto" ? "Tout générer" : (steps.find((s) => s.id === id)?.label ?? id)

async function post(url: string, body: unknown): Promise<{ error?: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.ok
    ? {}
    : ((await res.json().catch(() => ({ error: res.statusText }))) as { error?: string })
}

export function Workspace({ initial }: { initial: ClubDetail }) {
  const [data, setData] = useState(initial)
  const [tab, setTab] = useState<Tab>(
    initial.previews.length ? "renders" : initial.research ? "research" : "log",
  )
  const [runId, setRunId] = useState<string | undefined>(initial.shownRun?.id)
  const [error, setError] = useState<string | null>(null)
  const slug = data.slug
  const active = data.runs.find((r) => r.state === "running" || r.state === "queued")

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/clubs/${slug}/state${runId ? `?run=${runId}` : ""}`, {
      cache: "no-store",
    })
    if (res.ok) setData((await res.json()) as ClubDetail)
  }, [slug, runId])

  useEffect(() => {
    const t = setInterval(refresh, active ? 1500 : 6000)
    return () => clearInterval(t)
  }, [refresh, active])

  async function start(step: StepId, options: Record<string, unknown> = {}) {
    setError(null)
    const res = await fetch(`/api/clubs/${slug}/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, options }),
    })
    const out = (await res.json()) as { id?: string; error?: string }
    if (!res.ok || !out.id) return setError(out.error ?? "Impossible de lancer l'étape")
    setRunId(out.id)
    setTab("log")
    void refresh()
  }

  const eventSlug = data.brief?.event.slug ?? "samedi"
  // the viewer the last preview used, whether run alone or by "Tout générer"
  const viewer =
    (data.runs.find((r) => (r.step === "preview" || r.step === "auto") && r.result?.viewer)?.result
      ?.viewer as string | undefined) ?? `http://localhost:3000/${slug}/${eventSlug}`

  return (
    <div className="relative min-h-dvh">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(45%_35%_at_15%_0%,rgb(191_90_242/0.12),transparent_70%),radial-gradient(35%_30%_at_95%_5%,color-mix(in_srgb,var(--brand)_10%,transparent),transparent_70%)]"
      />
      <header className="relative mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-6 pt-8">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/"
            aria-label="Clubs"
            className="glass glass-rim text-label grid size-10 shrink-0 place-items-center rounded-full"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <div className="min-w-0">
            <p className="eyebrow text-label-3">{data.city || "Club"}</p>
            <h1 className="text-title text-label truncate">{data.name}</h1>
          </div>
          {active ? (
            <Chip tone="brand">
              <StateIcon state="running" className="size-3.5" />{" "}
              {stepLabel(data.steps, active.current ?? active.step)}
            </Chip>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {!active &&
          data.brief &&
          data.steps.some((s) => s.id !== "publish" && s.id !== "brief" && s.state !== "done") ? (
            <button
              type="button"
              onClick={() => start("auto")}
              className="brand-pill text-ui inline-flex h-10 items-center gap-2 rounded-full px-4 font-medium"
            >
              <Play className="size-4" /> Tout générer
            </button>
          ) : null}
          {data.registered ? (
            <a
              href={viewer}
              target="_blank"
              rel="noreferrer"
              className="text-ui text-label bg-fill inline-flex h-10 items-center gap-2 rounded-full px-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] hover:bg-white/[0.16]"
            >
              Ouvrir la démo <ExternalLink className="size-4" />
            </a>
          ) : null}
          {data.published?.prUrl ? (
            <a
              href={data.published.prUrl}
              target="_blank"
              rel="noreferrer"
              className="brand-pill text-ui inline-flex h-10 items-center gap-2 rounded-full px-4 font-medium"
            >
              <GitPullRequest className="size-4" /> Pull request
            </a>
          ) : null}
        </div>
      </header>

      {error ? (
        <p className="text-footnote relative mx-auto mt-4 max-w-[1500px] px-6 text-[#ff6961]">
          {error}
        </p>
      ) : null}

      <div className="relative mx-auto grid max-w-[1500px] gap-6 px-6 pt-6 pb-16 lg:grid-cols-[400px_1fr]">
        <Pipeline
          steps={data.steps}
          busy={Boolean(active)}
          onStart={start}
          runs={data.runs}
          onShowRun={(id) => {
            setRunId(id)
            setTab("log")
          }}
        />
        <Panel className="min-w-0 p-2">
          <nav className="flex gap-1 overflow-x-auto p-1" aria-label="Sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "text-ui h-9 shrink-0 rounded-full px-4 font-medium transition-colors",
                  tab === t.id ? "text-label bg-white/[0.14]" : "text-label-2 hover:text-label",
                )}
              >
                {t.label}
                {t.id === "feedback" && data.feedback.some((f) => f.status === "open") ? (
                  <span className="bg-brand ml-2 inline-block size-1.5 rounded-full align-middle" />
                ) : null}
              </button>
            ))}
          </nav>
          <div className="p-4 sm:p-5">
            {tab === "renders" ? <Renders data={data} onFeedback={refresh} /> : null}
            {tab === "preview" ? <Preview data={data} viewer={viewer} /> : null}
            {tab === "log" ? <RunLog data={data} runId={runId} onSelect={setRunId} /> : null}
            {tab === "research" ? (
              data.research ? (
                <Markdown source={data.research} />
              ) : (
                <Empty>Pas encore de note de recherche.</Empty>
              )
            ) : null}
            {tab === "spec" ? <Spec data={data} /> : null}
            {tab === "feedback" ? <Feedback data={data} onChange={refresh} /> : null}
            {tab === "lessons" ? <Lessons data={data} onChange={refresh} /> : null}
            {tab === "sources" ? <Sources data={data} onChange={refresh} /> : null}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function Pipeline({
  steps,
  busy,
  runs,
  onStart,
  onShowRun,
}: {
  steps: StepView[]
  busy: boolean
  runs: ClubDetail["runs"]
  onStart: (step: StepId, options?: Record<string, unknown>) => void
  onShowRun: (id: string) => void
}) {
  const [open, setOpen] = useState<StepView["id"] | null>(
    steps.find((s) => s.state !== "done")?.id ?? null,
  )
  const [quality, setQuality] = useState<"draft" | "final">("final")
  const [iterations, setIterations] = useState(1)
  const [dryRun, setDryRun] = useState(true)
  const [issue, setIssue] = useState("")

  return (
    <Panel as="aside" className="h-fit p-3 lg:sticky lg:top-6">
      <p className="eyebrow text-label-3 px-3 pt-2 pb-3">Pipeline</p>
      <ol className="space-y-1">
        {steps.map((s, i) => {
          const last = runs.find((r) => r.step === s.id)
          const expanded = open === s.id
          const runnable = s.id !== "brief"
          return (
            <li
              key={s.id}
              className={cn(
                "rounded-2xl transition-colors",
                expanded ? "bg-white/[0.06]" : "hover:bg-white/[0.03]",
              )}
            >
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : s.id)}
                className="flex w-full items-start gap-3 p-3 text-left"
              >
                <span className="num text-caption text-label-3 mt-0.5 w-4 shrink-0 text-right">
                  {i + 1}
                </span>
                <StateIcon state={s.state} className="mt-px" />
                <span className="min-w-0 flex-1">
                  <span className="text-callout text-label block">{s.label}</span>
                  <span
                    className={cn(
                      "text-caption block truncate",
                      s.state === "failed" ? "text-[#ff6961]" : "text-label-3",
                    )}
                  >
                    {s.detail ?? STATE_STYLE[s.state].label}
                  </span>
                </span>
                {last?.endedAt ? (
                  <span className="num text-caption text-label-3 shrink-0">
                    {duration(last.startedAt, last.endedAt)}
                  </span>
                ) : null}
              </button>
              {expanded ? (
                <div className="space-y-3 px-3 pb-3 pl-[52px]">
                  <p className="text-footnote text-label-2">{ABOUT[s.id]}</p>
                  {s.id === "bake" ? (
                    <Options
                      value={quality}
                      onChange={setQuality}
                      items={[
                        ["draft", "Brouillon (~2 min)"],
                        ["final", "Final (~6 min)"],
                      ]}
                    />
                  ) : null}
                  {s.id === "review" ? (
                    <Options
                      value={String(iterations)}
                      onChange={(v) => setIterations(Number(v))}
                      items={[
                        ["1", "1 passe"],
                        ["2", "2 passes"],
                        ["3", "3 passes"],
                      ]}
                    />
                  ) : null}
                  {s.id === "publish" ? (
                    <div className="space-y-2">
                      <label className="text-footnote text-label-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={dryRun}
                          onChange={(e) => setDryRun(e.target.checked)}
                          className="accent-[var(--brand)]"
                        />
                        Essai à blanc (branche locale, rien n&apos;est poussé)
                      </label>
                      <input
                        value={issue}
                        onChange={(e) => setIssue(e.target.value.toUpperCase())}
                        placeholder="Ticket Linear (VYR-59)"
                        className="text-footnote text-label placeholder:text-label-3 h-9 w-full rounded-xl bg-white/[0.06] px-3 outline-none"
                      />
                    </div>
                  ) : null}
                  {runnable ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const step = s.id as StepId
                          if (
                            step === "publish" &&
                            !dryRun &&
                            !window.confirm(
                              "Pousser une branche et ouvrir une pull request sur GitHub ?",
                            )
                          )
                            return
                          onStart(
                            step,
                            step === "bake"
                              ? { quality }
                              : step === "review"
                                ? { iterations }
                                : step === "publish"
                                  ? { dryRun, issue: issue || undefined }
                                  : {},
                          )
                        }}
                        className={cn(
                          "text-footnote inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 font-medium disabled:opacity-40",
                          s.state === "done"
                            ? "bg-fill text-label hover:bg-white/[0.16]"
                            : "brand-pill",
                        )}
                      >
                        {s.state === "todo" ? (
                          <Play className="size-3.5" />
                        ) : (
                          <RotateCcw className="size-3.5" />
                        )}
                        {s.state === "todo" ? "Lancer" : "Relancer"}
                      </button>
                      {last ? (
                        <button
                          type="button"
                          onClick={() => onShowRun(last.id)}
                          className="text-footnote text-label-2 hover:text-label px-2"
                        >
                          Journal · {ago(last.endedAt ?? last.createdAt)}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
    </Panel>
  )
}

function Options<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T
  onChange: (v: T) => void
  items: [T, string][]
}) {
  return (
    <div className="inline-flex rounded-full bg-white/[0.06] p-0.5">
      {items.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "text-caption h-7 rounded-full px-3 font-medium",
            value === v ? "text-label bg-white/[0.16]" : "text-label-2",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function Renders({ data, onFeedback }: { data: ClubDetail; onFeedback: () => void }) {
  const [zoom, setZoom] = useState<string | null>(null)
  const [text, setText] = useState("")
  const report = data.report as {
    objects?: number
    triangles?: number
    lights?: number
    checks?: { name: string; ok: boolean }[]
  } | null
  if (!data.previews.length) return <Empty>Pas encore de rendus : lancer la construction 3D.</Empty>
  return (
    <div className="space-y-6">
      {report ? (
        <div className="flex flex-wrap items-center gap-2">
          <Chip>{report.objects} objets</Chip>
          <Chip>{report.triangles?.toLocaleString("fr-FR")} triangles</Chip>
          <Chip>{report.lights} lumières</Chip>
          {report.checks?.map((c) => (
            <Chip key={c.name} tone={c.ok ? "ok" : "bad"}>
              {c.ok ? "✓" : "✗"} {c.name}
            </Chip>
          ))}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {data.previews.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setZoom(p)}
            className="group relative overflow-hidden rounded-2xl bg-black/40 text-left"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${fileUrl(data.slug, `build/previews/${p}`)}&t=${data.steps.find((s) => s.id === "build")?.at ?? ""}`}
              alt={p}
              className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
            <span className="text-caption absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-1 backdrop-blur-md">
              {p.replace(".png", "")}
            </span>
          </button>
        ))}
      </div>
      {data.reviews.length ? (
        <div>
          <p className="eyebrow text-label-3">Revues de l&apos;agent</p>
          <div className="mt-3 space-y-3">
            {data.reviews.slice(0, 4).map((r) => (
              <div key={r.id} className="rounded-2xl bg-white/[0.04] p-4">
                <p className="text-caption text-label-3 num">{r.id}</p>
                {(["issues", "changes", "remaining"] as const).map((k) =>
                  Array.isArray(r[k]) && r[k].length ? (
                    <div key={k} className="mt-2">
                      <p className="text-footnote text-label font-medium">
                        {k === "issues"
                          ? "Constats"
                          : k === "changes"
                            ? "Corrections"
                            : "Reste à faire"}
                      </p>
                      <ul className="text-footnote text-label-2 mt-1 list-disc space-y-0.5 pl-5">
                        {r[k].map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null,
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {zoom ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6 backdrop-blur-sm"
          onClick={() => setZoom(null)}
        >
          <div
            className="glass-thick w-full max-w-6xl rounded-[28px] p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-2 pb-2">
              <p className="text-headline text-label">{zoom.replace(".png", "")}</p>
              <CloseButton onClick={() => setZoom(null)} />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fileUrl(data.slug, `build/previews/${zoom}`)}
              alt={zoom}
              className="w-full rounded-2xl"
            />
            <form
              className="mt-3 flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault()
                if (!text.trim()) return
                await post(`/api/clubs/${data.slug}/feedback`, {
                  text,
                  target: zoom.replace(".png", ""),
                })
                setText("")
                onFeedback()
              }}
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Retour sur ce rendu (« les globes cachent la loge VIP »)…"
                className="text-callout text-label placeholder:text-label-3 h-11 flex-1 rounded-full bg-white/[0.07] px-4 outline-none"
              />
              <button
                type="submit"
                className="brand-pill text-ui h-11 rounded-full px-5 font-medium"
              >
                Envoyer
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const DEVICES = {
  phone: { label: "Téléphone", w: 390, h: 844 },
  landscape: { label: "Paysage", w: 844, h: 390 },
  desktop: { label: "Ordinateur", w: 1440, h: 900 },
} as const

function Preview({ data, viewer }: { data: ClubDetail; viewer: string }) {
  const [device, setDevice] = useState<keyof typeof DEVICES>("phone")
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    if (box.current) ro.observe(box.current)
    return () => ro.disconnect()
  }, [])
  const d = DEVICES[device]
  const scale = Math.min(1, (width - 8) / d.w, 640 / d.h)
  if (!data.registered)
    return (
      <Empty>
        Le club n&apos;est pas encore dans le registre : lancer l&apos;aperçu (après
        l&apos;éclairage).
      </Empty>
    )
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full bg-white/[0.06] p-0.5">
          {(Object.keys(DEVICES) as (keyof typeof DEVICES)[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setDevice(k)}
              className={cn(
                "text-footnote inline-flex h-8 items-center gap-1.5 rounded-full px-3 font-medium",
                device === k ? "text-label bg-white/[0.16]" : "text-label-2",
              )}
            >
              {k === "desktop" ? (
                <Monitor className="size-3.5" />
              ) : (
                <Smartphone className={cn("size-3.5", k === "landscape" && "rotate-90")} />
              )}
              {DEVICES[k].label}
            </button>
          ))}
        </div>
        <p className="text-caption text-label-3 font-code">{viewer}</p>
      </div>
      <div ref={box} className="grid place-items-center">
        <div
          className="overflow-hidden rounded-[34px] bg-black shadow-[0_0_0_10px_#141218,0_0_0_11px_rgb(255_255_255/0.1),0_30px_80px_-20px_rgb(0_0_0/0.8)]"
          style={{ width: d.w * scale, height: d.h * scale }}
        >
          <iframe
            key={device}
            src={viewer}
            title={`Démo — ${d.label}`}
            style={{
              width: d.w,
              height: d.h,
              transform: `scale(${scale})`,
              transformOrigin: "0 0",
            }}
            className="border-0"
          />
        </div>
      </div>
      {data.captures.length ? (
        <div>
          <p className="eyebrow text-label-3">Captures</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {data.captures.map((c) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={c}
                src={fileUrl(data.slug, `private/studio/captures/${c}`)}
                alt={c}
                className="w-full rounded-2xl"
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function RunLog({
  data,
  runId,
  onSelect,
}: {
  data: ClubDetail
  runId?: string
  onSelect: (id: string) => void
}) {
  const run = data.shownRun
  const pre = useRef<HTMLPreElement>(null)
  useEffect(() => {
    if (pre.current) pre.current.scrollTop = pre.current.scrollHeight
  }, [data.log])
  if (!run) return <Empty>Aucune étape lancée pour l&apos;instant.</Empty>
  const result = (run.result ?? {}) as Record<string, unknown>
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={runId ?? run.id}
          onChange={(e) => onSelect(e.target.value)}
          className="text-footnote text-label h-9 rounded-full bg-white/[0.07] px-3 outline-none"
        >
          {data.runs.map((r) => (
            <option key={r.id} value={r.id} className="bg-[#16131b]">
              {stepLabel(data.steps, r.step)} ·{" "}
              {new Date(r.createdAt).toLocaleString("fr-FR", {
                dateStyle: "short",
                timeStyle: "short",
              })}{" "}
              · {r.state}
            </option>
          ))}
        </select>
        <Chip tone={run.state === "done" ? "ok" : run.state === "failed" ? "bad" : "brand"}>
          {run.state}
        </Chip>
        {run.startedAt ? <Chip>{duration(run.startedAt, run.endedAt)}</Chip> : null}
        {typeof result.turns === "number" ? <Chip>{result.turns} tours d&apos;agent</Chip> : null}
        {typeof result.costUsd === "number" ? (
          <Chip>≈ {result.costUsd.toFixed(2)} $ estimés</Chip>
        ) : null}
        {typeof result.triangles === "number" ? (
          <Chip>{result.triangles.toLocaleString("fr-FR")} triangles</Chip>
        ) : null}
        {typeof result.prUrl === "string" ? (
          <a href={result.prUrl} target="_blank" rel="noreferrer">
            <Chip tone="brand">PR ↗</Chip>
          </a>
        ) : null}
      </div>
      {run.error ? <p className="text-footnote text-[#ff6961]">{run.error}</p> : null}
      {run.phases.length ? (
        <ol className="flex flex-wrap gap-2">
          {run.phases.map((p, i) => (
            <li key={i}>
              <Chip tone={p.ok === false ? "bad" : p.ok ? "ok" : "brand"}>
                {p.name} {p.endedAt ? `· ${duration(p.startedAt, p.endedAt)}` : "…"}
              </Chip>
            </li>
          ))}
        </ol>
      ) : null}
      <pre
        ref={pre}
        className="font-code text-label-2 max-h-[560px] overflow-auto rounded-2xl bg-black/40 p-4 whitespace-pre-wrap"
      >
        {data.log || "…"}
      </pre>
    </div>
  )
}

function Spec({ data }: { data: ClubDetail }) {
  const files = [
    "content.json",
    "layout.json",
    "brand.json",
    "ambiance.json",
    "scene.json",
    "README.md",
  ]
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <StateIcon
          state={
            data.validation.ok
              ? "done"
              : Object.values(data.validation.files).some(Boolean)
                ? "failed"
                : "todo"
          }
        />
        <p className="text-callout text-label">
          {data.validation.ok ? "Spécification valide" : "Spécification à compléter"}
        </p>
      </div>
      {!data.validation.ok && data.validation.problems.length ? (
        <pre className="font-code max-h-80 overflow-auto rounded-2xl bg-black/40 p-4 whitespace-pre-wrap text-[#ffb4ae]">
          {data.validation.problems.join("\n\n")}
        </pre>
      ) : null}
      <ul className="grid gap-2 sm:grid-cols-3">
        {files.map((f) => (
          <li key={f}>
            <a
              href={fileUrl(data.slug, f)}
              target="_blank"
              rel="noreferrer"
              className="text-footnote text-label flex items-center gap-2 rounded-2xl bg-white/[0.04] px-3 py-2.5 hover:bg-white/[0.08]"
            >
              <FileJson className="text-label-3 size-4" /> {f}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Feedback({ data, onChange }: { data: ClubDetail; onChange: () => void }) {
  const [text, setText] = useState("")
  const [target, setTarget] = useState("")
  const [realism, setRealism] = useState(0)
  const [fidelity, setFidelity] = useState(0)
  const [note, setNote] = useState("")
  const targets = useMemo(
    () => ["", ...data.previews.map((p) => p.replace(".png", "")), "démo"],
    [data.previews],
  )
  return (
    <div className="grid gap-8 xl:grid-cols-2">
      <section>
        <p className="eyebrow text-label-3">Retours pour l&apos;agent</p>
        <form
          className="mt-3 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!text.trim()) return
            await post(`/api/clubs/${data.slug}/feedback`, { text, target })
            setText("")
            onChange()
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="« Le bar doit être en marbre noir, pas en béton », « les boules sont trop basses »…"
            className="text-callout text-label placeholder:text-label-3 w-full resize-y rounded-2xl bg-white/[0.06] px-4 py-3 outline-none"
          />
          <div className="flex gap-2">
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="text-footnote text-label h-10 flex-1 rounded-full bg-white/[0.07] px-3 outline-none"
            >
              {targets.map((t) => (
                <option key={t} value={t} className="bg-[#16131b]">
                  {t || "Général"}
                </option>
              ))}
            </select>
            <button type="submit" className="brand-pill text-ui h-10 rounded-full px-5 font-medium">
              Ajouter
            </button>
          </div>
        </form>
        <ul className="mt-5 space-y-2">
          {data.feedback.length === 0 ? <Empty>Aucun retour.</Empty> : null}
          {[...data.feedback].reverse().map((f) => (
            <li key={f.id} className="rounded-2xl bg-white/[0.04] p-3">
              <div className="flex items-center gap-2">
                <Chip
                  tone={f.status === "open" ? "brand" : f.status === "addressed" ? "ok" : "neutral"}
                >
                  {f.status === "open"
                    ? "à traiter"
                    : f.status === "addressed"
                      ? "traité"
                      : "écarté"}
                </Chip>
                {f.target ? <Chip>{f.target}</Chip> : null}
                <span className="text-caption text-label-3 ml-auto">{ago(f.createdAt)}</span>
              </div>
              <p className="text-callout text-label-2 mt-2">{f.text}</p>
              {f.status === "open" ? (
                <button
                  type="button"
                  onClick={async () => {
                    await fetch(`/api/clubs/${data.slug}/feedback`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: f.id, status: "dismissed" }),
                    })
                    onChange()
                  }}
                  className="text-caption text-label-3 hover:text-label mt-1"
                >
                  Écarter
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <p className="eyebrow text-label-3">Évaluation de l&apos;équipe</p>
        <div className="mt-3 space-y-3 rounded-2xl bg-white/[0.04] p-4">
          <Stars label="Réalisme" value={realism} onChange={setRealism} />
          <Stars label="Fidélité au club" value={fidelity} onChange={setFidelity} />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Commentaire (facultatif)"
            className="text-footnote text-label placeholder:text-label-3 h-10 w-full rounded-full bg-white/[0.06] px-4 outline-none"
          />
          <button
            type="button"
            disabled={!realism || !fidelity}
            onClick={async () => {
              await post(`/api/clubs/${data.slug}/evals`, { realism, fidelity, note })
              setRealism(0)
              setFidelity(0)
              setNote("")
              onChange()
            }}
            className="brand-pill text-ui h-10 rounded-full px-5 font-medium disabled:opacity-40"
          >
            Enregistrer la note
          </button>
        </div>
        <ul className="mt-4 space-y-2">
          {[...data.evals].reverse().map((e) => (
            <li
              key={e.at}
              className="text-footnote text-label-2 flex flex-wrap items-center gap-2 rounded-2xl bg-white/[0.03] px-3 py-2"
            >
              <span className="num text-label-3">{new Date(e.at).toLocaleDateString("fr-FR")}</span>
              <Chip>réalisme {e.realism}/5</Chip>
              <Chip>fidélité {e.fidelity}/5</Chip>
              {e.triangles ? (
                <span className="num text-label-3">{e.triangles.toLocaleString("fr-FR")} tri.</span>
              ) : null}
              {e.note ? <span className="w-full">{e.note}</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Stars({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-callout text-label">{label}</span>
      <span className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-label={`${n} sur 5`} onClick={() => onChange(n)}>
            <Star
              className={cn(
                "size-5",
                n <= value ? "text-brand fill-[var(--brand)]" : "text-label-3",
              )}
            />
          </button>
        ))}
      </span>
    </div>
  )
}

function Lessons({ data, onChange }: { data: ClubDetail; onChange: () => void }) {
  if (!data.lessons.length)
    return <Empty>Pas encore de leçons : lancer l&apos;étape « Leçons pour le guide ».</Empty>
  return (
    <div className="space-y-3">
      <p className="text-footnote text-label-2">
        Une leçon acceptée rejoint <code className="font-code">studio/playbook/lessons.md</code>{" "}
        (versionné) : l&apos;agent la lira pour les clubs suivants.
      </p>
      {data.lessons.map((l) => (
        <div key={l.id} className="rounded-2xl bg-white/[0.04] p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-callout text-label font-medium">{l.title}</p>
            {l.decision ? (
              <Chip tone={l.decision === "accepted" ? "ok" : "neutral"}>
                {l.decision === "accepted" ? "acceptée" : "refusée"}
              </Chip>
            ) : null}
          </div>
          <p className="text-footnote text-label-2 mt-1.5">{l.text}</p>
          {!l.decision ? (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  await post(`/api/clubs/${data.slug}/lessons`, { id: l.id, decision: "accepted" })
                  onChange()
                }}
                className="brand-pill text-footnote h-8 rounded-full px-3.5 font-medium"
              >
                Accepter
              </button>
              <button
                type="button"
                onClick={async () => {
                  await post(`/api/clubs/${data.slug}/lessons`, { id: l.id, decision: "rejected" })
                  onChange()
                }}
                className="bg-fill text-footnote text-label h-8 rounded-full px-3.5 font-medium"
              >
                Refuser
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function Sources({ data, onChange }: { data: ClubDetail; onChange: () => void }): ReactNode {
  const [busy, setBusy] = useState(false)
  return (
    <div className="space-y-5">
      <label className="text-footnote text-label inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-white/[0.06] px-4 hover:bg-white/[0.08]">
        <ImagePlus className="size-4" /> {busy ? "Envoi…" : "Ajouter des photos ou des plans"}
        <input
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.webp,.gif,.pdf"
          className="sr-only"
          onChange={async (e) => {
            const files = e.currentTarget.files
            if (!files?.length) return
            setBusy(true)
            const form = new FormData()
            for (const f of Array.from(files)) form.append("sources", f)
            await fetch(`/api/clubs/${data.slug}/sources`, { method: "POST", body: form })
            setBusy(false)
            onChange()
          }}
        />
      </label>
      {data.sources.length === 0 ? (
        <Empty>Aucune source : l&apos;agent travaillera à partir du brief.</Empty>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {data.sources.map((s) =>
          /\.pdf$/i.test(s) ? (
            <a
              key={s}
              href={fileUrl(data.slug, `private/sources/${s}`)}
              target="_blank"
              rel="noreferrer"
              className="text-footnote text-label grid aspect-square place-items-center rounded-2xl bg-white/[0.05] p-3 text-center"
            >
              {s}
            </a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={s}
              src={fileUrl(data.slug, `private/sources/${s}`)}
              alt={s}
              className="aspect-square w-full rounded-2xl object-cover"
            />
          ),
        )}
      </div>
      {data.brief ? (
        <div className="rounded-2xl bg-white/[0.04] p-4">
          <p className="eyebrow text-label-3">Brief</p>
          <p className="text-callout text-label-2 mt-2 whitespace-pre-wrap">
            {data.brief.brief || "—"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.brief.links.website ? <Chip>{data.brief.links.website}</Chip> : null}
            {data.brief.links.instagram ? <Chip>@{data.brief.links.instagram}</Chip> : null}
            <Chip>{data.brief.event.name}</Chip>
          </div>
        </div>
      ) : null}
    </div>
  )
}
