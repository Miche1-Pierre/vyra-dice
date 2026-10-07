"use client"

import { useGLTF } from "@react-three/drei"
import { useFrame, useLoader } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"

import {
  createLedRainMaterial,
  createScreenMaterial,
  createSphereMaterial,
  type TimedMaterial,
} from "@/components/scene/fx/materials"
import { useExperience } from "@/lib/store"

export interface LightmapManifest {
  version: number
  club: string
  encoding: "srgb"
  lightmaps: Record<string, { file: string; scale: number; size: number }>
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
}

function ownerName(obj: THREE.Object3D, known: (name: string) => boolean): string | null {
  let cur: THREE.Object3D | null = obj
  while (cur) {
    if (known(cur.name)) return cur.name
    cur = cur.parent
  }
  return null
}

const FX_NAMES = new Set(["fx_ledrain", "fx_spheres", "fx_screen"])

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
): PreparedVenue {
  const timed: TimedMaterial[] = []
  const upper: THREE.Material[] = []
  const known = (n: string) =>
    n in manifest.lightmaps || FX_NAMES.has(n) || /^(lvl1_|fx_|glass|rig)/.test(n)

  scene.updateMatrixWorld(true)
  scene.traverse((obj) => {
    obj.matrixAutoUpdate = false
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const owner = ownerName(mesh, known) ?? mesh.name
    const src = mesh.material as THREE.MeshStandardMaterial
    let mat: THREE.Material

    if (owner === "fx_ledrain" || owner === "fx_spheres") {
      const data = mesh.geometry.getAttribute("uv1")
      if (data) mesh.geometry.setAttribute("aData", data)
      const m = owner === "fx_ledrain" ? createLedRainMaterial() : createSphereMaterial()
      timed.push(m)
      mat = m
    } else if (owner === "fx_screen") {
      const m = createScreenMaterial()
      timed.push(m)
      mat = m
    } else if (isEmissive(src)) {
      const color = src.emissive.clone().multiplyScalar(src.emissiveIntensity * EMISSION_SCALE)
      mat = new THREE.MeshBasicMaterial({ color, fog: false })
    } else if (src.transparent || src.opacity < 1) {
      mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color("#b9c9dd"),
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    } else {
      const lm = lightmaps[owner]
      const entry = manifest.lightmaps[owner]
      mat = new THREE.MeshBasicMaterial({
        color: src.color,
        map: src.map ?? null,
        lightMap: lm ?? null,
        lightMapIntensity: entry ? entry.scale * Math.PI * LIGHTMAP_EXPOSURE : 1,
        side: src.side,
      })
      if (!lm) (mat as THREE.MeshBasicMaterial).color.multiplyScalar(0.6)
    }
    mat.name = src.name
    mat.userData.baseOpacity = mat.opacity
    mat.userData.baseTransparent = mat.transparent
    mat.userData.baseDepthWrite = mat.depthWrite
    mesh.material = mat
    if (owner.startsWith("lvl1_")) upper.push(mat)
  })
  return { root: scene, timed, upper }
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

export function VenueModel({ club }: { club: string }) {
  const base = `/models/${club}`
  const gltf = useGLTF(`${base}/${club}.glb`, false, true)
  const manifestText = useLoader(THREE.FileLoader, `${base}/lightmaps.json`) as string
  const manifest = useMemo(() => JSON.parse(manifestText) as LightmapManifest, [manifestText])
  const names = useMemo(() => Object.keys(manifest.lightmaps), [manifest])
  const textures = useLoader(
    THREE.TextureLoader,
    names.map((n) => `${base}/${manifest.lightmaps[n].file}`),
  )

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
    return prepareVenue(gltf.scene, manifest, byName)
  }, [gltf.scene, manifest, names, textures])

  const setSceneReady = useExperience((s) => s.setSceneReady)
  useEffect(() => {
    // one frame later the textures are uploaded: reveal the scene
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

  return <primitive object={prepared.root} dispose={null} />
}

export function preloadVenue(club: string) {
  useGLTF.preload(`/models/${club}/${club}.glb`, false, true)
}
