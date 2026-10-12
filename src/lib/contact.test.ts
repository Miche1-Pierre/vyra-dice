import { describe, expect, it } from "vitest"

import {
  contactMessage,
  instagramUrl,
  internationalPhone,
  phoneUrl,
  ticketingSite,
  whatsappUrl,
} from "@/lib/contact"

describe("internationalPhone", () => {
  it("reads a French number without a country code as French", () => {
    const french = { digits: "33612345678", display: "+33 6 12 34 56 78" }
    for (const phone of ["06 12 34 56 78", "06.12.34.56.78", "0612345678"]) {
      expect(internationalPhone(phone), phone).toEqual(french)
    }
  })

  it("keeps the country code of an international number", () => {
    const french = { digits: "33612345678", display: "+33 6 12 34 56 78" }
    expect(internationalPhone("+33 6 12 34 56 78")).toEqual(french)
    expect(internationalPhone("+33 (0)6 12-34-56-78")).toEqual(french)
    expect(internationalPhone("0033 6 12 34 56 78")).toEqual(french)
    expect(internationalPhone("+1 805 259 0503")).toEqual({
      digits: "18052590503",
      display: "+18052590503",
    })
  })

  it("refuses what cannot be a phone number", () => {
    for (const phone of ["12 34", "+0 6 12 34 56 78", "06+12345678", ""]) {
      expect(internationalPhone(phone), phone).toBeNull()
    }
  })
})

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

describe("ticketingSite", () => {
  it("names Shotgun, and other sites by their host", () => {
    expect(ticketingSite("https://shotgun.live/fr/venues/naho-club")).toBe("Shotgun")
    expect(ticketingSite("https://www.billetterie.example/soiree")).toBe("billetterie.example")
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
