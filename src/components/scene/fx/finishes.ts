import * as THREE from "three"

import {
  brushedNormal,
  leatherNormal,
  marbleMaps,
  normalFromAlbedo,
  roughnessFromAlbedo,
  velvetNormal,
} from "@/components/scene/fx/surfaces"

/*
 * Physically based finishes for the venue's Blender materials. Diffuse light comes from the
 * baked lightmaps (same intensity convention as MeshBasicMaterial); the environment map adds
 * what lightmaps cannot hold: view-dependent reflections, metal, lacquer and velvet sheen.
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

function finishRaw(input: FinishInput): THREE.Material | null {
  const { src, detail } = input
  const b = base(input)
  switch (src.name) {
    case "naho_tiles": {
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
    case "naho_concrete": {
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
    case "naho_wood": {
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
    case "naho_foliage": {
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
    case "naho_black_metal": {
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
    case "naho_gold": {
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
    case "naho_slat":
      return new THREE.MeshStandardMaterial({
        ...b,
        roughness: 0.32,
        metalness: 0.6,
        envMapIntensity: 1.2,
      })
    case "naho_stone": {
      const { map, roughnessMap } = marbleMaps()
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
    case "naho_leather": {
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
    case "naho_velvet_lounge":
    case "naho_velvet_vip":
    case "naho_velvet_prestige": {
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
    case "naho_glass":
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
    default:
      return null
  }
}

/** Returns an upgraded material, or null to keep the cheap unlit path. */
export function finishFor(input: FinishInput): THREE.Material | null {
  const m = finishRaw(input)
  if (m instanceof THREE.MeshStandardMaterial && !m.transparent) lightmapFirst(m)
  return m
}
