import * as THREE from "three"

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

/** Hanging globes: slow breathing, colour per slot (white / pink / blue). */
export function createSphereMaterial(): TimedMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWhite: { value: new THREE.Color("#fff1e2") },
      uPink: { value: new THREE.Color("#ff74bd") },
      uBlue: { value: new THREE.Color("#6fb4ff") },
      uIntensity: { value: 1.7 },
    },
    vertexShader: /* glsl */ `
      attribute vec2 aData;
      varying vec2 vData;
      varying vec3 vNormalV;
      varying vec3 vView;
      void main() {
        vData = vec2(aData.x, 1.0 - aData.y);      // (phase, slot / 2)
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormalV = normalize(normalMatrix * normal);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uWhite;
      uniform vec3 uPink;
      uniform vec3 uBlue;
      uniform float uIntensity;
      varying vec2 vData;
      varying vec3 vNormalV;
      varying vec3 vView;
      void main() {
        float slot = floor(vData.y * 2.0 + 0.5);
        vec3 col = slot < 0.5 ? uWhite : (slot < 1.5 ? uPink : uBlue);
        float facing = clamp(dot(normalize(vNormalV), normalize(vView)), 0.0, 1.0);
        float breathe = 0.78 + 0.22 * sin(uTime * 1.1 + vData.x * 6.2831);
        gl_FragColor = vec4(col * (0.45 + 0.9 * facing) * breathe * uIntensity, 1.0);
        ${OUTPUT}
      }
    `,
  }) as TimedMaterial
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
