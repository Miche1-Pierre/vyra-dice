import { computeNeonEdges, type EdgeRequest } from "@/components/scene/fx/neon-edges"

/* Computes the neon intro's lines off the main thread: the loading screen keeps its pace. */
self.onmessage = (event: MessageEvent<EdgeRequest>) => {
  const edges = computeNeonEdges(event.data)
  ;(self as unknown as Worker).postMessage(edges, [
    edges.positions.buffer,
    edges.seg.buffer,
    edges.delay.buffer,
  ])
}
