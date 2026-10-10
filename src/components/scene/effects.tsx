"use client"

import { useFrame } from "@react-three/fiber"
import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing"
import { ToneMappingMode, type BloomEffect } from "postprocessing"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"

import { NightGradeEffect } from "@/components/scene/fx/night-grade"
import { pulse } from "@/lib/music"

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
    // the night's music: the lights and their halos beat with the bass
    const beat = night ? pulse.beat : 0
    grade.pulse = night ? beat * 0.6 + pulse.level * 0.25 : 0
    if (bloom.current) bloom.current.intensity = bloomIntensity * (1 + beat * 0.9)
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
