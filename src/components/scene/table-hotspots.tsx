"use client"

import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { useMemo } from "react"
import * as THREE from "three"

import { createHaloMaterial } from "@/components/scene/fx/materials"
import type { ClubBrand } from "@/lib/clubs/brand"
import { useExperience } from "@/lib/store"
import {
  levelHeight,
  tableFootprint,
  tableLevel,
  toThree,
  type VenueLayout,
} from "@/lib/venue/layout"

const hitMaterial = new THREE.MeshBasicMaterial({ visible: false })

/** Invisible pick boxes over each booth + a pulsing halo for hover / selection / comparison. */
export function TableHotspots({
  layout,
  tiers,
}: {
  layout: VenueLayout
  tiers: ClubBrand["tiers"]
}) {
  const tables = useMemo(
    () =>
      layout.tables.map((t) => {
        const level = tableLevel(layout, t)
        const floor = levelHeight(layout, level)
        const { width, depth } = tableFootprint(layout, t)
        const zone = layout.zones.find((z) => z.id === t.zone)
        const halo = createHaloMaterial()
        halo.uniforms.uColor.value.set(tiers[zone?.tier ?? t.kind].color)
        return {
          table: t,
          level,
          position: toThree([t.x, t.y, floor]),
          rotation: (t.facing * Math.PI) / 180,
          width,
          depth,
          halo,
        }
      }),
    [layout, tiers],
  )

  const hoverTable = useExperience((s) => s.hoverTable)
  const selectTable = useExperience((s) => s.selectTable)

  useFrame((state, delta) => {
    const s = useExperience.getState()
    const t = state.clock.elapsedTime
    for (const item of tables) {
      const id = item.table.id
      let target = 0
      if (s.view !== "intro" && s.view !== "seat") {
        if (s.selectedTableId === id) target = 1
        else if (s.hoveredTableId === id) target = 0.75
        else if (s.compareIds.includes(id)) target = 0.5
      }
      const u = item.halo.uniforms
      u.uTime.value = t
      u.uStrength.value = THREE.MathUtils.damp(u.uStrength.value, target, 8, delta)
      item.halo.visible = u.uStrength.value > 0.004 // skip the draw call when invisible
    }
  })

  const onOver = (id: string, level: 0 | 1) => (e: ThreeEvent<PointerEvent>) => {
    const { view, levelFilter } = useExperience.getState()
    if (view === "intro" || view === "seat") return
    if (levelFilter !== "all" && levelFilter !== level) return
    e.stopPropagation()
    hoverTable(id)
    document.body.style.cursor = "pointer"
  }
  const onOut = () => {
    hoverTable(null)
    document.body.style.cursor = ""
  }
  const onClick = (id: string, level: 0 | 1) => (e: ThreeEvent<MouseEvent>) => {
    const { view, levelFilter } = useExperience.getState()
    if (view === "intro" || view === "seat" || e.delta > 6) return
    if (levelFilter !== "all" && levelFilter !== level) return
    e.stopPropagation()
    selectTable(id)
  }

  return (
    <group>
      {tables.map(({ table, level, position, rotation, width, depth, halo }) => (
        <group key={table.id} position={position} rotation={[0, rotation, 0]}>
          <mesh
            position={[0, 0.6, 0]}
            material={hitMaterial}
            onPointerOver={onOver(table.id, level)}
            onPointerOut={onOut}
            onClick={onClick(table.id, level)}
          >
            <boxGeometry args={[depth, 1.2, width]} />
          </mesh>
          <mesh
            position={[0, 0.045, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            material={halo}
            renderOrder={6}
            raycast={() => null}
          >
            <planeGeometry args={[depth + 0.7, width + 0.7]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
