import { z } from "zod"

import layoutJson from "@clubs/naho/layout.json"

/*
 * Venue geometry of each club (`clubs/<club>/layout.json`), read by its Blender build.
 *
 * Units are metres, in Blender axes: x = east, y = north, z = up. Use `toThree` to convert a point
 * to three.js / glTF space. A range such as `x: [min, max]` is an axis-aligned extent.
 */

export const tableKindSchema = z.enum(["lounge", "vip", "prestige"])
/** Furniture kind of a table, and tier of a zone. */
export type TableKind = z.infer<typeof tableKindSchema>

export const levelSchema = z.literal([0, 1])
/** 0 = ground floor, 1 = mezzanine. */
export type Level = z.infer<typeof levelSchema>

const vec2Schema = z.tuple([z.number(), z.number()])
const vec3Schema = z.tuple([z.number(), z.number(), z.number()])
const rangeSchema = z
  .tuple([z.number(), z.number()])
  .refine(([min, max]) => min <= max, { error: "Expected a [min, max] range" })
const rectSchema = z.object({ x: rangeSchema, y: rangeSchema })
const namedRectSchema = rectSchema.extend({ id: z.string().min(1) })
const levelPointSchema = z.object({ x: z.number(), y: z.number(), level: levelSchema })
const cameraPoseSchema = z.object({ position: vec3Schema, target: vec3Schema })
const length = z.number().positive()

export const layoutZoneSchema = z.object({
  id: z.string().min(1),
  tier: tableKindSchema,
  level: levelSchema,
  x: rangeSchema,
  y: rangeSchema,
})

export const layoutTableSchema = z.object({
  id: z.string().min(1),
  /** Id of the layout zone the table belongs to. */
  zone: z.string().min(1),
  kind: tableKindSchema,
  /** Centre of the table, in metres. */
  x: z.number(),
  y: z.number(),
  /** Direction the seated guests look at, in degrees: 0 = east, 90 = north. */
  facing: z.number(),
})

export const venueLayoutSchema = z
  .object({
    club: z.string().min(1),
    version: z.number().int().positive(),
    heights: z.object({
      /** Floor of the mezzanine (level 1) above the ground floor. */
      mezzanine: length,
      slab: length,
      ceiling: length,
      railing: length,
      stage: length,
    }),
    building: z.object({
      minX: z.number(),
      maxX: z.number(),
      minY: z.number(),
      maxY: z.number(),
      wall: length,
    }),
    groundFloor: rectSchema,
    /** Booth footprint per table kind: `width` along the seat, `depth` front to back. */
    furniture: z.record(
      tableKindSchema,
      z.object({ width: length, depth: length, seatDepth: length }),
    ),
    movingHeads: z.array(vec3Schema),
    /** Double-height areas (no slab above the ground floor). */
    void: z.array(namedRectSchema),
    /** Mezzanine slabs (level 1). */
    mezzanine: z.array(namedRectSchema),
    railings: z.array(z.object({ from: vec2Schema, to: vec2Schema })),
    columns: z.array(vec2Schema),
    stairs: z.array(
      namedRectSchema.extend({
        /** Side of the rectangle where the flight starts on the ground floor. */
        bottom: z.enum(["north", "south", "east", "west"]),
        steps: z.number().int().positive(),
      }),
    ),
    bar: rectSchema.extend({ height: length, chamfer: z.number().nonnegative() }),
    stage: rectSchema,
    dj: rectSchema,
    screen: z.object({ x: rangeSchema, z: rangeSchema }),
    wc: rectSchema,
    entrance: z.object({ x: rangeSchema, y: z.number() }),
    ledRain: rectSchema.extend({ z: z.number(), spacing: length, length: rangeSchema }),
    decor: z.object({
      vipBar: rectSchema.extend({ level: levelSchema }),
      highTables: z.array(levelPointSchema),
      plants: z.array(levelPointSchema),
    }),
    zones: z.array(layoutZoneSchema).min(1),
    tables: z.array(layoutTableSchema).min(1),
    cameras: z.object({
      overview: cameraPoseSchema,
      intro: z.array(cameraPoseSchema).min(1),
    }),
  })
  .superRefine((layout, ctx) => {
    const zoneIds = new Set<string>()
    layout.zones.forEach((zone, index) => {
      if (zoneIds.has(zone.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate zone id "${zone.id}"`,
          path: ["zones", index, "id"],
        })
      }
      zoneIds.add(zone.id)
    })
    const tableIds = new Set<string>()
    layout.tables.forEach((table, index) => {
      if (tableIds.has(table.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate table id "${table.id}"`,
          path: ["tables", index, "id"],
        })
      }
      tableIds.add(table.id)
      if (!zoneIds.has(table.zone)) {
        ctx.addIssue({
          code: "custom",
          message: `Unknown zone "${table.zone}"`,
          path: ["tables", index, "zone"],
        })
      }
    })
  })

export type VenueLayout = z.infer<typeof venueLayoutSchema>
export type LayoutZone = z.infer<typeof layoutZoneSchema>
export type LayoutTable = z.infer<typeof layoutTableSchema>

/** Validates a layout export; throws with a readable report when it does not match the schema. */
export function parseLayout(json: unknown): VenueLayout {
  const result = venueLayoutSchema.safeParse(json)
  if (!result.success) {
    throw new Error(`Invalid venue layout:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}

/** Layouts by club slug, validated at import time so a broken export fails loudly. */
export const layouts: Record<string, VenueLayout> = {
  naho: parseLayout(layoutJson),
}

export function getLayout(club: string): VenueLayout | null {
  return Object.hasOwn(layouts, club) ? layouts[club] : null
}

/** Converts a point from Blender axes (x east, y north, z up) to three.js (x, y up, z south). */
export function toThree([x, y, z]: readonly [number, number, number]): [number, number, number] {
  // `0 - y` instead of `-y` keeps points on the x axis at +0 rather than -0.
  return [x, z, 0 - y]
}

/** Level of a table, read from its zone. */
export function tableLevel(layout: VenueLayout, table: LayoutTable): Level {
  const zone = layout.zones.find((candidate) => candidate.id === table.zone)
  if (!zone) throw new Error(`Table "${table.id}" references unknown zone "${table.zone}"`)
  return zone.level
}

/** Floor height of a level, in metres. */
export function levelHeight(layout: VenueLayout, level: Level): number {
  return level === 0 ? 0 : layout.heights.mezzanine
}

/** Footprint of a table's booth in its own frame (`width` along the seat, `depth` front to back). */
export function tableFootprint(
  layout: VenueLayout,
  table: LayoutTable,
): { width: number; depth: number } {
  const { width, depth } = layout.furniture[table.kind]
  return { width, depth }
}
