import { describe, expect, it } from "vitest"

import { contactMessage, instagramUrl, phoneUrl, whatsappUrl } from "@/lib/contact"

describe("whatsappUrl", () => {
  it("keeps only the digits of the international number", () => {
    expect(whatsappUrl("+33 6 12 34 56 78")).toBe("https://wa.me/33612345678")
  })

  it("prefills the message, encoded", () => {
    expect(whatsappUrl("+33612345678", "Bonjour, table L1 ?")).toBe(
      "https://wa.me/33612345678?text=Bonjour%2C%20table%20L1%20%3F",
    )
  })
})

describe("other channels", () => {
  it("opens the club's Instagram conversation and dials its number", () => {
    expect(instagramUrl("club.demo")).toBe("https://ig.me/m/club.demo")
    expect(phoneUrl("+33 (0)6 12-34-56-78")).toBe("tel:+330612345678")
  })
})

describe("contactMessage", () => {
  it("names the night and, when there is one, the table", () => {
    expect(contactMessage({ clubName: "Club Démo", eventName: "Samedi" })).toBe(
      "Bonjour Club Démo, je regarde la soirée « Samedi » et j’ai une question sur vos tables.",
    )
    expect(
      contactMessage({ clubName: "Club Démo", eventName: "Samedi", tableLabel: "L1" }),
    ).toContain("une question sur la table L1.")
  })
})
