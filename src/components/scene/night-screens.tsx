"use client"

import { useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"

import {
  coverUv,
  findScreenPieces,
  pickVideo,
  trianglesOnScreens,
  type ScreenPiece,
} from "@/components/scene/fx/screens"
import { debugLog } from "@/lib/debug"
import { show } from "@/lib/music"

/**
 * Tempo the night's loops are cut at (motion design: 8 s loops, a beat every 0.5 s). With the
 * night's music, they play at the track's tempo, their first beat on the first beat of a phrase.
 */
const LOOP_BPM = 120

/** The chosen triangles of a geometry, in a new one (float attributes, no index). */
function pickTriangles(geometry: THREE.BufferGeometry, keep: (t: number) => boolean) {
  const index = geometry.index
  const count = index ? index.count : geometry.getAttribute("position").count
  const chosen: number[] = []
  for (let t = 0; t < count / 3; t++) if (keep(t)) chosen.push(t)
  const out = new THREE.BufferGeometry()
  for (const [name, attr] of Object.entries(geometry.attributes)) {
    const size = attr.itemSize
    const array = new Float32Array(chosen.length * 3 * size)
    let o = 0
    for (const t of chosen) {
      for (let k = 0; k < 3; k++) {
        const i = index ? index.getX(t * 3 + k) : t * 3 + k
        for (let c = 0; c < size; c++) array[o++] = attr.getComponent(i, c)
      }
    }
    out.setAttribute(name, new THREE.BufferAttribute(array, size))
  }
  out.computeBoundingSphere()
  return out
}

/**
 * The venue's screens for the night: their flat pieces, and the text standing on them split
 * into meshes of its own (same material), so that it can hide while the videos play. Safe to
 * run twice on the same venue (StrictMode): a mesh is split once.
 */
export function prepareScreens(root: THREE.Object3D, materials: readonly string[]) {
  const { screens, pieces } = findScreenPieces(root, materials)
  const texts: THREE.Mesh[] = []
  const parents = new Set(screens.map((s) => s.parent).filter((p) => p !== null))
  for (const parent of parents) {
    for (const child of [...parent.children]) {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh || screens.includes(mesh) || mesh.userData.textOf) continue
      let text = mesh.userData.screenText as THREE.Mesh | undefined
      if (!text) {
        const on = new Set(trianglesOnScreens(mesh, pieces))
        if (on.size === 0) continue
        const whole = mesh.geometry
        mesh.geometry = pickTriangles(whole, (t) => !on.has(t))
        text = new THREE.Mesh(
          pickTriangles(whole, (t) => on.has(t)),
          mesh.material,
        )
        text.name = `${mesh.name}_on_screen`
        text.position.copy(mesh.position)
        text.quaternion.copy(mesh.quaternion)
        text.scale.copy(mesh.scale)
        text.matrix.copy(mesh.matrix)
        text.matrixAutoUpdate = false
        // prepared again, it takes its finish from the glTF material, like the mesh it comes from
        text.userData.source = mesh.userData.source
        text.userData.textOf = mesh
        mesh.userData.screenText = text
        parent.add(text)
      }
      texts.push(text)
    }
  }
  return { screens, pieces, texts }
}

/**
 * While the night mode is on, the club's screens play the night's loops (muted, in a loop): each
 * piece takes the video closest to its shape, cropped to fill it. The videos load the first time
 * the night comes; until they can play, the screens keep their usual look. With the night's
 * music, the loops keep time with it.
 */
export function NightScreens({
  pieces,
  hide,
  videos,
  on,
}: {
  pieces: readonly ScreenPiece[]
  /** The screens' own faces and the text standing on them. */
  hide: readonly THREE.Object3D[]
  /** URLs of the loops. */
  videos: readonly string[]
  on: boolean
}) {
  const [media, setMedia] = useState<{ elements: HTMLVideoElement[]; aspects: number[] } | null>(
    null,
  )
  useEffect(() => {
    if (!on || media || videos.length === 0) return
    let live = true
    const elements = videos.map((src) => {
      const video = document.createElement("video")
      // muted by its attribute too: iPhones decide from it whether a video may take the sound
      video.muted = true
      video.defaultMuted = true
      video.setAttribute("muted", "")
      video.setAttribute("playsinline", "")
      video.loop = true
      video.playsInline = true
      video.crossOrigin = "anonymous"
      video.preload = "auto"
      video.src = src
      return video
    })
    Promise.all(
      elements.map(
        (video) =>
          new Promise<number>((resolve, reject) => {
            video.addEventListener(
              "loadedmetadata",
              () => resolve(video.videoWidth / video.videoHeight),
              {
                once: true,
              },
            )
            video.addEventListener("error", () => reject(new Error(video.src)), { once: true })
          }),
      ),
    ).then(
      (aspects) => {
        if (live) setMedia({ elements, aspects })
      },
      () => undefined, // a missing loop: the screens keep their usual look
    )
    return () => {
      live = false
    }
  }, [on, media, videos])

  const meshes = useMemo(() => {
    if (!media) return []
    const textures = media.elements.map((video) => {
      const texture = new THREE.VideoTexture(video)
      texture.colorSpace = THREE.SRGBColorSpace
      return texture
    })
    return pieces.map((piece) => {
      const i = pickVideo(piece.aspect, media.aspects)
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute("position", new THREE.BufferAttribute(piece.positions, 3))
      geometry.setAttribute(
        "uv",
        new THREE.BufferAttribute(coverUv(piece.uv, piece.aspect, media.aspects[i]), 2),
      )
      geometry.computeBoundingSphere()
      // brighter than white: the loops' light reaches the bloom, like the club's other screens
      const material = new THREE.MeshBasicMaterial({
        map: textures[i],
        color: new THREE.Color(1.5, 1.5, 1.5),
        fog: false,
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.userData.source = piece.source
      return mesh
    })
  }, [media, pieces])
  useEffect(
    () => () => {
      for (const mesh of meshes) {
        mesh.geometry.dispose()
        const material = mesh.material as THREE.MeshBasicMaterial
        material.map?.dispose()
        material.dispose()
      }
    },
    [meshes],
  )
  useEffect(
    () => () => {
      for (const video of media?.elements ?? []) {
        video.pause()
        video.removeAttribute("src")
        video.load()
      }
    },
    [media],
  )

  const playing = on && meshes.length > 0
  useEffect(() => {
    for (const video of media?.elements ?? []) {
      if (playing) void video.play().catch(() => undefined)
      else video.pause()
    }
    for (const object of hide) object.visible = !playing
    return () => {
      for (const object of hide) object.visible = true
    }
  }, [playing, media, hide])

  useEffect(() => {
    // for checks in a browser, outside production
    if (process.env.NODE_ENV !== "production" && media)
      (window as unknown as { __videos?: HTMLVideoElement[] }).__videos = media.elements
  }, [media])

  // in time with the music: at its tempo, nudged towards their place in the phrase, put back
  // there when far off (a seek costs a stall: once in a while at most)
  const lastSeek = useRef(new Map<HTMLVideoElement, number>())
  useFrame(() => {
    if (!playing || !media) return
    const now = performance.now()
    for (const video of media.elements) {
      let rate = 1
      if (show.on && show.bpm > 0 && video.duration > 0) {
        // a slow or fast track: the loops take twice or half its beats, never far from their pace
        let speed = show.bpm / LOOP_BPM
        let perBeat = 1
        while (speed < 0.75) [speed, perBeat] = [speed * 2, perBeat * 2]
        while (speed >= 1.5) [speed, perBeat] = [speed / 2, perBeat / 2]
        const beat = 60 / LOOP_BPM
        const loopBeats = Math.max(1, Math.round(video.duration / beat))
        const at = show.phraseBeat * perBeat
        const wanted = ((((at % loopBeats) + loopBeats) % loopBeats) * beat) % video.duration
        let off = video.currentTime - wanted
        off -= video.duration * Math.round(off / video.duration)
        if (Math.abs(off) > 0.25 && now - (lastSeek.current.get(video) ?? 0) > 1500) {
          lastSeek.current.set(video, now)
          debugLog("screen_seek", { off: +off.toFixed(2) })
          video.currentTime = wanted
        }
        rate = speed * (1 - THREE.MathUtils.clamp(off, -0.12, 0.12))
      }
      if (Math.abs(video.playbackRate - rate) > 0.002) video.playbackRate = rate
    }
  })

  // a screen of the mezzanine fades with its level, as its own face does
  useFrame(() => {
    for (const mesh of meshes) {
      const source = (mesh.userData.source as THREE.Mesh).material as THREE.Material
      const material = mesh.material as THREE.MeshBasicMaterial
      material.opacity = source.opacity
      if (material.transparent !== source.transparent) {
        material.transparent = source.transparent
        material.needsUpdate = true
      }
    }
  })

  return meshes.length ? (
    <group visible={playing}>
      {meshes.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}
    </group>
  ) : null
}
