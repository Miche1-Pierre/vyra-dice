"use client"

import { useGLTF } from "@react-three/drei"
import { useFrame, useLoader, useThree } from "@react-three/fiber"
import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js"

import type { Quality } from "@/components/scene/effects"
import { finishFor, isMetal } from "@/components/scene/fx/finishes"
import { extractGlobes, GlobeGlow, type Globe } from "@/components/scene/fx/globes"
import type { NeonEdges } from "@/components/scene/fx/neon-edges"
import { NeonIntro, neonRequest, requestNeonEdges } from "@/components/scene/fx/neon-intro"
import {
  createLedRainMaterial,
  createScreenMaterial,
  createSphereMaterial,
  GLOBE_FOCUS,
  type TimedMaterial,
} from "@/components/scene/fx/materials"
import { surfacesReady } from "@/components/scene/fx/surfaces"
import { finishOf, type ClubAmbiance } from "@/lib/clubs/ambiance"
import { assetUrl, modelUrl, type AssetManifest } from "@/lib/clubs/assets"
import { useExperience } from "@/lib/store"

// the geometry decodes in two workers: the loading screen keeps its pace while the GLB arrives
// (meshoptimizer's API, not a React hook)
const decodeInWorkers = MeshoptDecoder.useWorkers
if (typeof window !== "undefined") decodeInWorkers(2)
const withMeshopt = (loader: { setMeshoptDecoder: (decoder: unknown) => unknown }) =>
  loader.setMeshoptDecoder(MeshoptDecoder)

/**
 * Lightmaps decode off the main thread when the browser can (ImageBitmap), as plain images
 * otherwise. glTF UVs are not flipped: the bitmaps are not either.
 */
class LightmapLoader extends THREE.ImageBitmapLoader {
  constructor(manager?: THREE.LoadingManager) {
    super(manager)
    this.setOptions({ imageOrientation: "from-image", premultiplyAlpha: "none" })
  }
}
const LIGHTMAP_LOADER =
  typeof createImageBitmap === "function" ? LightmapLoader : THREE.TextureLoader

/** Every texture with pixels that the scene's materials use (maps, lightmaps, uniforms). */
function sceneTextures(scene: THREE.Object3D): THREE.Texture[] {
  const found = new Set<THREE.Texture>()
  const add = (value: unknown) => {
    const tex = value as THREE.Texture | null | undefined
    if (tex?.isTexture && tex.image && !tex.isRenderTargetTexture) found.add(tex)
  }
  scene.traverse((obj) => {
    const material = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
    if (!material) return
    for (const m of Array.isArray(material) ? material : [material]) {
      Object.values(m).forEach(add)
      const uniforms = (m as THREE.ShaderMaterial).uniforms
      if (uniforms) Object.values(uniforms).forEach((u) => add(u?.value))
    }
  })
  return [...found]
}

const texels = (tex: THREE.Texture) => {
  const image = tex.image as { width?: number; height?: number }
  return (image.width ?? 0) * (image.height ?? 0)
}

/**
 * Compiles, in parallel (KHR_parallel_shader_compile), the shader variants the next frames draw
 * with. Composited, the scene is drawn into a render target, whose variants are not the
 * canvas' (linear output); under the neon intro's clipping plane, the variants without it are
 * compiled as well, so that the end of the intro recompiles nothing.
 */
async function compileVariants(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  composited: boolean,
) {
  const target = composited ? new THREE.WebGLRenderTarget(1, 1) : null
  const previous = gl.getRenderTarget()
  const planes = gl.clippingPlanes
  const runs: Promise<unknown>[] = []
  gl.setRenderTarget(target)
  runs.push(gl.compileAsync(scene, camera))
  if (planes.length) {
    gl.clippingPlanes = []
    runs.push(gl.compileAsync(scene, camera))
    gl.clippingPlanes = planes
  }
  gl.setRenderTarget(previous)
  await Promise.all(runs).catch(() => undefined)
  target?.dispose()
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
  composited = true,
  neon,
}: {
  club: string
  assets: AssetManifest
  ambiance: ClubAmbiance
  quality: Quality
  /** Drawn through the effect composer (into its render target), not straight to the canvas. */
  composited?: boolean
  /** Colour of the neon intro, when the club opens with it. */
  neon?: string
}) {
  const names = useMemo(() => Object.keys(manifest.lightmaps), [manifest])
  const urls = useMemo(
    () => names.map((n) => assetUrl(club, manifest.lightmaps[n].file, manifest.lightmaps[n].hash)),
    [club, manifest, names],
  )
  const glbUrl = modelUrl(club, manifest)
  // start every download now: the GLB and the lightmaps load in parallel, not in a waterfall
  useGLTF.preload(glbUrl, false, false, withMeshopt)
  useLoader.preload(LIGHTMAP_LOADER, urls)
  const gltf = useGLTF(glbUrl, false, false, withMeshopt)
  const images = useLoader(LIGHTMAP_LOADER, urls) as (THREE.Texture | ImageBitmap)[]

  const prepared = useMemo(() => {
    const byName: Record<string, THREE.Texture> = {}
    names.forEach((n, i) => {
      const image = images[i]
      const tex = image instanceof THREE.Texture ? image : new THREE.Texture(image)
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
  }, [gltf.scene, manifest, ambiance, names, images, quality])

  // before the club is shown: its procedural surfaces generated (worker), the scene's textures
  // sent to the GPU a few per frame, then the shaders it will draw with compiled in parallel. No
  // long frame freezes the loading screen, and the first frames of the club compile nothing.
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const [uploaded, setUploaded] = useState<PreparedVenue | null>(null)
  useEffect(() => {
    let cancelled = false
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))
    void (async () => {
      await surfacesReady()
      for (const tex of sceneTextures(scene)) {
        if (cancelled) return
        gl.initTexture(tex)
        if (texels(tex) > 256 * 256) await nextFrame()
      }
      if (cancelled) return
      await compileVariants(gl, scene, camera, composited)
      if (!cancelled) setUploaded(prepared)
    })()
    return () => {
      cancelled = true
    }
  }, [gl, camera, scene, prepared, composited])
  const shown = uploaded === prepared

  // the neon intro's lines, computed in a worker while the loading screen is still up
  const [edges, setEdges] = useState<{ venue: PreparedVenue; edges: NeonEdges } | null>(null)
  useEffect(() => {
    if (!neon) return
    return requestNeonEdges(neonRequest(prepared.root), (e) =>
      setEdges({ venue: prepared, edges: e }),
    )
  }, [neon, prepared])
  const height = useMemo(() => new THREE.Box3().setFromObject(prepared.root).max.y, [prepared])

  const opening = useExperience((s) => Boolean(neon) && s.view === "intro")
  const setSceneReady = useExperience((s) => s.setSceneReady)
  useEffect(() => {
    if (!shown) return
    // everything is on the GPU: one frame of the club, then reveal it
    if (process.env.NODE_ENV !== "production")
      (window as unknown as { __venue?: PreparedVenue }).__venue = prepared
    const id = requestAnimationFrame(() => setSceneReady())
    return () => cancelAnimationFrame(id)
  }, [shown, prepared, setSceneReady])

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
    // the neon intro draws the club in the dark: its animated FX wait until it is built
    const hidden = Boolean(neon) && view === "intro"
    for (const m of prepared.timed) {
      m.uniforms.uTime.value = t
      m.visible = !hidden
    }
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
      <primitive object={prepared.root} visible={shown} dispose={null} />
      {/* hidden, not unmounted, under the neon intro: its shaders compile with the club's */}
      <group visible={!opening}>
        <GlobeGlow
          globes={prepared.globes}
          show={ambiance.show}
          intensity={quality === "high" ? 1 : 0.85}
        />
      </group>
      {neon ? (
        <NeonIntro
          edges={edges?.venue === prepared ? edges.edges : null}
          color={neon}
          height={height}
        />
      ) : null}
    </>
  )
}
