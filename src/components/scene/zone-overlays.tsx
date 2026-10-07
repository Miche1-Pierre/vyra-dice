"use client"

import { useFrame } from "@react-three/fiber"
import { useMemo } from "react"
import * as THREE from "three"

import { createZoneMaterial } from "@/components/scene/fx/materials"
import { useExperience } from "@/lib/store"
import { levelHeight, toThree, type VenueLayout } from "@/lib/venue/layout"
import { TIERS } from "@/lib/venue/tiers"

/** Tier-coloured floor overlays: faint on the overview (reads like the club sketch), bright on focus. */
export function ZoneOverlays({ layout }: { layout: VenueLayout }) {
  const zones = useMemo(
    () =>
      layout.zones.map((z) => {
        const w = z.x[1] - z.x[0]
        const d = z.y[1] - z.y[0]
        const center = toThree([
          (z.x[0] + z.x[1]) / 2,
          (z.y[0] + z.y[1]) / 2,
          levelHeight(layout, z.level) + 0.035,
        ])
        const material = createZoneMaterial(TIERS[z.tier].color)
        material.uniforms.uSize.value.set(w, d)
        return { zone: z, w, d, center, material }
      }),
    [layout],
  )

  useFrame((state, delta) => {
    const s = useExperience.getState()
    const t = state.clock.elapsedTime
    for (const { zone, material } of zones) {
      let target = 0
      const levelHidden = s.levelFilter !== "all" && s.levelFilter !== zone.level
      if (s.view === "overview") target = levelHidden ? 0 : 0.55
      else if (s.view === "zone") target = s.focusedZoneId === zone.id ? 1 : levelHidden ? 0 : 0.14
      else if (s.view === "table") {
        const table = layout.tables.find((tb) => tb.id === s.selectedTableId)
        target = table?.zone === zone.id ? 0.35 : 0
      }
      material.uniforms.uTime.value = t
      material.uniforms.uStrength.value = THREE.MathUtils.damp(
        material.uniforms.uStrength.value,
        target,
        5,
        delta,
      )
      material.visible = material.uniforms.uStrength.value > 0.004
    }
  })

  return (
    <group>
      {zones.map(({ zone, w, d, center, material }) => (
        <mesh
          key={zone.id}
          position={center}
          rotation={[-Math.PI / 2, 0, 0]}
          material={material}
          renderOrder={5}
          raycast={() => null}
        >
          <planeGeometry args={[w, d]} />
        </mesh>
      ))}
    </group>
  )
}
