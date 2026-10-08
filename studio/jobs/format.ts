import { existsSync } from "node:fs"
import path from "node:path"

import type { RunContext } from "@studio/jobs/context"
import { REPO } from "@studio/lib/paths"

const PRETTIER = path.join(
  path.dirname(require.resolve("prettier/package.json")),
  "bin",
  "prettier.cjs",
)

/** The files of a club the agent writes and the site reads (some are ignored by prettier). */
export const CLUB_TEXT = [
  "content.json",
  "layout.json",
  "brand.json",
  "ambiance.json",
  "scene.json",
  "index.ts",
  "README.md",
  "public/lightmaps.json",
]

/**
 * Formats files of a checkout (the repo, or the publication worktree), given relative to it, with
 * the repo's prettier and config, honouring that checkout's .prettierignore (hand-aligned plans,
 * generated bundles). Runs from the repo, where prettier's plugins resolve. The repo's checks run
 * `prettier --check`, so what the agent writes must pass it. Only the files that changed are logged.
 */
export async function formatFiles(
  ctx: RunContext,
  files: string[],
  root: string = REPO,
): Promise<void> {
  const existing = files.map((f) => path.join(root, f)).filter((f) => existsSync(f))
  if (!existing.length) return
  await ctx.exec(
    process.execPath,
    [
      PRETTIER,
      "--write",
      "--no-color",
      "--config",
      path.join(REPO, ".prettierrc.json"),
      "--ignore-path",
      path.join(root, ".prettierignore"),
      ...existing,
    ],
    { filter: (line) => !line.includes("(unchanged)") },
  )
}
