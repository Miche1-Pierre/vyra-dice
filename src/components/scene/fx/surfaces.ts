import * as THREE from "three"

/*
 * Surface detail generated on the client: tangent-space normal maps (relief) and a few
 * albedo / roughness maps, all tileable. Baked lighting stays in the lightmaps; these maps only
 * add the small-scale relief and sheen that make tiles, wood, velvet or marble read as matter.
 *
 * Orientation: textures use `flipY = false` like glTF ones, so image rows run along +v.
 */

type Field = Float32Array

function seeded(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Tileable value noise: `px` × `py` random lattice, smooth interpolation, wraps at the edges. */
function noise(size: number, px: number, py: number, seed: number): Field {
  const rnd = seeded(seed)
  const lattice = new Float32Array(px * py)
  for (let i = 0; i < lattice.length; i++) lattice[i] = rnd()
  const out = new Float32Array(size * size)
  const fade = (t: number) => t * t * (3 - 2 * t)
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * py
    const y0 = Math.floor(fy)
    const ty = fade(fy - y0)
    const r0 = (y0 % py) * px
    const r1 = ((y0 + 1) % py) * px
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * px
      const x0 = Math.floor(fx)
      const tx = fade(fx - x0)
      const c0 = x0 % px
      const c1 = (x0 + 1) % px
      const a = lattice[r0 + c0] + (lattice[r0 + c1] - lattice[r0 + c0]) * tx
      const b = lattice[r1 + c0] + (lattice[r1 + c1] - lattice[r1 + c0]) * tx
      out[y * size + x] = a + (b - a) * ty
    }
  }
  return out
}

/** Fractal sum of tileable noise octaves, normalised to 0..1. */
function fbm(size: number, period: number, octaves: number, seed: number, gain = 0.5): Field {
  const out = new Float32Array(size * size)
  let amp = 1
  let total = 0
  for (let o = 0; o < octaves; o++) {
    const p = period * 2 ** o
    const n = noise(size, p, p, seed + o * 101)
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp
    total += amp
    amp *= gain
  }
  for (let i = 0; i < out.length; i++) out[i] /= total
  return out
}

function canvasOf(size: number) {
  const c = document.createElement("canvas")
  c.width = c.height = size
  return c
}

function finish(tex: THREE.Texture, name: string, srgb = false): THREE.Texture {
  tex.name = name
  tex.flipY = false
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  tex.anisotropy = 8
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.needsUpdate = true
  return tex
}

/** Height field (0..1) → normal map. `strength` scales the slopes. */
function normalFromHeight(h: Field, size: number, strength: number, name: string): THREE.Texture {
  const c = canvasOf(size)
  const ctx = c.getContext("2d")!
  const img = ctx.createImageData(size, size)
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Sobel slopes, in "height per pixel" scaled by strength
      const dx =
        at(x + 1, y - 1) +
        2 * at(x + 1, y) +
        at(x + 1, y + 1) -
        at(x - 1, y - 1) -
        2 * at(x - 1, y) -
        at(x - 1, y + 1)
      const dy =
        at(x - 1, y + 1) +
        2 * at(x, y + 1) +
        at(x + 1, y + 1) -
        at(x - 1, y - 1) -
        2 * at(x, y - 1) -
        at(x + 1, y - 1)
      let nx = -dx * strength
      let ny = -dy * strength
      let nz = 1
      const len = Math.hypot(nx, ny, nz)
      nx /= len
      ny /= len
      nz /= len
      const i = (y * size + x) * 4
      img.data[i] = (nx * 0.5 + 0.5) * 255
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return finish(new THREE.CanvasTexture(c), name)
}

function greyTexture(v: Field, size: number, name: string): THREE.Texture {
  const c = canvasOf(size)
  const ctx = c.getContext("2d")!
  const img = ctx.createImageData(size, size)
  for (let i = 0; i < v.length; i++) {
    const g = Math.max(0, Math.min(255, v[i] * 255))
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = g
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return finish(new THREE.CanvasTexture(c), name)
}

const cache = new Map<string, THREE.Texture>()
function cached(key: string, make: () => THREE.Texture): THREE.Texture {
  let t = cache.get(key)
  if (!t) {
    t = make()
    cache.set(key, t)
  }
  return t
}

/** Relief derived from an albedo texture's luminance (grout, wood grain, leaves, pits). */
export function normalFromAlbedo(
  map: THREE.Texture,
  strength: number,
  size = 512,
): THREE.Texture | null {
  const image = map.image as CanvasImageSource & { width?: number; height?: number }
  if (!image || !image.width) return null
  return cached(`albedo:${map.uuid}:${strength}`, () => {
    const c = canvasOf(size)
    const ctx = c.getContext("2d", { willReadFrequently: true })!
    ctx.drawImage(image, 0, 0, size, size)
    const data = ctx.getImageData(0, 0, size, size).data
    const h = new Float32Array(size * size)
    for (let i = 0; i < h.length; i++) {
      h[i] = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255
    }
    return normalFromHeight(h, size, strength, `${map.name || "albedo"}-normal`)
  })
}

/** Velvet pile: soft, slightly brushed, with a faint weave. */
export function velvetNormal(): THREE.Texture {
  return cached("velvet", () => {
    const size = 256
    const n = fbm(size, 8, 4, 11, 0.55)
    const brush = noise(size, 4, 64, 17)
    const h = new Float32Array(size * size)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x
        const weave =
          0.5 +
          0.5 * Math.sin((x / size) * Math.PI * 2 * 48) * Math.sin((y / size) * Math.PI * 2 * 48)
        h[i] = n[i] * 0.6 + brush[i] * 0.3 + weave * 0.1
      }
    }
    return normalFromHeight(h, size, 1.6, "velvet-normal")
  })
}

/** Pebbled leather grain. */
export function leatherNormal(): THREE.Texture {
  return cached("leather", () => {
    const size = 256
    const a = fbm(size, 16, 3, 23, 0.5)
    const b = noise(size, 48, 48, 29)
    const h = new Float32Array(size * size)
    for (let i = 0; i < h.length; i++) {
      const ridged = 1 - Math.abs(b[i] * 2 - 1)
      h[i] = a[i] * 0.55 + ridged ** 3 * 0.45
    }
    return normalFromHeight(h, size, 2.2, "leather-normal")
  })
}

/** Brushed metal: fine streaks along one axis. */
export function brushedNormal(): THREE.Texture {
  return cached("brushed", () => {
    const size = 256
    const a = noise(size, 2, 256, 31)
    const b = noise(size, 4, 96, 37)
    const h = new Float32Array(size * size)
    for (let i = 0; i < h.length; i++) h[i] = a[i] * 0.6 + b[i] * 0.4
    return normalFromHeight(h, size, 0.9, "brushed-normal")
  })
}

/** Black marble with warm veins (bar top, tables): albedo + roughness, tileable. */
export function marbleMaps(size = 512): { map: THREE.Texture; roughnessMap: THREE.Texture } {
  const map = cached(`marble-albedo:${size}`, () => {
    const warp = fbm(size, 3, 5, 41, 0.55)
    const warp2 = fbm(size, 6, 4, 43, 0.5)
    const c = canvasOf(size)
    const ctx = c.getContext("2d")!
    const img = ctx.createImageData(size, size)
    const veinsField = new Float32Array(size * size)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x
        const u = x / size
        const v = y / size
        const t = (u + v) * 2 + warp[i] * 3.2 + warp2[i] * 0.8
        const vein = Math.pow(1 - Math.abs(Math.sin(t * Math.PI)), 26)
        const fine =
          Math.pow(1 - Math.abs(Math.sin((u * 3 - v + warp2[i] * 2.4) * Math.PI)), 60) * 0.5
        const veins = Math.min(1, vein + fine)
        veinsField[i] = veins
        const base = 0.028 + warp2[i] * 0.02
        img.data[i * 4] = (base + veins * 0.62) * 255
        img.data[i * 4 + 1] = (base + veins * 0.5) * 255
        img.data[i * 4 + 2] = (base * 1.15 + veins * 0.34) * 255
        img.data[i * 4 + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    cache.set(
      `marble-veins:${size}`,
      greyTexture(
        veinsField.map((v) => 0.12 + v * 0.35),
        size,
        "marble-roughness",
      ),
    )
    return finish(new THREE.CanvasTexture(c), "marble-albedo", true)
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
  const image = map.image as CanvasImageSource & { width?: number }
  if (!image || !image.width) return null
  return cached(`rough:${map.uuid}:${lo}:${hi}`, () => {
    const c = canvasOf(size)
    const ctx = c.getContext("2d", { willReadFrequently: true })!
    ctx.drawImage(image, 0, 0, size, size)
    const data = ctx.getImageData(0, 0, size, size).data
    const wear = fbm(size, 8, 4, 53)
    const r = new Float32Array(size * size)
    let min = 1
    let max = 0
    for (let i = 0; i < r.length; i++) {
      const l = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255
      r[i] = l
      min = Math.min(min, l)
      max = Math.max(max, l)
    }
    for (let i = 0; i < r.length; i++) {
      const bright = (r[i] - min) / Math.max(1e-3, max - min)
      // darker texels (grout) rougher, plus soft wear patches
      r[i] = lo + (hi - lo) * (1 - bright) * 0.8 + wear[i] * 0.12
    }
    return greyTexture(r, size, `${map.name || "albedo"}-roughness`)
  })
}
