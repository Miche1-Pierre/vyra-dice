import * as THREE from "three"

/*
 * The club's light show, shared by the globes (GLSL) and the moving heads (JS) so everything
 * changes colour together: four looks of 8 s each with 1.5 s crossfades —
 *   drift   pastel colours wandering globe by globe
 *   wave    colour bands sweeping across the room
 *   unison  every globe on the same colour, pulsing on a 124 BPM beat
 *   sparkle dim warm light, random globes flashing white
 */

export const BPM = 124
const LOOK_SECONDS = 8

/** Naho palette: warm white, rose, lilac, sky, amber (linear-ish RGB, HDR-safe). */
export const PALETTE: [number, number, number][] = [
  [1.0, 0.84, 0.66],
  [1.0, 0.16, 0.56],
  [0.52, 0.22, 1.0],
  [0.16, 0.5, 1.0],
  [1.0, 0.46, 0.1],
]

export const SHOW_GLSL = /* glsl */ `
  uniform float uTime;

  vec3 showPal(int i) {
    if (i == 0) return vec3(${PALETTE[0].join(", ")});
    if (i == 1) return vec3(${PALETTE[1].join(", ")});
    if (i == 2) return vec3(${PALETTE[2].join(", ")});
    if (i == 3) return vec3(${PALETTE[3].join(", ")});
    return vec3(${PALETTE[4].join(", ")});
  }

  vec3 showPalette(float t) {
    float x = fract(t) * 5.0;
    int i = int(floor(x));
    float f = smoothstep(0.0, 1.0, fract(x));
    return mix(showPal(i), showPal(i == 4 ? 0 : i + 1), f);
  }

  float showHash(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
  }

  // weight of look k (0..3) at show position s (0..4), crossfading into the next look
  float showWindow(float s, float k) {
    float d = mod(s - k + 4.0, 4.0);
    float inside = (1.0 - step(1.0, d)) * (1.0 - smoothstep(0.81, 1.0, d));
    return max(inside, smoothstep(3.81, 4.0, d));
  }

  // HDR colour of one globe (phase 0..1, world position)
  vec3 showColor(float phase, vec3 wpos) {
    float t = uTime;
    float beat = t * ${BPM.toFixed(1)} / 60.0;
    float s = mod(t / ${LOOK_SECONDS.toFixed(1)}, 4.0);

    vec3 drift = showPalette(t * 0.035 + phase) * (0.85 + 0.15 * sin(t * 1.3 + phase * 6.2831));
    vec3 wave = showPalette(t * 0.12 + wpos.x * 0.045 - wpos.z * 0.02) * (0.9 + 0.3 * sin(t * 3.0 - wpos.x * 0.6));
    vec3 unison = showPalette(floor(beat / 4.0) * 0.2 + 0.05) * (0.5 + 1.05 * exp(-fract(beat) * 5.0));
    float flash = step(0.86, showHash(floor(t * 3.0) * 17.0 + phase * 113.0));
    vec3 sparkle = mix(vec3(1.0, 0.8, 0.6) * 0.5, vec3(1.25), flash);

    return drift * showWindow(s, 0.0)
      + wave * showWindow(s, 1.0)
      + unison * showWindow(s, 2.0)
      + sparkle * showWindow(s, 3.0);
  }
`

function palette(t: number, out: THREE.Color): THREE.Color {
  const x = (((t % 1) + 1) % 1) * 5
  const i = Math.floor(x)
  const f = x - i
  const k = f * f * (3 - 2 * f)
  const a = PALETTE[i]
  const b = PALETTE[(i + 1) % 5]
  return out.setRGB(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k)
}

/** Colour the whole room agrees on right now (the "unison" hue), for lights driven from JS. */
export function showKeyColor(t: number, out: THREE.Color): THREE.Color {
  const beat = (t * BPM) / 60
  return palette(Math.floor(beat / 4) * 0.2 + 0.05, out)
}

/** 0..1 pulse on each beat. */
export function showBeat(t: number): number {
  const beat = (t * BPM) / 60
  return Math.exp(-(beat % 1) * 5)
}
