"use client"

import { Environment, Lightformer } from "@react-three/drei"

import type { ClubAmbiance } from "@/lib/clubs/ambiance"

/**
 * Reflection environment rendered once from light panels placed like the club's own sources
 * (its ambiance: LED walls, washes, bar, spots), each facing its target. It only feeds
 * reflections and sheen; diffuse lighting stays in the baked lightmaps.
 */
export function ClubEnvironment({
  environment,
  intensity = 1,
}: {
  environment: ClubAmbiance["environment"]
  intensity?: number
}) {
  return (
    <Environment resolution={256} frames={1} environmentIntensity={intensity}>
      <color attach="background" args={[environment.background]} />
      {environment.lightformers.map((panel, i) => (
        <Lightformer
          key={i}
          form={panel.form}
          color={panel.color}
          intensity={panel.intensity}
          position={panel.position}
          target={panel.target}
          scale={panel.scale}
        />
      ))}
    </Environment>
  )
}
