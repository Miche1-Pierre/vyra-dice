import { surfaceImages, type SurfaceJob } from "@/components/scene/fx/surface-fields"

/* Generates the club's procedural surfaces off the main thread: the loading screen keeps its pace. */
self.onmessage = (event: MessageEvent<{ id: number; job: SurfaceJob }>) => {
  const images = surfaceImages(event.data.job)
  ;(self as unknown as Worker).postMessage(
    { id: event.data.id, images },
    images.map((image) => image.buffer),
  )
}
