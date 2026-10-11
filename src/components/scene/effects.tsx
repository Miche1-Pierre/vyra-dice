"use client"

import { useFrame } from "@react-three/fiber"
import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing"
import { ToneMappingMode, type BloomEffect } from "postprocessing"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"

import { NightGradeEffect } from "@/components/scene/fx/night-grade"
import { pulse, show } from "@/lib/music"

export type Quality = "low" | "high"

/**
 * HDR bloom on the LEDs, the night grade when the club offers it, AgX tone mapping, soft
 * vignette. Cheaper chain on phones; `lite` (a struggling device in night mode) keeps only the
 * grade and the tone mapping.
 */
export function Effects({
  quality,
  night = null,
  lite = false,
}: {
  quality: Quality
  /** Night colour while the night mode is on; the grade fades out when it goes back to null. */
  night?: string | null
  lite?: boolean
}) {
  const high = quality === "high"
  const grade = useMemo(() => new NightGradeEffect(), [])
  useEffect(() => {
    if (night) grade.setColor(night)
  }, [grade, night])
  useEffect(() => () => grade.dispose(), [grade])
  const bloom = useRef<BloomEffect>(null)
  const bloomIntensity = high ? 1.15 : 0.95
  useFrame((_, delta) => {
    // the night's music, read ahead: the lights hit on its beats, a break dims the room, they
    // swell before a drop, go dark just before it and flash white on it
    const beat = night ? pulse.beat : 0
    if (night && show.on) {
      // one hit per beat at most: well under three flashes a second
      const lift =
        show.kick * (0.4 + 0.5 * show.energy) +
        0.5 * show.build +
        0.35 * show.drop -
        0.3 * (1 - show.energy)
      grade.pulse = lift * (1 - show.blackout) - 0.92 * show.blackout
      grade.flash = 0.55 * show.flash
    } else {
      // heard live, without a map: the lights beat with the bass
      grade.pulse = night ? beat * 0.6 + pulse.level * 0.25 : 0
      grade.flash = 0
    }
    const hit = night && show.on ? 0.6 * show.drop + 0.8 * show.flash : 0
    if (bloom.current) bloom.current.intensity = bloomIntensity * (1 + beat * 0.9 + hit)
    const wanted = night ? 1 : 0
    if (grade.amount === wanted) return
    const next = THREE.MathUtils.damp(grade.amount, wanted, 2.6, delta)
    grade.amount = Math.abs(next - wanted) < 0.002 ? wanted : next
  })

  const chain = []
  if (!lite) {
    chain.push(
      <Bloom
        key="bloom"
        ref={bloom}
        mipmapBlur
        intensity={bloomIntensity}
        luminanceThreshold={0.82}
        luminanceSmoothing={0.28}
        radius={0.78}
        resolutionScale={high ? 1 : 0.5}
      />,
    )
  }
  // after the bloom: its halos take the night colour too
  chain.push(<primitive key="night" object={grade} />)
  chain.push(
    <ToneMapping key="tone" mode={ToneMappingMode.AGX} />,
    <Vignette key="vignette" offset={0.28} darkness={0.6} />,
  )
  // MSAA on desktop, SMAA (cheaper) on phones
  if (!high && !lite) chain.push(<SMAA key="smaa" />)
  return (
    <EffectComposer multisampling={high && !lite ? 4 : 0} enableNormalPass={false}>
      {chain}
    </EffectComposer>
  )
}
