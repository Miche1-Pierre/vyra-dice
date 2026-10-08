// Turns the raw Blender export of a club into its web bundle (committed, served at /clubs/<club>/).
//
//   clubs/<club>/build/export/<club>.glb       -> clubs/<club>/public/<club>.glb   (meshopt, WebP)
//   clubs/<club>/build/export/lm/*.png         -> clubs/<club>/public/lm/*.webp    (lightmaps)
//   clubs/<club>/build/export/lightmaps.json   -> clubs/<club>/public/lightmaps.json
//
// Usage: pnpm assets:optimize [club]   (default: every club with a Blender export)
//
// Object names, empty nodes and the second UV set (lightmap / FX data) must survive:
// prune keeps leaves and attributes, nothing is joined, flattened or simplified.
import { NodeIO } from "@gltf-transform/core"
import { ALL_EXTENSIONS } from "@gltf-transform/extensions"
import { dedup, meshopt, prune, textureCompress } from "@gltf-transform/functions"
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer"
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import sharp from "sharp"

const CLUBS = "clubs"
const exportDir = (club) => join(CLUBS, club, "build", "export")

const kb = async (p) => `${((await stat(p)).size / 1024).toFixed(0)} KB`
/** Short content hash: the web appends it to asset URLs so a new bake is never served stale. */
const hashOf = async (p) =>
  createHash("sha256")
    .update(await readFile(p))
    .digest("hex")
    .slice(0, 10)

async function optimizeClub(club) {
  const src = exportDir(club)
  const outDir = join(CLUBS, club, "public")
  await mkdir(join(outDir, "lm"), { recursive: true })

  await MeshoptEncoder.ready
  await MeshoptDecoder.ready
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder })

  const input = join(src, `${club}.glb`)
  const doc = await io.read(input)
  await doc.transform(
    dedup(),
    prune({ keepLeaves: true, keepAttributes: true, keepIndices: true }),
    textureCompress({ encoder: sharp, targetFormat: "webp", quality: 82, resize: [1024, 1024] }),
    meshopt({ encoder: MeshoptEncoder, level: "medium", quantizeTexcoord: 14, quantizeNormal: 10 }),
  )
  const output = join(outDir, `${club}.glb`)
  await io.write(output, doc)
  console.log(`${club}.glb: ${await kb(input)} -> ${await kb(output)}`)

  const manifest = JSON.parse(await readFile(join(src, "lightmaps.json"), "utf8"))
  manifest.model = { file: `${club}.glb`, hash: await hashOf(output) }
  let total = 0
  for (const [name, entry] of Object.entries(manifest.lightmaps)) {
    const png = join(src, entry.file)
    const file = entry.file.replace(/\.png$/, ".webp")
    const webp = join(outDir, file)
    await sharp(png).webp({ quality: 86, effort: 6, smartSubsample: true }).toFile(webp)
    entry.file = file
    entry.hash = await hashOf(webp)
    total += (await stat(webp)).size
    console.log(`  lm ${name}: ${await kb(png)} -> ${await kb(webp)}`)
  }
  await writeFile(join(outDir, "lightmaps.json"), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`  lightmaps total: ${(total / 1024).toFixed(0)} KB`)
}

const only = process.argv[2]
const clubs = only
  ? [only]
  : (await readdir(CLUBS, { withFileTypes: true }))
      .filter((d) => d.isDirectory() && existsSync(join(exportDir(d.name), `${d.name}.glb`)))
      .map((d) => d.name)
if (clubs.length === 0) console.log(`No Blender export in ${CLUBS}/*/build/export`)
for (const club of clubs) await optimizeClub(club)
// the dev server serves public/clubs: publish the new bundle right away
if (clubs.length)
  execFileSync(process.execPath, ["scripts/sync-club-assets.mjs"], { stdio: "inherit" })
