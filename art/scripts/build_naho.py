"""Build the Naho Club POC venue from ``art/layouts/naho.json`` (VYR-55).

Live Blender (MCP / Python console):
    import sys; sys.path.insert(0, r"C:/vyra-dice/art/scripts")
    import importlib, build_naho; importlib.reload(build_naho); build_naho.build()

Headless:
    blender -b -P art/scripts/build_naho.py

Everything is generated: re-running rebuilds the NAHO collection from scratch.
Dimensions are PROVISIONAL (reconstructed from a sketch) and must be validated by the club.
"""

from __future__ import annotations

import importlib
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import vyra3d as v3  # noqa: E402

importlib.reload(v3)
MeshBuilder = v3.MeshBuilder

REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
LAYOUT_PATH = os.path.join(REPO, "art", "layouts", "naho.json")
TEX_DIR = os.path.join(REPO, "art", "textures", "generated", "naho")
BLEND_PATH = os.path.join(REPO, "art", "blender", "naho.blend")

# Jost (SIL OFL), the typeface of the web UI, for the club's lettering
FONT_MEDIUM = "jost-latin-500-normal.woff2"
FONT_BOLD = "jost-latin-600-normal.woff2"

WARM = (1.0, 0.64, 0.36)
FOLIAGE_LIGHT = (0.8, 1.0, 0.84)


def load_layout() -> dict:
    with open(LAYOUT_PATH, encoding="utf-8") as fh:
        return json.load(fh)


# --------------------------------------------------------------------------- context


class Ctx:
    def __init__(self, layout: dict, mats: dict, colls: dict):
        self.L = layout
        self.M = mats
        self.C = colls
        h = layout["heights"]
        self.mz = h["mezzanine"]
        self.under = h["mezzanine"] - h["slab"]
        self.ceil = h["ceiling"]
        self.zones = {z["id"]: z for z in layout["zones"]}
        # shared builders, finalized at the end
        self.fx_strips = MeshBuilder("fx_led_strips")
        self.lvl1_fx_strips = MeshBuilder("lvl1_fx_strips")
        self.glass = MeshBuilder("glass")
        self.lvl1_glass = MeshBuilder("lvl1_glass")
        self.rig = MeshBuilder("rig")
        self.signs = MeshBuilder("fx_signs")
        self.furn = {0: MeshBuilder("furniture"), 1: MeshBuilder("lvl1_furniture")}
        self.lamp_points: list[Vector] = []
        self.table_points: dict[str, Vector] = {}

    def level_z(self, level: int) -> float:
        return self.mz if level == 1 else 0.0

    def under_slab(self, x: float, y: float) -> bool:
        return any(r["x"][0] < x < r["x"][1] and r["y"][0] < y < r["y"][1] for r in self.L["mezzanine"])


def frame(origin, xaxis, yaxis) -> Matrix:
    """Matrix whose local X/Y map to the given world axes (Z = X x Y)."""
    x, y = Vector(xaxis).normalized(), Vector(yaxis).normalized()
    z = x.cross(y)
    m = Matrix((x, y, z)).transposed().to_4x4()
    m.translation = Vector(origin)
    return m


# Naho's wordmark as drawn in the web UI (src/components/experience/brand.tsx): N, an A without
# crossbar, H, O — thin strokes on a 70 x 20 grid (y down), cap height 16.
NAHO_STROKES = [
    [(1.5, 18), (1.5, 2.4), (13, 17.6), (13, 2)],
    [(18.5, 18), (25, 2.2), (31.5, 18)],
    [(36.5, 2), (36.5, 18)],
    [(48.5, 2), (48.5, 18)],
    [(36.5, 10.1), (48.5, 10.1)],
    ("circle", 61.2, 10, 8),
]


def naho_wordmark(mb: MeshBuilder, mat, height: float, radius: float, matrix: Matrix) -> None:
    """Neon tubes spelling NΛHO, centred on the local origin, `height` = cap height."""
    k = height / 16

    def local(x: float, y: float) -> tuple[float, float]:
        return ((x - 35.3) * k, (10 - y) * k)

    strokes = []
    for st in NAHO_STROKES:
        if st[0] == "circle":
            _, cx, cy, r = st
            lx, ly = local(cx, cy)
            strokes.append(("circle", lx, ly, r * k))
        else:
            strokes.append([local(x, y) for x, y in st])
    mb.tubes(strokes, radius, mat, matrix)


# --------------------------------------------------------------------------- materials


def make_materials() -> dict:
    tiles = v3.save_png(v3.tex_tiles(512), os.path.join(TEX_DIR, "tiles.png"), "naho_tiles")
    concrete = v3.save_png(v3.tex_concrete(1024), os.path.join(TEX_DIR, "concrete.png"), "naho_concrete")
    wood = v3.save_png(v3.tex_wood(1024), os.path.join(TEX_DIR, "wood.png"), "naho_wood")
    foliage = v3.save_png(v3.tex_foliage(1024), os.path.join(TEX_DIR, "foliage.png"), "naho_foliage")
    m = v3.material
    return {
        "tiles": m("naho_tiles", roughness=0.3, image=tiles, uv_scale=1.2),
        "concrete": m("naho_concrete", roughness=0.55, image=concrete, uv_scale=3.0),
        "wood": m("naho_wood", roughness=0.5, image=wood, uv_scale=2.4),
        "foliage": m("naho_foliage", roughness=0.9, image=foliage, uv_scale=2.0),
        "wall": m("naho_wall", "#1f1e24", 0.85),
        "ceiling": m("naho_ceiling", "#0d0d10", 0.95),
        "fascia": m("naho_fascia", "#131317", 0.5),
        "black": m("naho_black_metal", "#141418", 0.45, metallic=0.6),
        "stone": m("naho_stone", "#18181c", 0.22),
        "gold": m("naho_gold", "#c29b4e", 0.3, metallic=1.0),
        "slat": m("naho_slat", "#b08643", 0.45, metallic=0.35),
        "glass": m("naho_glass", "#a9bfd6", 0.05, alpha=0.14),
        "leather": m("naho_leather", "#17171a", 0.5),
        "velvet_lounge": m("naho_velvet_lounge", "#2f6a48", 0.9),
        "velvet_vip": m("naho_velvet_vip", "#55286a", 0.9),
        "velvet_prestige": m("naho_velvet_prestige", "#22386e", 0.85),
        "led_pink": m("naho_led_pink", "#ff2f92", emission="#ff2f92", strength=14.0),
        "led_blue": m("naho_led_blue", "#3f6dff", emission="#3f6dff", strength=12.0),
        "led_violet": m("naho_led_violet", "#9a3dff", emission="#9a3dff", strength=12.0),
        "led_amber": m("naho_led_amber", "#ffa548", emission="#ffa548", strength=8.0),
        "led_white": m("naho_led_white", "#fff1df", emission="#fff1df", strength=8.0),
        "screen": m("naho_screen", "#ff7a26", emission="#ff7a26", strength=3.0),
        "sphere_white": m("naho_sphere_white", "#fff4e8", emission="#fff4e8", strength=4.0),
        "sphere_pink": m("naho_sphere_pink", "#ff7cc4", emission="#ff7cc4", strength=4.0),
        "sphere_blue": m("naho_sphere_blue", "#72b8ff", emission="#72b8ff", strength=4.0),
        "neon_white": m("naho_neon_white", "#ffffff", emission="#ffffff", strength=10.0),
        "neon_green": m("naho_neon_green", "#7dff6e", emission="#7dff6e", strength=10.0),
        "neon_gold": m("naho_neon_gold", "#d9b26a", emission="#d9b26a", strength=1.2),
        "bottle_amber": m("naho_bottle_amber", "#b8682a", emission="#c8742a", strength=0.55),
        "bottle_green": m("naho_bottle_green", "#3c6e3a", emission="#3f7a3a", strength=0.45),
        "bottle_clear": m("naho_bottle_clear", "#9fb2c6", emission="#b8c8d8", strength=0.5),
        "lamp": m("naho_lamp", "#ffcf96", emission="#ffcf96", strength=10.0),
        "glow": m("naho_glow", "#ffb26a", emission="#ffb26a", strength=3.0),
        "lens": m("naho_lens", "#ffffff", emission="#ffffff", strength=4.0),
    }


# --------------------------------------------------------------------------- architecture


def build_ground(c: Ctx) -> None:
    gf, e = c.L["groundFloor"], c.L["entrance"]
    mb = MeshBuilder("ground_floor")
    mb.floor(*gf["x"], *gf["y"], 0.0, c.M["tiles"])
    mb.floor(e["x"][0], e["x"][1], e["y"] - 3.0, e["y"], 0.0, c.M["tiles"])
    mb.finalize(c.C["ARCHI"], lightmap=2048)


def build_walls(c: Ctx) -> None:
    L, M = c.L, c.M
    b = L["building"]
    x0, x1, y0, y1 = b["minX"], b["maxX"], b["minY"], b["maxY"]
    gy0, gy1 = L["groundFloor"]["y"]
    hy0, hy1 = L["void"][0]["y"]
    mz, under, ch = c.mz, c.under, c.ceil

    west = MeshBuilder("wall_west")
    west.wall_x(x0, y0, gy0, mz, ch, M["wall"], +1)  # south band (upper)
    west.wall_x(x0, gy0, hy0, 0, under, M["wall"], +1)  # entrance lobby
    west.wall_x(x0, gy0, hy0, mz, ch, M["wall"], +1)  # loge
    west.wall_x(x0, hy0, hy1, 0, ch, M["foliage"], +1)  # green wall, full height
    west.wall_x(x0, hy1, y1, mz, ch, M["wall"], +1)  # north band
    west.finalize(c.C["ARCHI"], lightmap=2048)

    east = MeshBuilder("wall_east")
    east.wall_x(x1, gy0, gy1, 0, under, M["wall"], -1)  # ground lounge (behind slats)
    east.wall_x(x1, y0, gy0, mz, ch, M["wall"], -1)
    east.wall_x(x1, gy0, hy1, mz, ch, M["foliage"], -1)  # green wall above the mezzanine
    east.wall_x(x1, hy1, y1, mz, ch, M["wall"], -1)
    east.finalize(c.C["ARCHI"], lightmap=2048)

    upper = MeshBuilder("walls_upper")
    upper.wall_y(y1, x0, x1, mz, ch, M["wall"], -1)
    upper.wall_y(y0, x0, x1, mz, ch, M["wall"], +1)
    upper.finalize(c.C["ARCHI"], lightmap=1024)

    e = L["entrance"]
    ex0, ex1, ey, door = e["x"][0], e["x"][1], e["y"], 2.7
    ground = MeshBuilder("walls_ground")
    ground.wall_y(gy1, x0, x1, 0, under, M["concrete"], -1)  # wall behind the DJ screen
    ground.wall_y(ey, x0, ex0, 0, under, M["concrete"], +1)
    ground.wall_y(ey, ex1, x1, 0, under, M["concrete"], +1)
    ground.wall_y(ey, ex0, ex1, door, under, M["concrete"], +1)
    ground.wall_x(ex0, ey - 3.0, ey, 0, door, M["wall"], +1)
    ground.wall_x(ex1, ey - 3.0, ey, 0, door, M["wall"], -1)
    ground.floor(ex0, ex1, ey - 3.0, ey, door, M["wall"], up=False)
    ground.finalize(c.C["ARCHI"], lightmap=1024)

    glow = MeshBuilder("fx_entrance")
    glow.wall_y(ey - 2.95, ex0, ex1, 0, door, M["glow"], +1)
    glow.finalize(c.C["FX"])

    ceil = MeshBuilder("ceiling")
    ceil.floor(x0, x1, y0, y1, ch, M["ceiling"], up=False)
    ceil.finalize(c.C["ARCHI"], lightmap=1024)


def exposed_spans(axis: str, k: float, a0: float, a1: float, normal: int, solid, step: float = 0.1):
    """Sub-intervals of a slab edge that face the void (sampled every ``step`` metres)."""
    spans, cur = [], None
    count = max(1, int(round((a1 - a0) / step)))
    for i in range(count):
        t0 = a0 + (a1 - a0) * i / count
        t1 = a0 + (a1 - a0) * (i + 1) / count
        tm = (t0 + t1) / 2
        px, py = (tm, k + normal * 0.05) if axis == "y" else (k + normal * 0.05, tm)
        if not solid(px, py):
            cur = [t0, t1] if cur is None else [cur[0], t1]
        elif cur is not None:
            spans.append(tuple(cur))
            cur = None
    if cur is not None:
        spans.append(tuple(cur))
    return spans


def build_mezzanine(c: Ctx) -> None:
    M, b = c.M, c.L["building"]
    rects = [(r["x"][0], r["x"][1], r["y"][0], r["y"][1]) for r in c.L["mezzanine"]]

    def solid(px: float, py: float) -> bool:
        if px <= b["minX"] or px >= b["maxX"] or py <= b["minY"] or py >= b["maxY"]:
            return True
        return any(x0 < px < x1 and y0 < py < y1 for x0, x1, y0, y1 in rects)

    slab = MeshBuilder("lvl1_slabs")
    led = c.lvl1_fx_strips
    mz, under = c.mz, c.under
    for x0, x1, y0, y1 in rects:
        slab.floor(x0, x1, y0, y1, mz, M["wood"])
        slab.floor(x0, x1, y0, y1, under, M["fascia"], up=False)
        for axis, k, a0, a1, n in (("y", y0, x0, x1, -1), ("y", y1, x0, x1, +1),
                                   ("x", x0, y0, y1, -1), ("x", x1, y0, y1, +1)):  # fmt: skip
            for s0, s1 in exposed_spans(axis, k, a0, a1, n, solid):
                if axis == "y":
                    slab.wall_y(k, s0, s1, under, mz, M["fascia"], n)
                    led.box(s0, s1, k, k + n * 0.035, under - 0.035, under, M["led_violet"])
                else:
                    slab.wall_x(k, s0, s1, under, mz, M["fascia"], n)
                    led.box(k, k + n * 0.035, s0, s1, under - 0.035, under, M["led_violet"])
    # "WELCOME / CLUB" bulkhead under the loge, facing the dance floor
    loge = next(r for r in c.L["mezzanine"] if r["id"] == "loge-sw")
    lx0, lx1 = loge["x"]
    ly = loge["y"][1]
    slab.box(lx0, lx1, ly - 0.06, ly, under - 0.75, under, M["fascia"], skip=("+x", "-x"))
    slab.finalize(c.C["LVL1"], lightmap=2048)

    # as in the club: solid white WELCOME, then CLUB in green neon outlines and a starburst
    to_world = frame((-3.6, ly + 0.012, under - 0.4), (-1, 0, 0), (0, 0, 1))
    c.signs.text("WELCOME", M["neon_white"], 0.52, to_world, extrude=0.02, font=FONT_BOLD, spacing=1.05)
    to_world = frame((-8.0, ly + 0.03, under - 0.4), (-1, 0, 0), (0, 0, 1))
    c.signs.text("CLUB", M["neon_green"], 0.6, to_world, font=FONT_MEDIUM, outline=0.011, spacing=1.12)
    star = frame((-9.7, ly + 0.03, under - 0.4), (-1, 0, 0), (0, 0, 1))
    spokes = [[(math.cos(a) * 0.17, math.sin(a) * 0.17), (-math.cos(a) * 0.17, -math.sin(a) * 0.17)]
              for a in (0, math.pi / 4, math.pi / 2, 3 * math.pi / 4)]  # fmt: skip
    c.signs.tubes(spokes, 0.011, M["neon_green"], star)


def rail(metal: MeshBuilder, glass: MeshBuilder, p0, p1, height: float, M: dict, step: float = 1.5) -> None:
    a, b = Vector(p0), Vector(p1)
    d = b - a
    n = max(1, math.ceil(d.length / step))
    for i in range(n + 1):
        p = a + d * (i / n)
        metal.box(p.x - 0.022, p.x + 0.022, p.y - 0.022, p.y + 0.022, p.z, p.z + height, M["black"])
    up = Vector((0, 0, height))
    metal.beam(a + up, b + up, 0.06, 0.05, M["black"])
    g0, g1 = a + Vector((0, 0, 0.08)), b + Vector((0, 0, 0.08))
    g2, g3 = b + Vector((0, 0, height - 0.06)), a + Vector((0, 0, height - 0.06))
    glass.face([tuple(g0), tuple(g1), tuple(g2), tuple(g3)], M["glass"])


def build_railings(c: Ctx) -> None:
    metal = MeshBuilder("lvl1_railing")
    h = c.L["heights"]["railing"]
    for seg in c.L["railings"]:
        (ax, ay), (bx, by) = seg["from"], seg["to"]
        rail(metal, c.lvl1_glass, (ax, ay, c.mz), (bx, by, c.mz), h, c.M)
    metal.finalize(c.C["LVL1"])
    # gold Naho wordmarks on the glass, facing the dance floor
    for y in (-9.5, -3.5, 2.5):
        naho_wordmark(c.signs, c.M["neon_gold"], 0.16, 0.0045, frame((8.36, y, c.mz + 0.55), (0, -1, 0), (0, 0, 1)))
    for x in (-6.0, 0.0, 6.0):
        naho_wordmark(c.signs, c.M["neon_gold"], 0.16, 0.0045, frame((x, 10.96, c.mz + 0.55), (1, 0, 0), (0, 0, 1)))


def build_columns(c: Ctx) -> None:
    mb = MeshBuilder("columns")
    for x, y in c.L["columns"]:
        mb.box(x - 0.17, x + 0.17, y - 0.17, y + 0.17, 0, c.under, c.M["black"], skip=("-z", "+z"))
    mb.finalize(c.C["ARCHI"], lightmap=512)


def build_stairs(c: Ctx) -> None:
    M = c.M
    mb = MeshBuilder("stairs")
    h = c.L["heights"]["railing"]
    for s in c.L["stairs"]:
        n = s["steps"]
        rise = c.mz / n
        x0, x1 = s["x"]
        y0, y1 = s["y"]
        if s["bottom"] == "south":  # climbs towards +y
            run = (y1 - y0) / n
            for i in range(n):
                z, a, bb = (i + 1) * rise, y0 + i * run, y0 + (i + 1) * run
                mb.floor(x0, x1, a, bb, z, M["concrete"])
                mb.wall_y(a, x0, x1, z - rise, z, M["concrete"], -1)
                mb.wall_x(x1, a, bb, 0, z, M["concrete"], +1)
                c.fx_strips.box(x0 + 0.06, x1 - 0.06, a - 0.012, a + 0.012, z - 0.035, z - 0.012, M["led_blue"])
            rail(c.rig, c.glass, (x1 - 0.04, y0, 0.0), (x1 - 0.04, y1, c.mz), h, M)
        else:  # bottom "west": climbs towards +x
            run = (x1 - x0) / n
            for i in range(n):
                z, a, bb = (i + 1) * rise, x0 + i * run, x0 + (i + 1) * run
                mb.floor(a, bb, y0, y1, z, M["concrete"])
                mb.wall_x(a, y0, y1, z - rise, z, M["concrete"], -1)
                mb.wall_y(y0, a, bb, 0, z, M["concrete"], -1)
                mb.wall_y(y1, a, bb, 0, z, M["concrete"], +1)
                c.fx_strips.box(a - 0.012, a + 0.012, y0 + 0.06, y1 - 0.06, z - 0.035, z - 0.012, M["led_pink"])
            for yy in (y0 + 0.04, y1 - 0.04):
                rail(c.rig, c.glass, (x0, yy, 0.0), (x1, yy, c.mz), h, M)
    mb.finalize(c.C["ARCHI"], lightmap=1024)


def build_bar(c: Ctx) -> None:
    M, bar = c.M, c.L["bar"]
    x0, x1 = bar["x"]
    y0, y1 = bar["y"]
    ch, h, d = bar["chamfer"], bar["height"], 0.75
    outer = v3.chamfered_rect(x0, x1, y0, y1, ch)
    inner = v3.chamfered_rect(x0 + d, x1 - d, y0 + d, y1 - d, max(0.25, ch - 0.31))
    kick = v3.chamfered_rect(x0 + 0.06, x1 - 0.06, y0 + 0.06, y1 - 0.06, ch - 0.025)
    top_o = v3.chamfered_rect(x0 - 0.08, x1 + 0.08, y0 - 0.08, y1 + 0.08, ch + 0.033)
    top_i = v3.chamfered_rect(x0 + d + 0.06, x1 - d - 0.06, y0 + d + 0.06, y1 - d - 0.06, max(0.2, ch - 0.33))

    mb = MeshBuilder("bar")
    mb.prism(kick, 0.0, 0.09, M["black"], top=False)
    mb.prism(outer, 0.09, h - 0.06, M["concrete"], top=False)
    mb.prism(top_o, h - 0.06, h, M["stone"], top=False)
    mb.ring(top_o, top_i, h, M["stone"])
    mb.prism(list(reversed(top_i)), h - 0.06, h, M["stone"], top=False)
    mb.prism(list(reversed(inner)), 0.0, h - 0.06, M["black"], top=False)
    # gold patina emblems on the long faces (stand-ins for the club logo)
    yc = (y0 + y1) / 2
    for yy in (yc - 2.3, yc + 2.3):
        for xx, sgn in ((x0, -1), (x1, +1)):
            m = Matrix.Translation((xx + sgn * 0.004, yy, 0.62)) @ Matrix.Rotation(math.radians(90 * sgn), 4, "Y")
            ring_o = [(math.cos(a) * 0.31, math.sin(a) * 0.31) for a in (k * math.tau / 40 for k in range(40))]
            ring_i = [(x * 0.86, y * 0.86) for x, y in ring_o]
            for poly_o, poly_i in ((ring_o, ring_i), ([(x * 0.42, y * 0.42) for x, y in ring_o],
                                                       [(x * 0.3, y * 0.3) for x, y in ring_o])):  # fmt: skip
                for k in range(40):
                    kk = (k + 1) % 40
                    quad = [(poly_o[k][0], poly_o[k][1], 0), (poly_o[kk][0], poly_o[kk][1], 0),
                            (poly_i[kk][0], poly_i[kk][1], 0), (poly_i[k][0], poly_i[k][1], 0)]  # fmt: skip
                    c.signs.face([tuple(m @ Vector(p)) for p in quad], M["neon_gold"])
    # back bar island with glowing shelves
    bx0, bx1 = (x0 + x1) / 2 - 0.55, (x0 + x1) / 2 + 0.55
    by0, by1 = y0 + d + 0.9, y1 - d - 0.9
    mb.box(bx0, bx1, by0, by1, 0, 2.15, M["concrete"], skip=("-z",))
    mb.finalize(c.C["ARCHI"], lightmap=1024)

    rng = v3.seeded(3)
    bottles = MeshBuilder("fx_bottles")
    for side, xs in ((-1, bx0), (+1, bx1)):
        for zs in (1.15, 1.55, 1.95):
            c.fx_strips.box(xs, xs + side * 0.2, by0 + 0.1, by1 - 0.1, zs - 0.025, zs, M["led_amber"])
            y = by0 + 0.2
            while y < by1 - 0.2:
                mat = rng.choice([M["bottle_amber"], M["bottle_green"], M["bottle_clear"]])
                bottles.cylinder(xs + side * 0.1, y, zs, zs + rng.uniform(0.22, 0.32), 0.034, mat, sides=8)
                y += rng.uniform(0.1, 0.15)
    bottles.finalize(c.C["FX"])
    # glow lines: under the counter overhang (amber) and toe-kick (pink)
    glow_top = v3.chamfered_rect(x0 - 0.03, x1 + 0.03, y0 - 0.03, y1 + 0.03, ch + 0.012)
    glow_kick = v3.chamfered_rect(x0 + 0.03, x1 - 0.03, y0 + 0.03, y1 - 0.03, ch - 0.012)
    for poly, z, mat in ((glow_top, h - 0.075, M["led_amber"]), (glow_kick, 0.05, M["led_pink"])):
        for i in range(len(poly)):
            (ax, ay), (bx, by) = poly[i], poly[(i + 1) % len(poly)]
            c.fx_strips.beam((ax, ay, z), (bx, by, z), 0.02, 0.02, mat)


def build_stage(c: Ctx) -> None:
    M, st, dj, sc = c.M, c.L["stage"], c.L["dj"], c.L["screen"]
    sh = c.L["heights"]["stage"]
    x0, x1 = st["x"]
    y0, y1 = st["y"]
    dx0, dx1 = dj["x"]
    dy0, dy1 = dj["y"]
    mb = MeshBuilder("stage")
    mb.box(x0, x1, y0, y1, 0, sh, M["concrete"], skip=("-z", "+y"))
    mb.box(dx0, dx1, dy0, dy1, sh, sh + 1.12, M["black"], skip=("-z",))
    mb.box(dx0 - 0.05, dx1 + 0.05, dy0 - 0.05, dy1 + 0.05, sh + 1.12, sh + 1.16, M["stone"])
    for i, w in enumerate((0.33, 0.33, 0.42, 0.33, 0.33)):
        cx = -0.95 + i * 0.48
        mb.box(cx - w / 2, cx + w / 2, dy0 + 0.2, dy0 + 0.62, sh + 1.16, sh + 1.24, M["black"])
    mb.finalize(c.C["ARCHI"], lightmap=1024)

    c.fx_strips.wall_y(dy0 - 0.012, dx0 + 0.1, dx1 - 0.1, sh + 0.12, sh + 1.0, M["led_violet"], -1)
    c.fx_strips.box(x0, x1, y0 - 0.025, y0, sh - 0.045, sh - 0.012, M["led_white"])

    scr = MeshBuilder("fx_screen")
    scr.wall_y(y1 - 0.03, sc["x"][0], sc["x"][1], sc["z"][0], sc["z"][1], M["screen"], -1)
    obj = scr.finalize(c.C["FX"])
    me, uv = obj.data, obj.data.uv_layers["UVMap"]
    for loop in me.loops:
        co = me.vertices[loop.vertex_index].co
        uv.data[loop.index].uv = (
            (co.x - sc["x"][0]) / (sc["x"][1] - sc["x"][0]),
            (co.z - sc["z"][0]) / (sc["z"][1] - sc["z"][0]),
        )


def build_wc(c: Ctx) -> None:
    w, M = c.L["wc"], c.M
    x0, x1 = w["x"]
    y0, y1 = w["y"]
    mb = MeshBuilder("lvl1_wc")
    mb.box(x0, x1, y0, y1, c.mz, c.mz + 2.9, M["concrete"], skip=("-z", "+x", "+y"))
    mb.wall_y(y0 - 0.01, 11.0, 12.1, c.mz, c.mz + 2.2, M["black"], -1)
    mb.finalize(c.C["LVL1"], lightmap=512)
    c.signs.text("WC", M["neon_white"], 0.3, frame((11.55, y0 - 0.02, c.mz + 2.45), (1, 0, 0), (0, 0, 1)), 0.01, font=FONT_MEDIUM)


def build_slats(c: Ctx) -> None:
    zone = c.zones["lounge-mezzanine"]
    ya, yb = zone["y"]
    xw = c.L["building"]["maxX"]
    mb = MeshBuilder("slats")
    z = 0.95
    while z < c.under - 0.3:
        mb.box(xw - 0.14, xw - 0.06, ya, yb, z, z + 0.07, c.M["slat"], skip=("+x",))
        z += 0.17
    mb.finalize(c.C["ARCHI"], lightmap=1024)
    c.fx_strips.wall_x(xw - 0.02, ya, yb, 0.9, c.under - 0.3, c.M["glow"], -1)


# --------------------------------------------------------------------------- rig & FX


def truss(mb: MeshBuilder, p0, p1, mat, size: float = 0.3, step: float = 0.5) -> None:
    a, b = Vector(p0), Vector(p1)
    d = b - a
    u = d.normalized()
    side = u.cross(Vector((0, 0, 1))).normalized()
    up = Vector((0, 0, 1))
    hs = size / 2
    for corner in (side * hs + up * hs, -side * hs + up * hs, -side * hs - up * hs, side * hs - up * hs):
        mb.beam(a + corner, b + corner, 0.035, 0.035, mat)
    n = max(1, int(d.length / step))
    for i in range(n):
        t0, t1 = a + u * (d.length * i / n), a + u * (d.length * (i + 1) / n)
        for s in (side * hs, -side * hs):
            lo, hi = (up * hs, -up * hs) if i % 2 == 0 else (-up * hs, up * hs)
            mb.beam(t0 + s + lo, t1 + s + hi, 0.018, 0.018, mat)


def build_rig(c: Ctx) -> None:
    M, rig = c.M, c.rig
    z = 7.6
    truss(rig, (-7.5, 6.6, z), (7.5, 6.6, z), M["black"])
    truss(rig, (-6.5, -10.6, z), (-6.5, 6.6, z), M["black"])
    truss(rig, (7.6, -10.6, z), (7.6, 6.6, z), M["black"])
    truss(rig, (-7.5, -10.6, z), (7.6, -10.6, z), M["black"])
    lr = c.L["ledRain"]
    fz = lr["z"] + 0.18
    corners = [(lr["x"][0], lr["y"][0]), (lr["x"][1], lr["y"][0]), (lr["x"][1], lr["y"][1]), (lr["x"][0], lr["y"][1])]
    for i in range(4):
        (ax, ay), (bx, by) = corners[i], corners[(i + 1) % 4]
        truss(rig, (ax, ay, fz), (bx, by, fz), M["black"], size=0.22)
    # moving heads (beams are animated in the web viewer from the same positions)
    for x, y, zz in c.L["movingHeads"]:
        rig.box(x - 0.17, x + 0.17, y - 0.17, y + 0.17, zz, zz + 0.12, M["black"])
        rig.box(x - 0.17, x - 0.13, y - 0.05, y + 0.05, zz - 0.32, zz, M["black"])
        rig.box(x + 0.13, x + 0.17, y - 0.05, y + 0.05, zz - 0.32, zz, M["black"])
        rig.cylinder(x, y, zz - 0.42, zz - 0.06, 0.12, M["black"], sides=12, cap_bottom=False)
        c.fx_strips.cylinder(x, y, zz - 0.43, zz - 0.42, 0.095, M["lens"], sides=12, cap_top=False,
                             cap_bottom=True)  # fmt: skip
    # line-array speakers either side of the stage
    for sx in (-6.3, 6.3):
        for i in range(8):
            tilt = math.radians(2.5 * i)
            m = Matrix.Translation((sx, 8.1, 7.35 - i * 0.31)) @ Matrix.Rotation(tilt, 4, "X")
            rig.box(-0.48, 0.48, -0.28, 0.28, -0.14, 0.14, M["black"], matrix=m)
        rig.box(sx - 0.006, sx + 0.006, 8.1 - 0.006, 8.1 + 0.006, 7.5, c.ceil, M["black"])
    # black diamond panels on the green wall
    x = c.L["building"]["minX"] + 0.04
    for y, zc, s in ((-6.2, 5.6, 1.2), (2.6, 6.1, 1.0), (-1.6, 4.4, 0.7)):
        rig.face([(x, y, zc - s), (x, y + s, zc), (x, y, zc + s), (x, y - s, zc)], M["black"])


def fx_mesh(name, verts, faces, uv0, data_uv, mats, mat_idx, coll, smooth=True) -> bpy.types.Object:
    me = bpy.data.meshes.get(name)
    if me is not None:
        bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    l0 = me.uv_layers.new(name="UVMap")
    l1 = me.uv_layers.new(name="data")
    for poly in me.polygons:
        poly.use_smooth = smooth
        poly.material_index = mat_idx[poly.index]
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            l0.data[li].uv = uv0[vi]
            l1.data[li].uv = data_uv[vi]
    for m in mats:
        me.materials.append(m)
    obj = bpy.data.objects.new(name, me)
    coll.objects.link(obj)
    return obj


def build_led_rain(c: Ctx) -> None:
    """Hanging LED tubes over the bar — Naho's signature. UV0.y = 0 top -> 1 bottom,
    UV1 ('data') = (phase, speed) per tube for the web shader."""
    lr = c.L["ledRain"]
    rng = v3.seeded(7)
    (x0, x1), (y0, y1), sp = lr["x"], lr["y"], lr["spacing"]
    lmin, lmax = lr["length"]
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    verts, faces, uv0, data = [], [], [], []
    s = 0.017
    nx, ny = int((x1 - x0) / sp), int((y1 - y0) / sp)
    for i in range(nx):
        for j in range(ny):
            x = x0 + sp / 2 + i * sp + rng.uniform(-0.04, 0.04)
            y = y0 + sp / 2 + j * sp + rng.uniform(-0.04, 0.04)
            ex, ey = (x - cx) / ((x1 - x0) / 2), (y - cy) / ((y1 - y0) / 2)
            envelope = max(0.3, 1 - 0.65 * (ex * ex + ey * ey))
            wave = 0.5 + 0.5 * math.sin(i * 0.55 + j * 0.31)
            length = lmin + (lmax - lmin) * envelope * (0.35 + 0.4 * wave + 0.25 * rng.random())
            zt, zb = lr["z"], lr["z"] - length
            base = len(verts)
            corners = [(x - s, y - s), (x + s, y - s), (x + s, y + s), (x - s, y + s)]
            verts += [(qx, qy, zt) for qx, qy in corners] + [(qx, qy, zb) for qx, qy in corners]
            for k in range(4):
                kk = (k + 1) % 4
                faces.append((base + 4 + k, base + 4 + kk, base + kk, base + k))
            phase, speed = rng.random(), rng.uniform(0.7, 1.3)
            uv0 += [(k % 2, 0.0) for k in range(4)] + [(k % 2, 1.0) for k in range(4)]
            data += [(phase, speed)] * 8
    fx_mesh("fx_ledrain", verts, faces, uv0, data, [c.M["led_pink"]], [0] * len(faces), c.C["FX"], smooth=False)


# Opal globes hung around the LED rain like in the club: arcs on both sides of the dance floor,
# a cluster in front of the stage, a few towards the south stairs. (x, y, z, radius), metres.
GLOBES = [
    # west arc, between the vegetal lounge and the dance floor
    (-5.3, -9.6, 5.3, 0.42), (-3.7, -7.4, 6.4, 0.34), (-5.6, -5.0, 5.8, 0.48), (-3.5, -2.6, 5.0, 0.38),
    (-5.2, -0.2, 6.6, 0.36), (-3.9, 2.3, 5.5, 0.46), (-5.6, 4.6, 6.2, 0.40),
    # east arc, at eye level for the VIP east balcony
    (6.6, -10.0, 5.9, 0.40), (7.6, -7.6, 5.2, 0.46), (6.3, -5.2, 6.5, 0.36), (7.5, -2.8, 5.6, 0.42),
    (6.5, -0.4, 6.1, 0.48), (7.4, 2.2, 5.3, 0.36),
    # in front of the stage
    (-1.6, 4.4, 6.9, 0.44), (0.9, 5.6, 6.0, 0.36), (3.3, 4.6, 6.7, 0.50), (5.6, 5.9, 5.7, 0.38),
    (-0.2, 5.2, 7.1, 0.32),
    # towards the south stairs
    (-1.2, -10.6, 6.3, 0.38), (1.4, -10.2, 5.6, 0.44), (3.8, -10.7, 6.2, 0.36),
    # accents near the entrance and the prestige corner
    (-7.6, -10.6, 6.6, 0.50), (7.0, 8.4, 6.4, 0.46),
]  # fmt: skip


def build_spheres(c: Ctx) -> None:
    """Glowing globes. UV1 ('data') = (phase, colour slot) for the web shader."""
    M = c.M
    rng = v3.seeded(17)
    pts = list(GLOBES)
    tmp = bmesh.new()
    bmesh.ops.create_icosphere(tmp, subdivisions=3, radius=1.0)
    tv = [v.co.copy() for v in tmp.verts]
    tf = [[v.index for v in f.verts] for f in tmp.faces]
    tmp.free()
    mats = [M["sphere_white"], M["sphere_pink"], M["sphere_blue"]]
    verts, faces, uv0, data, idx = [], [], [], [], []
    for x, y, z, r in pts:
        slot = rng.choices([0, 1, 2], weights=[0.5, 0.25, 0.25])[0]
        phase = rng.random()
        base = len(verts)
        verts += [(x + v.x * r, y + v.y * r, z + v.z * r) for v in tv]
        faces += [tuple(base + i for i in f) for f in tf]
        idx += [slot] * len(tf)
        uv0 += [(0.5 + v.x * 0.5, 0.5 + v.z * 0.5) for v in tv]
        data += [(phase, slot / 2)] * len(tv)
        c.rig.box(x - 0.006, x + 0.006, y - 0.006, y + 0.006, z + r, c.ceil, M["black"])
    fx_mesh("fx_spheres", verts, faces, uv0, data, mats, idx, c.C["FX"], smooth=True)


def build_signs(c: Ctx) -> None:
    M = c.M
    xw = c.L["building"]["maxX"] - 0.04
    # the club's name in neon tubes over the lounge wall, 1.5 m tall
    naho_wordmark(c.signs, M["neon_white"], 1.5, 0.032, frame((xw - 0.02, -3.4, 6.4), (0, -1, 0), (0, 0, 1)))
    e = c.L["entrance"]
    to_world = frame((sum(e["x"]) / 2, e["y"] + 0.02, 2.95), (-1, 0, 0), (0, 0, 1))
    c.signs.text("ENTRÉE", M["neon_white"], 0.22, to_world, 0.01, font=FONT_MEDIUM, spacing=1.2)


# --------------------------------------------------------------------------- furniture


def bottle(mb: MeshBuilder, x: float, y: float, z: float, mat, M: dict, m: Matrix, body: float = 0.26) -> None:
    """Bottle with shoulder, neck and gold foil (local booth frame)."""
    mb.cylinder(x, y, z, z + body, 0.04, mat, sides=12, cap_top=False, matrix=m)
    mb.cylinder(x, y, z + body, z + body + 0.07, 0.04, mat, sides=12, cap_top=False, matrix=m, radius_top=0.016)
    mb.cylinder(x, y, z + body + 0.07, z + body + 0.12, 0.016, mat, sides=10, cap_top=False, matrix=m)
    mb.cylinder(x, y, z + body + 0.1, z + body + 0.155, 0.018, M["gold"], sides=10, matrix=m)


def booth(mb: MeshBuilder, c: Ctx, t: dict, f: dict, z: float, glass: MeshBuilder) -> None:
    """U-shaped booth around a low table, guests facing local +X (``facing``)."""
    M, kind = c.M, t["kind"]
    W, D, sd = f["width"], f["depth"], f["seatDepth"]
    velvet = M[f"velvet_{kind}"]
    m = v3.facing_matrix(t["x"], t["y"], z, t["facing"])
    back_t, base_h, seat_h = 0.2, 0.1, 0.44
    back_h = 0.86 if kind == "lounge" else 0.94
    xb, xf = -D / 2, D / 2

    # plinths
    mb.box(xb, xb + sd, -W / 2, W / 2, 0, base_h, M["leather"], skip=("-z",), matrix=m)
    for s in (-1, 1):
        ya, yb = sorted((s * (W / 2 - sd), s * W / 2))
        mb.box(xb + sd, xf, ya, yb, 0, base_h, M["leather"], skip=("-z",), matrix=m)
    # backrests
    mb.soft_box(xb, xb + back_t, -W / 2, W / 2, base_h, back_h, velvet, bevel=0.05, matrix=m)
    for s in (-1, 1):
        ya, yb = sorted((s * (W / 2 - back_t), s * W / 2))
        mb.soft_box(xb + back_t, xf, ya, yb, base_h, back_h - 0.1, velvet, bevel=0.05, matrix=m)
    # seat cushions (back row)
    span = W - 2 * back_t
    n = max(2, round(span / 0.7))
    for i in range(n):
        ya = -W / 2 + back_t + span * i / n + 0.008
        yb = -W / 2 + back_t + span * (i + 1) / n - 0.008
        mb.soft_box(xb + back_t + 0.01, xb + sd, ya, yb, base_h, seat_h, velvet, bevel=0.06, matrix=m)
    # seat cushions (returns)
    depth = xf - (xb + sd)
    nr = max(1, round(depth / 0.65))
    for s in (-1, 1):
        ya, yb = sorted((s * (W / 2 - sd), s * (W / 2 - back_t)))
        for i in range(nr):
            xa = xb + sd + depth * i / nr + 0.008
            xz = xb + sd + depth * (i + 1) / nr - 0.008
            mb.soft_box(xa, xz, ya + 0.01, yb, base_h, seat_h, velvet, bevel=0.06, matrix=m)
    # table(s)
    td = {"lounge": 0.62, "vip": 0.72, "prestige": 0.85}[kind]
    tw = W - 2 * sd - 0.42
    tx = xb + sd + 0.28 + td / 2
    tables = [(0.0, tw)] if kind != "prestige" else [(-tw / 4 - 0.03, tw / 2 - 0.06), (tw / 4 + 0.03, tw / 2 - 0.06)]
    c.table_points[t["id"]] = m @ Vector((tx, 0.0, 0.41))
    for ty, w in tables:
        mb.box(tx - td / 2 + 0.08, tx + td / 2 - 0.08, ty - w / 2 + 0.08, ty + w / 2 - 0.08, 0, 0.34, M["black"],
               skip=("-z",), matrix=m)  # fmt: skip
        mb.box(tx - td / 2 - 0.012, tx + td / 2 + 0.012, ty - w / 2 - 0.012, ty + w / 2 + 0.012, 0.34, 0.37,
               M["gold"], matrix=m)  # fmt: skip
        mb.box(tx - td / 2, tx + td / 2, ty - w / 2, ty + w / 2, 0.37, 0.41, M["stone"], skip=("-z",), matrix=m)
        lx, ly = tx + td / 2 - 0.1, ty + w / 2 - 0.12
        mb.cylinder(lx, ly, 0.41, 0.53, 0.045, M["lamp"], sides=10, matrix=m)
        c.lamp_points.append(m @ Vector((lx, ly, 0.75)))
        if kind != "lounge":
            # champagne bucket with two bottles, and a bottle served on the table
            mb.cylinder(tx - 0.08, ty, 0.41, 0.6, 0.11, M["gold"], sides=18, matrix=m)
            bottle(mb, tx - 0.11, ty + 0.035, 0.47, M["black"], M, m)
            bottle(mb, tx - 0.05, ty - 0.04, 0.45, M["bottle_green"], M, m)
            bottle(mb, tx + 0.16, ty - w / 4, 0.41, M["bottle_clear"], M, m, body=0.24)
    if kind == "prestige":
        for s in (-1, 1):
            mb.cylinder(xf + 0.4, s * 0.85, 0.0, 0.42, 0.27, velvet, sides=20, matrix=m)
            g = [m @ Vector(p) for p in ((xb, s * (W / 2 + 0.06), 0.1), (xf, s * (W / 2 + 0.06), 0.1),
                                          (xf, s * (W / 2 + 0.06), 1.7), (xb, s * (W / 2 + 0.06), 1.7))]  # fmt: skip
            glass.face([tuple(p) for p in g], M["glass"])
            mb.box(xb, xf, s * (W / 2 + 0.06) - 0.025, s * (W / 2 + 0.06) + 0.025, 1.7, 1.75, M["gold"], matrix=m)


def build_furniture(c: Ctx) -> None:
    F = c.L["furniture"]
    for t in c.L["tables"]:
        level = c.zones[t["zone"]]["level"]
        booth(c.furn[level], c, t, F[t["kind"]], c.level_z(level), c.lvl1_glass if level == 1 else c.glass)


def high_table(mb: MeshBuilder, c: Ctx, x: float, y: float, z: float, seed: int) -> None:
    M = c.M
    mb.cylinder(x, y, z, z + 0.03, 0.28, M["black"], sides=20, smooth=False)
    mb.cylinder(x, y, z + 0.03, z + 1.06, 0.035, M["black"], sides=10)
    mb.cylinder(x, y, z + 1.06, z + 1.09, 0.37, M["gold"], sides=24, smooth=False)
    mb.cylinder(x, y, z + 1.09, z + 1.12, 0.36, M["stone"], sides=24, smooth=False)
    rng = v3.seeded(seed)
    a0 = rng.uniform(0, math.tau)
    for k in range(3):
        a = a0 + k * math.tau / 3
        sx, sy = x + math.cos(a) * 0.62, y + math.sin(a) * 0.62
        mb.cylinder(sx, sy, z, z + 0.72, 0.03, M["black"], sides=8)
        mb.cylinder(sx, sy, z + 0.72, z + 0.8, 0.19, M["leather"], sides=16)


def plant(mb: MeshBuilder, c: Ctx, x: float, y: float, z: float, seed: int) -> None:
    M = c.M
    mb.cylinder(x, y, z, z + 0.72, 0.3, M["black"], sides=18)
    mb.cylinder(x, y, z + 0.72, z + 0.76, 0.32, M["gold"], sides=18, smooth=False)
    rng = v3.seeded(seed)
    for k in range(4):
        dx, dy = rng.uniform(-0.18, 0.18), rng.uniform(-0.18, 0.18)
        r = rng.uniform(0.32, 0.45)
        mb.blob((x + dx, y + dy, z + 0.95 + k * 0.32), (r, r, r * 1.2), M["foliage"], seed=seed * 10 + k)


def vip_bar(c: Ctx, spec: dict) -> None:
    M = c.M
    z = c.level_z(spec["level"])
    x0, x1 = spec["x"]
    y0, y1 = spec["y"]
    mb = c.furn[spec["level"]]
    mb.box(x0, x1, y0, y1, z, z + 1.05, M["concrete"], skip=("-z",))
    mb.box(x0 - 0.06, x1 + 0.06, y0 - 0.1, y1 + 0.02, z + 1.05, z + 1.11, M["stone"])
    wall_y = c.L["building"]["minY"]
    rng = v3.seeded(99)
    bottles = MeshBuilder("lvl1_fx_bottles")
    for zs in (z + 1.35, z + 1.8, z + 2.25):
        c.lvl1_fx_strips.box(x0, x1, wall_y + 0.02, wall_y + 0.24, zs - 0.025, zs, M["led_amber"])
        xx = x0 + 0.15
        while xx < x1 - 0.15:
            mat = rng.choice([M["bottle_amber"], M["bottle_green"], M["bottle_clear"]])
            bottles.cylinder(xx, wall_y + 0.12, zs, zs + rng.uniform(0.22, 0.32), 0.034, mat, sides=8)
            xx += rng.uniform(0.1, 0.16)
    bottles.finalize(c.C["LVL1"])
    c.lvl1_fx_strips.beam((x0, y1 + 0.03, z + 1.0), (x1, y1 + 0.03, z + 1.0), 0.02, 0.02, M["led_amber"])


def build_decor(c: Ctx) -> None:
    d = c.L["decor"]
    vip_bar(c, d["vipBar"])
    for i, h in enumerate(d["highTables"]):
        high_table(c.furn[h["level"]], c, h["x"], h["y"], c.level_z(h["level"]), 200 + i)
    for i, p in enumerate(d["plants"]):
        plant(c.furn[p["level"]], c, p["x"], p["y"], c.level_z(p["level"]), 300 + i)
    c.furn[0].finalize(c.C["FURNITURE"], lightmap=2048)
    c.furn[1].finalize(c.C["FURNITURE"], lightmap=2048)


# --------------------------------------------------------------------------- lights & render


def build_lights(c: Ctx) -> None:
    coll, mz, under, ch = c.C["LIGHTS_BAKE"], c.mz, c.under, c.ceil

    def spot(name, pos, target, energy, color, size_deg=70.0, blend=0.5, radius=0.05):
        rot = (Vector(target) - Vector(pos)).to_track_quat("-Z", "Y").to_euler()
        v3.add_light(coll, name, "SPOT", pos, energy, color, radius, rot, size_deg, blend)

    for i, p in enumerate(c.lamp_points):
        v3.add_light(coll, f"lamp_{i:02d}", "POINT", tuple(p), 18.0, WARM, 0.08)
    # pinspot per table: the tables are the product, they must read from afar
    for tid, p in c.table_points.items():
        zl = under - 0.05 if p.z < 1.0 and c.under_slab(p.x, p.y) else ch - 0.3
        dist = zl - p.z
        spot(f"pin_{tid}", (p.x, p.y, zl), tuple(p), 26.0 * dist * dist, (1.0, 0.82, 0.62), 34, 0.55)
    for i, y in enumerate((-14.5, -11.0, -7.5, -4.0, -0.5, 3.0, 6.5, 9.5)):
        spot(f"dl_lounge_{i}", (15.9, y, under - 0.05), (15.9, y, 0), 160.0, WARM, 85)
        spot(f"dl_edge_{i}", (10.6, y, under - 0.05), (10.6, y, 0), 90.0, (1.0, 0.55, 0.5), 85)
    for i, x in enumerate((-8.6, -5.4, -2.4)):
        spot(f"dl_lobby_{i}", (x, -14.4, under - 0.05), (x, -14.4, 0), 110.0, WARM, 85)
    for i in range(8):
        y = -10.2 + 2.7 * i
        spot(f"up_west_{i}", (-10.25, y, 1.0), (-10.5, y, 7.8), 420.0, FOLIAGE_LIGHT, 56, 0.75)
    for i in range(9):
        y = -16.0 + 3.1 * i
        spot(f"up_east_{i}", (17.15, y, mz + 0.1), (17.48, y, ch), 320.0, FOLIAGE_LIGHT, 52, 0.75)
    for i, x in enumerate((-3.6, 0.0, 3.6)):
        spot(f"wash_{i}", (x, 6.3, 7.3), (x * 0.3, 8.6, 1.6), 650.0, (1.0, 0.58, 0.24), 38, 0.4)
    for i, (x, y) in enumerate(((-4.5, -6.0), (-4.5, 3.5), (4.5, 4.5), (4.5, -9.5))):
        v3.add_light(coll, f"fill_hall_{i}", "AREA", (x, y, ch - 0.3), 1300.0, (0.45, 0.32, 1.0), 4.5)
    for i, (x, y) in enumerate(((-1.0, 14.0), (8.0, 14.0), (13.0, -1.0), (13.0, -10.0), (3.0, -21.0), (-6.0, -14.4))):
        v3.add_light(coll, f"fill_mezz_{i}", "AREA", (x, y, ch - 0.3), 850.0, (1.0, 0.52, 0.74), 5.0)


def setup_world() -> None:
    world = bpy.data.worlds.get("naho_world") or bpy.data.worlds.new("naho_world")
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs[0].default_value = (0.004, 0.003, 0.007, 1.0)
    bg.inputs[1].default_value = 1.0
    bpy.context.scene.world = world


def setup_render() -> None:
    scn = bpy.context.scene
    try:
        scn.render.engine = "CYCLES"
    except TypeError as exc:  # pragma: no cover - depends on the build
        print("engine:", exc)
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "OPTIX"
        prefs.get_devices()
        for dev in prefs.devices:
            dev.use = dev.type == "OPTIX"
        scn.cycles.device = "GPU"
    except (KeyError, TypeError):
        scn.cycles.device = "CPU"
    scn.cycles.samples = 96
    scn.cycles.use_denoising = True
    try:
        scn.view_settings.view_transform = "AgX"
    except TypeError:
        pass
    scn.render.resolution_x, scn.render.resolution_y = 1280, 720


def setup_preview_camera(c: Ctx) -> None:
    cam_data = bpy.data.cameras.get("preview_cam") or bpy.data.cameras.new("preview_cam")
    cam_data.lens = 30
    cam_data.clip_end = 400
    cam = bpy.data.objects.new("preview_cam", cam_data)
    c.C["PREVIEW"].objects.link(cam)
    ov = c.L["cameras"]["overview"]
    cam.location = ov["position"]
    cam.rotation_euler = (Vector(ov["target"]) - Vector(ov["position"])).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam


def clean_default_scene() -> None:
    if bpy.data.filepath not in ("", BLEND_PATH):
        return
    for name in ("Cube", "Light", "Camera"):
        obj = bpy.data.objects.get(name)
        if obj is not None and not any(col.name.startswith("NAHO") for col in obj.users_collection):
            bpy.data.objects.remove(obj, do_unlink=True)


# --------------------------------------------------------------------------- entry point


def build(save: bool = True) -> dict:
    layout = load_layout()
    clean_default_scene()
    root = v3.ensure_collection("NAHO")
    v3.purge_collection(root)
    names = ("ARCHI", "LVL1", "FURNITURE", "FX", "LIGHTS_BAKE", "PREVIEW")
    colls = {n: v3.ensure_collection(f"NAHO_{n}", root) for n in names}
    c = Ctx(layout, make_materials(), colls)

    build_ground(c)
    build_walls(c)
    build_mezzanine(c)
    build_railings(c)
    build_columns(c)
    build_stairs(c)
    build_bar(c)
    build_stage(c)
    build_wc(c)
    build_slats(c)
    build_rig(c)
    build_furniture(c)
    build_decor(c)
    build_led_rain(c)
    build_spheres(c)
    build_signs(c)

    c.fx_strips.finalize(colls["FX"])
    c.lvl1_fx_strips.finalize(colls["LVL1"])
    c.glass.finalize(colls["ARCHI"])
    c.lvl1_glass.finalize(colls["LVL1"])
    c.rig.finalize(colls["ARCHI"])
    c.signs.finalize(colls["FX"])

    build_lights(c)
    setup_world()
    setup_render()
    setup_preview_camera(c)
    colls["LIGHTS_BAKE"].hide_viewport = False

    stats = {}
    for coll in colls.values():
        for obj in coll.objects:
            if obj.type == "MESH":
                stats[obj.name] = {"tris": sum(len(p.vertices) - 2 for p in obj.data.polygons), "lm": obj.get("vyra_lm")}
    if save:
        os.makedirs(os.path.dirname(BLEND_PATH), exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
        bpy.ops.file.make_paths_relative()
        bpy.ops.wm.save_mainfile()
    return stats


if __name__ == "__main__":
    result = build(save="--no-save" not in sys.argv)
    print(json.dumps({"objects": len(result), "tris": sum(v["tris"] for v in result.values())}))
