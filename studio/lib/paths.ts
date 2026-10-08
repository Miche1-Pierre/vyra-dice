import path from "node:path"

/*
 * Where the Studio reads and writes. It runs from the repo root (`pnpm studio`, `pnpm studio:job`).
 *
 *   clubs/<slug>/                       the club, as the site reads it (content, plan, brand, ambiance, bundle)
 *   clubs/<slug>/scene.json             its Blender scene
 *   clubs/<slug>/studio/                its history in the Studio (versioned): brief, research note, runs with
 *                                       their logs, renders and captures, reviews, feedback, ratings, lessons
 *   clubs/<slug>/build/                 Blender scene, export, report, previews (gitignored, rebuilt locally)
 *   clubs/<slug>/private/sources/       photos and plans we were given (gitignored: not ours to publish)
 *   studio/playbook/                    the agent's guide, enriched club after club (versioned)
 */

export const REPO = path.resolve(process.env.VYRA_REPO ?? process.cwd())
export const CLUBS_DIR = path.join(REPO, "clubs")
export const PLAYBOOK_DIR = path.join(REPO, "studio", "playbook")

/** Lowercase slug, as in URLs and folder names. */
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Renders and captures (PNG from Blender, JPEG once kept in the history). */
export const IMAGE = /\.(png|jpe?g)$/i

export function clubPaths(slug: string) {
  if (!SLUG.test(slug)) throw new Error(`Invalid club slug: ${slug}`)
  const dir = path.join(CLUBS_DIR, slug)
  const studio = path.join(dir, "studio")
  return {
    dir,
    build: path.join(dir, "build"),
    previews: path.join(dir, "build", "previews"),
    report: path.join(dir, "build", "report.json"),
    blend: path.join(dir, "build", `${slug}.blend`),
    public: path.join(dir, "public"),
    sources: path.join(dir, "private", "sources"),
    studio,
    brief: path.join(studio, "brief.json"),
    /** The sources' list (versioned), the files themselves staying in private/sources. */
    sourcesManifest: path.join(studio, "sources.json"),
    research: path.join(studio, "research.md"),
    runs: path.join(studio, "runs"),
    feedback: path.join(studio, "feedback.json"),
    evals: path.join(studio, "evals.json"),
    captures: path.join(studio, "captures"),
    lessons: path.join(studio, "lessons.json"),
    files: {
      content: path.join(dir, "content.json"),
      layout: path.join(dir, "layout.json"),
      brand: path.join(dir, "brand.json"),
      ambiance: path.join(dir, "ambiance.json"),
      scene: path.join(dir, "scene.json"),
      assets: path.join(dir, "public", "lightmaps.json"),
      index: path.join(dir, "index.ts"),
      readme: path.join(dir, "README.md"),
    },
  }
}

export type ClubPaths = ReturnType<typeof clubPaths>

/** Resolves a path inside a club folder; refuses anything that escapes it. */
export function insideClub(slug: string, relative: string): string {
  const { dir } = clubPaths(slug)
  const full = path.resolve(dir, relative)
  if (full !== dir && !full.startsWith(dir + path.sep))
    throw new Error(`Outside the club folder: ${relative}`)
  return full
}
