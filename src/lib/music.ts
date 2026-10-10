/*
 * The night's music for the immersion, and what the light show reads from it.
 *
 * One audio element for the visit, started only on the visitor's explicit choice (browsers refuse
 * sound without a gesture anyway); a sealed track opens only with the key of a private demo link.
 * Its signal goes through an analyser: once per frame, `sampleMusic` turns the bass into a level
 * and beats, written into `pulse`, a plain object the scene reads in useFrame (no React state, no
 * re-render).
 */

/** 0–1: the bass level, smoothed; a beat that jumps to 1 on each kick and decays. */
export const pulse = { level: 0, beat: 0 }

let audio: HTMLAudioElement | null = null
let context: AudioContext | null = null
let analyser: AnalyserNode | null = null
let gain: GainNode | null = null
let bins: Uint8Array<ArrayBuffer> | null = null
let average = 0
let sinceBeat = 1
let stopTimer: number | null = null

const FADE_S = 0.6

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

/**
 * Once per frame: the level of the kick and the bass line (43–150 Hz) and the beats, detected
 * when the bass jumps above its recent average.
 */
export function sampleMusic(delta: number) {
  const dt = Math.min(delta, 0.1)
  if (!analyser || !bins || !context || !musicPlaying()) {
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
