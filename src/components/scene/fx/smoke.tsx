"use client"

import { useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"

import { toThree, type VenueLayout } from "@/lib/venue/layout"

/*
 * Night mode haze: soft puffs of smoke drifting over the floor (camera-facing quads, procedural
 * noise, one draw call), and a denser fog. They are grey: the night grade gives them its colour.
 */

const vertexShader = /* glsl */ `
  attribute vec4 aPuff; // centre (xyz) and size
  attribute vec2 aSeed; // phase, spin
  uniform float uTime;
  varying vec2 vUv;
  varying float vSeed;

  void main() {
    vUv = uv;
    vSeed = aSeed.x;
    float ph = aSeed.x * 6.2832;
    // slow sway and breathing
    vec3 centre = aPuff.xyz + vec3(
      sin(uTime * 0.07 + ph) * 0.9,
      sin(uTime * 0.05 + ph * 0.5) * 0.35,
      cos(uTime * 0.06 + ph * 0.75) * 0.9
    );
    float a = aSeed.y * uTime * 0.05 + ph;
    vec2 corner = position.xy * aPuff.w;
    corner = vec2(corner.x * cos(a) - corner.y * sin(a), corner.x * sin(a) + corner.y * cos(a));
    // the quad faces the camera
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    gl_Position = projectionMatrix * viewMatrix * vec4(centre + right * corner.x + up * corner.y, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vSeed;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float falloff = smoothstep(1.0, 0.15, r);
    float n = fbm(vUv * 3.0 + vec2(vSeed * 10.0, uTime * 0.03));
    float a = falloff * smoothstep(0.35, 0.85, n) * uOpacity;
    if (a < 0.003) discard;
    // bright enough to survive the night grade: the haze glows in the night colour
    gl_FragColor = vec4(vec3(1.5), a);
  }
`

/** Seeded pseudo-random numbers: the same smoke on every load. */
function random(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const NIGHT_FOG = 0.017
/** Opacity of the puffs at their thickest. */
const SMOKE = 0.42

export function Smoke({ layout, on, count }: { layout: VenueLayout; on: boolean; count: number }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
      }),
    [],
  )
  const geometry = useMemo(() => {
    const quad = new THREE.PlaneGeometry(1, 1)
    const g = new THREE.InstancedBufferGeometry()
    g.index = quad.index
    g.setAttribute("position", quad.getAttribute("position"))
    g.setAttribute("uv", quad.getAttribute("uv"))
    const rand = random(809)
    const b = layout.building
    const puff = new Float32Array(count * 4)
    const seed = new Float32Array(count * 2)
    for (let i = 0; i < count; i++) {
      // over the room, away from the walls
      const x = b.minX + (b.maxX - b.minX) * (0.15 + 0.7 * rand())
      const y = b.minY + (b.maxY - b.minY) * (0.15 + 0.7 * rand())
      const [tx, ty, tz] = toThree([x, y, 0.6 + rand() * 3.9])
      puff.set([tx, ty, tz, 3 + rand() * 4.5], i * 4)
      seed.set([rand(), rand() * 2 - 1], i * 2)
    }
    g.setAttribute("aPuff", new THREE.InstancedBufferAttribute(puff, 4))
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 2))
    g.instanceCount = count
    return g
  }, [layout, count])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  const mesh = useRef<THREE.Mesh>(null)
  const baseFog = useRef<number | null>(null)
  useFrame((state, delta) => {
    const u = material.uniforms
    u.uTime.value = state.clock.elapsedTime
    const wanted = on ? SMOKE : 0
    if (u.uOpacity.value !== wanted) {
      const next = THREE.MathUtils.damp(u.uOpacity.value, wanted, 2.4, delta)
      u.uOpacity.value = Math.abs(next - wanted) < 0.002 ? wanted : next
    }
    if (mesh.current) mesh.current.visible = u.uOpacity.value > 0.003
    // the fog thickens with the smoke
    const fog = state.scene.fog as THREE.FogExp2 | null
    if (fog && "density" in fog) {
      baseFog.current ??= fog.density
      fog.density = THREE.MathUtils.lerp(baseFog.current, NIGHT_FOG, u.uOpacity.value / SMOKE)
    }
  })

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={8}
      raycast={() => null}
    />
  )
}
