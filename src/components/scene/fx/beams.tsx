"use client"

import { useFrame } from "@react-three/fiber"
import { useMemo, useRef } from "react"
import * as THREE from "three"

import { createBeamMaterial } from "@/components/scene/fx/materials"
import { toThree, type VenueLayout } from "@/lib/venue/layout"

const PALETTES = [
  ["#ffb347", "#ffd9a0"],
  ["#ff3d9a", "#ffffff"],
  ["#7a5cff", "#3fd0ff"],
  ["#ffffff", "#ff3d9a"],
]
const LENGTH = 9.5

/** Animated moving-head beams, fired from the fixtures modelled on the trusses. */
export function Beams({ layout, intensity = 1 }: { layout: VenueLayout; intensity?: number }) {
  const heads = useMemo(() => {
    const target = toThree([
      (layout.bar.x[0] + layout.bar.x[1]) / 2,
      (layout.bar.y[0] + layout.bar.y[1]) / 2,
      0,
    ])
    return layout.movingHeads.map(([x, y, z], i) => {
      const pos = toThree([x, y, z - 0.43])
      const dx = target[0] - pos[0]
      const dz = target[2] - pos[2]
      return { pos, yaw: Math.atan2(-dx, -dz), seed: i * 1.37 }
    })
  }, [layout])

  const geometry = useMemo(() => {
    const g = new THREE.ConeGeometry(Math.tan(0.09) * LENGTH, LENGTH, 20, 1, true)
    g.translate(0, -LENGTH / 2, 0) // apex at the lens, pointing down
    return g
  }, [])
  const materials = useMemo(() => heads.map(() => createBeamMaterial("#ffffff")), [heads])
  const groups = useRef<(THREE.Group | null)[]>([])
  const tmp = useMemo(() => new THREE.Color(), [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const palette = PALETTES[Math.floor(t / 9) % PALETTES.length]
    heads.forEach((h, i) => {
      const g = groups.current[i]
      if (!g) return
      const sweep = Math.sin(t * 0.42 + h.seed) * 0.85
      g.rotation.set(
        0.22 + 0.3 * (0.5 + 0.5 * Math.sin(t * 0.57 + h.seed * 2.1)),
        h.yaw + sweep,
        0,
        "YXZ",
      )
      const m = materials[i]
      tmp.set(palette[i % 2])
      m.uniforms.uColor.value.lerp(tmp, 0.04)
      m.uniforms.uOpacity.value = 0.42 * intensity * (0.75 + 0.25 * Math.sin(t * 2.2 + h.seed))
    })
  })

  return (
    <group>
      {heads.map((h, i) => (
        <group
          key={i}
          position={h.pos}
          ref={(el) => {
            groups.current[i] = el
          }}
        >
          <mesh
            geometry={geometry}
            material={materials[i]}
            renderOrder={10}
            frustumCulled={false}
          />
        </group>
      ))}
    </group>
  )
}
