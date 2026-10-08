import { existsSync } from "node:fs"

import { BLENDER, blenderNoise, type RunContext } from "@studio/jobs/context"

/**
 * Éclairage précalculé: Cycles lightmaps + glTF export, then the web bundle (meshopt, WebP,
 * content hashes) in clubs/<slug>/public. `quality: "draft"` bakes at half resolution, faster.
 */
export async function bake(ctx: RunContext): Promise<void> {
  if (!existsSync(ctx.paths.blend))
    throw new Error("Pas de scène construite : lancer la construction 3D")
  const draft = ctx.options.quality === "draft"
  const extra = draft ? ["--samples", "128", "--res-scale", "0.5"] : []
  await ctx.phase(draft ? "Bake des lightmaps (brouillon)" : "Bake des lightmaps (final)", () =>
    ctx.exec(
      BLENDER,
      [
        "-b",
        ctx.paths.blend,
        "-P",
        "art/scripts/bake_export.py",
        "--",
        "--club",
        ctx.slug,
        ...extra,
      ],
      {
        filter: (line) =>
          blenderNoise(line) &&
          (/\[bake\]|Error|Traceback|error/i.test(line) || line.startsWith("  ")),
      },
    ),
  )
  await ctx.phase("Optimisation web", () =>
    ctx.exec(process.execPath, ["scripts/optimize-glb.mjs", ctx.slug]),
  )
  ctx.setResult({ quality: draft ? "draft" : "final" })
}
