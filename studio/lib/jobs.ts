import { spawn } from "node:child_process"
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

import { clubPaths, REPO } from "@studio/lib/paths"

/*
 * A run = one step of the pipeline for one club, executed by `studio/jobs/run.ts` in its own
 * detached process. It writes clubs/<slug>/studio/runs/<id>/status.json and log.txt: the Studio only
 * reads them, so runs survive a Studio restart and a failed step can be relaunched alone.
 */

export const STEPS = [
  "research",
  "spec",
  "build",
  "review",
  "bake",
  "preview",
  "lessons",
  "publish",
  "auto",
] as const
export type StepId = (typeof STEPS)[number]

export interface Phase {
  name: string
  startedAt: string
  endedAt?: string
  ok?: boolean
}

export interface RunStatus {
  id: string
  step: StepId
  state: "queued" | "running" | "done" | "failed"
  options: Record<string, unknown>
  createdAt: string
  startedAt?: string
  endedAt?: string
  pid?: number
  error?: string
  phases: Phase[]
  /** Step results: agent turns and cost, build triangles, PR url… */
  result?: Record<string, unknown>
  /** The step an "auto" run is on. */
  current?: StepId
}

function runDir(slug: string, id: string): string {
  if (!/^[\w-]+$/.test(id)) throw new Error(`Invalid run id: ${id}`)
  return path.join(clubPaths(slug).runs, id)
}

export function readRun(slug: string, id: string): RunStatus | null {
  const file = path.join(runDir(slug, id), "status.json")
  if (!existsSync(file)) return null
  const status = JSON.parse(readFileSync(file, "utf8")) as RunStatus
  // a run whose process died without writing its end is a failure, not a forever-spinner
  if (
    (status.state === "running" || status.state === "queued") &&
    status.pid &&
    !alive(status.pid)
  ) {
    return { ...status, state: "failed", error: status.error ?? "Processus interrompu" }
  }
  return status
}

export function readLog(slug: string, id: string, maxBytes = 64_000): string {
  const file = path.join(runDir(slug, id), "log.txt")
  if (!existsSync(file)) return ""
  const text = readFileSync(file, "utf8")
  return text.length > maxBytes ? text.slice(-maxBytes) : text
}

export function listRuns(slug: string): RunStatus[] {
  const dir = clubPaths(slug).runs
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .sort()
    .reverse()
    .map((id) => readRun(slug, id))
    .filter((r): r is RunStatus => r !== null)
}

export function activeRun(slug: string): RunStatus | null {
  return listRuns(slug).find((r) => r.state === "running" || r.state === "queued") ?? null
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const require = createRequire(path.join(REPO, "package.json"))

/** Starts one step in a detached process; refuses while another step of the club runs. */
export function startRun(
  slug: string,
  step: StepId,
  options: Record<string, unknown> = {},
): RunStatus {
  if (!STEPS.includes(step)) throw new Error(`Unknown step: ${step}`)
  const busy = activeRun(slug)
  if (busy) throw new Error(`Une étape tourne déjà pour ce club : ${busy.step}`)
  const id = `${new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14)}-${step}`
  const dir = runDir(slug, id)
  mkdirSync(dir, { recursive: true })
  const status: RunStatus = {
    id,
    step,
    state: "queued",
    options,
    createdAt: new Date().toISOString(),
    phases: [],
  }
  writeFileSync(path.join(dir, "status.json"), JSON.stringify(status, null, 2))
  const log = openSync(path.join(dir, "log.txt"), "a")
  const tsx = require.resolve("tsx/cli")
  const child = spawn(
    process.execPath,
    [
      tsx,
      "--tsconfig",
      path.join(REPO, "studio", "tsconfig.json"),
      path.join(REPO, "studio", "jobs", "run.ts"),
      slug,
      id,
    ],
    {
      cwd: REPO,
      detached: true,
      stdio: ["ignore", log, log],
      windowsHide: true,
      env: { ...process.env, FORCE_COLOR: "0" },
    },
  )
  child.unref()
  closeSync(log)
  writeFileSync(
    path.join(dir, "status.json"),
    JSON.stringify({ ...status, pid: child.pid }, null, 2),
  )
  return { ...status, pid: child.pid }
}
