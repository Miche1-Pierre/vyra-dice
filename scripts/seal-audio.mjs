// Seals a night's music for a private demo link: AES-256-GCM with a new random key, so that the
// public repo and site only hold an unreadable file. The track plays only from a link that carries
// the key (`…/<club>/<event>#son=<key>`), sent to whom the demo is shown (the artist, the club).
//
// usage: node scripts/seal-audio.mjs <track.mp3> <clubs/<slug>/public/audio/<name>.mp3.enc> <key file>
// Format: 12-byte IV, then the ciphertext and its 16-byte tag (what WebCrypto's AES-GCM expects).
// The key goes to <key file> (keep it in clubs/<slug>/private/, ignored by git), never in the repo.
import { createCipheriv, randomBytes } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"

const [input, output, keyFile] = process.argv.slice(2)
if (!input || !output || !keyFile) {
  console.error("usage: node scripts/seal-audio.mjs <track> <out .enc> <key file>")
  process.exit(1)
}
const key = randomBytes(32)
const iv = randomBytes(12)
const cipher = createCipheriv("aes-256-gcm", key, iv)
const sealed = Buffer.concat([
  iv,
  cipher.update(readFileSync(input)),
  cipher.final(),
  cipher.getAuthTag(),
])
writeFileSync(output, sealed)
writeFileSync(keyFile, `${key.toString("base64url")}\n`)
console.log(`sealed ${input} -> ${output} (${sealed.length} bytes); key in ${keyFile}`)
