import { beforeEach, describe, expect, it } from "vitest"

import { useExperience } from "@/lib/store"

const initial = useExperience.getState()
const store = () => useExperience.getState()

beforeEach(() => {
  useExperience.setState(initial, true)
  store().finishIntro()
})

describe("going back", () => {
  it("returns to the list when the table was opened from it", () => {
    store().openPanel("list")
    store().selectTable("l1", { from: "list" })
    expect(store()).toMatchObject({ panel: "table", view: "table" })

    store().back()
    expect(store()).toMatchObject({ panel: "list", selectedTableId: null, view: "overview" })
  })

  it("keeps the way back when switching tables inside the card", () => {
    store().selectTable("l1", { from: "compare" })
    store().selectTable("l2")
    store().closePanel()
    expect(store().panel).toBe("compare")
  })

  it("closes the card when the table was picked in the 3D", () => {
    store().focusZone("lounge")
    store().selectTable("l1")
    store().back()
    expect(store()).toMatchObject({ panel: null, view: "zone", selectedTableId: null })
    store().back()
    expect(store()).toMatchObject({ view: "overview", focusedZoneId: null })
  })
})

describe("request form", () => {
  it("keeps the typing until the request is sent", () => {
    store().saveDraft({ tableId: "l1", idempotencyKey: "key", fullName: "Camille" })
    store().openDialog(null)
    expect(store().draft).toMatchObject({ fullName: "Camille" })

    store().requestSent({ requestId: "DEM-AAAAA", tableId: "l1", demo: true })
    expect(store()).toMatchObject({ draft: null, dialog: "ack" })
  })

  it("starts another table from its own proposed group size", () => {
    store().selectTable("l1")
    store().setGuests(4)
    store().selectTable("l1")
    expect(store().guests).toBe(4)
    store().selectTable("l2")
    expect(store().guests).toBeNull()
  })
})
