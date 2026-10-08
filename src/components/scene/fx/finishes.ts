import * as THREE from "three"

import type { FinishPreset, FinishSpec } from "@/lib/clubs/ambiance"
import {
  brushedNormal,
  leatherNormal,
  marbleMaps,
  normalFromAlbedo,
  roughnessFromAlbedo,
  velvetNormal,
} from "@/components/scene/fx/surfaces"

/*
 * Physically based finishes for the venue's Blender materials, chosen per material by the
 * club's ambiance (`finishes`). Diffuse light comes from the baked lightmaps (same intensity
 * convention as MeshBasicMaterial); the environment map adds what lightmaps cannot hold:
 * view-dependent reflections, metal, lacquer and velvet sheen.
 */

export interface FinishInput {
  src: THREE.MeshStandardMaterial
  lightMap: THREE.Texture | null
  lightMapIntensity: number
  /** Normal maps and clearcoat only on capable devices. */
  detail: boolean
}

function repeat(tex: THREE.Texture, r: number): THREE.Texture {
  const t = tex.clone()
  t.repeat.set(r, r)
  t.needsUpdate = true
  return t
}

const tint = (hex: string) => new THREE.Color(hex)

const ENV_DIFFUSE_LINE = "vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;"
const PHYSICAL_PARS = THREE.ShaderChunk.lights_physical_pars_fragment.replace(
  ENV_DIFFUSE_LINE,
  "vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance * ENV_DIFFUSE;",
)

/**
 * The lightmaps already hold the diffuse light: keep only a trace of the environment's diffuse
 * term (it would tint every surface with the light panels) and all of its reflections and sheen.
 */
function lightmapFirst<T extends THREE.MeshStandardMaterial>(m: T, envDiffuse = 0.1): T {
  if (!PHYSICAL_PARS.includes("ENV_DIFFUSE")) return m
  m.defines = { ...m.defines, ENV_DIFFUSE: envDiffuse.toFixed(3) }
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <lights_physical_pars_fragment>",
      PHYSICAL_PARS,
    )
  }
  m.customProgramCacheKey = () => `lightmap-first-${envDiffuse}`
  return m
}

function base(input: FinishInput) {
  const { src, lightMap, lightMapIntensity } = input
  return {
    color: src.color.clone(),
    map: src.map ?? null,
    lightMap,
    lightMapIntensity,
    side: src.side,
  }
}

function presetMaterial(preset: FinishPreset, input: FinishInput): THREE.Material {
  const { src, detail } = input
  const b = base(input)
  switch (preset) {
    case "glazed-tiles": {
      const m = new THREE.MeshStandardMaterial({
        ...b,
        roughness: 1,
        metalness: 0,
        envMapIntensity: 1.1,
      })
      if (src.map) {
        m.roughnessMap = roughnessFromAlbedo(src.map, 0.14, 0.62)
        if (detail) {
          m.normalMap = normalFromAlbedo(src.map, 1.1)
          m.normalScale.set(0.6, 0.6)
        }
      }
      return m
    }
    case "concrete": {
      const m = new THREE.MeshStandardMaterial({
        ...b,
        roughness: 0.86,
        metalness: 0,
        envMapIntensity: 0.35,
      })
      if (detail && src.map) {
        m.normalMap = normalFromAlbedo(src.map, 2.2)
        m.normalScale.set(0.9, 0.9)
      }
      return m
    }
    case "lacquered-wood": {
      const m = new THREE.MeshStandardMaterial({
        ...b,
        roughness: 0.4,
        metalness: 0,
        envMapIntensity: 0.75,
      })
      if (detail && src.map) {
        m.normalMap = normalFromAlbedo(src.map, 1.4)
        m.normalScale.set(0.7, 0.7)
      }
      return m
    }
    case "foliage": {
      const m = new THREE.MeshStandardMaterial({
        ...b,
        roughness: 0.58,
        metalness: 0,
        envMapIntensity: 0.55,
      })
      if (detail && src.map) {
        m.normalMap = normalFromAlbedo(src.map, 3.2)
        m.normalScale.set(1.4, 1.4)
      }
      return m
    }
    case "brushed-metal": {
      const m = new THREE.MeshStandardMaterial({
        ...b,
        roughness: 0.3,
        metalness: 0.85,
        envMapIntensity: 1.3,
      })
      if (detail) {
        m.normalMap = repeat(brushedNormal(), 2)
        m.normalScale.set(0.25, 0.25)
      }
      return m
    }
    case "brushed-gold": {
      const m = new THREE.MeshStandardMaterial({
        ...b,
        color: tint("#e0b45e"),
        roughness: 0.2,
        metalness: 1,
        envMapIntensity: 1.9,
      })
      if (detail) {
        m.normalMap = repeat(brushedNormal(), 3)
        m.normalScale.set(0.2, 0.2)
      }
      return m
    }
    case "satin-metal":
      return new THREE.MeshStandardMaterial({
        ...b,
        roughness: 0.32,
        metalness: 0.6,
        envMapIntensity: 1.2,
      })
    case "marble": {
      // phones: half resolution, the veins are generated on the main thread while loading
      const { map, roughnessMap } = marbleMaps(detail ? 512 : 256)
      return new THREE.MeshPhysicalMaterial({
        ...b,
        color: tint("#ffffff"),
        map: repeat(map, 0.9),
        roughnessMap: repeat(roughnessMap, 0.9),
        roughness: 1,
        metalness: 0,
        clearcoat: detail ? 0.9 : 0,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.4,
      })
    }
    case "leather": {
      const m = new THREE.MeshPhysicalMaterial({
        ...b,
        roughness: 0.46,
        metalness: 0,
        clearcoat: detail ? 0.3 : 0,
        clearcoatRoughness: 0.35,
        envMapIntensity: 0.9,
      })
      if (detail) {
        m.normalMap = repeat(leatherNormal(), 6)
        m.normalScale.set(0.55, 0.55)
      }
      return m
    }
    case "velvet": {
      // same hue, brighter: velvet catches light along its edges without turning pale
      const sheenColor = src.color.clone().multiplyScalar(2.2)
      const m = new THREE.MeshPhysicalMaterial({
        ...b,
        // deep pile: the baked pinspots read brighter on velvet than on the Cycles preview
        color: src.color.clone().multiplyScalar(0.78),
        roughness: 0.82,
        metalness: 0,
        sheen: 0.55,
        sheenColor,
        sheenRoughness: 0.5,
        envMapIntensity: 0.9,
      })
      if (detail) {
        m.normalMap = repeat(velvetNormal(), 7)
        m.normalScale.set(0.45, 0.45)
      }
      return m
    }
    case "glass":
      return new THREE.MeshPhysicalMaterial({
        color: tint("#c9d8ea"),
        transparent: true,
        opacity: 0.13,
        roughness: 0.04,
        metalness: 0,
        envMapIntensity: 2.4,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
  }
}

/** Metals keep their finish (environment reflections) even on objects without a lightmap. */
export function isMetal(preset: FinishPreset): boolean {
  return preset === "brushed-metal" || preset === "brushed-gold" || preset === "satin-metal"
}

/** The club's finish for a material: its preset, then the club's adjustments. */
export function finishFor(input: FinishInput, spec: FinishSpec): THREE.Material {
  const m = presetMaterial(spec.preset, input)
  if (m instanceof THREE.MeshStandardMaterial) {
    if (spec.tint) m.color.set(spec.tint)
    if (spec.roughness !== undefined) m.roughness = spec.roughness
    if (spec.metalness !== undefined) m.metalness = spec.metalness
    if (spec.envMapIntensity !== undefined) m.envMapIntensity = spec.envMapIntensity
    if (!m.transparent) lightmapFirst(m)
  }
  return m
}
