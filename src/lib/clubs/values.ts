import { z } from "zod"

/** sRGB colour, `#rrggbb` (CSS, three.js `Color`). */
export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, { error: "Expected a #rrggbb colour" })

/** Linear HDR colour `[r, g, b]` for shaders: values above 1 bloom. */
export const hdrColorSchema = z.tuple([
  z.number().min(0).max(8),
  z.number().min(0).max(8),
  z.number().min(0).max(8),
])
export type HdrColor = z.infer<typeof hdrColorSchema>

export const vec3Schema = z.tuple([z.number(), z.number(), z.number()])
