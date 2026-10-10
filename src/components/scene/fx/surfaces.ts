import * as THREE from "three"

import { surfaceImages, type SurfaceJob } from "@/components/scene/fx/surface-fields"

/*
 * Surface detail generated on the client: tangent-space normal maps (relief) and a few
 * albedo / roughness maps, all tileable. Baked lighting stays in the lightmaps; these maps only
 * add the small-scale relief and sheen that make tiles, wood, velvet or marble read as matter.
 *
 * The pixels are computed in a worker (surface-fields.ts): each texture exists at once, empty,
 * and is filled when its pixels arrive. `surfacesReady()` waits for them before the club is shown.
 *
 * Orientation: textures use `flipY = false` like glTF ones, so image rows run along +v.
 */

function texture(size: number, name: string, srgb = false): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8ClampedArray(size * size * 4), size, size)
  tex.name = name
  tex.flipY = false
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  tex.anisotropy = 8
  tex.generateMipmaps = true
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  // no `needsUpdate` yet: nothing goes to the GPU before the pixels are there
  return tex
}

/** Surfaces still being generated, and the worker that generates them (null: on this thread). */
const pending = new Set<Promise<void>>()
const waiting = new Map<number, { job: SurfaceJob; fill: (images: Uint8ClampedArray[]) => void }>()
let worker: Worker | null | undefined
let seq = 0

function surfaceWorker(): Worker | null {
  if (worker !== undefined) return worker
  try {
    worker = new Worker(new URL("./surfaces.worker.ts", import.meta.url), { type: "module" })
    worker.onmessage = (event: MessageEvent<{ id: number; images: Uint8ClampedArray[] }>) => {
      waiting.get(event.data.id)?.fill(event.data.images)
      waiting.delete(event.data.id)
    }
    worker.onerror = () => {
      // no worker after all: what it had is generated here
      worker?.terminate()
      worker = null
      for (const { job, fill } of waiting.values()) fill(surfaceImages(job))
      waiting.clear()
    }
  } catch {
    worker = null
  }
  return worker
}

/** Fills `targets` with the job's images, in the worker when there is one. */
function generate(job: SurfaceJob, targets: THREE.DataTexture[]) {
  const fill = (images: Uint8ClampedArray[]) =>
    images.forEach((data, i) => {
      targets[i].image.data = data
      targets[i].needsUpdate = true
    })
  const w = surfaceWorker()
  if (!w) {
    fill(surfaceImages(job))
    return
  }
  const id = ++seq
  const done = new Promise<void>((resolve) => {
    waiting.set(id, {
      job,
      fill: (images) => {
        fill(images)
        resolve()
      },
    })
  })
  pending.add(done)
  void done.then(() => pending.delete(done))
  w.postMessage({ id, job })
}

/** Resolves once every surface asked for so far has its pixels. */
export async function surfacesReady(): Promise<void> {
  while (pending.size) await Promise.all(pending)
}

const cache = new Map<string, THREE.DataTexture>()
function cached(key: string, make: () => THREE.DataTexture): THREE.DataTexture {
  let t = cache.get(key)
  if (!t) {
    t = make()
    cache.set(key, t)
  }
  return t
}

/** An albedo texture's pixels, resized to `size` × `size` (read here, processed in the worker). */
function albedoPixels(map: THREE.Texture, size: number): Uint8ClampedArray | null {
  const image = map.image as CanvasImageSource & { width?: number }
  if (!image || !image.width) return null
  const c = document.createElement("canvas")
  c.width = c.height = size
  const ctx = c.getContext("2d", { willReadFrequently: true })!
  ctx.drawImage(image, 0, 0, size, size)
  return ctx.getImageData(0, 0, size, size).data
}

/** Relief derived from an albedo texture's luminance (grout, wood grain, leaves, pits). */
export function normalFromAlbedo(
  map: THREE.Texture,
  strength: number,
  size = 512,
): THREE.Texture | null {
  const key = `albedo:${map.uuid}:${strength}`
  if (cache.has(key)) return cache.get(key)!
  const pixels = albedoPixels(map, size)
  if (!pixels) return null
  return cached(key, () => {
    const tex = texture(size, `${map.name || "albedo"}-normal`)
    generate({ kind: "albedo-normal", size, strength, pixels }, [tex])
    return tex
  })
}

function normalMap(kind: "velvet" | "leather" | "brushed"): THREE.Texture {
  return cached(kind, () => {
    const tex = texture(256, `${kind}-normal`)
    generate({ kind }, [tex])
    return tex
  })
}

/** Velvet pile: soft, slightly brushed, with a faint weave. */
export const velvetNormal = () => normalMap("velvet")
/** Pebbled leather grain. */
export const leatherNormal = () => normalMap("leather")
/** Brushed metal: fine streaks along one axis. */
export const brushedNormal = () => normalMap("brushed")

/** Black marble with warm veins (bar top, tables): albedo + roughness, tileable. */
export function marbleMaps(size = 512): { map: THREE.Texture; roughnessMap: THREE.Texture } {
  const map = cached(`marble-albedo:${size}`, () => {
    const albedo = texture(size, "marble-albedo", true)
    const roughness = texture(size, "marble-roughness")
    cache.set(`marble-veins:${size}`, roughness)
    generate({ kind: "marble", size }, [albedo, roughness])
    return albedo
  })
  return { map, roughnessMap: cache.get(`marble-veins:${size}`)! }
}

/** Polished floor: roughness from the albedo (grout and wear are matte, tiles glossy). */
export function roughnessFromAlbedo(
  map: THREE.Texture,
  lo: number,
  hi: number,
  size = 512,
): THREE.Texture | null {
  const key = `rough:${map.uuid}:${lo}:${hi}`
  if (cache.has(key)) return cache.get(key)!
  const pixels = albedoPixels(map, size)
  if (!pixels) return null
  return cached(key, () => {
    const tex = texture(size, `${map.name || "albedo"}-roughness`)
    generate({ kind: "albedo-roughness", size, lo, hi, pixels }, [tex])
    return tex
  })
}
