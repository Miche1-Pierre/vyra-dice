"use client"

import { useFrame } from "@react-three/fiber"
import { useMemo } from "react"
import * as THREE from "three"

import { createZoneMaterial } from "@/components/scene/fx/materials"
import type { ClubBrand } from "@/lib/clubs/brand"
import { useExperience } from "@/lib/store"
import { toThree, zoneFloor, zoneParts, type VenueLayout } from "@/lib/venue/layout"

/** Tier-coloured floor overlays: faint on the overview (reads like the club sketch), bright on focus. */
export function ZoneOverlays({
  layout,
  tiers,
}: {
  layout: VenueLayout
  tiers: ClubBrand["tiers"]
}) {
  const zones = useMemo(
    () =>
      layout.zones.map((z) => {
        const floor = zoneFloor(layout, z) + 0.035
        // on the mezzanine, only where the zone has a slab under it: nothing floats over the void
        const parts = zoneParts(layout, z).map((r) => {
          const w = r.x[1] - r.x[0]
          const d = r.y[1] - r.y[0]
          const center = toThree([(r.x[0] + r.x[1]) / 2, (r.y[0] + r.y[1]) / 2, floor])
          const material = createZoneMaterial(tiers[z.tier].color)
          material.uniforms.uSize.value.set(w, d)
          return { w, d, center, material }
        })
        return { zone: z, parts }
      }),
    [layout, tiers],
  )

  useFrame((state, delta) => {
    const s = useExperience.getState()
    const t = state.clock.elapsedTime
    for (const { zone, parts } of zones) {
      let target = 0
      const levelHidden = s.levelFilter !== "all" && s.levelFilter !== zone.level
      if (s.view === "overview") target = levelHidden ? 0 : 0.55
      else if (s.view === "zone") target = s.focusedZoneId === zone.id ? 1 : levelHidden ? 0 : 0.14
      else if (s.view === "table") {
        const table = layout.tables.find((tb) => tb.id === s.selectedTableId)
        target = table?.zone === zone.id ? 0.35 : 0
      }
      for (const { material } of parts) {
        material.uniforms.uTime.value = t
        material.uniforms.uStrength.value = THREE.MathUtils.damp(
          material.uniforms.uStrength.value,
          target,
          5,
          delta,
        )
        material.visible = material.uniforms.uStrength.value > 0.004
      }
    }
  })

  return (
    <group>
      {zones.flatMap(({ zone, parts }) =>
        parts.map(({ w, d, center, material }, i) => (
          <mesh
            key={`${zone.id}-${i}`}
            position={center}
            rotation={[-Math.PI / 2, 0, 0]}
            material={material}
            renderOrder={5}
            raycast={() => null}
          >
            <planeGeometry args={[w, d]} />
          </mesh>
        )),
      )}
    </group>
  )
}
