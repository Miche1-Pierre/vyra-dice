import type { LightShow } from "@/lib/clubs/ambiance"

/*
 * The club's light show, compiled into the globes' shaders so they all change colour together:
 * four looks of 8 s each with 1.5 s crossfades —
 *   drift   colours wandering globe by globe
 *   wave    colour bands sweeping across the room
 *   unison  every globe on the same colour, pulsing on the beat
 *   sparkle dim warm light, random globes flashing white
 * The club's ambiance gives the tempo and the palette.
 */

const LOOK_SECONDS = 8

/** GLSL of the show: `uTime` uniform and `showColor(phase, worldPosition)`. */
export function showGlsl({ bpm, palette }: LightShow): string {
  const n = palette.length
  const colors = palette
    .map((c, i) => (i < n - 1 ? `if (i == ${i}) ` : "") + `return vec3(${c.join(", ")});`)
    .join("\n    ")
  return /* glsl */ `
  uniform float uTime;

  vec3 showPal(int i) {
    ${colors}
  }

  vec3 showPalette(float t) {
    float x = fract(t) * ${n.toFixed(1)};
    int i = int(floor(x));
    float f = smoothstep(0.0, 1.0, fract(x));
    return mix(showPal(i), showPal(i == ${n - 1} ? 0 : i + 1), f);
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
    float beat = t * ${bpm.toFixed(1)} / 60.0;
    float s = mod(t / ${LOOK_SECONDS.toFixed(1)}, 4.0);

    vec3 drift = showPalette(t * 0.035 + phase) * (0.85 + 0.15 * sin(t * 1.3 + phase * 6.2831));
    vec3 wave = showPalette(t * 0.12 + wpos.x * 0.045 - wpos.z * 0.02) * (0.9 + 0.3 * sin(t * 3.0 - wpos.x * 0.6));
    vec3 unison = showPalette(floor(beat / 4.0) * ${(1 / n).toFixed(4)} + 0.05) * (0.5 + 1.05 * exp(-fract(beat) * 5.0));
    float flash = step(0.86, showHash(floor(t * 3.0) * 17.0 + phase * 113.0));
    vec3 sparkle = mix(vec3(1.0, 0.8, 0.6) * 0.5, vec3(1.25), flash);

    return drift * showWindow(s, 0.0)
      + wave * showWindow(s, 1.0)
      + unison * showWindow(s, 2.0)
      + sparkle * showWindow(s, 3.0);
  }
`
}
