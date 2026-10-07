"use client"

import { useEffect, useMemo } from "react"
import * as THREE from "three"
import { Reflector } from "three/examples/jsm/objects/Reflector.js"

import { toThree, type VenueLayout } from "@/lib/venue/layout"

/** Additive glossy reflection: soft multi-tap blur, stronger at grazing angles (Fresnel). */
const GLOSS_SHADER = {
  name: "FloorGloss",
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uStrength: { value: 0.6 },
    uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 1024) },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    uniform vec2 uTexel;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      vec2 uv = vUv.xy / vUv.w;
      vec3 c = texture2D(tDiffuse, uv).rgb * 0.28;
      for (int i = 0; i < 6; i++) {
        float a = float(i) * 1.0472;
        c += texture2D(tDiffuse, uv + vec2(cos(a), sin(a)) * uTexel * 3.5).rgb * 0.12;
      }
      vec3 view = normalize(cameraPosition - vWorld);
      float fresnel = 0.28 + 0.72 * pow(1.0 - max(view.y, 0.0), 3.0);
      gl_FragColor = vec4(c * uStrength * fresnel, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
}

/**
 * Polished ground floor: a planar reflection of the club (LED rain, globes, beams) laid
 * additively over the lightmapped tiles. Desktop only — it renders the scene a second time.
 */
export function FloorGloss({
  layout,
  strength = 0.6,
  resolution = 1024,
}: {
  layout: VenueLayout
  strength?: number
  resolution?: number
}) {
  const reflector = useMemo(() => {
    const gf = layout.groundFloor
    const geometry = new THREE.PlaneGeometry(gf.x[1] - gf.x[0], gf.y[1] - gf.y[0])
    const r = new Reflector(geometry, {
      textureWidth: resolution,
      textureHeight: resolution,
      clipBias: 0.004,
      shader: GLOSS_SHADER,
    })
    const m = r.material as THREE.ShaderMaterial
    m.transparent = true
    m.depthWrite = false
    m.blending = THREE.AdditiveBlending
    m.uniforms.uStrength.value = strength
    m.uniforms.uTexel.value.set(1 / resolution, 1 / resolution)
    const [cx, , cz] = toThree([(gf.x[0] + gf.x[1]) / 2, (gf.y[0] + gf.y[1]) / 2, 0])
    r.position.set(cx, 0.008, cz)
    r.rotation.x = -Math.PI / 2
    r.renderOrder = 1
    return r
  }, [layout, strength, resolution])

  useEffect(() => () => reflector.dispose(), [reflector])

  return <primitive object={reflector} />
}
