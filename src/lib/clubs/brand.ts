import { z } from "zod"

import { tierSchema } from "@/lib/schema"
import { hexColorSchema } from "@/lib/clubs/values"

/*
 * Identity of a club in the interface (`clubs/<slug>/brand.json`): its accent colour, the hues of
 * its tiers, its typeface, its drawn wordmark and emblem. The venue page turns the colours and
 * the typeface into CSS custom properties (`brandCss`); the UI only reads those.
 */

/** Typefaces the app ships (src/app/fonts.ts loads each one as `--font-<key>`). */
export const fontKeySchema = z.enum(["jost"])
export type FontKey = z.infer<typeof fontKeySchema>

/** SVG path data only: commands and numbers. */
const pathSchema = z
  .string()
  .regex(/^[MmLlHhVvCcSsQqTtAaZz\d\s.,+-]+$/, { error: "Expected SVG path data" })
const viewBoxSchema = z.tuple([z.number().positive(), z.number().positive()])

export const brandSchema = z.object({
  /** Accent: primary action, prices, highlights, focus rings. */
  accent: z.object({
    /** French name of the colour, for copy such as « le meilleur est en or ». */
    name: z.string().min(1).max(24),
    color: hexColorSchema,
    /** Darker accent: far end of gradients. */
    deep: hexColorSchema,
    /** Text and icons laid on the accent. */
    on: hexColorSchema,
    /** Top and bottom of the primary button's gradient (the accent sits in the middle). */
    pill: z.tuple([hexColorSchema, hexColorSchema]),
    /** Metallic foil (light, mid, dark) of prices, the wordmark and the emblem. */
    foil: z.tuple([hexColorSchema, hexColorSchema, hexColorSchema]),
  }),
  /** Hue of each tier: dots, zone tiles, floor overlays, table halos. */
  tiers: z.record(tierSchema, z.object({ color: hexColorSchema, deep: hexColorSchema })),
  font: fontKeySchema,
  /** The club's name drawn with round-capped strokes; spaced capitals when absent. */
  wordmark: z
    .object({
      viewBox: viewBoxSchema,
      strokeWidth: z.number().positive(),
      strokes: z.array(pathSchema).min(1),
    })
    .optional(),
  /** Spaced small capitals under the wordmark on the loading screen (« C L U B »). */
  tagline: z.string().min(1).max(24).optional(),
  /**
   * Emblem of the dock tile, the top bar and the loading screen. Filled shapes rise into place,
   * stroked ones (`stroke` = width) draw themselves one after the other.
   */
  emblem: z
    .object({
      viewBox: viewBoxSchema,
      shapes: z.array(z.object({ d: pathSchema, stroke: z.number().positive().optional() })).min(1),
    })
    .optional(),
})
export type ClubBrand = z.infer<typeof brandSchema>

/**
 * CSS custom properties of a brand, for `:root`. Every value went through `brandSchema`
 * (hex colours, known font keys), so the rule is safe to inline in the page.
 */
export function brandCss(brand: ClubBrand): string {
  const { accent, tiers } = brand
  const vars: [string, string][] = [
    ["--brand", accent.color],
    ["--brand-deep", accent.deep],
    ["--brand-on", accent.on],
    ["--brand-hi", accent.pill[0]],
    ["--brand-lo", accent.pill[1]],
    ["--foil-hi", accent.foil[0]],
    ["--foil", accent.foil[1]],
    ["--foil-lo", accent.foil[2]],
    ["--club-font", `var(--font-${brand.font})`],
    ...tierSchema.options.flatMap((tier): [string, string][] => [
      [`--${tier}`, tiers[tier].color],
      [`--${tier}-deep`, tiers[tier].deep],
    ]),
  ]
  return `:root{${vars.map(([name, value]) => `${name}:${value}`).join(";")}}`
}
