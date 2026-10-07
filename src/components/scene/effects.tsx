"use client"

import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing"
import { ToneMappingMode } from "postprocessing"

export type Quality = "low" | "high"

/** HDR bloom on the LEDs, AgX tone mapping, soft vignette. Cheaper chain on phones. */
export function Effects({ quality }: { quality: Quality }) {
  const high = quality === "high"
  const chain = [
    <Bloom
      key="bloom"
      mipmapBlur
      intensity={high ? 1.15 : 0.95}
      luminanceThreshold={0.82}
      luminanceSmoothing={0.28}
      radius={0.78}
      resolutionScale={high ? 1 : 0.5}
    />,
    <ToneMapping key="tone" mode={ToneMappingMode.AGX} />,
    <Vignette key="vignette" offset={0.28} darkness={0.6} />,
  ]
  // MSAA on desktop, SMAA (cheaper) on phones
  if (!high) chain.push(<SMAA key="smaa" />)
  return (
    <EffectComposer multisampling={high ? 4 : 0} enableNormalPass={false}>
      {chain}
    </EffectComposer>
  )
}
