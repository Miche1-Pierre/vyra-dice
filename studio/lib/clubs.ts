import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { briefSchema, slugify, type Brief } from "@studio/lib/brief"
import { commitPaths, ensureWorkBranch } from "@studio/lib/git"
import { clubPaths, PLAYBOOK_DIR, SLUG } from "@studio/lib/paths"

/** Image and plan formats the agent can read (Read shows images; PDFs are plans). */
const SOURCE_TYPES = /\.(png|jpe?g|webp|gif|pdf)$/i
const MAX_SOURCE_BYTES = 25 * 1024 * 1024

export function safeFileName(name: string): string {
  const base = path.basename(name).normalize("NFD").replace(/[̀-ͯ]/g, "")
  const clean = base
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "")
  return clean.slice(-80) || "source"
}

export interface SourceEntry {
  file: string
  bytes: number
  sha256: string
  addedAt: string
}

/** What sources the club was made from: versioned, unlike the files (not ours to publish). */
export function readSourcesManifest(slug: string): SourceEntry[] {
  const file = clubPaths(slug).sourcesManifest
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as SourceEntry[]) : []
}

/**
 * Saves uploaded photos and plans in private/sources (never committed: the repo is public) and
 * lists them in studio/sources.json (committed), so the history says what the club was made from.
 */
export async function saveSources(slug: string, files: File[]): Promise<string[]> {
  const p = clubPaths(slug)
  const dir = p.sources
  mkdirSync(dir, { recursive: true })
  const manifest = readSourcesManifest(slug)
  const saved: string[] = []
  for (const file of files) {
    if (!file.size) continue
    if (!SOURCE_TYPES.test(file.name)) throw new Error(`Format non pris en charge : ${file.name}`)
    if (file.size > MAX_SOURCE_BYTES)
      throw new Error(`Fichier trop lourd (25 Mo max) : ${file.name}`)
    const bytes = Buffer.from(await file.arrayBuffer())
    const sha256 = createHash("sha256").update(bytes).digest("hex")
    // a source already listed (added on another machine) comes back under its name
    const known = manifest.find((m) => m.sha256 === sha256)
    let name = known?.file ?? safeFileName(file.name)
    if (!known) {
      for (let i = 2; existsSync(path.join(dir, name)); i++)
        name = name.replace(/(\.\w+)$/, `-${i}$1`)
      manifest.push({ file: name, bytes: bytes.length, sha256, addedAt: new Date().toISOString() })
    }
    writeFileSync(path.join(dir, name), bytes)
    saved.push(name)
  }
  if (saved.length) {
    mkdirSync(p.studio, { recursive: true })
    writeFileSync(p.sourcesManifest, JSON.stringify(manifest, null, 2))
  }
  return saved
}

export interface NewClubInput {
  name: string
  city: string
  address?: string
  website?: string
  instagram?: string
  brief?: string
  eventName?: string
}

/** Creates clubs/<slug>/studio/brief.json; the agent does the rest. */
export function createClub(input: NewClubInput): Brief {
  const slug = slugify(input.name)
  if (!SLUG.test(slug)) throw new Error("Nom de club invalide")
  const p = clubPaths(slug)
  if (existsSync(p.dir)) throw new Error(`Le dossier clubs/${slug}/ existe déjà`)
  const brief = briefSchema.parse({
    slug,
    name: input.name,
    city: input.city,
    address: input.address || undefined,
    links: {
      website: input.website || undefined,
      instagram: input.instagram?.replace(/^@/, "") || undefined,
      other: [],
    },
    brief: input.brief ?? "",
    event: {
      name: input.eventName || "Samedi soir",
      slug: slugify(input.eventName || "samedi") || "samedi",
    },
    createdAt: new Date().toISOString(),
  })
  mkdirSync(p.studio, { recursive: true })
  mkdirSync(p.sources, { recursive: true })
  writeFileSync(p.brief, JSON.stringify(brief, null, 2))
  return brief
}

export interface LessonProposal {
  id: string
  title: string
  text: string
  decision?: "accepted" | "rejected"
}

export function readLessons(slug: string): { proposals: LessonProposal[] } | null {
  const file = clubPaths(slug).lessons
  return existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")) as { proposals: LessonProposal[] })
    : null
}

/**
 * Adds a lesson at the end of its club's section (created at the end of the file if needed), so
 * a club's lessons read in the order they were accepted.
 */
export function appendLesson(content: string, heading: string, entry: string): string {
  const start = content.indexOf(heading)
  if (start === -1) return `${content.trimEnd()}\n\n${heading}\n\n${entry}\n`
  const after = content.indexOf("\n## ", start + heading.length)
  const section = content.slice(0, after === -1 ? content.length : after).trimEnd()
  return `${section}\n${entry}\n${after === -1 ? "" : `\n${content.slice(after + 1)}`}`
}

/**
 * Accepting a lesson appends it to the versioned playbook and commits it on the work branch
 * (never on main; it reaches main with the club's next share): the git history is the history
 * of what each club taught us.
 */
export function decideLesson(slug: string, id: string, decision: "accepted" | "rejected"): void {
  const data = readLessons(slug)
  const lesson = data?.proposals.find((l) => l.id === id)
  if (!data || !lesson) throw new Error("Leçon introuvable")
  if (lesson.decision) return
  lesson.decision = decision
  writeFileSync(clubPaths(slug).lessons, JSON.stringify(data, null, 2))
  if (decision !== "accepted") return
  const file = path.join(PLAYBOOK_DIR, "lessons.md")
  const content = readFileSync(file, "utf8")
  const brief = existsSync(clubPaths(slug).brief)
    ? (JSON.parse(readFileSync(clubPaths(slug).brief, "utf8")) as { name: string; city: string })
    : { name: slug, city: "" }
  const heading = `## ${brief.name}${brief.city ? ` (${brief.city})` : ""} — ${new Date().toISOString().slice(0, 10)}`
  writeFileSync(file, appendLesson(content, heading, `- **${lesson.title}** : ${lesson.text}`))
  try {
    ensureWorkBranch(slug)
    commitPaths(["studio/playbook/lessons.md"], `docs(studio): add a lesson from ${slug}`, {
      body: lesson.title,
    })
  } catch {
    // the lesson stays in the file and leaves with the next share; committing is a convenience
  }
}
