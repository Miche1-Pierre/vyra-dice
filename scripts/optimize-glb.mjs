// Turns the raw Blender export of a venue into the web bundle served from public/models/<club>/.
//
//   art/export/<club>.glb              -> public/models/<club>/<club>.glb   (meshopt, WebP textures)
//   art/export/<club>/lm/*.png         -> public/models/<club>/lm/*.webp    (lightmaps)
//   art/export/<club>.lightmaps.json   -> public/models/<club>/lightmaps.json
//
// Usage: pnpm assets:optimize [club]   (default: every <club>.glb found in art/export)
//
// Object names, empty nodes and the second UV set (lightmap / FX data) must survive:
// prune keeps leaves and attributes, nothing is joined, flattened or simplified.
import { NodeIO } from "@gltf-transform/core"
import { ALL_EXTENSIONS } from "@gltf-transform/extensions"
import { dedup, meshopt, prune, textureCompress } from "@gltf-transform/functions"
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer"
import { createHash } from "node:crypto"
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import sharp from "sharp"

const SRC = "art/export"
const OUT = "public/models"

const kb = async (p) => `${((await stat(p)).size / 1024).toFixed(0)} KB`
/** Short content hash: the web appends it to asset URLs so a new bake is never served stale. */
const hashOf = async (p) =>
  createHash("sha256")
    .update(await readFile(p))
    .digest("hex")
    .slice(0, 10)

async function optimizeClub(club) {
  const outDir = join(OUT, club)
  await mkdir(join(outDir, "lm"), { recursive: true })

  await MeshoptEncoder.ready
  await MeshoptDecoder.ready
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder })

  const input = join(SRC, `${club}.glb`)
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

  const manifest = JSON.parse(await readFile(join(SRC, `${club}.lightmaps.json`), "utf8"))
  manifest.model = { file: `${club}.glb`, hash: await hashOf(output) }
  let total = 0
  for (const [name, entry] of Object.entries(manifest.lightmaps)) {
    const png = join(SRC, club, entry.file)
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
  : (await readdir(SRC)).filter((f) => f.endsWith(".glb")).map((f) => f.replace(/\.glb$/, ""))
if (clubs.length === 0) console.log(`No .glb in ${SRC}`)
for (const club of clubs) await optimizeClub(club)
