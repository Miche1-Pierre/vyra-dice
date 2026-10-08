"use client"

import { useGLTF } from "@react-three/drei"
import { useFrame, useLoader } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"

import type { Quality } from "@/components/scene/effects"
import { finishFor, isMetal } from "@/components/scene/fx/finishes"
import { extractGlobes, GlobeGlow, type Globe } from "@/components/scene/fx/globes"
import {
  createLedRainMaterial,
  createScreenMaterial,
  createSphereMaterial,
  GLOBE_FOCUS,
  type TimedMaterial,
} from "@/components/scene/fx/materials"
import { finishOf, type ClubAmbiance } from "@/lib/clubs/ambiance"
import { assetUrl, modelUrl, type AssetManifest } from "@/lib/clubs/assets"
import { useExperience } from "@/lib/store"

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
  /** Wall-mounted signs, hidden when the cutaway shows the back of their wall. */
  wallSigns: WallSign[]
}

interface WallSign {
  object: THREE.Object3D
  anchor: THREE.Vector3
  /** Direction the sign faces (three.js space). */
  normal: THREE.Vector3
}

/** `fx_sign_wall_<n|s|e|w>`: the suffix is the direction the sign faces (Blender compass). */
const WALL_SIGN = /^fx_sign_wall_([nsew])$/
const FACING: Record<string, [number, number, number]> = {
  n: [0, 0, -1],
  s: [0, 0, 1],
  e: [1, 0, 0],
  w: [-1, 0, 0],
}

const FX_NAMES = new Set(["fx_ledrain", "fx_spheres", "fx_screen"])

/** For an FX the ambiance leaves out (the club tests require it whenever the model has one). */
const NEUTRAL_LED_RAIN: NonNullable<ClubAmbiance["ledRain"]> = {
  colors: ["#ffffff", "#dfe4ff"],
  intensity: 2,
}
const NEUTRAL_SCREEN: NonNullable<ClubAmbiance["screen"]> = {
  low: [1, 1, 1],
  high: [0.8, 0.85, 1],
  backdrop: [
    [0.08, 0.08, 0.1],
    [0.1, 0.1, 0.12],
  ],
}

/**
 * Blender node owning a mesh. glTF splits a multi-material node into a group named after the
 * node with one child per material (`lvl1_furniture` → `lvl1_furniture_1`, …): the node name
 * is what owns the lightmap and the FX role.
 */
function nodeName(mesh: THREE.Object3D, manifest: AssetManifest): string {
  let cur: THREE.Object3D | null = mesh
  while (cur) {
    if (Object.hasOwn(manifest.lightmaps, cur.name) || FX_NAMES.has(cur.name)) return cur.name
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
  manifest: AssetManifest,
  ambiance: ClubAmbiance,
  lightmaps: Record<string, THREE.Texture>,
  quality: Quality,
): PreparedVenue {
  const timed: TimedMaterial[] = []
  const upper: THREE.Material[] = []
  const sphereMeshes: THREE.Mesh[] = []
  const wallSigns: WallSign[] = []
  const detail = quality === "high"

  scene.updateMatrixWorld(true)
  scene.traverse((obj) => {
    obj.matrixAutoUpdate = false
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const owner = nodeName(mesh, manifest)
    // StrictMode prepares the same scene twice: always start again from the glTF material
    const src = (mesh.userData.source ??= mesh.material) as THREE.MeshStandardMaterial
    const finish = finishOf(ambiance.finishes, src.name)
    let mat: THREE.Material

    if (owner === "fx_ledrain" || owner === "fx_spheres") {
      const data = mesh.geometry.getAttribute("uv1")
      if (data) mesh.geometry.setAttribute("aData", data)
      const m =
        owner === "fx_ledrain"
          ? createLedRainMaterial(ambiance.ledRain ?? NEUTRAL_LED_RAIN)
          : createSphereMaterial(ambiance.show)
      if (owner === "fx_spheres") sphereMeshes.push(mesh)
      timed.push(m)
      mat = m
    } else if (owner === "fx_screen") {
      const m = createScreenMaterial(ambiance.screen ?? NEUTRAL_SCREEN)
      timed.push(m)
      mat = m
    } else if (isEmissive(src)) {
      const color = src.emissive.clone().multiplyScalar(src.emissiveIntensity * EMISSION_SCALE)
      mat = new THREE.MeshBasicMaterial({ color, fog: false })
    } else if (finish?.preset === "glass") {
      mat = finishFor({ src, lightMap: null, lightMapIntensity: 1, detail }, finish)
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
      // metals keep their reflections even where nothing was baked
      if (finish && (lm || isMetal(finish.preset))) {
        mat = finishFor({ src, lightMap: lm, lightMapIntensity, detail }, finish)
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
    const facing = WALL_SIGN.exec(owner)?.[1]
    if (facing) {
      const anchor = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3())
      wallSigns.push({ object: mesh, anchor, normal: new THREE.Vector3(...FACING[facing]) })
    }
  })
  return { root: scene, timed, upper, globes: extractGlobes(sphereMeshes), wallSigns }
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

/**
 * The club's baked venue. The manifest comes with the page, so the lightmaps are requested
 * together with the GLB instead of after it.
 */
export function VenueModel({
  club,
  assets: manifest,
  ambiance,
  quality,
}: {
  club: string
  assets: AssetManifest
  ambiance: ClubAmbiance
  quality: Quality
}) {
  const names = useMemo(() => Object.keys(manifest.lightmaps), [manifest])
  const urls = useMemo(
    () => names.map((n) => assetUrl(club, manifest.lightmaps[n].file, manifest.lightmaps[n].hash)),
    [club, manifest, names],
  )
  const glbUrl = modelUrl(club, manifest)
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
    return prepareVenue(gltf.scene, manifest, ambiance, byName, quality)
  }, [gltf.scene, manifest, ambiance, names, textures, quality])

  const setSceneReady = useExperience((s) => s.setSceneReady)
  useEffect(() => {
    // one frame later the textures are uploaded: reveal the scene
    if (process.env.NODE_ENV !== "production")
      (window as unknown as { __venue?: PreparedVenue }).__venue = prepared
    const id = requestAnimationFrame(() => setSceneReady())
    return () => cancelAnimationFrame(id)
  }, [prepared, setSceneReady])

  const upperOpacity = useRef(1)
  const toCamera = useMemo(() => new THREE.Vector3(), [])
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    // globes between the camera and the zone / table being looked at dissolve
    const { view } = useExperience.getState()
    const controls = state.controls as { getTarget?: (out: THREE.Vector3) => THREE.Vector3 } | null
    controls?.getTarget?.(GLOBE_FOCUS.uFocus.value)
    GLOBE_FOCUS.uOcclude.value = view === "zone" || view === "table" ? 1 : 0
    for (const sign of prepared.wallSigns) {
      sign.object.visible =
        toCamera.subVectors(state.camera.position, sign.anchor).dot(sign.normal) > 0
    }
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
      <GlobeGlow
        globes={prepared.globes}
        show={ambiance.show}
        intensity={quality === "high" ? 1 : 0.85}
      />
    </>
  )
}
