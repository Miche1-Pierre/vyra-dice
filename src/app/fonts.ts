import { Jost } from "next/font/google"

import type { FontKey } from "@/lib/clubs/brand"

/*
 * Typefaces a club can pick in its brand.json (`font`). Each one is exposed as `--font-<key>`;
 * the venue page points `--club-font` at the club's. Add a font here and to `fontKeySchema`.
 */

/** Geometric, airy, Futura-like, legible down to 11 px: VYRA's default. */
const jost = Jost({ variable: "--font-jost", subsets: ["latin"], display: "swap" })

export const fonts: Record<FontKey, { variable: string }> = { jost }
