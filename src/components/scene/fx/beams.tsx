"use client"

import { useFrame } from "@react-three/fiber"
import { useMemo, useRef } from "react"
import * as THREE from "three"

import { createBeamMaterial } from "@/components/scene/fx/materials"
import type { ClubAmbiance } from "@/lib/clubs/ambiance"
import { pulse, show } from "@/lib/music"
import { toThree, type VenueLayout } from "@/lib/venue/layout"

const LENGTH = 9.5
/** Seconds each colour pair of the club stays on. */
const PALETTE_SECONDS = 9

/** Animated moving-head beams, fired from the fixtures modelled on the trusses. */
export function Beams({
  layout,
  palettes,
  intensity = 1,
}: {
  layout: VenueLayout
  palettes: ClubAmbiance["beams"]["palettes"]
  intensity?: number
}) {
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
  const white = useMemo(() => new THREE.Color("#ffffff"), [])
  // phases of the sweeps (radians): on the scene's clock (frozen in captures), sped up by the
  // bass; on the beats when the music's map drives the show; never jumping from one to the other
  const pan = useRef(0)
  const tilt = useRef(0)
  const drive = useRef(0)
  const offset = useRef({ pan: 0, tilt: 0 })
  const lastBeat = useRef<number | null>(null)
  /** Sweeps per bar, eased from one section to the next. */
  const pace = useRef(0.5)
  /** 0–1: the heads move in mirrored pairs (the show), or each on its own. */
  const mirror = useRef(0)

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const dt = Math.min(delta, 0.1)
    if (show.on) {
      const beats = lastBeat.current === null ? 0 : show.beat - lastBeat.current
      lastBeat.current = show.beat
      // a sweep every two bars in the groove, slower in a break, every bar after a drop, and
      // faster and faster as the next one nears
      const wanted = (show.energy < 0.4 ? 0.25 : 0.5) * (1 + show.drop) * (1 + 2 * show.build)
      pace.current = THREE.MathUtils.damp(pace.current, wanted, 3, dt)
      const turn = beats > 0 && beats < 2 ? (beats / 4) * pace.current * 2 * Math.PI : 0
      pan.current += turn
      tilt.current += turn * 0.5
    } else {
      if (lastBeat.current !== null) {
        // back on the clock, from where the show left the heads
        offset.current = {
          pan: pan.current - 0.42 * (t + drive.current),
          tilt: tilt.current - 0.57 * (t + drive.current),
        }
        lastBeat.current = null
      }
      drive.current += dt * pulse.level * 2.5
      pan.current = 0.42 * (t + drive.current) + offset.current.pan
      tilt.current = 0.57 * (t + drive.current) + offset.current.tilt
    }
    mirror.current = THREE.MathUtils.damp(mirror.current, show.on ? 1 : 0, 2, dt)
    const phrase = show.on ? show.phrase : Math.floor(t / PALETTE_SECONDS)
    const palette = palettes[((phrase % palettes.length) + palettes.length) % palettes.length]
    // the beams close in on the floor before a drop, open wide when the music is full
    const spread = show.on ? (0.55 + 0.45 * show.energy) * (1 - 0.65 * show.build) : 1
    heads.forEach((h, i) => {
      const g = groups.current[i]
      if (!g) return
      const side = THREE.MathUtils.lerp(1, i % 2 ? -1 : 1, mirror.current)
      const sweep = Math.sin(pan.current + h.seed * (1 - 0.6 * mirror.current)) * 0.85 * spread
      g.rotation.set(
        0.22 +
          0.3 * (0.5 + 0.5 * Math.sin(tilt.current + h.seed * 2.1)) -
          (show.on ? 0.06 * show.kick : 0), // a nod on each beat
        h.yaw + sweep * side,
        0,
        "YXZ",
      )
      const m = materials[i]
      // the colours change with the phrases, at once, and turn white on a drop
      tmp.set(palette[i % 2]).lerp(white, show.flash)
      m.uniforms.uColor.value.lerp(tmp, 1 - Math.exp(-dt * (show.on ? 14 : 2.4)))
      m.uniforms.uOpacity.value =
        0.42 *
        intensity *
        (show.on
          ? (0.4 + 0.6 * show.energy) *
            (1 + 1.3 * show.kick + 0.6 * show.drop) *
            (1 - show.blackout)
          : (0.75 + 0.25 * Math.sin(t * 2.2 + h.seed)) * (1 + 1.3 * pulse.beat))
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
