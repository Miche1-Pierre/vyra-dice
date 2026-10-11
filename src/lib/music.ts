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

import { debugLog } from "@/lib/debug"
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

const unsealed = new Map<string, Promise<string>>()

/**
 * A sealed track, fetched and opened with the private link's key, as a URL the audio can play.
 * Opened once per visit: the same URL to every caller, so that the track playing stays the one
 * offered (a failure is forgotten, to be tried again).
 */
export function unsealMusic(url: string, key: string): Promise<string> {
  const id = `${url}#${key}`
  let opened = unsealed.get(id)
  if (!opened) {
    opened = (async () => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status} ${url}`)
      const plain = await unseal(new Uint8Array(await res.arrayBuffer()), key)
      return URL.createObjectURL(new Blob([plain], { type: "audio/mpeg" }))
    })()
    unsealed.set(id, opened)
    opened.catch(() => unsealed.delete(id))
  }
  return opened
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

/** The visitor wants the music on: set when it starts, cleared when they cut it or leave. */
let wanted = false
const changeListeners = new Set<(on: boolean) => void>()

/**
 * Calls `listener` when the music starts or stops from outside the page's buttons (the phone's
 * own controls), so that the interface shows what plays.
 */
export function onMusicChange(listener: (on: boolean) => void): () => void {
  changeListeners.add(listener)
  return () => {
    changeListeners.delete(listener)
  }
}

/** Plays again what the browser stopped on its own (no-op once the visitor has cut the sound). */
function resumeMusic() {
  if (!audio || !wanted) return
  void context?.resume()
  if (audio.paused) void audio.play().catch(() => undefined)
}

/** When the music was last played again on its own: a phone that keeps pausing it is not fought. */
const retries: number[] = []
let armed = false

/**
 * The browser paused the music, or suspended its audio, without the visitor asking (iPhones do,
 * when something else on the page or the phone takes the sound). It plays again at once when the
 * page is in view (three times in ten seconds at most), and at the visitor's next touch or key in
 * any case: a gesture the browser always accepts.
 */
function interrupted(reason: string) {
  if (!wanted) return
  debugLog("music_interrupted", { reason, context: context?.state, paused: audio?.paused })
  const now = performance.now()
  while (retries.length && now - retries[0] > 10_000) retries.shift()
  if (document.visibilityState === "visible" && retries.length < 3) {
    retries.push(now)
    resumeMusic()
  }
  if (armed) return
  armed = true
  const again = () => {
    armed = false
    window.removeEventListener("pointerdown", again, true)
    window.removeEventListener("keydown", again, true)
    debugLog("music_resume_gesture")
    resumeMusic()
  }
  window.addEventListener("pointerdown", again, true)
  window.addEventListener("keydown", again, true)
}

const AUDIO_EVENTS = ["play", "playing", "pause", "waiting", "stalled", "ended", "error"] as const

function graph(src: string): HTMLAudioElement {
  if (audio && audio.dataset.src === src) return audio
  audio?.pause()
  audio = new Audio(src)
  audio.dataset.src = src
  audio.loop = true
  audio.preload = "auto"
  const element = audio
  for (const type of AUDIO_EVENTS) {
    element.addEventListener(type, () =>
      debugLog(`audio_${type}`, {
        time: +element.currentTime.toFixed(2),
        ready: element.readyState,
      }),
    )
  }
  element.addEventListener("pause", () => {
    if (element === audio) interrupted("paused")
  })
  if (!context) {
    const created = new AudioContext()
    created.addEventListener("statechange", () => {
      debugLog("audio_context", { state: created.state })
      if (created.state !== "running") interrupted(`context ${created.state}`)
    })
    context = created
  }
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
    wanted = true
    debugLog("music_play", { src: src.slice(0, 40) })
    followSystemControls(src)
    return true
  } catch (error) {
    debugLog("music_play_failed", { error: String(error).slice(0, 200) })
    return false
  }
}

/**
 * The phone's own play/pause (lock screen, control centre, headphones) goes through the page: a
 * pause asked for there is the visitor's, not an interruption to undo.
 */
function followSystemControls(src: string) {
  const session = typeof navigator === "undefined" ? undefined : navigator.mediaSession
  if (!session) return
  try {
    session.setActionHandler("pause", () => {
      debugLog("system_pause")
      pauseMusic()
      for (const listener of changeListeners) listener(false)
    })
    session.setActionHandler("play", () => {
      debugLog("system_play")
      void playMusic(src).then((on) => {
        for (const listener of changeListeners) listener(on)
      })
    })
  } catch {
    // an action this browser does not know: it keeps its own handling
  }
}

/** Fades the track out, then pauses it (it resumes where it was). */
export function pauseMusic() {
  wanted = false
  debugLog("music_pause")
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

/** Seconds until the next snapshot for the on-device diagnostics. */
let snapshotIn = 0

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
  snapshotIn -= delta
  if (snapshotIn <= 0) {
    snapshotIn = 1
    debugLog("tick", {
      context: context?.state ?? null,
      paused: audio?.paused ?? null,
      time: audio ? +audio.currentTime.toFixed(2) : null,
      show: show.on,
      wanted,
    })
  }
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
