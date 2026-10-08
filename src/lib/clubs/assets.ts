import { z } from "zod"

/*
 * Manifest of a club's web bundle (`clubs/<slug>/public/lightmaps.json`), written by
 * `bake_export.py` and `pnpm assets:optimize`. Files are served from `/clubs/<slug>/`.
 */

const fileSchema = z.string().regex(/^[\w-]+(?:\/[\w-]+)*\.(?:glb|webp|png)$/, {
  error: "Expected a relative file path",
})
/** Content hash (assets:optimize): appended as `?v=` so a new bake is never served stale. */
const hashSchema = z.string().regex(/^[0-9a-f]{6,64}$/, { error: "Expected a hex content hash" })

export const assetManifestSchema = z.object({
  version: z.number().int().positive(),
  club: z.string().min(1),
  encoding: z.literal("srgb"),
  model: z.object({ file: fileSchema, hash: hashSchema }).optional(),
  /** Baked lighting per Blender object: texture file and HDR scale (value = texel * scale). */
  lightmaps: z.record(
    z.string().min(1),
    z.object({
      file: fileSchema,
      scale: z.number().positive(),
      size: z.number().int().positive(),
      hash: hashSchema.optional(),
    }),
  ),
})
export type AssetManifest = z.infer<typeof assetManifestSchema>

/** URL of a bundle file, versioned by its content hash when the manifest has one. */
export function assetUrl(club: string, file: string, hash?: string): string {
  const url = `/clubs/${club}/${file}`
  return hash ? `${url}?v=${hash}` : url
}

/** The venue model: named in the manifest, `<slug>.glb` by default. */
export function modelUrl(club: string, assets: AssetManifest): string {
  return assetUrl(club, assets.model?.file ?? `${club}.glb`, assets.model?.hash)
}
