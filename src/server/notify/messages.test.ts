import { describe, expect, it } from "vitest"

import {
  managerEmail,
  managerWhatsAppParameters,
  templateParameter,
} from "@/server/notify/messages"
import { requestDetails } from "@/test/fixtures"

describe("managerEmail", () => {
  it("names the request, the table and the buyer in the subject and the text", () => {
    const { subject, text } = managerEmail(requestDetails())
    expect(subject).toBe("[Démo] Nouvelle demande · Table L1 · Samedi · 5 pers. · DEM-7K2QF")
    expect(text).toContain("Client : Camille Martin")
    expect(text).toContain("Téléphone : +33 6 12 34 56 78")
    expect(text).toContain("E-mail : camille@example.com")
    expect(text).toContain("Soirée : Samedi · samedi 10 octobre")
    expect(text).toContain("Arrivée : 00h30")
    expect(text).toMatch(/Minimum : 350\s€ pour 5 personnes/)
    expect(text).toMatch(/Acompte : 70\s€ si le club confirme/)
    expect(text).toContain("Ce n’est pas une réservation")
    expect(text).toContain(
      "Reçue le 10/10/2026 23:42 (heure de Paris) · source : instagram · story",
    )
    expect(text).toContain("Démo : cette demande vient de la démo Club Démo")
  })

  it("lets the manager answer the buyer in one tap", () => {
    const { html, text } = managerEmail(requestDetails())
    const answer = encodeURIComponent(
      "Bonjour Camille, ici Club Démo, au sujet de votre demande DEM-7K2QF pour la table L1 (Samedi).",
    )
    expect(html).toContain(`href="https://wa.me/33612345678?text=${answer}"`)
    expect(html).toContain('href="tel:+33612345678"')
    expect(html).toContain('href="mailto:camille@example.com?subject=')
    expect(text).toContain("Répondre sur WhatsApp : https://wa.me/33612345678?text=")
  })

  it("escapes what the buyer typed and keeps the message's line breaks", () => {
    const { html } = managerEmail(
      requestDetails({
        buyer: {
          ...requestDetails().buyer,
          firstName: "<script>",
          message: 'Bouteilles <b>"VIP"</b>\nMerci',
        },
      }),
    )
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt; Martin")
    expect(html).toContain("Bouteilles &lt;b&gt;&quot;VIP&quot;&lt;/b&gt;<br>Merci")
  })

  it("drops the demo marks and the price for a live club with a table on request", () => {
    const { subject, text } = managerEmail(
      requestDetails({ demo: false, quote: { minimumSpend: null, deposit: null } }),
    )
    expect(subject).toBe("Nouvelle demande · Table L1 · Samedi · 5 pers. · DEM-7K2QF")
    expect(text).toContain("Minimum : sur demande")
    expect(text).not.toContain("Acompte")
    expect(text).not.toContain("démo")
  })

  it("shows a number it cannot read as typed, with no WhatsApp link", () => {
    const { html } = managerEmail(
      requestDetails({ buyer: { ...requestDetails().buyer, phone: "06 12 34 56 7" } }),
    )
    expect(html).not.toContain("wa.me")
    expect(html).toContain(">06 12 34 56 7</a>")
  })
})

describe("managerWhatsAppParameters", () => {
  it("fills the six variables of the template, one line each", () => {
    const parameters = managerWhatsAppParameters(requestDetails())
    expect(parameters).toHaveLength(6)
    expect(parameters[0]).toBe("DEM-7K2QF (démo)")
    expect(parameters[1]).toBe("Samedi du samedi 10 octobre au Club Démo")
    expect(parameters[2]).toMatch(
      /^L1 \(Lounge\) · 5 pers\. · arrivée 00h30 · minimum 350 € · acompte 70 €$/,
    )
    expect(parameters[3]).toBe("Camille Martin")
    expect(parameters[4]).toBe("+33 6 12 34 56 78 · camille@example.com")
    expect(parameters[5]).toBe("Anniversaire / Deux bouteilles")
    for (const parameter of parameters) expect(parameter).not.toMatch(/[\n\t]| {2,}/)
  })

  it("says when there is no message and no price", () => {
    const parameters = managerWhatsAppParameters(
      requestDetails({
        demo: false,
        quote: { minimumSpend: null, deposit: null },
        buyer: { ...requestDetails().buyer, message: undefined },
      }),
    )
    expect(parameters[0]).toBe("DEM-7K2QF")
    expect(parameters[2]).toContain("prix sur demande")
    expect(parameters[5]).toBe("aucun")
  })
})

describe("templateParameter", () => {
  it("keeps one line, cut with an ellipsis, never empty", () => {
    expect(templateParameter("a\n\tb    c", 20)).toBe("a b c")
    expect(templateParameter("x".repeat(30), 10)).toBe(`${"x".repeat(9)}…`)
    expect(templateParameter("   ", 10)).toBe("—")
  })
})
