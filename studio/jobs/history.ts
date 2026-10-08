import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs"
import path from "node:path"

import sharp from "sharp"

import type { RunContext } from "@studio/jobs/context"
import { IMAGE } from "@studio/lib/paths"

/*
 * What each run produced stays in its folder (clubs/<slug>/studio/runs/<id>/), so the history
 * shows every version, not only the last one: the renders of each build, the site captures of
 * each preview. JPEG, light enough to be versioned.
 */

/** The renders of the build just made: runs/<id>/renders/<n>/ (a review builds several times). */
export async function keepRenders(ctx: RunContext): Promise<void> {
  if (!existsSync(ctx.paths.previews)) return
  const base = path.join(ctx.paths.runs, ctx.id, "renders")
  const dir = path.join(base, String((existsSync(base) ? readdirSync(base).length : 0) + 1))
  mkdirSync(dir, { recursive: true })
  for (const file of readdirSync(ctx.paths.previews).filter((f) => IMAGE.test(f))) {
    await sharp(path.join(ctx.paths.previews, file))
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(path.join(dir, file.replace(IMAGE, ".jpg")))
  }
}

/** The site captures of this preview: runs/<id>/captures/. */
export function keepCaptures(ctx: RunContext): void {
  if (!existsSync(ctx.paths.captures)) return
  const dir = path.join(ctx.paths.runs, ctx.id, "captures")
  mkdirSync(dir, { recursive: true })
  for (const file of readdirSync(ctx.paths.captures).filter((f) => IMAGE.test(f))) {
    copyFileSync(path.join(ctx.paths.captures, file), path.join(dir, file))
  }
}
