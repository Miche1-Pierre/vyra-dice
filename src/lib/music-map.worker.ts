import { analyseTrack } from "@/lib/music-map"

/* Reads the night's music off the main thread: the visit keeps its pace meanwhile. */
self.onmessage = (event: MessageEvent<{ samples: Float32Array; sampleRate: number }>) => {
  const map = analyseTrack(event.data.samples, event.data.sampleRate)
  ;(self as unknown as Worker).postMessage(
    map,
    map ? [map.beats.buffer, map.energy.buffer, map.bass.buffer] : [],
  )
}
