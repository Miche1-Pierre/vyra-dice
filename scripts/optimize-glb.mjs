// Optimizes Blender exports for the web.
// art/export/<name>.glb  ->  public/models/<name>.glb  (meshopt geometry, WebP textures <= 2048px)
import { execFileSync } from "node:child_process"
import { mkdirSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const SRC = "art/export"
const OUT = "public/models"
const only = process.argv[2] // optional: single file name

mkdirSync(OUT, { recursive: true })

const files = readdirSync(SRC).filter((f) => f.endsWith(".glb") && (!only || f === only))
if (files.length === 0) {
  console.log(`No .glb in ${SRC}${only ? ` matching ${only}` : ""}`)
  process.exit(0)
}

for (const file of files) {
  const input = join(SRC, file)
  const output = join(OUT, file)
  execFileSync(
    "pnpm",
    [
      "exec",
      "gltf-transform",
      "optimize",
      input,
      output,
      "--compress",
      "meshopt",
      "--texture-compress",
      "webp",
      "--texture-size",
      "2048",
    ],
    { stdio: "inherit", shell: true },
  )
  const kb = (p) => (statSync(p).size / 1024).toFixed(0)
  console.log(`${file}: ${kb(input)} KB -> ${kb(output)} KB`)
}
