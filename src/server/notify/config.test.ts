import { describe, expect, it } from "vitest"

import { readNotifyConfig } from "@/server/notify/config"

describe("readNotifyConfig", () => {
  it("turns every channel off without settings", () => {
    expect(readNotifyConfig({})).toEqual({
      resend: null,
      whatsapp: null,
      team: { emails: [], whatsapp: [] },
    })
  })

  it("reads Resend, WhatsApp and the team's addresses and numbers", () => {
    const config = readNotifyConfig({
      RESEND_API_KEY: " re_test ",
      REQUESTS_FROM_EMAIL: "VYRA <demandes@notifications.example.com>",
      REQUESTS_TEAM_EMAIL: "equipe@example.com; Pierre <pierre@example.com>, pas-une-adresse",
      WHATSAPP_TOKEN: "EAAG",
      WHATSAPP_PHONE_NUMBER_ID: "1234567890",
      REQUESTS_TEAM_WHATSAPP: "+33 6 12 34 56 78, 12",
    })
    expect(config).toEqual({
      resend: { apiKey: "re_test", from: "demandes@notifications.example.com" },
      whatsapp: {
        token: "EAAG",
        phoneNumberId: "1234567890",
        template: "nouvelle_demande_table",
        language: "fr",
        apiVersion: "v23.0",
      },
      team: {
        emails: ["equipe@example.com", "pierre@example.com"],
        whatsapp: ["33612345678"],
      },
    })
  })

  it("keeps a channel off when one of its settings is missing or malformed", () => {
    expect(readNotifyConfig({ RESEND_API_KEY: "re_test" }).resend).toBeNull()
    expect(
      readNotifyConfig({ RESEND_API_KEY: "re_test", REQUESTS_FROM_EMAIL: "demandes" }).resend,
    ).toBeNull()
    expect(readNotifyConfig({ WHATSAPP_TOKEN: "EAAG" }).whatsapp).toBeNull()
    // the id goes into the API's URL
    expect(
      readNotifyConfig({ WHATSAPP_TOKEN: "EAAG", WHATSAPP_PHONE_NUMBER_ID: "12/../me" }).whatsapp,
    ).toBeNull()
  })

  it("takes another template, language and API version, and ignores a malformed version", () => {
    const env = {
      WHATSAPP_TOKEN: "EAAG",
      WHATSAPP_PHONE_NUMBER_ID: "1234567890",
      WHATSAPP_TEMPLATE: "demande_table",
      WHATSAPP_TEMPLATE_LANGUAGE: "fr_FR",
      WHATSAPP_API_VERSION: "v24.0",
    }
    expect(readNotifyConfig(env).whatsapp).toMatchObject({
      template: "demande_table",
      language: "fr_FR",
      apiVersion: "v24.0",
    })
    expect(
      readNotifyConfig({ ...env, WHATSAPP_API_VERSION: "latest/../" }).whatsapp?.apiVersion,
    ).toBe("v23.0")
  })
})
