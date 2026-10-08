// Publishes the web bundle of every club: clubs/<slug>/public/ -> public/clubs/<slug>/,
// served at /clubs/<slug>/… (GLB, lightmaps). Runs before `next dev` and `next build`;
// public/clubs/ is generated (gitignored): edit the files in clubs/<slug>/public/.
//
// Usage: node scripts/sync-club-assets.mjs
import { cpSync, existsSync, readdirSync, rmSync } from "node:fs"
import { join } from "node:path"

const CLUBS = "clubs"
const OUT = join("public", "clubs")

rmSync(OUT, { recursive: true, force: true })
const published = []
for (const entry of readdirSync(CLUBS, { withFileTypes: true })) {
  const src = join(CLUBS, entry.name, "public")
  if (!entry.isDirectory() || !existsSync(src)) continue
  cpSync(src, join(OUT, entry.name), { recursive: true })
  published.push(entry.name)
}
console.log(`club assets: ${published.length ? published.join(", ") : "none"} -> ${OUT}`)
