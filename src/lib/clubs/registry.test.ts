import { existsSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { getClub, getVenueContent, listClubs, listVenues } from "@/lib/clubs/registry"

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
