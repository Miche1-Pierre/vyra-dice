import { afterEach, describe, expect, it, vi } from "vitest"

import { mailbox, sendEmail, type Email } from "@/server/notify/resend"
import { sendWhatsAppTemplate } from "@/server/notify/whatsapp"

const resend = { apiKey: "re_test", from: "demandes@notifications.example.com" }
const whatsapp = {
  token: "EAAG",
  phoneNumberId: "1234567890",
  template: "nouvelle_demande_table",
  language: "fr",
  apiVersion: "v23.0",
}

const email: Email = {
  fromName: "VYRA",
  to: ["equipe@example.com"],
  replyTo: ["camille@example.com"],
  subject: "Nouvelle demande",
  html: "<p>Camille Martin</p>",
  text: "Camille Martin",
  tags: { kind: "request", club: "demo" },
}

/** A fetch answering `status` with `body`, recording what it was asked. */
function fakeFetch(status: number, body: unknown = {}) {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("mailbox", () => {
  it("quotes the display name, without quotes or line breaks of its own", () => {
    expect(mailbox("809 Social Club via VYRA", "a@example.com")).toBe(
      '"809 Social Club via VYRA" <a@example.com>',
    )
    expect(mailbox('Club "Démo"\r\nBcc: x', "a@example.com")).toBe(
      '"Club DémoBcc: x" <a@example.com>',
    )
  })
})

describe("sendEmail", () => {
  it("posts the e-mail to Resend with its idempotency key", async () => {
    const fetchImpl = fakeFetch(200, { id: "49a3999c" })
    const outcome = await sendEmail(resend, email, {
      idempotencyKey: "request/key/manager",
      fetch: fetchImpl,
    })
    expect(outcome).toBe("sent")
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe("https://api.resend.com/emails")
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer re_test",
      "Idempotency-Key": "request/key/manager",
    })
    expect(JSON.parse(String(init?.body))).toEqual({
      from: '"VYRA" <demandes@notifications.example.com>',
      to: ["equipe@example.com"],
      reply_to: ["camille@example.com"],
      subject: "Nouvelle demande",
      html: "<p>Camille Martin</p>",
      text: "Camille Martin",
      tags: [
        { name: "kind", value: "request" },
        { name: "club", value: "demo" },
      ],
    })
  })

  it("takes Resend's 409 for an e-mail already sent with the same key", async () => {
    const outcome = await sendEmail(resend, email, {
      idempotencyKey: "k",
      fetch: fakeFetch(409, { name: "invalid_idempotent_request" }),
    })
    expect(outcome).toBe("already_sent")
  })

  it("reports a refusal or a network error without logging the e-mail", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    const refused = fakeFetch(422, {
      name: "validation_error",
      message: "Invalid `to` field: camille@example.com",
    })
    expect(await sendEmail(resend, email, { idempotencyKey: "k", fetch: refused })).toBe("failed")
    const offline = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed")
    })
    expect(await sendEmail(resend, email, { idempotencyKey: "k", fetch: offline })).toBe("failed")
    expect(log).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(log.mock.calls)).toContain("validation_error")
    expect(JSON.stringify(log.mock.calls)).not.toContain("camille")
  })
})

describe("sendWhatsAppTemplate", () => {
  it("sends the template with its variables to the number", async () => {
    const fetchImpl = fakeFetch(200, { messages: [{ id: "wamid.1" }] })
    const outcome = await sendWhatsAppTemplate(whatsapp, "33612345678", ["DEM-7K2QF", "Samedi"], {
      fetch: fetchImpl,
    })
    expect(outcome).toBe("sent")
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe("https://graph.facebook.com/v23.0/1234567890/messages")
    expect(init?.headers).toMatchObject({ Authorization: "Bearer EAAG" })
    expect(JSON.parse(String(init?.body))).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "33612345678",
      type: "template",
      template: {
        name: "nouvelle_demande_table",
        language: { code: "fr" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "DEM-7K2QF" },
              { type: "text", text: "Samedi" },
            ],
          },
        ],
      },
    })
  })

  it("logs Meta's error code, never the message or the variables", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    const refused = fakeFetch(400, {
      error: { code: 131030, message: "Recipient +33612345678 not in allowed list" },
    })
    expect(
      await sendWhatsAppTemplate(whatsapp, "33612345678", ["Camille"], { fetch: refused }),
    ).toBe("failed")
    const logged = JSON.stringify(log.mock.calls)
    expect(logged).toContain("131030")
    expect(logged).not.toContain("33612345678")
    expect(logged).not.toContain("Camille")
  })
})
