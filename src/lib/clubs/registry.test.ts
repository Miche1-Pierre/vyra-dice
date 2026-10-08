import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { getClub, getVenueContent, listClubs, listVenues } from "@/lib/clubs/registry"

/** Names of the materials and nodes of a GLB, read from its JSON chunk. */
function gltfNames(path: string): { materials: Set<string>; nodes: Set<string> } {
  const glb = readFileSync(path)
  if (glb.toString("ascii", 0, 4) !== "glTF" || glb.readUInt32LE(16) !== 0x4e4f534a) {
    throw new Error(`${path} is not a binary glTF`)
  }
  const gltf = JSON.parse(glb.toString("utf8", 20, 20 + glb.readUInt32LE(12))) as {
    materials?: { name?: string }[]
    nodes?: { name?: string }[]
  }
  const names = (items: { name?: string }[] = []) => new Set(items.flatMap((i) => i.name ?? []))
  return { materials: names(gltf.materials), nodes: names(gltf.nodes) }
}

describe("club registry", () => {
  it("serves at least one club", () => {
    expect(listClubs().length).toBeGreaterThan(0)
  })

  it("finds each venue night by club and event slug", () => {
    for (const club of listClubs()) {
      expect(getClub(club.slug)).toBe(club)
      expect(getVenueContent(club.slug, club.content.event.slug)).toBe(club.content)
      expect(getVenueContent(club.slug, "no-such-night")).toBeNull()
    }
  })

  it("returns null for unknown clubs, including prototype keys", () => {
    for (const slug of ["unknown", "constructor", "__proto__", "toString"]) {
      expect(getClub(slug), slug).toBeNull()
      expect(getVenueContent(slug, "samedi"), slug).toBeNull()
    }
  })

  it("lists every venue night for the static routes", () => {
    expect(listVenues()).toEqual(
      listClubs().map((club) => ({ club: club.slug, event: club.content.event.slug })),
    )
  })
})

// What every club folder must hold, whoever (or whatever) generated it.
describe.each(listClubs().map((club) => [club.slug, club] as const))("club %s", (slug, club) => {
  const folder = join(process.cwd(), "clubs", slug)

  it("lives in clubs/<slug>/", () => {
    expect(existsSync(join(folder, "index.ts"))).toBe(true)
  })

  it("ships the model and every lightmap of its manifest", () => {
    const bundle = join(folder, "public")
    expect(existsSync(join(bundle, club.assets.model?.file ?? `${slug}.glb`))).toBe(true)
    for (const [name, lightmap] of Object.entries(club.assets.lightmaps)) {
      expect(existsSync(join(bundle, lightmap.file)), name).toBe(true)
    }
  })

  it("matches its ambiance and its manifest to the model", () => {
    const model = gltfNames(join(folder, "public", club.assets.model?.file ?? `${slug}.glb`))
    for (const material of Object.keys(club.ambiance.finishes)) {
      expect(model.materials.has(material), `finish of unknown material ${material}`).toBe(true)
    }
    for (const node of Object.keys(club.assets.lightmaps)) {
      expect(model.nodes.has(node), `lightmap of unknown node ${node}`).toBe(true)
    }
    if (model.nodes.has("fx_ledrain")) expect(club.ambiance.ledRain, "ledRain").toBeDefined()
    if (model.nodes.has("fx_screen")) expect(club.ambiance.screen, "screen").toBeDefined()
  })

  it("versions its bundle with content hashes", () => {
    expect(club.assets.model?.hash).toBeDefined()
    for (const [name, lightmap] of Object.entries(club.assets.lightmaps)) {
      expect(lightmap.hash, name).toBeDefined()
    }
  })

  it("labels demo data as such", () => {
    if (club.content.club.demo) expect(club.content.club.disclaimer).toMatch(/^Démo/)
  })
})
