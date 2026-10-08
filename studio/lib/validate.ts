import { existsSync, readFileSync } from "node:fs"

import { defineClub } from "@/lib/clubs/club"
import { clubPaths } from "@studio/lib/paths"
import { checkScene, type Scene } from "@studio/lib/scene-schema"

export interface Validation {
  ok: boolean
  /** Files of the club spec, present or not. */
  files: Record<"content" | "layout" | "brand" | "ambiance" | "scene", boolean>
  problems: string[]
}

function readJson(file: string): { value?: unknown; error?: string } {
  try {
    return { value: JSON.parse(readFileSync(file, "utf8")) }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Checks a generated club the way the site and the builder will read it: every file against its
 * schema, content against plan (defineClub), the Blender scene, and what ties them together.
 * Before the bake there is no bundle yet: an empty manifest stands in for it.
 */
export function validateClub(slug: string): Validation {
  const p = clubPaths(slug)
  const names = ["content", "layout", "brand", "ambiance", "scene"] as const
  const files = Object.fromEntries(
    names.map((n) => [n, existsSync(p.files[n])]),
  ) as Validation["files"]
  const problems: string[] = []
  const json: Record<string, unknown> = {}
  for (const name of names) {
    if (!files[name]) {
      problems.push(`${name}.json manquant`)
      continue
    }
    const { value, error } = readJson(p.files[name])
    if (error) problems.push(`${name}.json illisible : ${error}`)
    else json[name] = value
  }
  if (problems.length) return { ok: false, files, problems }

  const assets = existsSync(p.files.assets)
    ? readJson(p.files.assets).value
    : { version: 1, club: slug, encoding: "srgb", lightmaps: {} }
  try {
    const club = defineClub({
      content: json.content,
      layout: json.layout,
      brand: json.brand,
      ambiance: json.ambiance,
      assets,
    })
    if (club.slug !== slug) problems.push(`content.json : slug "${club.slug}", attendu "${slug}"`)
    if (!club.content.club.demo) {
      problems.push("content.json : un club généré est une démo (club.demo = true)")
    }
    const scene = json.scene as Scene
    const sceneProblems = checkScene(scene)
    problems.push(...sceneProblems.map((m) => `scene.json\n${m}`))
    if (!sceneProblems.length) {
      const blenderNames = new Set(Object.values(scene.materials).map((m) => m.name))
      for (const material of Object.keys(club.ambiance.finishes)) {
        if (!blenderNames.has(material)) {
          problems.push(
            `ambiance.json : finition pour "${material}", absente de scene.json (materials.*.name)`,
          )
        }
      }
    }
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error))
  }
  return { ok: problems.length === 0, files, problems }
}
