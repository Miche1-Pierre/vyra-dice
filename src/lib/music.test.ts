import { createCipheriv, randomBytes } from "node:crypto"

import { describe, expect, it } from "vitest"

import { unseal } from "@/lib/music"

/** Seals like scripts/seal-audio.mjs: IV, then the AES-256-GCM ciphertext and its tag. */
function seal(plain: Buffer, key: Buffer): Uint8Array<ArrayBuffer> {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const out = Buffer.concat([iv, cipher.update(plain), cipher.final(), cipher.getAuthTag()])
  return new Uint8Array(out)
}

describe("unseal", () => {
  it("opens a sealed track with the key of the private link", async () => {
    const key = randomBytes(32)
    const track = randomBytes(4096)
    const plain = await unseal(seal(track, key), key.toString("base64url"))
    expect(Buffer.from(plain).equals(track)).toBe(true)
  })

  it("refuses another key", async () => {
    const sealed = seal(randomBytes(1024), randomBytes(32))
    await expect(unseal(sealed, randomBytes(32).toString("base64url"))).rejects.toThrow()
  })
})
