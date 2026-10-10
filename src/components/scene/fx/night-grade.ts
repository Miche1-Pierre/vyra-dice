import { BlendFunction, Effect } from "postprocessing"
import * as THREE from "three"

/*
 * Night mode grade, after the bloom: the room falls dark, the light sources keep their glow,
 * and everything takes the club's night colour. `uAmount` fades it in and out.
 */
const fragmentShader = /* glsl */ `
  uniform float uAmount;
  uniform vec3 uTint;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 c = inputColor.rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    // a toe sinks the lit room into the dark (still readable); LEDs, beams and their bloom stay bright
    float k = l * l / (l + 0.2) * 2.2;
    outputColor = vec4(mix(c, uTint * k, uAmount), inputColor.a);
  }
`

export class NightGradeEffect extends Effect {
  constructor() {
    super("NightGradeEffect", fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ["uAmount", new THREE.Uniform(0)],
        ["uTint", new THREE.Uniform(new THREE.Vector3(1, 0.05, 0.07))],
      ]),
    })
  }

  /** The night colour (`#rrggbb`), as the grade's tint. */
  setColor(hex: string) {
    const c = new THREE.Color(hex)
    const max = Math.max(c.r, c.g, c.b, 1e-4)
    // full strength in its brightest channel, with a little white so that a pure red still reads
    const tint = this.uniforms.get("uTint")!.value as THREE.Vector3
    tint
      .set(c.r / max, c.g / max, c.b / max)
      .multiplyScalar(0.9)
      .addScalar(0.1)
  }

  get amount(): number {
    return this.uniforms.get("uAmount")!.value as number
  }

  set amount(value: number) {
    this.uniforms.get("uAmount")!.value = value
  }
}
