"use client"

import { useGLTF } from "@react-three/drei"
import { useFrame, useLoader } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"

import type { Quality } from "@/components/scene/effects"
import { finishFor } from "@/components/scene/fx/finishes"
import { extractGlobes, GlobeGlow, type Globe } from "@/components/scene/fx/globes"
import {
  createLedRainMaterial,
  createScreenMaterial,
  createSphereMaterial,
  type TimedMaterial,
} from "@/components/scene/fx/materials"
import { useExperience } from "@/lib/store"

import nahoLightmaps from "../../../public/models/naho/lightmaps.json"

export interface LightmapManifest {
  version: number
  club: string
  encoding: "srgb"
  /** Content hashes (assets:optimize) version the URLs: a new bake is never served stale. */
  model?: { file: string; hash: string }
  lightmaps: Record<string, { file: string; scale: number; size: number; hash?: string }>
}

const versioned = (url: string, hash?: string) => (hash ? `${url}?v=${hash}` : url)

/** Lightmap manifests are bundled (2 KB) so the textures can be requested with the GLB. */
const MANIFESTS: Record<string, LightmapManifest> = {
  naho: nahoLightmaps as LightmapManifest,
}

/** Global brightness of the baked lighting (artistic exposure, 1 = as baked). */
const LIGHTMAP_EXPOSURE = 1.15
/** Emission strengths come from Blender (Cycles watts-ish); scale them into bloom range. */
const EMISSION_SCALE = 0.32

interface PreparedVenue {
  root: THREE.Object3D
  timed: TimedMaterial[]
  /** Mezzanine materials, faded out when only the ground floor is shown. */
  upper: THREE.Material[]
  /** Hanging globes, for their halos. */
  globes: Globe[]
}

const FX_NAMES = new Set(["fx_ledrain", "fx_spheres", "fx_screen"])
/** Metals keep their finish (environment reflections) even without a lightmap. */
const METALS = new Set(["naho_black_metal", "naho_gold", "naho_slat"])

/**
 * Blender node owning a mesh. glTF splits a multi-material node into a group named after the
 * node with one child per material (`lvl1_furniture` → `lvl1_furniture_1`, …): the node name
 * is what owns the lightmap and the FX role.
 */
function nodeName(mesh: THREE.Object3D, manifest: LightmapManifest): string {
  let cur: THREE.Object3D | null = mesh
  while (cur) {
    if (cur.name in manifest.lightmaps || FX_NAMES.has(cur.name)) return cur.name
    cur = cur.parent
  }
  return mesh.name.replace(/_\d+$/, "")
}

function isEmissive(m: THREE.MeshStandardMaterial): boolean {
  return (
    Boolean(m.emissive) &&
    m.emissiveIntensity > 0 &&
    m.emissive.r + m.emissive.g + m.emissive.b > 0.002
  )
}

function prepareVenue(
  scene: THREE.Object3D,
  manifest: LightmapManifest,
  lightmaps: Record<string, THREE.Texture>,
  quality: Quality,
): PreparedVenue {
  const timed: TimedMaterial[] = []
  const upper: THREE.Material[] = []
  const sphereMeshes: THREE.Mesh[] = []
  const detail = quality === "high"

  scene.updateMatrixWorld(true)
  scene.traverse((obj) => {
    obj.matrixAutoUpdate = false
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const owner = nodeName(mesh, manifest)
    // StrictMode prepares the same scene twice: always start again from the glTF material
    const src = (mesh.userData.source ??= mesh.material) as THREE.MeshStandardMaterial
    let mat: THREE.Material

    if (owner === "fx_ledrain" || owner === "fx_spheres") {
      const data = mesh.geometry.getAttribute("uv1")
      if (data) mesh.geometry.setAttribute("aData", data)
      const m = owner === "fx_ledrain" ? createLedRainMaterial() : createSphereMaterial()
      if (owner === "fx_spheres") sphereMeshes.push(mesh)
      timed.push(m)
      mat = m
    } else if (owner === "fx_screen") {
      const m = createScreenMaterial()
      timed.push(m)
      mat = m
    } else if (isEmissive(src)) {
      const color = src.emissive.clone().multiplyScalar(src.emissiveIntensity * EMISSION_SCALE)
      mat = new THREE.MeshBasicMaterial({ color, fog: false })
    } else if (src.name === "naho_glass") {
      mat = finishFor({ src, lightMap: null, lightMapIntensity: 1, detail })!
    } else if (src.transparent || src.opacity < 1) {
      mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color("#b9c9dd"),
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    } else {
      const lm = lightmaps[owner] ?? null
      const entry = manifest.lightmaps[owner]
      const lightMapIntensity = entry ? entry.scale * Math.PI * LIGHTMAP_EXPOSURE : 1
      const finished =
        lm || METALS.has(src.name)
          ? finishFor({ src, lightMap: lm, lightMapIntensity, detail })
          : null
      if (finished) {
        mat = finished
      } else {
        mat = new THREE.MeshBasicMaterial({
          color: src.color,
          map: src.map ?? null,
          lightMap: lm ?? null,
          lightMapIntensity,
          side: src.side,
        })
        if (!lm) (mat as THREE.MeshBasicMaterial).color.multiplyScalar(0.6)
      }
    }
    mat.name = src.name
    mat.userData.baseOpacity = mat.opacity
    mat.userData.baseTransparent = mat.transparent
    mat.userData.baseDepthWrite = mat.depthWrite
    mesh.material = mat
    if (owner.startsWith("lvl1_")) upper.push(mat)
  })
  return { root: scene, timed, upper, globes: extractGlobes(sphereMeshes) }
}

function applyUpperOpacity(materials: THREE.Material[], k: number) {
  for (const m of materials) {
    const transparent = k < 1 || m.userData.baseTransparent
    if (m.transparent !== transparent) {
      m.transparent = transparent
      m.needsUpdate = true
    }
    m.opacity = m.userData.baseOpacity * k
    m.depthWrite = k >= 1 ? m.userData.baseDepthWrite : false
  }
}

export function VenueModel({ club, quality }: { club: string; quality: Quality }) {
  const base = `/models/${club}`
  const manifest = MANIFESTS[club]
  const names = useMemo(() => Object.keys(manifest.lightmaps), [manifest])
  const urls = useMemo(
    () =>
      names.map((n) =>
        versioned(`${base}/${manifest.lightmaps[n].file}`, manifest.lightmaps[n].hash),
      ),
    [base, manifest, names],
  )
  const glbUrl = versioned(`${base}/${club}.glb`, manifest.model?.hash)
  // start every download now: the GLB and the lightmaps load in parallel, not in a waterfall
  useGLTF.preload(glbUrl, false, true)
  useLoader.preload(THREE.TextureLoader, urls)
  const gltf = useGLTF(glbUrl, false, true)
  const textures = useLoader(THREE.TextureLoader, urls)

  const prepared = useMemo(() => {
    const byName: Record<string, THREE.Texture> = {}
    names.forEach((n, i) => {
      const tex = textures[i]
      tex.flipY = false
      tex.channel = 1
      tex.colorSpace = THREE.SRGBColorSpace
      tex.generateMipmaps = true
      tex.minFilter = THREE.LinearMipmapLinearFilter
      tex.anisotropy = 4
      tex.needsUpdate = true
      byName[n] = tex
    })
    return prepareVenue(gltf.scene, manifest, byName, quality)
  }, [gltf.scene, manifest, names, textures, quality])

  const setSceneReady = useExperience((s) => s.setSceneReady)
  useEffect(() => {
    // one frame later the textures are uploaded: reveal the scene
    if (process.env.NODE_ENV !== "production")
      (window as unknown as { __venue?: PreparedVenue }).__venue = prepared
    const id = requestAnimationFrame(() => setSceneReady())
    return () => cancelAnimationFrame(id)
  }, [prepared, setSceneReady])

  const upperOpacity = useRef(1)
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    for (const m of prepared.timed) m.uniforms.uTime.value = t
    const wanted = useExperience.getState().levelFilter === 0 ? 0.07 : 1
    const cur = upperOpacity.current
    if (cur !== wanted) {
      const next = THREE.MathUtils.damp(cur, wanted, 6, delta)
      upperOpacity.current = Math.abs(next - wanted) < 0.003 ? wanted : next
      applyUpperOpacity(prepared.upper, upperOpacity.current)
    }
  })

  return (
    <>
      <primitive object={prepared.root} dispose={null} />
      <GlobeGlow globes={prepared.globes} intensity={quality === "high" ? 1 : 0.85} />
    </>
  )
}
