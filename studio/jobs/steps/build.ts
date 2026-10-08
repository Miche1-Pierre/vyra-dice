import { existsSync, readFileSync } from "node:fs"

import { BLENDER, blenderNoise, type RunContext } from "@studio/jobs/context"
import { keepRenders } from "@studio/jobs/history"
import { validateClub } from "@studio/lib/validate"

interface Report {
  objects: number
  triangles: number
  lights: number
  checks: { name: string; ok: boolean }[]
  previews?: string[]
}

/** Construction 3D: the generic builder on the club's plan and scene, with review renders. */
export async function build(ctx: RunContext): Promise<void> {
  await ctx.phase("Vérification de la spécification", async () => {
    const v = validateClub(ctx.slug)
    if (!v.ok) {
      ctx.log(v.problems.join("\n"))
      throw new Error("Spécification invalide : corriger avant de construire")
    }
  })
  await ctx.phase("Construction Blender et aperçus", () =>
    ctx.exec(
      BLENDER,
      ["-b", "-P", "art/scripts/build_club.py", "--", "--club", ctx.slug, "--previews"],
      {
        filter: blenderNoise,
      },
    ),
  )
  if (!existsSync(ctx.paths.report)) throw new Error("Pas de rapport de construction")
  const report = JSON.parse(readFileSync(ctx.paths.report, "utf8")) as Report
  ctx.setResult({ objects: report.objects, triangles: report.triangles, lights: report.lights })
  await keepRenders(ctx)
  const failing = report.checks.filter((c) => !c.ok)
  ctx.log(
    `${report.objects} objets, ${report.triangles.toLocaleString("fr-FR")} triangles, ${report.lights} lumières`,
  )
  if (failing.length)
    throw new Error(`Contrôles en échec : ${failing.map((c) => c.name).join(", ")}`)
}
