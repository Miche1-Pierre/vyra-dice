import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { readLessons } from "@studio/lib/clubs"
import { readEvals, readFeedback } from "@studio/lib/feedback"
import { listRuns, readLog } from "@studio/lib/jobs"
import { clubPaths } from "@studio/lib/paths"
import { clubState } from "@studio/lib/state"

export interface ReviewEntry {
  id: string
  issues?: string[]
  changes?: string[]
  remaining?: string[]
  feedbackAddressed?: string[]
}

function list(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).sort() : []
}

/** Everything the club page shows, read from the club's files. */
export function clubDetail(slug: string, runId?: string) {
  const p = clubPaths(slug)
  const runs = listRuns(slug)
  const shown = runs.find((r) => r.id === runId) ?? runs[0] ?? null
  const reviewsDir = path.join(p.studio, "reviews")
  const report = existsSync(p.report)
    ? (JSON.parse(readFileSync(p.report, "utf8")) as Record<string, unknown>)
    : null
  return {
    ...clubState(slug),
    runs: runs.slice(0, 30),
    shownRun: shown,
    log: shown ? readLog(slug, shown.id) : "",
    sources: list(p.sources),
    previews: list(p.previews).filter((f) => f.endsWith(".png")),
    captures: list(p.captures).filter((f) => f.endsWith(".png")),
    research: existsSync(p.research) ? readFileSync(p.research, "utf8") : null,
    reviews: list(reviewsDir)
      .filter((f) => f.endsWith(".json"))
      .reverse()
      .map((f): ReviewEntry => ({
        ...(JSON.parse(readFileSync(path.join(reviewsDir, f), "utf8")) as Omit<ReviewEntry, "id">),
        id: f.replace(/.json$/, ""),
      })),
    report,
    feedback: readFeedback(slug).items,
    evals: readEvals(slug),
    lessons: readLessons(slug)?.proposals ?? [],
    published: existsSync(p.publish)
      ? (JSON.parse(readFileSync(p.publish, "utf8")) as { prUrl?: string; branch?: string })
      : null,
  }
}

export type ClubDetail = ReturnType<typeof clubDetail>
