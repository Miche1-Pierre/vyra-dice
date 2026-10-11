/*
 * The night's music for the immersion, and what the light show reads from it.
 *
 * One audio element for the visit, started only on the visitor's explicit choice (browsers refuse
 * sound without a gesture anyway); a sealed track opens only with the key of a private demo link.
 * The whole track is read once beforehand (`prepareShow`, music-map.ts): its beat grid, its bars,
 * its breaks and drops. Once per frame, `sampleMusic` follows the position heard in the track and
 * writes where the show stands into `show` and `pulse`, plain objects the scene reads in useFrame
 * (no React state, no re-render). Until the track is read, or when it has no steady beat, the
 * lights follow its bass through an analyser as it plays.
 */

import { emptyShow, showAt, type MusicMap } from "@/lib/music-map"

/** 0–1: the bass level, smoothed; a beat that jumps to 1 on each kick and decays. */
export const pulse = { level: 0, beat: 0 }

/** Where the light show stands in the track's map, in step with what is heard. */
export const show = emptyShow()

let audio: HTMLAudioElement | null = null
let context: AudioContext | null = null
let analyser: AnalyserNode | null = null
let gain: GainNode | null = null
let bins: Uint8Array<ArrayBuffer> | null = null
let average = 0
let sinceBeat = 1
let stopTimer: number | null = null

const FADE_S = 0.6
/** Sample rate the track is read at: plenty for a beat, a quarter of the work of 44.1 kHz. */
const ANALYSIS_RATE = 22050
/** About how long a frame takes to reach the screen: the show runs that much ahead. */
const DISPLAY_LEAD = 0.02

/** The key of a private demo link (`#son=<key>`, never sent to the server), if any. */
export function musicKey(): string | null {
  if (typeof window === "undefined") return null
  return new URLSearchParams(window.location.hash.slice(1)).get("son")
}

/** Opens a sealed track (scripts/seal-audio.mjs: IV, then AES-GCM ciphertext and tag). */
export async function unseal(data: Uint8Array<ArrayBuffer>, key: string): Promise<ArrayBuffer> {
  const raw = Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  )
  const secret = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"])
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: data.subarray(0, 12) },
    secret,
    data.subarray(12),
  )
}

/** A sealed track, fetched and opened with the private link's key, as a URL the audio can play. */
export async function unsealMusic(url: string, key: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  const plain = await unseal(new Uint8Array(await res.arrayBuffer()), key)
  return URL.createObjectURL(new Blob([plain], { type: "audio/mpeg" }))
}

/* The track's map -------------------------------------------------------------------------- */

let mapped: { src: string; map: MusicMap } | null = null
const reading = new Map<string, Promise<boolean>>()

/**
 * Reads the whole track once, ahead of the show: decoded here, analysed in a worker. Resolves to
 * false when it cannot be read or has no steady beat (the lights then follow its bass live).
 */
export function prepareShow(src: string): Promise<boolean> {
  if (mapped?.src === src) return Promise.resolve(true)
  let pending = reading.get(src)
  if (!pending) {
    pending = readTrack(src).then(
      (map) => {
        if (map) mapped = { src, map }
        return map !== null
      },
      () => false,
    )
    reading.set(src, pending)
  }
  return pending
}

async function readTrack(src: string): Promise<MusicMap | null> {
  const res = await fetch(src)
  if (!res.ok) return null
  const { samples, sampleRate } = await decodeMono(await res.arrayBuffer())
  return analyseInWorker(samples, sampleRate)
}

/** The track as mono samples, resampled for the analysis by the browser's own decoder. */
async function decodeMono(
  data: ArrayBuffer,
): Promise<{ samples: Float32Array; sampleRate: number }> {
  let offline: OfflineAudioContext
  try {
    offline = new OfflineAudioContext(1, 1, ANALYSIS_RATE)
  } catch {
    offline = new OfflineAudioContext(1, 1, 44100) // a browser that will not resample that low
  }
  const buffer = await offline.decodeAudioData(data)
  const samples = new Float32Array(buffer.length)
  const channels = buffer.numberOfChannels
  for (let c = 0; c < channels; c++) {
    const channel = buffer.getChannelData(c)
    for (let i = 0; i < samples.length; i++) samples[i] += channel[i] / channels
  }
  return { samples, sampleRate: buffer.sampleRate }
}

function analyseInWorker(samples: Float32Array, sampleRate: number): Promise<MusicMap | null> {
  return new Promise((resolve) => {
    let worker: Worker
    try {
      worker = new Worker(new URL("./music-map.worker.ts", import.meta.url), { type: "module" })
    } catch {
      resolve(null)
      return
    }
    const done = (map: MusicMap | null) => {
      worker.terminate()
      resolve(map)
    }
    worker.onmessage = (event: MessageEvent<MusicMap | null>) => done(event.data)
    worker.onerror = () => done(null)
    worker.postMessage({ samples, sampleRate }, [samples.buffer])
  })
}

/* Playback --------------------------------------------------------------------------------- */

function graph(src: string): HTMLAudioElement {
  if (audio && audio.dataset.src === src) return audio
  audio?.pause()
  audio = new Audio(src)
  audio.dataset.src = src
  audio.loop = true
  audio.preload = "auto"
  context ??= new AudioContext()
  // element → analyser → volume → speakers: the analyser hears the track, not the fades
  const source = context.createMediaElementSource(audio)
  analyser = context.createAnalyser()
  analyser.fftSize = 2048
  analyser.smoothingTimeConstant = 0.5
  gain = context.createGain()
  gain.gain.value = 0
  source.connect(analyser)
  analyser.connect(gain)
  gain.connect(context.destination)
  bins = new Uint8Array(analyser.frequencyBinCount)
  return audio
}

/**
 * Starts the track with a short fade-in. Call it from a click or a key press: the browser plays
 * sound only after a gesture. Resolves to false when it cannot play (missing file, refused).
 */
export async function playMusic(src: string): Promise<boolean> {
  try {
    // iPhone: Web Audio follows the ring switch unless the page plays as a music player does
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
    if (session) session.type = "playback"
    const element = graph(src)
    if (stopTimer !== null) window.clearTimeout(stopTimer)
    stopTimer = null
    // started inside the gesture, before anything is awaited
    const playing = element.play()
    void context?.resume()
    await playing
    const now = context!.currentTime
    gain!.gain.cancelScheduledValues(now)
    gain!.gain.setValueAtTime(gain!.gain.value, now)
    gain!.gain.linearRampToValueAtTime(1, now + FADE_S)
    return true
  } catch {
    return false
  }
}

/** Fades the track out, then pauses it (it resumes where it was). */
export function pauseMusic() {
  if (!audio || !context || !gain || audio.paused) return
  const now = context.currentTime
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(gain.gain.value, now)
  gain.gain.linearRampToValueAtTime(0, now + FADE_S)
  const element = audio
  stopTimer = window.setTimeout(() => element.pause(), FADE_S * 1000)
}

/** The music actually plays (not paused, not fading out). */
export function musicPlaying(): boolean {
  return !!audio && !audio.paused && stopTimer === null
}

/* Once per frame --------------------------------------------------------------------------- */

/** Seconds into the track as heard: the element's position, smoothed, minus the output delay. */
let heard = 0
let lastPosition = -1

// for checks in a browser, outside production: the show, the map, the audio and its clock
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  ;(window as unknown as { __music?: object }).__music = {
    show,
    pulse,
    map: () => mapped?.map ?? null,
    audio: () => audio,
    context: () => context,
    gain: () => gain,
    heard: () => heard,
  }
}

function followTrack(delta: number) {
  if (!audio || !context) return
  heard += delta
  const position = audio.currentTime
  if (position === lastPosition) return
  lastPosition = position
  const latency = (context.outputLatency || 0) + (context.baseLatency || 0)
  const error = position - latency - heard
  // a loop or a seek jumps there; otherwise ease towards the element's coarser clock
  heard = Math.abs(error) > 0.25 ? position - latency : heard + error * 0.3
}

function restShow(dt: number) {
  show.on = false
  const fade = Math.exp(-dt * 7)
  show.kick *= fade
  show.drop *= fade
  show.flash *= fade
  show.build *= fade
  show.blackout = 0
}

/** The show holds still (the visitor asked for less motion): no beat, no flash. */
export function stillShow() {
  restShow(1)
  pulse.level = pulse.beat = 0
}

/**
 * Once per frame: where the show stands in the track's map, at the instant being heard. Without
 * a map, the level of the kick and the bass line (43–150 Hz) and the beats, detected when the
 * bass jumps above its recent average.
 */
export function sampleMusic(delta: number) {
  const dt = Math.min(delta, 0.1)
  const playing = musicPlaying()
  if (playing) followTrack(delta)
  const map = playing && mapped && audio?.dataset.src === mapped.src ? mapped.map : null
  if (map) {
    showAt(map, heard + DISPLAY_LEAD, show)
    pulse.beat = show.kick
    pulse.level = show.energy
    return
  }
  restShow(dt)
  if (!analyser || !bins || !context || !playing) {
    pulse.level *= Math.exp(-dt * 6)
    pulse.beat *= Math.exp(-dt * 7)
    return
  }
  analyser.getByteFrequencyData(bins)
  const hz = context.sampleRate / analyser.fftSize
  const lo = Math.max(1, Math.floor(43 / hz))
  const hi = Math.max(lo, Math.ceil(150 / hz))
  let sum = 0
  for (let i = lo; i <= hi; i++) sum += bins[i]
  const bass = sum / ((hi - lo + 1) * 255)
  average += (bass - average) * Math.min(1, dt * 2) // about half a second of memory
  sinceBeat += dt
  if (bass > 0.35 && bass > average * 1.18 && sinceBeat > 0.24) {
    pulse.beat = 1
    sinceBeat = 0
  } else {
    pulse.beat *= Math.exp(-dt * 7)
  }
  pulse.level += (bass - pulse.level) * Math.min(1, dt * 12)
}
