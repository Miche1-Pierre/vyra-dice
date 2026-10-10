/*
 * Pixels of the procedural surfaces (surfaces.ts) as RGBA bytes, tileable. Pure arithmetic, no
 * three.js nor DOM: it runs in a worker (surfaces.worker.ts), so the loading screen keeps its
 * pace while the club's finishes are generated.
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

/** Height field (0..1) → tangent-space normal map. `strength` scales the slopes. */
function normalImage(h: Field, size: number, strength: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(size * size * 4)
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
      data[i] = (nx * 0.5 + 0.5) * 255
      data[i + 1] = (ny * 0.5 + 0.5) * 255
      data[i + 2] = (nz * 0.5 + 0.5) * 255
      data[i + 3] = 255
    }
  }
  return data
}

function greyImage(v: Field): Uint8ClampedArray {
  const data = new Uint8ClampedArray(v.length * 4)
  for (let i = 0; i < v.length; i++) {
    const g = Math.max(0, Math.min(255, v[i] * 255))
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = g
    data[i * 4 + 3] = 255
  }
  return data
}

/** Relative luminance (0..1) of RGBA pixels. */
function luminance(pixels: Uint8ClampedArray): Field {
  const l = new Float32Array(pixels.length / 4)
  for (let i = 0; i < l.length; i++) {
    l[i] = (0.2126 * pixels[i * 4] + 0.7152 * pixels[i * 4 + 1] + 0.0722 * pixels[i * 4 + 2]) / 255
  }
  return l
}

/** Velvet pile: soft, slightly brushed, with a faint weave. */
function velvet(): Uint8ClampedArray {
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
  return normalImage(h, size, 1.6)
}

/** Pebbled leather grain. */
function leather(): Uint8ClampedArray {
  const size = 256
  const a = fbm(size, 16, 3, 23, 0.5)
  const b = noise(size, 48, 48, 29)
  const h = new Float32Array(size * size)
  for (let i = 0; i < h.length; i++) {
    const ridged = 1 - Math.abs(b[i] * 2 - 1)
    h[i] = a[i] * 0.55 + ridged ** 3 * 0.45
  }
  return normalImage(h, size, 2.2)
}

/** Brushed metal: fine streaks along one axis. */
function brushed(): Uint8ClampedArray {
  const size = 256
  const a = noise(size, 2, 256, 31)
  const b = noise(size, 4, 96, 37)
  const h = new Float32Array(size * size)
  for (let i = 0; i < h.length; i++) h[i] = a[i] * 0.6 + b[i] * 0.4
  return normalImage(h, size, 0.9)
}

/** Black marble with warm veins: albedo, then roughness (veins matte). */
function marble(size: number): [Uint8ClampedArray, Uint8ClampedArray] {
  const warp = fbm(size, 3, 5, 41, 0.55)
  const warp2 = fbm(size, 6, 4, 43, 0.5)
  const albedo = new Uint8ClampedArray(size * size * 4)
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
      albedo[i * 4] = (base + veins * 0.62) * 255
      albedo[i * 4 + 1] = (base + veins * 0.5) * 255
      albedo[i * 4 + 2] = (base * 1.15 + veins * 0.34) * 255
      albedo[i * 4 + 3] = 255
    }
  }
  return [albedo, greyImage(veinsField.map((v) => 0.12 + v * 0.35))]
}

/** Polished floor: roughness from the albedo (grout and wear are matte, tiles glossy). */
function albedoRoughness(
  pixels: Uint8ClampedArray,
  size: number,
  lo: number,
  hi: number,
): Uint8ClampedArray {
  const wear = fbm(size, 8, 4, 53)
  const r = luminance(pixels)
  let min = 1
  let max = 0
  for (const l of r) {
    min = Math.min(min, l)
    max = Math.max(max, l)
  }
  for (let i = 0; i < r.length; i++) {
    const bright = (r[i] - min) / Math.max(1e-3, max - min)
    // darker texels (grout) rougher, plus soft wear patches
    r[i] = lo + (hi - lo) * (1 - bright) * 0.8 + wear[i] * 0.12
  }
  return greyImage(r)
}

/** A surface to generate; `pixels` are the albedo's, resized to `size` × `size`. */
export type SurfaceJob =
  | { kind: "velvet" | "leather" | "brushed" }
  | { kind: "marble"; size: number }
  | { kind: "albedo-normal"; size: number; strength: number; pixels: Uint8ClampedArray }
  | { kind: "albedo-roughness"; size: number; lo: number; hi: number; pixels: Uint8ClampedArray }

/** The RGBA images of a surface: one, or two for the marble (albedo, roughness). */
export function surfaceImages(job: SurfaceJob): Uint8ClampedArray[] {
  switch (job.kind) {
    case "velvet":
      return [velvet()]
    case "leather":
      return [leather()]
    case "brushed":
      return [brushed()]
    case "marble":
      return marble(job.size)
    case "albedo-normal":
      // relief from the albedo's luminance (grout, wood grain, leaves, pits)
      return [normalImage(luminance(job.pixels), job.size, job.strength)]
    case "albedo-roughness":
      return [albedoRoughness(job.pixels, job.size, job.lo, job.hi)]
  }
}
