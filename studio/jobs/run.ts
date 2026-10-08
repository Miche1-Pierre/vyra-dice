import { RunContext } from "@studio/jobs/context"
import { lessons, research, review, spec } from "@studio/jobs/steps/agent-steps"
import { bake } from "@studio/jobs/steps/bake"
import { build } from "@studio/jobs/steps/build"
import { preview } from "@studio/jobs/steps/preview"
import { publish } from "@studio/jobs/steps/publish"
import type { StepId } from "@studio/lib/jobs"

/*
 * Runs one step of the pipeline for one club, in its own process (started by the Studio):
 *   pnpm studio:job <slug> <run id>
 * Its stdout is the run log; status.json records state, phases and results.
 */

const STEPS: Record<StepId, (ctx: RunContext) => Promise<void>> = {
  research,
  spec,
  build,
  review,
  bake,
  preview,
  lessons,
  publish,
}

async function main(): Promise<void> {
  const [slug, id] = process.argv.slice(2)
  const ctx = new RunContext(slug, id)
  const step = ctx.status.step

  ctx.update({ state: "running", startedAt: new Date().toISOString(), pid: process.pid })
  ctx.log(`Étape « ${step} » — ${slug}`)
  try {
    await STEPS[step](ctx)
    ctx.update({ state: "done", endedAt: new Date().toISOString() })
    ctx.log("Terminé.")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ctx.update({ state: "failed", endedAt: new Date().toISOString(), error: message })
    ctx.log(`Échec : ${message}`)
    process.exitCode = 1
  }
}

void main()
