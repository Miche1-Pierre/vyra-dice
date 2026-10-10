"use client"

import { useFrame, useThree } from "@react-three/fiber"
import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"

import {
  computeNeonEdges,
  type EdgeRequest,
  type NeonEdges,
} from "@/components/scene/fx/neon-edges"
import { useExperience } from "@/lib/store"

/*
 * Neon opening (`ambiance.intro: "neon"`): from the overview, glowing lines draw the club from
 * the dance floor outwards, then the club builds up from the floor and the neon goes out.
 */

/** Seconds: the lines draw; the club builds up (overlapping the end of the drawing); the neon goes out. */
const DRAW = 2.8
const BUILD_FROM = 1.9
const BUILD = 2.4
const FADE = 0.9
/** Without its lines (worker failed, very slow device), the intro gives up after this long. */
const WAIT_LIMIT = 3.5
/** Folds sharper than this angle get a line (bevels and soft cushions do not). */
const THRESHOLD_DEG = 48

/**
 * `?neon=<seconds>` holds the intro at that instant (lines drawn, club half built…), so it can
 * be captured and reviewed frame by frame. It then never ends by itself.
 */
function readNeonHold(): number | null {
  if (typeof window === "undefined") return null
  const raw = new URLSearchParams(window.location.search).get("neon")
  if (raw === null) return null
  const t = Number(raw)
  return Number.isFinite(t) && t >= 0 ? t : null
}

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function createNeonMaterial(color: string) {
  const c = new THREE.Color(color)
  return new THREE.ShaderMaterial({
    uniforms: {
      uDraw: { value: 0 },
      uFade: { value: 1 },
      uColor: { value: new THREE.Vector3(c.r, c.g, c.b) },
    },
    vertexShader: /* glsl */ `
      attribute float aSeg;
      attribute float aDelay;
      varying float vSeg;
      varying float vDelay;
      void main() {
        vSeg = aSeg;
        vDelay = aDelay;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uDraw;
      uniform float uFade;
      uniform vec3 uColor;
      varying float vSeg;
      varying float vDelay;
      void main() {
        // each segment draws from its start to its end, after its delay
        float head = (uDraw - vDelay * 0.75) / 0.25;
        if (vSeg > head) discard;
        // the tip of the stroke burns brighter and blooms; the neon settles behind it
        float tip = 1.0 - smoothstep(0.0, 0.18, head - vSeg);
        gl_FragColor = vec4(uColor * (1.15 + 3.2 * tip), uFade);
      }
    `,
    // overlapping lines do not add up: the dense corners stay lines, not a red fog
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
}

/**
 * The venue's meshes as the edge worker reads them: world-space positions (copied, the GPU
 * keeps its own) and indices. FX and glass are left out: they would only add noise.
 */
export function neonRequest(root: THREE.Object3D): EdgeRequest {
  const meshes: EdgeRequest["meshes"] = []
  const v = new THREE.Vector3()
  root.updateMatrixWorld(true)
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const material = mesh.material as THREE.Material
    if (
      material.transparent ||
      /^(fx_|lvl1_fx_)/.test(mesh.name) ||
      /^(fx_|lvl1_fx_)/.test(mesh.parent?.name ?? "")
    )
      return
    const attr = mesh.geometry.getAttribute("position")
    const positions = new Float32Array(attr.count * 3)
    for (let i = 0; i < attr.count; i++) {
      v.fromBufferAttribute(attr, i).applyMatrix4(mesh.matrixWorld)
      positions[i * 3] = v.x
      positions[i * 3 + 1] = v.y
      positions[i * 3 + 2] = v.z
    }
    const index = mesh.geometry.index ? new Uint32Array(mesh.geometry.index.array) : null
    meshes.push({ positions, index })
  })
  const box = new THREE.Box3().setFromObject(root)
  const center = box.getCenter(new THREE.Vector3())
  return {
    meshes,
    thresholdDeg: THRESHOLD_DEG,
    origin: [center.x, Math.max(0, box.min.y), center.z],
    reach: Math.hypot(box.max.x - box.min.x, box.max.z - box.min.z) / 2,
    height: Math.max(1, box.max.y),
  }
}

/** Computes the lines in a worker (the loading screen keeps its pace), on the page as a fallback. */
export function requestNeonEdges(
  request: EdgeRequest,
  onEdges: (edges: NeonEdges) => void,
): () => void {
  let cancelled = false
  const fallback = () => {
    if (!cancelled) onEdges(computeNeonEdges(request))
  }
  let worker: Worker | null = null
  try {
    worker = new Worker(new URL("./neon-edges.worker.ts", import.meta.url), { type: "module" })
  } catch {
    fallback()
    return () => {}
  }
  worker.onmessage = (event: MessageEvent<NeonEdges>) => {
    if (!cancelled) onEdges(event.data)
    worker?.terminate()
  }
  worker.onerror = () => {
    worker?.terminate()
    fallback()
  }
  // copies of the positions travel to the worker; the GPU keeps the originals
  worker.postMessage(
    request,
    request.meshes.flatMap((m) =>
      m.index ? [m.positions.buffer, m.index.buffer] : [m.positions.buffer],
    ),
  )
  return () => {
    cancelled = true
    worker?.terminate()
  }
}

export function NeonIntro({
  edges,
  color,
  height,
}: {
  edges: NeonEdges | null
  color: string
  /** Top of the club: the build rises from the floor to here. */
  height: number
}) {
  const gl = useThree((s) => s.gl)
  const intro = useExperience((s) => s.view === "intro")
  const sceneReady = useExperience((s) => s.sceneReady)
  const finishIntro = useExperience((s) => s.finishIntro)
  // keeps what is below it: the club is hidden under the floor until it builds up
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), -0.5), [])
  const material = useMemo(() => createNeonMaterial(color), [color])
  const lines = useMemo(() => {
    if (!edges) return null
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.BufferAttribute(edges.positions, 3))
    geometry.setAttribute("aSeg", new THREE.BufferAttribute(edges.seg, 1))
    geometry.setAttribute("aDelay", new THREE.BufferAttribute(edges.delay, 1))
    const segments = new THREE.LineSegments(geometry, material)
    segments.frustumCulled = false
    segments.renderOrder = 20
    return segments
  }, [edges, material])
  const [heldAt] = useState(readNeonHold)
  const startedAt = useRef<number | null>(null)
  const waitingSince = useRef<number | null>(null)
  const finished = useRef(false)

  useEffect(() => {
    if (!intro) return
    gl.clippingPlanes = [plane]
    return () => {
      gl.clippingPlanes = []
    }
  }, [gl, plane, intro])

  useEffect(() => () => lines?.geometry.dispose(), [lines])
  useEffect(() => () => material.dispose(), [material])

  useFrame((state, delta) => {
    const u = material.uniforms
    if (!intro) {
      // finished or skipped: the neon goes out at once
      u.uFade.value = Math.max(0, u.uFade.value - delta / 0.35)
      if (lines) lines.visible = u.uFade.value > 0.01
      return
    }
    if (!sceneReady) return
    const now = state.clock.elapsedTime
    if (!lines) {
      waitingSince.current ??= now
      if (now - waitingSince.current > WAIT_LIMIT && !finished.current) {
        finished.current = true
        finishIntro()
      }
      return
    }
    startedAt.current ??= now
    const t = heldAt ?? now - startedAt.current
    u.uDraw.value = t / DRAW
    const build = Math.min(1, Math.max(0, (t - BUILD_FROM) / BUILD))
    plane.constant = -0.5 + (height + 1.5) * easeInOut(build)
    u.uFade.value = 1 - Math.min(1, Math.max(0, (t - BUILD_FROM - BUILD) / FADE))
    if (heldAt === null && t >= BUILD_FROM + BUILD + FADE && !finished.current) {
      finished.current = true
      finishIntro()
    }
  })

  return lines ? <primitive object={lines} /> : null
}
