"use client"

import { Environment, Lightformer } from "@react-three/drei"

/**
 * Reflection environment rendered once from light panels placed like the club's own sources:
 * the pink LED rain overhead, violet and blue washes on the walls, the amber bar, white spots.
 * It only feeds reflections and sheen; diffuse lighting stays in the baked lightmaps.
 */
export function ClubEnvironment({ intensity = 1 }: { intensity?: number }) {
  return (
    <Environment resolution={256} frames={1} environmentIntensity={intensity}>
      <color attach="background" args={["#040306"]} />
      {/* LED rain above the bar */}
      <Lightformer
        form="rect"
        color="#ff3d9a"
        intensity={3.2}
        position={[2, 9, -3]}
        rotation-x={Math.PI / 2}
        scale={[9, 12, 1]}
      />
      {/* wall washes */}
      <Lightformer
        form="rect"
        color="#8a46ff"
        intensity={1.4}
        position={[-14, 4, 0]}
        rotation-y={Math.PI / 2}
        scale={[26, 5, 1]}
      />
      <Lightformer
        form="rect"
        color="#3f7dff"
        intensity={1.1}
        position={[20, 4, 2]}
        rotation-y={-Math.PI / 2}
        scale={[26, 5, 1]}
      />
      {/* warm bar and back bar */}
      <Lightformer
        form="rect"
        color="#ffae58"
        intensity={2.2}
        position={[1.5, 2.5, 14]}
        scale={[10, 2.5, 1]}
      />
      <Lightformer form="ring" color="#ffc27a" intensity={2.6} position={[-6, 6, -16]} scale={3} />
      {/* white spot strips from the trusses */}
      <Lightformer
        form="rect"
        color="#fff4e6"
        intensity={2.4}
        position={[0, 10, 8]}
        rotation-x={Math.PI / 2}
        scale={[16, 0.5, 1]}
      />
      <Lightformer
        form="rect"
        color="#fff4e6"
        intensity={2.4}
        position={[0, 10, -8]}
        rotation-x={Math.PI / 2}
        scale={[16, 0.5, 1]}
      />
      {/* dim floor bounce so metals never go fully black from above */}
      <Lightformer
        form="rect"
        color="#2a1830"
        intensity={0.6}
        position={[0, -6, 0]}
        rotation-x={-Math.PI / 2}
        scale={[40, 40, 1]}
      />
    </Environment>
  )
}
