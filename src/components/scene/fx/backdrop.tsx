"use client"

import { useMemo } from "react"
import * as THREE from "three"

/** Dark ground disc fading to the background, so the building doesn't float in the void. */
export function Backdrop({ center }: { center: [number, number, number] }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uInner: { value: new THREE.Color("#141019") },
          uOuter: { value: new THREE.Color("#060408") },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uInner;
          uniform vec3 uOuter;
          varying vec2 vUv;
          void main() {
            float d = length(vUv - 0.5) * 2.0;
            vec3 col = mix(uInner, uOuter, smoothstep(0.08, 0.9, d));
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }
        `,
        depthWrite: false,
      }),
    [],
  )
  return (
    <mesh
      position={[center[0], -0.06, center[2]]}
      rotation={[-Math.PI / 2, 0, 0]}
      material={material}
      renderOrder={-1}
    >
      <circleGeometry args={[160, 64]} />
    </mesh>
  )
}
