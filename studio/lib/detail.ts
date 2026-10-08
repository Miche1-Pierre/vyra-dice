import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { readLessons, readSourcesManifest } from "@studio/lib/clubs"
import { readEvals, readFeedback } from "@studio/lib/feedback"
import { listRuns, readLog } from "@studio/lib/jobs"
import { clubPaths, IMAGE } from "@studio/lib/paths"
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

/** Images a run kept (renders of each build, site captures), relative to the club folder. */
function runMedia(slug: string, runId: string): { renders: string[][]; captures: string[] } {
  const base = path.join("studio", "runs", runId)
  const dir = path.join(clubPaths(slug).runs, runId)
  const images = (rel: string) =>
    list(path.join(dir, rel))
      .filter((f) => IMAGE.test(f))
      .map((f) => [base, rel, f].join("/").replace(/\\/g, "/"))
  return {
    renders: list(path.join(dir, "renders"))
      .sort((a, b) => Number(a) - Number(b))
      .map((n) => images(`renders/${n}`)),
    captures: images("captures"),
  }
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
    shownMedia: shown ? runMedia(slug, shown.id) : { renders: [], captures: [] },
    sources: list(p.sources),
    // listed in the history but kept on the machine of whoever added them
    missingSources: readSourcesManifest(slug).filter(
      (s) => !existsSync(path.join(p.sources, s.file)),
    ),
    previews: list(p.previews).filter((f) => f.endsWith(".png")),
    captures: list(p.captures).filter((f) => IMAGE.test(f)),
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
    // the pull request of the last share
    sharedPr:
      (
        runs.find((r) => r.step === "publish" && r.state === "done")?.result as
          { prUrl?: string } | undefined
      )?.prUrl ?? null,
  }
}

export type ClubDetail = ReturnType<typeof clubDetail>
