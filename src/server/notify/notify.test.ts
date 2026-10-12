import { afterEach, describe, expect, it, vi } from "vitest"

import type { NotifyConfig } from "@/server/notify/config"
import { acknowledgeBuyer, canNotify, notifyManager } from "@/server/notify/notify"
import { requestDetails } from "@/test/fixtures"

const config: NotifyConfig = {
  resend: { apiKey: "re_test", from: "demandes@notifications.example.com" },
  whatsapp: {
    token: "EAAG",
    phoneNumberId: "1234567890",
    template: "nouvelle_demande_table",
    language: "fr",
    apiVersion: "v23.0",
  },
  team: { emails: ["equipe@example.com"], whatsapp: ["33612345678", "33700000000"] },
}

/** Answers each service with the given status, and records the calls. */
function services({ resend = 200, meta = 200 }: { resend?: number; meta?: number | number[] }) {
  const metaStatuses = Array.isArray(meta) ? [...meta] : null
  return vi.fn<typeof fetch>(async (input) => {
    const url = String(input)
    const status = url.includes("resend") ? resend : (metaStatuses?.shift() ?? (meta as number))
    return new Response("{}", { status })
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("canNotify", () => {
  it("needs one channel set up with someone to write to", () => {
    expect(canNotify(config, config.team)).toBe(true)
    expect(canNotify({ ...config, whatsapp: null }, { emails: [], whatsapp: ["1"] })).toBe(false)
    expect(canNotify({ ...config, resend: null }, { emails: ["a@b.fr"], whatsapp: [] })).toBe(false)
    expect(canNotify({ resend: null, whatsapp: null, team: config.team }, config.team)).toBe(false)
  })
})

describe("notifyManager", () => {
  it("sends the e-mail once to the team and the WhatsApp message to each number", async () => {
    const fetchImpl = services({})
    const report = await notifyManager(requestDetails(), config, config.team, {
      fetch: fetchImpl,
    })
    expect(report).toEqual({ transmitted: true, email: "sent", whatsapp: "sent" })
    const calls = fetchImpl.mock.calls.map(([url, init]) => ({
      url: String(url),
      body: JSON.parse(String(init?.body)),
      headers: init?.headers as Record<string, string>,
    }))
    const email = calls.find((call) => call.url.includes("resend"))
    expect(email?.body).toMatchObject({
      from: '"VYRA (démo)" <demandes@notifications.example.com>',
      to: ["equipe@example.com"],
      reply_to: ["camille@example.com"],
    })
    expect(email?.headers["Idempotency-Key"]).toBe(
      "request/0b8c2c6e-3f1a-4d7e-9f2a-6f1c2d3e4a5b/manager",
    )
    const messages = calls.filter((call) => call.url.includes("graph.facebook.com"))
    expect(messages.map((call) => call.body.to)).toEqual(["33612345678", "33700000000"])
  })

  it("is transmitted when one channel reached the team", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(
      await notifyManager(requestDetails(), config, config.team, {
        fetch: services({ resend: 500 }),
      }),
    ).toEqual({ transmitted: true, email: "failed", whatsapp: "sent" })
    expect(
      await notifyManager(requestDetails(), config, config.team, {
        fetch: services({ meta: [400, 200] }),
      }),
    ).toEqual({ transmitted: true, email: "sent", whatsapp: "sent" })
  })

  it("is not transmitted when every channel failed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(
      await notifyManager(requestDetails(), config, config.team, {
        fetch: services({ resend: 500, meta: 400 }),
      }),
    ).toEqual({ transmitted: false, email: "failed", whatsapp: "failed" })
  })

  it("leaves a channel off when it is not set up", async () => {
    const fetchImpl = services({})
    const report = await notifyManager(
      requestDetails(),
      { ...config, whatsapp: null },
      config.team,
      { fetch: fetchImpl },
    )
    expect(report).toEqual({ transmitted: true, email: "sent", whatsapp: "off" })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe("acknowledgeBuyer", () => {
  it("sends the summary to the buyer from VYRA for a demo, answered by the team", async () => {
    const fetchImpl = services({})
    expect(
      await acknowledgeBuyer(requestDetails(), config, ["equipe@example.com"], {
        fetch: fetchImpl,
      }),
    ).toBe("sent")
    const [url, init] = fetchImpl.mock.calls[0]
    expect(String(url)).toBe("https://api.resend.com/emails")
    expect(JSON.parse(String(init?.body))).toMatchObject({
      from: '"VYRA (démo)" <demandes@notifications.example.com>',
      to: ["camille@example.com"],
      reply_to: ["equipe@example.com"],
      subject: "[Démo] Club Démo · Demande reçue · DEM-7K2QF",
    })
    expect((init?.headers as Record<string, string>)["Idempotency-Key"]).toBe(
      "request/0b8c2c6e-3f1a-4d7e-9f2a-6f1c2d3e4a5b/summary",
    )
  })

  it("writes in the club's name through VYRA once the club is live", async () => {
    const fetchImpl = services({})
    await acknowledgeBuyer(requestDetails({ demo: false }), config, ["manager@club.example"], {
      fetch: fetchImpl,
    })
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toMatchObject({
      from: '"Club Démo via VYRA" <demandes@notifications.example.com>',
      reply_to: ["manager@club.example"],
    })
  })

  it("sends nothing without Resend", async () => {
    const fetchImpl = services({})
    expect(
      await acknowledgeBuyer(requestDetails(), { ...config, resend: null }, [], {
        fetch: fetchImpl,
      }),
    ).toBe("off")
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
