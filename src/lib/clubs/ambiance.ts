import { z } from "zod"

import { hdrColorSchema, hexColorSchema, vec3Schema } from "@/lib/clubs/values"

/*
 * The 3D mood of a club (`clubs/<slug>/ambiance.json`): its light show, its FX colours, the light
 * panels its reflections are rendered from, and the finish of each of its Blender materials.
 */

/**
 * Physically based finishes the viewer knows how to render (src/components/scene/fx/finishes.ts).
 * Diffuse light always comes from the bake; a finish adds reflections, relief, sheen or clearcoat.
 */
export const finishPresetSchema = z.enum([
  "glazed-tiles",
  "concrete",
  "lacquered-wood",
  "foliage",
  "brushed-metal",
  "brushed-gold",
  "satin-metal",
  "marble",
  "leather",
  "velvet",
  "glass",
])
export type FinishPreset = z.infer<typeof finishPresetSchema>

const unit = z.number().min(0).max(1)

/** A preset, optionally tuned: `"velvet"` or `{ "preset": "brushed-metal", "roughness": 0.4 }`. */
export const finishSchema = z.union([
  finishPresetSchema,
  z.object({
    preset: finishPresetSchema,
    /** Replaces the Blender base colour. */
    tint: hexColorSchema.optional(),
    roughness: unit.optional(),
    metalness: unit.optional(),
    /** Strength of the environment reflections. */
    envMapIntensity: z.number().min(0).max(4).optional(),
  }),
])
export type Finish = z.infer<typeof finishSchema>
export type FinishSpec = Exclude<Finish, FinishPreset>

const lightformerSchema = z.object({
  /** What the panel stands for (documentation only). */
  label: z.string().optional(),
  form: z.enum(["rect", "ring", "circle"]),
  color: hexColorSchema,
  intensity: z.number().min(0),
  /** Centre of the panel, in three.js space (metres, y up). */
  position: vec3Schema,
  /** Point the panel faces, in three.js space (default: the origin of the venue). */
  target: vec3Schema.optional(),
  /** Size of the panel: one number, or `[width, height, 1]` for rectangles. */
  scale: z.union([z.number().positive(), vec3Schema]),
})
export type LightformerSpec = z.infer<typeof lightformerSchema>

export const lightShowSchema = z.object({
  bpm: z.number().min(60).max(200),
  /** Colours the globes travel through, in order. */
  palette: z.array(hdrColorSchema).min(2).max(8),
})
export type LightShow = z.infer<typeof lightShowSchema>

export const ambianceSchema = z.object({
  /** Shared by every globe (`fx_spheres`): four looks cycling on the beat. */
  show: lightShowSchema,
  /** Moving-head beams: one pair of colours at a time, alternating between the heads. */
  beams: z.object({ palettes: z.array(z.tuple([hexColorSchema, hexColorSchema])).min(1) }),
  /** LED tubes (`fx_ledrain`): meteors blending two colours. */
  ledRain: z
    .object({
      colors: z.tuple([hexColorSchema, hexColorSchema]),
      intensity: z.number().min(0).max(8),
    })
    .optional(),
  /** LED wall (`fx_screen`): equaliser bars from `low` to `high` over a dim backdrop. */
  screen: z
    .object({
      low: hdrColorSchema,
      high: hdrColorSchema,
      backdrop: z.tuple([hdrColorSchema, hdrColorSchema]),
    })
    .optional(),
  /** Reflection environment: light panels where the club's own sources are. */
  environment: z.object({
    background: hexColorSchema,
    lightformers: z.array(lightformerSchema).min(1),
  }),
  /** Finish of each Blender material, by material name. Others keep the plain baked look. */
  finishes: z.record(z.string().min(1), finishSchema),
  /**
   * Opening of the visit: `flight` (default) flies the authored keyframes; `neon` draws the club
   * in glowing lines from the overview, then builds it up from the floor.
   */
  intro: z.enum(["flight", "neon"]).default("flight"),
})
export type ClubAmbiance = z.infer<typeof ambianceSchema>

/** The finish of a material, normalised to an object; `null` when the club lists none. */
export function finishOf(finishes: ClubAmbiance["finishes"], material: string): FinishSpec | null {
  if (!Object.hasOwn(finishes, material)) return null
  const finish = finishes[material]
  return typeof finish === "string" ? { preset: finish } : finish
}
