import { describe, expect, it } from "vitest"

import { defineClub, type ClubFiles } from "@/lib/clubs/club"
import { listClubs } from "@/lib/clubs/registry"

/** Valid files to break: a copy of the first registered club's. */
function files() {
  const { content, layout, brand, ambiance, assets } = structuredClone(listClubs()[0])
  return { content, layout, brand, ambiance, assets }
}

const reject = (input: ClubFiles) => () => defineClub(input)

describe("defineClub", () => {
  it("accepts the files of a registered club", () => {
    expect(defineClub(files())).toEqual(listClubs()[0])
  })

  it("reports every invalid file in a single error", () => {
    const f = files()
    expect(
      reject({
        ...f,
        content: { ...f.content, tables: [] },
        assets: { ...f.assets, encoding: "linear" },
      }),
    ).toThrow(/content\.json[\s\S]*public\/lightmaps\.json/)
  })

  it("rejects a table that is not in the plan, and a planned table without content", () => {
    const f = files()
    const id = f.content.tables[0].id
    f.content.tables[0].id = "zz9"
    expect(reject(f)).toThrow(
      new RegExp(`table "zz9" is not in layout\\.json[\\s\\S]*table "${id}" has no content`),
    )
  })

  it("rejects a table filed in another zone than the plan's", () => {
    const f = files()
    const table = f.content.tables[0]
    const other = f.content.zones.find((zone) => zone.id !== table.zoneId)!
    table.zoneId = other.id
    expect(reject(f)).toThrow(new RegExp(`table "${table.id}" is in zone "${other.id}"`))
  })

  it("rejects a zone whose tier differs from the plan's", () => {
    const f = files()
    const zone = f.content.zones[0]
    zone.tier = zone.tier === "vip" ? "lounge" : "vip"
    expect(reject(f)).toThrow(new RegExp(`zone "${zone.id}" is ${zone.tier}, layout\\.json says`))
  })

  it("accepts standing areas sold as tickets, and rejects one side without the other", () => {
    const f = files()
    f.layout.standing = [{ id: "ga", level: 0, x: [-2, 2], y: [0, 4], facing: 90 }]
    f.content.tickets = [
      {
        id: "ga",
        name: "Fosse",
        shortName: "Fosse",
        description: "Debout, devant la scène.",
        fromPrice: 15,
        url: "https://shotgun.live/fr/events/demo",
      },
    ]
    expect(defineClub(f).content.tickets).toHaveLength(1)

    const noArea = files()
    noArea.content.tickets = f.content.tickets
    expect(reject(noArea)).toThrow(/ticket "ga" has no standing area in layout\.json/)

    const noTicket = files()
    noTicket.layout.standing = f.layout.standing
    expect(reject(noTicket)).toThrow(/standing area "ga" has no ticket/)
  })

  it("rejects files that belong to another club", () => {
    const f = files()
    f.assets.club = "another-club"
    expect(reject(f)).toThrow(/public\/lightmaps\.json: club "another-club"/)
  })
})
