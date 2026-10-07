import * as THREE from "three"

import { SHOW_GLSL } from "@/components/scene/fx/show"

/**
 * Animated materials for the venue FX meshes exported from Blender.
 *
 * glTF flips V (v = 1 - v_blender), so per-instance data written by the build script in
 * the second UV set (exposed here as the `aData` attribute) is un-flipped in the shaders.
 * Outputs are HDR (> 1) so the bloom pass picks them up.
 */

const OUTPUT = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`

type Uniforms<T> = { [K in keyof T]: { value: T[K] } }
export type ShaderWith<T> = THREE.ShaderMaterial & { uniforms: Uniforms<T> }
export type TimedMaterial = ShaderWith<{ uTime: number }>
export type HaloMaterial = ShaderWith<{ uTime: number; uColor: THREE.Color; uStrength: number }>
export type ZoneMaterial = ShaderWith<{
  uTime: number
  uColor: THREE.Color
  uStrength: number
  uSize: THREE.Vector2
}>

/** LED tubes: meteors falling down each tube with a soft trail. */
export function createLedRainMaterial(): TimedMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color("#ff2f92") },
      uColorB: { value: new THREE.Color("#a33dff") },
      uIntensity: { value: 2.4 },
    },
    vertexShader: /* glsl */ `
      attribute vec2 aData;
      varying float vAlong;
      varying vec2 vData;
      void main() {
        vAlong = 1.0 - uv.y;                       // 0 at the top, 1 at the bottom
        vData = vec2(aData.x, 1.0 - aData.y);      // (phase, speed)
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform float uIntensity;
      varying float vAlong;
      varying vec2 vData;
      void main() {
        float head = fract(uTime * 0.26 * vData.y + vData.x);
        float behind = head - vAlong;
        float trail = behind >= 0.0 ? exp(-behind * 6.0) : 0.0;
        float spark = smoothstep(0.02, 0.0, abs(behind));
        float wave = 0.5 + 0.5 * sin(uTime * 0.55 + vData.x * 6.2831);
        vec3 col = mix(uColorA, uColorB, wave * 0.55);
        float glow = 0.2 + 1.3 * trail + 2.6 * spark;
        gl_FragColor = vec4(col * glow * uIntensity, 1.0);
        ${OUTPUT}
      }
    `,
  }) as TimedMaterial
}

/**
 * Hanging globes: opal shades lit from inside, coloured by the shared light show.
 * `aData.x` is each globe's phase. HDR output so the bloom wraps them in light.
 */
export function createSphereMaterial(): TimedMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 2.1 },
    },
    vertexShader: /* glsl */ `
      attribute vec2 aData;
      varying float vPhase;
      varying vec3 vNormalV;
      varying vec3 vView;
      varying vec3 vWorld;
      void main() {
        vPhase = aData.x;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vec4 mv = viewMatrix * world;
        vNormalV = normalize(normalMatrix * normal);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      ${SHOW_GLSL}
      uniform float uIntensity;
      varying float vPhase;
      varying vec3 vNormalV;
      varying vec3 vView;
      varying vec3 vWorld;
      void main() {
        // dissolve globes that brush past the camera (screen-door, no sorting needed)
        float near = smoothstep(1.4, 3.4, length(vView));
        float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        if (near < noise) discard;
        vec3 col = showColor(vPhase, vWorld);
        float facing = clamp(dot(normalize(vNormalV), normalize(vView)), 0.0, 1.0);
        // hot core seen through the shade, softer limb
        float core = 0.42 + 0.9 * pow(facing, 1.6);
        col = mix(col, vec3(dot(col, vec3(0.333))) + 0.3, 0.12 * pow(facing, 6.0));
        gl_FragColor = vec4(col * core * uIntensity, 1.0);
        ${OUTPUT}
      }
    `,
  }) as TimedMaterial
}

export type GlowMaterial = ShaderWith<{ uTime: number; uIntensity: number; uScale: number }>

/**
 * Soft halo around each globe: camera-facing quads (instanced), additive, depth-tested so the
 * globe itself hides the centre and only the glow around its silhouette remains.
 */
export function createSphereGlowMaterial(): GlowMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0.85 },
      uScale: { value: 3.4 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aCenter;
      attribute float aRadius;
      attribute float aPhase;
      uniform float uScale;
      varying vec2 vUv;
      varying float vPhase;
      varying vec3 vWorld;
      varying float vNear;
      void main() {
        vUv = uv;
        vPhase = aPhase;
        vWorld = aCenter;
        vec4 mv = viewMatrix * vec4(aCenter, 1.0);
        vNear = smoothstep(1.6, 4.0, -mv.z);
        mv.xy += position.xy * aRadius * uScale * 2.0;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      ${SHOW_GLSL}
      uniform float uIntensity;
      varying vec2 vUv;
      varying float vPhase;
      varying vec3 vWorld;
      varying float vNear;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float glow = exp(-d * d * 5.5) * (1.0 - smoothstep(0.82, 1.0, d));
        vec3 col = showColor(vPhase, vWorld);
        gl_FragColor = vec4(col * glow * uIntensity * vNear, 1.0);
        ${OUTPUT}
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }) as GlowMaterial
}

/** LED wall behind the DJ: equaliser bars over a warm gradient. */
export function createScreenMaterial(): TimedMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 1.25 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = vec2(uv.x, 1.0 - uv.y);              // 0 at the bottom, 1 at the top
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vUv;
      void main() {
        float bars = 56.0;
        float id = floor(vUv.x * bars);
        float h = 0.18 + 0.7 * abs(sin(uTime * 2.3 + id * 0.41) * sin(uTime * 1.27 + id * 0.13));
        float gap = step(0.18, fract(vUv.x * bars));
        float bar = step(vUv.y, h) * gap;
        vec3 low = vec3(1.0, 0.42, 0.08);
        vec3 high = vec3(1.0, 0.12, 0.5);
        vec3 grad = mix(low, high, vUv.y);
        float sweep = smoothstep(0.12, 0.0, abs(fract(uTime * 0.08) - vUv.x));
        vec3 bg = mix(vec3(0.22, 0.04, 0.1), vec3(0.35, 0.1, 0.02), vUv.x) * (0.35 + sweep * 0.8);
        vec3 col = bg + grad * bar * 1.5;
        gl_FragColor = vec4(col * uIntensity, 1.0);
        ${OUTPUT}
      }
    `,
  }) as TimedMaterial
}

/** Volumetric-looking beam (additive cone, bright at the lens, soft edges). */
export function createBeamMaterial(color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0.55 } },
    vertexShader: /* glsl */ `
      varying float vAlong;
      varying vec3 vNormalV;
      varying vec3 vView;
      void main() {
        vAlong = uv.y;                             // 1 at the lens, 0 at the far end
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormalV = normalize(normalMatrix * normal);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlong;
      varying vec3 vNormalV;
      varying vec3 vView;
      void main() {
        float edge = pow(abs(dot(normalize(vNormalV), normalize(vView))), 2.2);
        float fade = pow(vAlong, 2.0);
        gl_FragColor = vec4(uColor * edge * fade * uOpacity, 1.0);
        ${OUTPUT}
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
}

/** Pulsing floor halo under the hovered / selected table. */
export function createHaloMaterial(): HaloMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color("#ffffff") },
      uStrength: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uStrength;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        vec2 q = abs(p);
        float box = max(q.x, q.y);                 // rounded-square distance
        float ring = smoothstep(0.78, 0.9, box) * smoothstep(1.0, 0.9, box);
        float fill = smoothstep(1.0, 0.0, box) * 0.18;
        float pulse = 0.75 + 0.25 * sin(uTime * 3.0);
        gl_FragColor = vec4(uColor * (ring * 1.6 * pulse + fill) * uStrength, 1.0);
        ${OUTPUT}
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }) as HaloMaterial
}

/** Zone floor overlay: glowing border + faint fill. */
export function createZoneMaterial(color: THREE.ColorRepresentation): ZoneMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uStrength: { value: 0 },
      uSize: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uStrength;
      uniform vec2 uSize;
      varying vec2 vUv;
      void main() {
        vec2 d = min(vUv, 1.0 - vUv) * uSize;      // distance to the border, in metres
        float edgeDist = min(d.x, d.y);
        float border = smoothstep(0.18, 0.0, edgeDist);
        vec2 m = vUv * uSize;
        float dash = step(0.5, fract((m.x + m.y) * 0.8 - uTime * 0.6));
        float fill = 0.1;
        gl_FragColor = vec4(uColor * (border * (0.9 + 0.4 * dash) + fill) * uStrength, 1.0);
        ${OUTPUT}
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }) as ZoneMaterial
}
