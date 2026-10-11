/*
 * What the light show knows of the night's music, read once from the whole track.
 *
 * `analyseTrack` (in a worker, music-map.worker.ts) finds the tempo and the grid of its beats,
 * the beat that starts its bars and the bar that starts its 4-bar phrases, how full each beat is
 * (bass, hats, loudness) and its drops, where the bass comes back after a break. `showAt` then
 * tells where the show stands at any instant of the track: the scene reads it once per frame, in
 * step with what is heard instead of reacting late to it.
 *
 * Club tracks keep one tempo: the grid is a constant one, fitted to every onset of the track. A
 * track without a steady beat gets no map, and the lights keep following its bass as it plays.
 */

/** A drop: the bass comes back on this beat after a break. */
export interface MusicDrop {
  beat: number
  /** 0–1: the longer the break before it, the bigger the drop. */
  strength: number
}

export interface MusicMap {
  bpm: number
  /** Time of each beat in the track, in seconds. */
  beats: Float64Array
  /** Index (0–3) of the first beat that starts a bar. */
  downbeat: number
  /** Index (0–3) of the first bar that starts a 4-bar phrase. */
  phrase: number
  /** Per beat, 0–1: how full the music is (bass, hats, loudness). */
  energy: Float32Array
  /** Per beat, 0–1: how much bass there is (0 in a break). */
  bass: Float32Array
  drops: MusicDrop[]
}

/** Where the show stands at one instant of the track. */
export interface ShowState {
  /** A track's map drives the show: its music plays. */
  on: boolean
  bpm: number
  /** Position in beats: index of the beat plus how far into it. */
  beat: number
  /** 0–1 into the current beat. */
  phase: number
  /** Beats since the start of the first 4-bar phrase (the screens' loops follow it). */
  phraseBeat: number
  /** Index of the current 4-bar phrase: the colours change with it. */
  phrase: number
  /** 0–1: the light hit of each beat, harder on the bar's first, soft in a break. */
  kick: number
  /** 0–1: how full the music is. */
  energy: number
  /** 0–1: a drop just hit, fading over two bars. */
  drop: number
  /** 0–1: the white flash of a drop, on its first beat. */
  flash: number
  /** 0–1: rising over the bars before a big drop. */
  build: number
  /** 0–1: the half-beat of darkness just before a big drop. */
  blackout: number
}

export function emptyShow(): ShowState {
  return {
    on: false,
    bpm: 0,
    beat: 0,
    phase: 0,
    phraseBeat: 0,
    phrase: 0,
    kick: 0,
    energy: 0,
    drop: 0,
    flash: 0,
    build: 0,
    blackout: 0,
  }
}

const MIN_BPM = 60
const MAX_BPM = 200
/** Below this, the onsets do not keep to one grid: no steady beat to follow. */
const MIN_LOCK = 0.3
/** Bass below this share of its usual level: a break. */
const NO_BASS = 0.3

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/* ------------------------------------------------------------------------------------------ */
/* Spectrum                                                                                   */
/* ------------------------------------------------------------------------------------------ */

interface Twiddles {
  cos: Float64Array
  sin: Float64Array
  rev: Uint32Array
}

function twiddles(n: number): Twiddles {
  const cos = new Float64Array(n / 2)
  const sin = new Float64Array(n / 2)
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n)
    sin[i] = Math.sin((2 * Math.PI * i) / n)
  }
  const bits = Math.log2(n)
  const rev = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    let r = 0
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b)
    rev[i] = r
  }
  return { cos, sin, rev }
}

/** In-place radix-2 FFT of `re` + i·`im` (length a power of two). */
export function fft(re: Float64Array, im: Float64Array, tw: Twiddles = twiddles(re.length)) {
  const n = re.length
  for (let i = 0; i < n; i++) {
    const j = tw.rev[i]
    if (j > i) {
      const r = re[i]
      re[i] = re[j]
      re[j] = r
      const m = im[i]
      im[i] = im[j]
      im[j] = m
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1
    const step = n / size
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const c = tw.cos[k * step]
        const s = tw.sin[k * step]
        const a = start + k
        const b = a + half
        const xr = re[b] * c + im[b] * s
        const xi = im[b] * c - re[b] * s
        re[b] = re[a] - xr
        im[b] = im[a] - xi
        re[a] += xr
        im[a] += xi
      }
    }
  }
}

/**
 * Magnitudes of the spectrum of `n` real samples (bins 0 to n/2), through one complex FFT of
 * half the length: even samples as the real part, odd ones as the imaginary part.
 */
export function realSpectrum(n: number): (frame: Float64Array, out: Float64Array) => void {
  const m = n / 2
  const tw = twiddles(m)
  const cosN = new Float64Array(m + 1)
  const sinN = new Float64Array(m + 1)
  for (let k = 0; k <= m; k++) {
    cosN[k] = Math.cos((2 * Math.PI * k) / n)
    sinN[k] = Math.sin((2 * Math.PI * k) / n)
  }
  const zr = new Float64Array(m)
  const zi = new Float64Array(m)
  return (frame, out) => {
    for (let i = 0; i < m; i++) {
      zr[i] = frame[2 * i]
      zi[i] = frame[2 * i + 1]
    }
    fft(zr, zi, tw)
    for (let k = 0; k <= m; k++) {
      const a = k % m
      const b = (m - k) % m
      // even part (Z[k] + conj Z[m-k]) / 2, odd part (Z[k] - conj Z[m-k]) / 2i
      const er = (zr[a] + zr[b]) / 2
      const ei = (zi[a] - zi[b]) / 2
      const or = (zi[a] + zi[b]) / 2
      const oi = -(zr[a] - zr[b]) / 2
      const xr = er + cosN[k] * or + sinN[k] * oi
      const xi = ei + cosN[k] * oi - sinN[k] * or
      out[k] = Math.sqrt(xr * xr + xi * xi)
    }
  }
}

/** Per frame of ~46 ms (hop ~23 ms): onset strength and band powers. */
interface Frames {
  count: number
  /** Frames per second. */
  rate: number
  /** Time of frame `f`: `(f + lead) / rate`. */
  lead: number
  flux: Float64Array
  lowFlux: Float64Array
  low: Float64Array
  high: Float64Array
  total: Float64Array
}

function spectralFrames(samples: Float32Array, sampleRate: number): Frames {
  const size = 2 ** Math.round(Math.log2(sampleRate * 0.0464)) // 1024 at 22.05 kHz
  const hop = size / 2
  const count = Math.max(0, Math.floor((samples.length - size) / hop) + 1)
  const window = new Float64Array(size)
  for (let i = 0; i < size; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size)
  const spectrum = realSpectrum(size)
  const bins = size / 2 + 1
  const bin = (hz: number) => Math.min(bins - 1, Math.round((hz * size) / sampleRate))
  const [lowLo, lowHi] = [bin(30), bin(150)]
  const [highLo, highHi] = [bin(2000), bin(11000)]
  const frame = new Float64Array(size)
  const mag = new Float64Array(bins)
  const prev = new Float64Array(bins)
  const out: Frames = {
    count,
    rate: sampleRate / hop,
    // a hit shows in the log spectrum as soon as the window's far half reaches it
    lead: 1.2,
    flux: new Float64Array(count),
    lowFlux: new Float64Array(count),
    low: new Float64Array(count),
    high: new Float64Array(count),
    total: new Float64Array(count),
  }
  for (let f = 0; f < count; f++) {
    const offset = f * hop
    for (let i = 0; i < size; i++) frame[i] = samples[offset + i] * window[i]
    spectrum(frame, mag)
    let flux = 0
    let lowFlux = 0
    let low = 0
    let high = 0
    let total = 0
    for (let k = 0; k < bins; k++) {
      const p = mag[k] * mag[k]
      total += p
      const log = Math.log1p(100 * mag[k])
      const rise = log - prev[k]
      prev[k] = log
      if (k >= lowLo && k <= lowHi) {
        low += p
        if (rise > 0) lowFlux += rise
      }
      if (k >= highLo && k <= highHi) high += p
      if (k >= lowLo && k <= highHi && rise > 0) flux += rise
    }
    out.flux[f] = flux
    out.lowFlux[f] = lowFlux
    out.low[f] = low
    out.high[f] = high
    out.total[f] = total
  }
  // the first frame rises from silence: no onset there
  if (count) out.flux[0] = out.lowFlux[0] = 0
  return out
}

/** Onsets stand out from their surroundings: minus the 1 s average, positive part, unit spread. */
function onsetEnvelope(series: Float64Array, rate: number): Float64Array {
  const n = series.length
  const width = Math.max(3, Math.round(rate))
  const sums = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) sums[i + 1] = sums[i] + series[i]
  const env = new Float64Array(n)
  let sq = 0
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - (width >> 1))
    const b = Math.min(n, i + (width >> 1) + 1)
    const v = Math.max(0, series[i] - (sums[b] - sums[a]) / (b - a))
    env[i] = v
    sq += v * v
  }
  const spread = Math.sqrt(sq / Math.max(1, n)) || 1
  for (let i = 0; i < n; i++) env[i] /= spread
  return env
}

/* ------------------------------------------------------------------------------------------ */
/* Tempo and grid                                                                             */
/* ------------------------------------------------------------------------------------------ */

/** Tempo, by autocorrelation of the onsets, leaning towards club tempos (around 120 BPM). */
function roughTempo(env: Float64Array, rate: number): number | null {
  const n = env.length
  const minLag = Math.max(2, Math.floor((60 * rate) / MAX_BPM))
  const maxLag = Math.min(n - 2, Math.ceil((60 * rate) / MIN_BPM))
  if (maxLag <= minLag + 2) return null
  const score = new Float64Array(maxLag + 2)
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
    let s = 0
    for (let i = 0; i + lag < n; i++) s += env[i] * env[i + lag]
    const bpm = (60 * rate) / lag
    const prior = Math.exp(-0.5 * Math.log2(bpm / 120) ** 2)
    score[lag] = (s / (n - lag)) * prior
  }
  let best = minLag
  for (let lag = minLag; lag <= maxLag; lag++) if (score[lag] > score[best]) best = lag
  const [a, b, c] = [score[best - 1], score[best], score[best + 1]]
  const curve = a - 2 * b + c
  const lag = best + (curve < 0 ? (0.5 * (a - c)) / curve : 0)
  return (60 * rate) / lag
}

/**
 * How well the onsets sit on an eighth-note grid at this tempo, over the whole track: the
 * vector strength of their phases on the eighth (0 = no grid, 1 = every onset on it), and
 * where they gather (seconds into the eighth).
 */
function eighthFit(env: Float64Array, frames: Frames, bpm: number): { lock: number; at: number } {
  const eighth = 30 / bpm
  const step = (2 * Math.PI) / eighth / frames.rate
  // the phase of each frame turns by `step`: a rotating unit vector, no trigonometry per frame
  let cos = Math.cos(step * frames.lead)
  let sin = Math.sin(step * frames.lead)
  const [dc, ds] = [Math.cos(step), Math.sin(step)]
  let re = 0
  let im = 0
  let sum = 0
  for (let f = 0; f < env.length; f++) {
    const v = env[f]
    re += v * cos
    im += v * sin
    sum += v
    const c = cos * dc - sin * ds
    sin = sin * dc + cos * ds
    cos = c
  }
  const angle = Math.atan2(im, re)
  return {
    lock: sum ? Math.hypot(re, im) / sum : 0,
    at: ((angle < 0 ? angle + 2 * Math.PI : angle) / (2 * Math.PI)) * eighth,
  }
}

/** The tempo whose eighth-note grid the onsets keep to best, near the rough tempo. */
function fitTempo(env: Float64Array, frames: Frames, rough: number) {
  let best = { bpm: rough, ...eighthFit(env, frames, rough) }
  const scan = (from: number, to: number, step: number) => {
    for (let bpm = from; bpm <= to; bpm += step) {
      const fit = eighthFit(env, frames, bpm)
      if (fit.lock > best.lock) best = { bpm, ...fit }
    }
  }
  scan(rough * 0.97, rough * 1.03, 0.02)
  const coarse = best.bpm
  scan(coarse - 0.03, coarse + 0.03, 0.002)
  return best
}

/**
 * Band levels of each beat, in dB: the median of its frames, so that a bass note sliding in at
 * the end of a beat of silence does not fill the whole beat.
 */
interface BeatLevels {
  low: Float64Array
  high: Float64Array
  total: Float64Array
}

const BANDS = ["low", "high", "total"] as const

function beatLevels(frames: Frames, start: number, period: number, count: number): BeatLevels {
  const lists = BANDS.map(() => Array.from({ length: count }, () => [] as number[]))
  for (let f = 0; f < frames.count; f++) {
    // the frame's centre: where its energy sits
    const k = Math.floor(((f + 1) / frames.rate - start) / period)
    if (k < 0 || k >= count) continue
    BANDS.forEach((band, b) => lists[b][k].push(10 * Math.log10(frames[band][f] + 1e-9)))
  }
  const median = (values: number[]) => {
    if (!values.length) return -90
    values.sort((a, b) => a - b)
    const mid = values.length >> 1
    return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2
  }
  const [low, high, total] = lists.map((perBeat) => Float64Array.from(perBeat, median))
  return { low, high, total }
}

/** How much the music changes entering each beat (bass, hats, loudness), in dB. */
function changes(levels: BeatLevels): Float64Array {
  const n = levels.low.length
  const out = new Float64Array(n)
  for (let k = 1; k < n; k++)
    out[k] =
      Math.abs(levels.low[k] - levels.low[k - 1]) +
      Math.abs(levels.high[k] - levels.high[k - 1]) +
      Math.abs(levels.total[k] - levels.total[k - 1])
  return out
}

/** Sum of the `top` largest values among the indices `i` with `i % every === slot`. */
function topSum(values: Float64Array, every: number, slot: number, top: number): number {
  const picked: number[] = []
  for (let i = slot; i < values.length; i += every) picked.push(values[i])
  picked.sort((a, b) => b - a)
  return picked.slice(0, top).reduce((s, v) => s + v, 0)
}

function bestSlot(values: Float64Array, every: number, top: number): number {
  let best = 0
  let bestScore = -1
  for (let slot = 0; slot < every; slot++) {
    const score = topSum(values, every, slot, top)
    if (score > bestScore) {
      bestScore = score
      best = slot
    }
  }
  return best
}

/** `p`-th percentile of a series (0–1). */
function percentile(values: Float64Array, p: number): number {
  const sorted = Float64Array.from(values).sort()
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))]
}

/** Value of the onset envelope at a time, linearly interpolated between frames. */
function envAt(env: Float64Array, frames: Frames, t: number): number {
  const x = t * frames.rate - frames.lead
  const i = Math.floor(x)
  if (i < 0 || i + 1 >= env.length) return 0
  return env[i] + (env[i + 1] - env[i]) * (x - i)
}

/* ------------------------------------------------------------------------------------------ */
/* The map                                                                                    */
/* ------------------------------------------------------------------------------------------ */

/**
 * Reads a whole track (mono samples): its beat grid, bars, phrases, how full each beat is and
 * its drops. Null without a steady beat (or under 10 s of music).
 */
export function analyseTrack(samples: Float32Array, sampleRate: number): MusicMap | null {
  const duration = samples.length / sampleRate
  if (duration < 10) return null
  const frames = spectralFrames(samples, sampleRate)
  const env = onsetEnvelope(frames.flux, frames.rate)
  const rough = roughTempo(env, frames.rate)
  if (!rough) return null
  const grid = fitTempo(env, frames, rough)
  if (grid.lock < MIN_LOCK) return null
  const bpm = grid.bpm
  const period = 60 / bpm

  // the beat is one of the two eighths: the one where the music changes sharply (sections
  // start on a beat) and where the kicks land
  const kickEnv = onsetEnvelope(frames.lowFlux, frames.rate)
  const candidates = [grid.at, grid.at + period / 2].map((at) => {
    const start = at - period * Math.floor(at / period + 0.5) // first beat, within half a beat of 0
    const count = Math.floor((duration - start) / period)
    const levels = beatLevels(frames, start, period, count)
    const change = changes(levels)
    const top = Math.max(8, Math.round(count / 16))
    let kick = 0
    for (let k = 0; k < count; k++) kick += envAt(kickEnv, frames, start + k * period)
    return { start, count, levels, change, sharp: topSum(change, 1, 0, top), kick: kick / count }
  })
  const [a, b] = candidates
  const vote = (x: number, y: number) => (x + y > 0 ? x / Math.max(x, y) : 0)
  const chosen =
    vote(a.sharp, b.sharp) + vote(a.kick, b.kick) >= vote(b.sharp, a.sharp) + vote(b.kick, a.kick)
      ? a
      : b
  const { start, count, levels, change } = chosen
  if (count < 16) return null

  const beats = new Float64Array(count)
  for (let k = 0; k < count; k++) beats[k] = start + k * period

  // bars start where the music changes most; 4-bar phrases likewise, bar by bar
  const downbeat = bestSlot(change, 4, Math.max(3, Math.round(count / 64)))
  const bars = Math.floor((count - downbeat) / 4)
  const barLevels: BeatLevels = {
    low: new Float64Array(bars),
    high: new Float64Array(bars),
    total: new Float64Array(bars),
  }
  for (let j = 0; j < bars; j++) {
    for (const key of ["low", "high", "total"] as const) {
      let s = 0
      for (let i = 0; i < 4; i++) s += 10 ** (levels[key][downbeat + 4 * j + i] / 10)
      barLevels[key][j] = 10 * Math.log10(s / 4)
    }
  }
  const phrase = bars >= 8 ? bestSlot(changes(barLevels), 4, Math.max(2, Math.round(bars / 16))) : 0

  // how full each beat is, against the track's own loud parts
  const ref = {
    low: percentile(levels.low, 0.95),
    high: percentile(levels.high, 0.95),
    total: percentile(levels.total, 0.95),
  }
  const bass = new Float32Array(count)
  const energy = new Float32Array(count)
  for (let k = 0; k < count; k++) {
    bass[k] = clamp01((levels.low[k] - ref.low + 24) / 18)
    const hats = clamp01((levels.high[k] - ref.high + 18) / 14)
    const loud = clamp01((levels.total[k] - ref.total + 18) / 14)
    energy[k] = 0.5 * bass[k] + 0.25 * hats + 0.25 * loud
  }

  // drops: the bass back after a break, on the first beat of a bar unless the break was long
  const drops: MusicDrop[] = []
  for (let k = 1; k < count; k++) {
    if (bass[k] < 0.6 || bass[k - 1] >= NO_BASS) continue
    let gap = 0
    while (gap < 32 && k - gap - 1 >= 0 && bass[k - gap - 1] < NO_BASS) gap++
    const barStart = (k - downbeat) % 4 === 0
    if (!barStart && gap < 4) continue
    drops.push({ beat: k, strength: gap >= 8 ? 1 : gap >= 4 ? 0.7 : 0.4 })
  }

  return { bpm, beats, downbeat, phrase, energy, bass, drops }
}

/* ------------------------------------------------------------------------------------------ */
/* The show at one instant                                                                    */
/* ------------------------------------------------------------------------------------------ */

/** Index of the last beat at or before `t` (-1 before the first). */
function beatIndex(beats: Float64Array, t: number): number {
  let lo = 0
  let hi = beats.length - 1
  if (t < beats[0]) return -1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (beats[mid] <= t) lo = mid
    else hi = mid - 1
  }
  return lo
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** Where the show stands at `t` seconds into the track (written into `out`). */
export function showAt(map: MusicMap, t: number, out: ShowState): ShowState {
  const { beats, bpm } = map
  const period = 60 / bpm
  const last = beats.length - 1
  const i = Math.max(0, beatIndex(beats, t))
  const next = i < last ? beats[i + 1] : beats[i] + period
  const phase = clamp01((t - beats[i]) / (next - beats[i]))
  const beat = t < beats[0] ? (t - beats[0]) / period : i + phase
  const k = Math.min(i, last)

  out.on = true
  out.bpm = bpm
  out.beat = beat
  out.phase = t < beats[0] ? 0 : phase
  const origin = map.downbeat + 4 * map.phrase
  out.phraseBeat = beat - origin
  out.phrase = Math.floor(out.phraseBeat / 16)
  out.energy = map.energy[k]

  const first = (((k - map.downbeat) % 4) + 4) % 4 === 0
  out.kick =
    t < beats[0] ? 0 : (first ? 1 : 0.72) * (0.15 + 0.85 * map.bass[k]) * Math.exp(-phase * 5.5)

  // the last drop behind, the next big one ahead
  let behind: MusicDrop | null = null
  let ahead: MusicDrop | null = null
  for (const drop of map.drops) {
    if (drop.beat <= beat) behind = drop
    else if (drop.strength >= 0.7) {
      ahead = drop
      break
    }
  }
  const since = behind ? beat - behind.beat : Infinity
  out.drop = behind && since < 16 ? behind.strength * Math.exp(-since / 3) : 0
  out.flash = behind && since < 2 ? behind.strength * Math.exp(-since * 3) : 0
  const until = ahead ? ahead.beat - beat : Infinity
  const span = ahead && ahead.strength >= 1 ? 8 : 4
  out.build = ahead && until <= span ? ahead.strength * (1 - until / span) : 0
  out.blackout = ahead && until <= 0.5 ? smoothstep(0.5, 0.35, until) : 0
  return out
}
