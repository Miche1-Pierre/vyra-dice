import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

import { briefSchema, type Brief } from "@studio/lib/brief"
import { listRuns, type RunStatus, type StepId } from "@studio/lib/jobs"
import { CLUBS_DIR, clubPaths, REPO, SLUG } from "@studio/lib/paths"
import { validateClub, type Validation } from "@studio/lib/validate"

/*
 * Where a club stands in the pipeline, read from its files (never from memory): a step is
 * done when its output exists, stale when what it was made from changed since.
 */

/** `skipped`: an agent step of a hand-made club (no brief): nothing to do. */
export type StepState = "todo" | "running" | "done" | "stale" | "failed" | "skipped"

export interface StepView {
  id: StepId | "brief"
  label: string
  state: StepState
  detail?: string
  at?: string
}

export interface ClubSummary {
  slug: string
  name: string
  city: string
  steps: StepView[]
  /** First step that is not done. */
  next: StepView["id"] | null
  lastRun: RunStatus | null
  thumbnail: string | null
  registered: boolean
}

const mtime = (file: string) => (existsSync(file) ? statSync(file).mtimeMs : 0)
const iso = (ms: number) => (ms ? new Date(ms).toISOString() : undefined)

export function readBrief(slug: string): Brief | null {
  const file = clubPaths(slug).brief
  if (!existsSync(file)) return null
  const parsed = briefSchema.safeParse(JSON.parse(readFileSync(file, "utf8")))
  return parsed.success ? parsed.data : null
}

export function isRegistered(slug: string): boolean {
  const registry = readFileSync(path.join(REPO, "clubs", "registry.ts"), "utf8")
  return new RegExp(`from "\\./${slug}"`).test(registry)
}

function readJson<T>(file: string): T | null {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : null
}

/** Every club folder the Studio knows: generated ones (with a brief) and hand-made ones. */
export function listClubSlugs(): string[] {
  return readdirSync(CLUBS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && SLUG.test(d.name))
    .map((d) => d.name)
    .sort()
}

export function clubState(
  slug: string,
): ClubSummary & { validation: Validation; brief: Brief | null } {
  const p = clubPaths(slug)
  const brief = readBrief(slug)
  const runs = listRuns(slug)
  const running = runs.find((r) => r.state === "running" || r.state === "queued")
  // a step's last run: its own, or "Tout générer" when it stopped on that step
  const lastOf = (step: StepId) =>
    runs.find((r) => r.step === step || (r.step === "auto" && r.current === step))
  const validation = validateClub(slug)
  const content = readJson<{ club?: { name?: string; city?: string } }>(p.files.content)

  const sources = existsSync(p.sources) ? readdirSync(p.sources).length : 0
  const specTime = Math.max(
    ...(["content", "layout", "brand", "ambiance", "scene"] as const).map((n) => mtime(p.files[n])),
  )
  const sceneTime = Math.max(mtime(p.files.scene), mtime(p.files.layout))
  const report = readJson<{ checks?: { ok: boolean; name: string }[]; triangles?: number }>(
    p.report,
  )
  const assets = readJson<{ model?: { hash?: string } }>(p.files.assets)
  const registered = isRegistered(slug)
  const reviews = existsSync(path.join(p.studio, "reviews"))
    ? readdirSync(path.join(p.studio, "reviews"))
    : []
  const captures = existsSync(p.captures) ? readdirSync(p.captures) : []
  const published = readJson<{ prUrl?: string; at?: string }>(p.publish)
  const lessons = readJson<{ proposals?: unknown[] }>(p.lessons)

  const view = (
    id: StepView["id"],
    label: string,
    state: StepState,
    detail?: string,
    at?: number,
  ): StepView => {
    const run = id !== "brief" ? lastOf(id) : undefined
    if (running && (running.step === id || running.current === id))
      return { id, label, state: "running", detail: "en cours", at: running.startedAt }
    if (state !== "done" && run?.state === "failed")
      return { id, label, state: "failed", detail: run.error, at: run.endedAt }
    return { id, label, state, detail, at: iso(at ?? 0) }
  }

  const failingChecks = report?.checks?.filter((c) => !c.ok).map((c) => c.name) ?? []
  // made by hand (the Naho): research, review and lessons are the agent's, not its steps
  const handMade = !brief && !!content
  const steps: StepView[] = [
    view(
      "brief",
      "Brief et sources",
      brief || content ? "done" : "todo",
      brief ? `${sources} source(s)` : content ? "club fait main" : undefined,
      mtime(p.brief),
    ),
    view(
      "research",
      "Note de recherche",
      handMade
        ? "skipped"
        : existsSync(p.research)
          ? mtime(p.research) < mtime(p.brief)
            ? "stale"
            : "done"
          : "todo",
      handMade ? "club fait main" : undefined,
      mtime(p.research),
    ),
    view(
      "spec",
      "Spécification du club",
      validation.ok ? "done" : Object.values(validation.files).some(Boolean) ? "failed" : "todo",
      validation.ok ? "valide" : validation.problems[0]?.split("\n")[0],
      specTime,
    ),
    view(
      "build",
      "Construction 3D",
      !report
        ? "todo"
        : mtime(p.report) < sceneTime
          ? "stale"
          : failingChecks.length
            ? "failed"
            : "done",
      report
        ? failingChecks.length
          ? `contrôles : ${failingChecks.join(", ")}`
          : `${report.triangles?.toLocaleString("fr-FR")} triangles`
        : undefined,
      mtime(p.report),
    ),
    view(
      "review",
      "Revue des rendus",
      handMade
        ? "skipped"
        : reviews.length
          ? mtime(path.join(p.studio, "reviews", reviews.sort().at(-1)!)) < mtime(p.report)
            ? "stale"
            : "done"
          : "todo",
      handMade ? "club fait main" : reviews.length ? `${reviews.length} passe(s)` : undefined,
    ),
    view(
      "bake",
      "Éclairage précalculé",
      assets?.model?.hash ? (mtime(p.files.assets) < mtime(p.blend) ? "stale" : "done") : "todo",
      assets?.model?.hash ? `bundle ${assets.model.hash}` : undefined,
      mtime(p.files.assets),
    ),
    view(
      "preview",
      "Aperçu et captures",
      registered && captures.length
        ? mtime(p.captures) < mtime(p.files.assets)
          ? "stale"
          : "done"
        : "todo",
      registered ? `${captures.length} capture(s)` : "non enregistré",
      mtime(p.captures),
    ),
    view(
      "lessons",
      "Leçons pour le guide",
      handMade ? "skipped" : lessons ? "done" : "todo",
      handMade
        ? "club fait main"
        : lessons?.proposals
          ? `${lessons.proposals.length} proposition(s)`
          : undefined,
      mtime(p.lessons),
    ),
    view("publish", "Publication", published ? "done" : "todo", published?.prUrl, mtime(p.publish)),
  ]
  const thumb = path.join(p.previews, "overview.png")
  return {
    slug,
    name: brief?.name ?? content?.club?.name ?? slug,
    city: brief?.city ?? content?.club?.city ?? "",
    steps,
    next: steps.find((s) => s.state !== "done" && s.state !== "skipped")?.id ?? null,
    lastRun: runs[0] ?? null,
    thumbnail: existsSync(thumb) ? "build/previews/overview.png" : null,
    registered,
    validation,
    brief,
  }
}
