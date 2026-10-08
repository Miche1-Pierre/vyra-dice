import { z } from "zod"

import { hexColorSchema } from "@/lib/clubs/values"

/*
 * Schema of clubs/<slug>/scene.json, the data art/scripts/build_club.py builds a venue from.
 * The Studio checks it before Blender runs, so the agent gets its mistakes as a readable list
 * instead of a Python traceback. Keep in sync with build_club.py (element types, fields).
 */

/** Tokens of an expression: numbers, names (no `__`), + - * / and parentheses. */
const TOKENS = /\s*(?:\d+(?:\.\d+)?|\.\d+|[A-Za-z_][A-Za-z0-9_]*|[-+*/()])\s*/y

/** Mirrors build_club.py's check: only numbers, names and arithmetic. */
export function isExpression(value: string): boolean {
  if (!value.trim() || value.includes("__")) return false
  TOKENS.lastIndex = 0
  let at = 0
  while (at < value.length) {
    TOKENS.lastIndex = at
    const m = TOKENS.exec(value)
    if (!m || m[0].length === 0) return false
    at += m[0].length
  }
  return true
}

/** A number, or an expression over the plan's named values (`under - 0.05`, `maxX - 0.04`). */
const num = z.union([
  z.number(),
  z.string().refine(isExpression, { error: "Expected a number or an arithmetic expression" }),
])
const vec3 = z.tuple([num, num, num])
const axis = z.tuple([z.number(), z.number(), z.number()])
const role = z.string().regex(/^[a-z0-9_]+$/, { error: "Material role: lowercase, digits, _" })
const objectName = z.string().regex(/^[a-z0-9_]+$/, { error: "Object name: lowercase, digits, _" })
const collection = z.enum(["ARCHI", "LVL1", "FURNITURE", "FX"])
const lightmap = z.union([z.literal(512), z.literal(1024), z.literal(2048), z.literal(4096)])
const shared = z.enum(["strips", "strips1", "glass", "glass1", "rig", "signs", "furn0", "furn1"])
const placed = { at: vec3, x: axis.optional(), y: axis.optional() }

const material = z.union([
  z.object({
    name: z.string().min(1),
    texture: z.object({
      kind: z.enum(["tiles", "concrete", "wood", "foliage"]),
      size: z.union([z.literal(256), z.literal(512), z.literal(1024), z.literal(2048)]),
    }),
    roughness: z.number().min(0).max(1).optional(),
    uvScale: z.number().positive().optional(),
  }),
  z.object({
    name: z.string().min(1),
    color: hexColorSchema,
    roughness: z.number().min(0).max(1).optional(),
    metallic: z.number().min(0).max(1).optional(),
    alpha: z.number().min(0).max(1).optional(),
    emission: hexColorSchema.optional(),
    strength: z.number().min(0).max(100).optional(),
  }),
])

/**
 * Argument kinds of each primitive operation (OPS in build_club.py): n number, m material role,
 * i integer (normal ±1), p point, P list of points. `[op, ...args, {kwargs}?]`.
 */
export const OPS: Record<string, string> = {
  floor: "nnnnnm",
  wall_x: "nnnnnmi",
  wall_y: "nnnnnmi",
  box: "nnnnnnm",
  face: "Pm",
  beam: "ppnnm",
  cylinder: "nnnnnm",
}

const KIND_LABEL: Record<string, string> = {
  n: "a number or an arithmetic expression",
  i: "an integer (normal: 1 or -1)",
  m: "a material role",
  p: "a point [x, y, z]",
  P: "a list of points",
}

const op = z
  .array(z.unknown())
  .min(2)
  .refine((o) => Object.hasOwn(OPS, String(o[0])), {
    error: `Unknown operation (${Object.keys(OPS).join(", ")})`,
  })

const roles = (keys: readonly string[]) => z.object(Object.fromEntries(keys.map((k) => [k, role])))

const element = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("mesh"),
    object: objectName.optional(),
    into: shared.optional(),
    collection: collection.optional(),
    lightmap: lightmap.optional(),
    ops: z.array(op).min(1),
  }),
  z.object({
    type: z.literal("mezzanine"),
    object: objectName.optional(),
    lightmap: lightmap.optional(),
    top: role,
    bottom: role,
    edge: role,
    led: role,
    ops: z.array(op).optional(),
  }),
  z.object({
    type: z.literal("railings"),
    object: objectName.optional(),
    metal: role,
    glass: role,
  }),
  z.object({
    type: z.literal("columns"),
    object: objectName.optional(),
    material: role,
    half: z.number().positive().optional(),
    lightmap: lightmap.optional(),
  }),
  z.object({
    type: z.literal("stairs"),
    object: objectName.optional(),
    material: role,
    lightmap: lightmap.optional(),
    led: z.record(z.string(), role),
    rail: z.object({
      metal: role,
      glass: role,
      into: shared.optional(),
      glassInto: shared.optional(),
    }),
  }),
  z.object({
    type: z.literal("bar"),
    object: objectName.optional(),
    lightmap: lightmap.optional(),
    seed: z.number().int().optional(),
    materials: roles(["base", "body", "top", "shelf", "glowTop", "glowKick"]),
    emblems: z
      .object({
        material: role,
        offsets: z.array(z.number()),
        z: z.number(),
        radius: z.number().positive(),
      })
      .nullable()
      .optional(),
    bottles: z.array(role).min(1),
  }),
  z.object({
    type: z.literal("stage"),
    object: objectName.optional(),
    lightmap: lightmap.optional(),
    materials: roles(["deck", "booth", "top", "boothLed", "edgeLed", "screen"]),
    gear: z.object({ x0: z.number(), step: z.number(), widths: z.array(z.number().positive()) }),
  }),
  z.object({
    type: z.literal("slats"),
    object: objectName.optional(),
    zone: z.string(),
    material: role,
    glow: role,
    lightmap: lightmap.optional(),
  }),
  z.object({
    type: z.literal("trusses"),
    into: shared.optional(),
    material: role,
    size: z.number().positive().optional(),
    segments: z.array(z.tuple([vec3, vec3])).min(1),
  }),
  z.object({
    type: z.literal("ledRainFrame"),
    into: shared.optional(),
    material: role,
    size: z.number().positive().optional(),
    lift: z.number().optional(),
  }),
  z.object({ type: z.literal("movingHeads"), into: shared.optional(), material: role, lens: role }),
  z.object({
    type: z.literal("speakers"),
    into: shared.optional(),
    material: role,
    items: z.array(z.object({ x: num, y: num })).min(1),
    top: z.number().optional(),
    count: z.number().int().positive().optional(),
    step: z.number().positive().optional(),
    tilt: z.number().optional(),
    hang: z.number().optional(),
  }),
  z.object({
    type: z.literal("diamonds"),
    into: shared.optional(),
    material: role,
    x: num,
    items: z.array(z.tuple([z.number(), z.number(), z.number().positive()])).min(1),
  }),
  z.object({
    type: z.literal("booths"),
    materials: roles([
      "plinth",
      "velvet_lounge",
      "velvet_vip",
      "velvet_prestige",
      "frame",
      "trim",
      "top",
      "lamp",
      "bottleGreen",
      "bottleClear",
      "glass",
    ]),
  }),
  z.object({
    type: z.literal("backBar"),
    wallY: num,
    seed: z.number().int().optional(),
    materials: roles(["body", "top", "shelf"]),
    bottles: z.array(role).min(1),
  }),
  z.object({
    type: z.literal("decor"),
    tableSeed: z.number().int().optional(),
    plantSeed: z.number().int().optional(),
    materials: roles(["frame", "trim", "top", "seat", "foliage"]),
  }),
  z.object({
    type: z.literal("ledRain"),
    material: role,
    seed: z.number().int().optional(),
    tube: z.number().positive().optional(),
  }),
  z.object({
    type: z.literal("globes"),
    seed: z.number().int().optional(),
    materials: z.array(role).min(1),
    weights: z.array(z.number().positive()).optional(),
    wire: role,
    into: shared.optional(),
    items: z.array(z.tuple([z.number(), z.number(), z.number(), z.number().positive()])).min(1),
  }),
  z.object({
    type: z.literal("logo"),
    object: z
      .string()
      .regex(/^fx_sign_wall_[nsew]$/, { error: "A wall logo object is fx_sign_wall_<n|s|e|w>" })
      .optional(),
    collection: collection.optional(),
    into: shared.optional(),
    material: role,
    height: z.number().positive(),
    tube: z.number().positive(),
    ...placed,
  }),
  z.object({
    type: z.literal("text"),
    text: z.string().min(1).max(40),
    into: shared.optional(),
    material: role,
    size: z.number().positive(),
    extrude: z.number().nonnegative().optional(),
    outline: z.number().nonnegative().optional(),
    spacing: z.number().positive().optional(),
    font: z.enum(["medium", "bold"]).optional(),
    ...placed,
  }),
  z.object({
    type: z.literal("starburst"),
    into: shared.optional(),
    material: role,
    radius: z.number().positive(),
    tube: z.number().positive(),
    spokes: z.number().int().min(2).max(12).optional(),
    ...placed,
  }),
])
export type SceneElement = z.infer<typeof element>

const lightColor = z.tuple([z.number().min(0), z.number().min(0), z.number().min(0)])
const lightSeries = {
  name: z.string().regex(/^[a-z0-9_]+$/),
  values: z.array(z.union([z.number(), z.array(z.number())])).optional(),
  count: z.number().int().positive().optional(),
  at: vec3,
  energy: z.number().positive(),
  color: lightColor,
}

export const sceneSchema = z
  .object({
    version: z.literal(1),
    fonts: z.object({ medium: z.string(), bold: z.string() }).partial().optional(),
    logo: z
      .object({
        capHeight: z.number().positive(),
        center: z.tuple([z.number(), z.number()]),
        strokes: z
          .array(
            z.union([
              z.array(z.tuple([z.number(), z.number()])).min(2),
              z.object({ circle: z.tuple([z.number(), z.number(), z.number().positive()]) }),
            ]),
          )
          .min(1),
      })
      .optional(),
    materials: z.record(role, material),
    elements: z.array(element).min(1),
    lights: z.object({
      lamps: z.object({
        energy: z.number().positive(),
        color: lightColor,
        radius: z.number().positive(),
      }),
      pins: z.object({
        energy: z.number().positive(),
        color: lightColor,
        size: z.number().positive(),
        blend: z.number().min(0).max(1),
      }),
      spots: z
        .array(
          z.object({
            ...lightSeries,
            target: vec3,
            size: z.number().positive().optional(),
            blend: z.number().min(0).max(1).optional(),
          }),
        )
        .optional(),
      areas: z.array(z.object({ ...lightSeries, size: z.number().positive() })).optional(),
    }),
    world: z.object({ color: lightColor }),
  })
  .superRefine((scene, ctx) => {
    const roles = new Set(Object.keys(scene.materials))
    const check = (value: unknown, path: (string | number)[]) => {
      if (typeof value === "string" && !roles.has(value)) {
        ctx.addIssue({ code: "custom", message: `Unknown material role "${value}"`, path })
      }
    }
    scene.elements.forEach((el, i) => {
      const base = ["elements", i]
      for (const key of [
        "material",
        "top",
        "bottom",
        "edge",
        "led",
        "metal",
        "glass",
        "glow",
        "lens",
        "wire",
      ]) {
        if (key in el && typeof (el as Record<string, unknown>)[key] === "string") {
          check((el as Record<string, unknown>)[key], [...base, key])
        }
      }
      if ("materials" in el) {
        const mats = el.materials
        for (const [k, v] of Array.isArray(mats) ? mats.entries() : Object.entries(mats))
          check(v, [...base, "materials", k])
      }
      if ("bottles" in el) el.bottles.forEach((b, k) => check(b, [...base, "bottles", k]))
      if (el.type === "stairs") {
        for (const [id, r] of Object.entries(el.led)) check(r, [...base, "led", id])
        check(el.rail.metal, [...base, "rail", "metal"])
        check(el.rail.glass, [...base, "rail", "glass"])
      }
      if (el.type === "mesh") {
        el.ops.forEach((o, k) => {
          const [name, ...args] = o
          const kinds = OPS[String(name)]
          const plain =
            args.length > 0 && typeof args.at(-1) === "object" && !Array.isArray(args.at(-1))
          const count = plain ? args.length - 1 : args.length
          if (count !== kinds.length) {
            ctx.addIssue({
              code: "custom",
              message: `${String(name)} takes ${kinds.length} arguments (${kinds}), got ${count}`,
              path: [...base, "ops", k],
            })
            return
          }
          const isNum = (a: unknown) =>
            typeof a === "number" || (typeof a === "string" && isExpression(a))
          const isPoint = (a: unknown) => Array.isArray(a) && a.length === 3 && a.every(isNum)
          ;[...kinds].forEach((kind, j) => {
            const a = args[j]
            const ok =
              kind === "n"
                ? isNum(a)
                : kind === "i"
                  ? Number.isInteger(a)
                  : kind === "p"
                    ? isPoint(a)
                    : kind === "P"
                      ? Array.isArray(a) && a.length >= 3 && a.every(isPoint)
                      : typeof a === "string"
            const path = [...base, "ops", k, j + 1]
            if (!ok) ctx.addIssue({ code: "custom", message: `Expected ${KIND_LABEL[kind]}`, path })
            else if (kind === "m") check(a, path)
          })
        })
      }
      if (el.type === "logo" && !scene.logo) {
        ctx.addIssue({ code: "custom", message: "A logo element needs scene.logo", path: base })
      }
    })
  })
export type Scene = z.infer<typeof sceneSchema>

/** Readable list of problems, or an empty list when the scene is valid. */
export function checkScene(json: unknown): string[] {
  const result = sceneSchema.safeParse(json)
  return result.success ? [] : [z.prettifyError(result.error)]
}
