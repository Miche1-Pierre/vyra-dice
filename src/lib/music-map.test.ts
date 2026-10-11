import { describe, expect, it } from "vitest"

import { analyseTrack, emptyShow, fft, realSpectrum, showAt, type MusicMap } from "@/lib/music-map"

const RATE = 22050

/** Deterministic noise, for hats and claps. */
function noise(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 31 - 1
  }
}

/**
 * A club track, beat by beat: kicks on every beat, hats on the off-beats, claps on 2 and 4 and a
 * bass line; a break of four bars (no kick, no bass) before a drop.
 */
function clubTrack({
  bpm,
  first,
  bars,
  breakBars,
}: {
  bpm: number
  first: number
  bars: number
  breakBars: [number, number]
}) {
  const period = 60 / bpm
  const length = Math.ceil((first + bars * 4 * period + 1) * RATE)
  const x = new Float32Array(length)
  const rand = noise(809)
  const add = (at: number, seconds: number, f: (t: number) => number) => {
    const from = Math.round(at * RATE)
    for (let i = 0; i < seconds * RATE && from + i < length; i++) x[from + i] += f(i / RATE)
  }
  for (let beat = 0; beat < bars * 4; beat++) {
    const at = first + beat * period
    const bar = Math.floor(beat / 4)
    const inBreak = bar >= breakBars[0] && bar < breakBars[1]
    if (!inBreak) {
      // kick: a pitch drop from 120 to 50 Hz
      let phase = 0
      add(at, 0.25, (t) => {
        phase += (2 * Math.PI * (50 + 70 * Math.exp(-t / 0.03))) / RATE
        return 0.9 * Math.sin(phase) * Math.exp(-t / 0.12)
      })
      // bass: a sustained low note across the beat
      add(at, period, (t) => 0.3 * Math.sin(2 * Math.PI * 55 * t) * Math.min(1, t / 0.01))
    }
    add(at + period / 2, 0.05, (t) => 0.25 * rand() * Math.exp(-t / 0.015))
    if (beat % 2 === 1) add(at, 0.12, (t) => 0.35 * rand() * Math.exp(-t / 0.04))
  }
  return x
}

describe("fft", () => {
  it("matches the plain DFT", () => {
    const n = 64
    const rand = noise(1)
    const x = Float64Array.from({ length: n }, () => rand())
    const re = Float64Array.from(x)
    const im = new Float64Array(n)
    fft(re, im)
    for (const k of [0, 1, 5, 31, 32, 63]) {
      let r = 0
      let i = 0
      for (let t = 0; t < n; t++) {
        r += x[t] * Math.cos((2 * Math.PI * k * t) / n)
        i -= x[t] * Math.sin((2 * Math.PI * k * t) / n)
      }
      expect(re[k]).toBeCloseTo(r, 9)
      expect(im[k]).toBeCloseTo(i, 9)
    }
  })

  it("gives the magnitudes of a real frame from half-length FFTs", () => {
    const n = 128
    const rand = noise(2)
    const x = Float64Array.from({ length: n }, () => rand())
    const out = new Float64Array(n / 2 + 1)
    realSpectrum(n)(x, out)
    for (const k of [0, 3, 17, 63, 64]) {
      let r = 0
      let i = 0
      for (let t = 0; t < n; t++) {
        r += x[t] * Math.cos((2 * Math.PI * k * t) / n)
        i -= x[t] * Math.sin((2 * Math.PI * k * t) / n)
      }
      expect(out[k]).toBeCloseTo(Math.hypot(r, i), 9)
    }
  })
})

describe("analyseTrack", () => {
  const bpm = 128
  const first = 0.31
  const period = 60 / bpm
  const track = clubTrack({ bpm, first, bars: 16, breakBars: [8, 12] })
  const map = analyseTrack(track, RATE) as MusicMap
  // index, in the map, of the track's first beat
  const one = map ? Math.round((first - map.beats[0]) / period) : 0

  it("finds the tempo and lays the beats on the kicks", () => {
    expect(map).not.toBeNull()
    expect(map.bpm).toBeCloseTo(bpm, 1)
    for (const beat of [0, 17, 40, 63]) {
      expect(Math.abs(map.beats[one + beat] - (first + beat * period))).toBeLessThan(0.004)
    }
  })

  it("starts the bars on the first kick", () => {
    expect((((one - map.downbeat) % 4) + 4) % 4).toBe(0)
  })

  it("tells the break from the full parts and finds the drop after it", () => {
    expect(map.energy[one + 34]).toBeLessThan(0.35)
    expect(map.energy[one + 20]).toBeGreaterThan(0.7)
    expect(map.bass[one + 40]).toBe(0)
    expect(map.drops).toContainEqual({ beat: one + 48, strength: 1 })
  })

  it("gives no map to a track without a steady beat", () => {
    const rand = noise(3)
    const hiss = Float32Array.from({ length: RATE * 20 }, () => 0.3 * rand())
    expect(analyseTrack(hiss, RATE)).toBeNull()
  })
})

describe("showAt", () => {
  const beats = Float64Array.from({ length: 64 }, (_, k) => 0.5 + k * 0.5)
  const map: MusicMap = {
    bpm: 120,
    beats,
    downbeat: 0,
    phrase: 0,
    energy: Float32Array.from({ length: 64 }, (_, k) => (k >= 32 && k < 48 ? 0.15 : 1)),
    bass: Float32Array.from({ length: 64 }, (_, k) => (k >= 32 && k < 48 ? 0 : 1)),
    drops: [{ beat: 48, strength: 1 }],
  }
  const at = (beat: number) => showAt(map, 0.5 + beat * 0.5, emptyShow())

  it("hits on each beat, harder on the bar's first", () => {
    expect(at(8).kick).toBeCloseTo(1, 5)
    expect(at(9).kick).toBeCloseTo(0.72, 5)
    expect(at(8.5).kick).toBeLessThan(0.1)
  })

  it("plays softly in a break, rises before the drop, then flashes on it", () => {
    expect(at(36).kick).toBeLessThan(0.2)
    expect(at(44).build).toBeCloseTo(0.5, 5)
    expect(at(47.8).blackout).toBe(1)
    const drop = at(48.05)
    expect(drop.blackout).toBe(0)
    expect(drop.flash).toBeGreaterThan(0.8)
    expect(drop.drop).toBeGreaterThan(0.9)
    expect(at(56).drop).toBeLessThan(0.1)
  })

  it("counts the 4-bar phrases from the map's first one", () => {
    expect(at(15.5).phrase).toBe(0)
    expect(at(16).phrase).toBe(1)
    expect(at(17).phraseBeat).toBeCloseTo(17, 5)
  })
})
