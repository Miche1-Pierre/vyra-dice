"""Build any club's venue in Blender from its folder (VYR-64).

    clubs/<slug>/layout.json   plan shared with the web viewer (zones, tables, bar, stage…)
    clubs/<slug>/scene.json    everything else the scene needs: material palette, walls, signs,
                               rig, globes, decor, lights — data, never code

One builder for every club: the bricks below are generic, a club only differs by its data.
``scene.json`` lists elements in build order; numbers can be expressions over the plan's
named values (``"under - 0.05"``, ``"maxX - 0.04"``, ``"mz + 0.55"``, see ``Values``).

Headless:
    blender -b -P art/scripts/build_club.py -- --club <slug> [--no-save] [--previews]
Live Blender (MCP / Python console):
    import runpy, sys; sys.argv = ["", "--", "--club", "naho"]
    runpy.run_path(r"C:/vyra-dice/art/scripts/build_club.py", run_name="__main__")

Writes clubs/<slug>/build/<slug>.blend, its generated textures and build/report.json (objects,
triangles, lightmaps, budget checks); --previews also renders build/previews/*.png.
"""

from __future__ import annotations

import ast
import importlib
import json
import math
import os
import sys
import time

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import vyra3d as v3  # noqa: E402

importlib.reload(v3)
MeshBuilder = v3.MeshBuilder

COLLECTIONS = ("ARCHI", "LVL1", "FURNITURE", "FX", "LIGHTS_BAKE", "PREVIEW")
#: Mobile budget (docs/3d-pipeline.md): checked on every build.
BUDGET = {"triangles": 300_000, "objects": 100}


# --------------------------------------------------------------------------- values


class Values:
    """Named values of the plan, usable in scene.json expressions.

    Heights: ``mz`` (mezzanine floor), ``under`` (underside of its slab), ``ceil``, ``slab``,
    ``railing``, ``stage``. Building: ``minX maxX minY maxY``. Ground floor: ``gx0 gx1 gy0 gy1``.
    Rectangles: ``bar_x0 … bar_y1``, ``stage_*``, ``dj_*``, ``wc_*``, ``screen_x0 screen_x1
    screen_z0 screen_z1``, ``entrance_x0 entrance_x1 entrance_y``, ``ledrain_*`` and every named
    rectangle of ``void``, ``mezzanine`` and ``stairs`` (``mezzanine_loge_sw_y1``…). In a series,
    ``i`` is the index and ``v`` the current value.
    """

    #: Only numbers, names and arithmetic: scene.json is written by people and by an agent.
    ALLOWED = (ast.Expression, ast.BinOp, ast.UnaryOp, ast.Constant, ast.Name, ast.Load,
               ast.Add, ast.Sub, ast.Mult, ast.Div, ast.USub, ast.UAdd)  # fmt: skip

    def __init__(self, layout: dict):
        h, b = layout["heights"], layout["building"]
        v: dict[str, float] = {
            "mz": h["mezzanine"],
            "under": h["mezzanine"] - h["slab"],
            "ceil": h["ceiling"],
            "slab": h["slab"],
            "railing": h["railing"],
            "stage": h["stage"],
            "minX": b["minX"],
            "maxX": b["maxX"],
            "minY": b["minY"],
            "maxY": b["maxY"],
        }
        gf = layout["groundFloor"]
        v.update(gx0=gf["x"][0], gx1=gf["x"][1], gy0=gf["y"][0], gy1=gf["y"][1])

        def rect(prefix: str, r: dict) -> None:
            for axis in ("x", "y", "z"):
                if axis in r and isinstance(r[axis], list):
                    v[f"{prefix}_{axis}0"], v[f"{prefix}_{axis}1"] = r[axis]

        for key in ("bar", "stage", "dj", "wc", "screen"):
            if key in layout:
                rect(key, layout[key])
        if "ledRain" in layout:
            rect("ledrain", layout["ledRain"])
            v["ledrain_z"] = layout["ledRain"]["z"]
        if "entrance" in layout:
            e = layout["entrance"]
            v.update(entrance_x0=e["x"][0], entrance_x1=e["x"][1], entrance_y=e["y"])
        for group in ("void", "mezzanine", "stairs"):
            for r in layout.get(group, []):
                rect(f"{group}_{r['id'].replace('-', '_')}", r)
        self.vars = v

    def num(self, value, **local):
        if isinstance(value, bool):
            raise ValueError(f"Not a number or an expression: {value!r}")
        if isinstance(value, (int, float)):
            return value
        if not isinstance(value, str):
            raise ValueError(f"Not a number or an expression: {value!r}")
        try:
            tree = ast.parse(value, mode="eval")
        except SyntaxError:
            raise ValueError(f"Invalid expression: {value!r}") from None
        for node in ast.walk(tree):
            if not isinstance(node, self.ALLOWED) or (isinstance(node, ast.Constant) and not isinstance(node.value, (int, float))):
                raise ValueError(f"Only numbers, names and + - * / in expressions: {value!r}")
        names = {**self.vars, **local}
        for node in ast.walk(tree):
            if isinstance(node, ast.Name) and node.id not in names:
                raise ValueError(f"Unknown name '{node.id}' in {value!r}")
        return eval(compile(tree, "<scene.json>", "eval"), {"__builtins__": {}}, names)  # noqa: S307 - AST vetted

    def point(self, values, **local) -> tuple:
        return tuple(self.num(x, **local) for x in values)


# --------------------------------------------------------------------------- context


class Ctx:
    def __init__(self, slug: str, layout: dict, scene: dict, mats: dict, colls: dict):
        self.slug = slug
        self.L = layout
        self.S = scene
        self.M = mats
        self.C = colls
        self.V = Values(layout)
        h = layout["heights"]
        self.mz = h["mezzanine"]
        self.under = h["mezzanine"] - h["slab"]
        self.ceil = h["ceiling"]
        self.zones = {z["id"]: z for z in layout["zones"]}
        fonts = scene.get("fonts", {})
        self.fonts = {"medium": fonts.get("medium"), "bold": fonts.get("bold")}
        # shared builders: every element can add to them, they are finalized at the end
        self.shared = {
            "strips": MeshBuilder("fx_led_strips"),
            "strips1": MeshBuilder("lvl1_fx_strips"),
            "glass": MeshBuilder("glass"),
            "glass1": MeshBuilder("lvl1_glass"),
            "rig": MeshBuilder("rig"),
            "signs": MeshBuilder("fx_signs"),
            "furn0": MeshBuilder("furniture"),
            "furn1": MeshBuilder("lvl1_furniture"),
        }
        self.lamp_points: list[Vector] = []
        self.table_points: dict[str, Vector] = {}

    def level_z(self, level: int) -> float:
        return self.mz if level == 1 else 0.0

    def furn(self, level: int) -> MeshBuilder:
        return self.shared["furn1" if level == 1 else "furn0"]

    def under_slab(self, x: float, y: float) -> bool:
        return any(r["x"][0] < x < r["x"][1] and r["y"][0] < y < r["y"][1] for r in self.L["mezzanine"])

    def mat(self, role: str):
        if role not in self.M:
            raise KeyError(f"scene.json: no material '{role}'")
        return self.M[role]


def frame(origin, xaxis, yaxis) -> Matrix:
    """Matrix whose local X/Y map to the given world axes (Z = X x Y)."""
    x, y = Vector(xaxis).normalized(), Vector(yaxis).normalized()
    z = x.cross(y)
    m = Matrix((x, y, z)).transposed().to_4x4()
    m.translation = Vector(origin)
    return m


def placement(c: Ctx, el: dict) -> Matrix:
    """`at` + local axes `x`, `y` (defaults: text reads along +x, upright)."""
    return frame(c.V.point(el["at"]), el.get("x", (1, 0, 0)), el.get("y", (0, 0, 1)))


# --------------------------------------------------------------------------- materials


TEXTURES = {"tiles": v3.tex_tiles, "concrete": v3.tex_concrete, "wood": v3.tex_wood, "foliage": v3.tex_foliage}


def make_materials(scene: dict, tex_dir: str) -> dict:
    """Palette of the club: role -> Blender material. Roles are what the bricks ask for
    (``wall``, ``black``, ``gold``, ``velvet_vip``, ``led_pink``…); names are the club's."""
    mats = {}
    for role, spec in scene["materials"].items():
        kw = {k: spec[k] for k in ("roughness", "metallic", "alpha", "emission", "strength") if k in spec}
        tex = spec.get("texture")
        if tex:
            pixels = TEXTURES[tex["kind"]](tex["size"])
            kw["image"] = v3.save_png(pixels, os.path.join(tex_dir, f"{tex['kind']}.png"), spec["name"])
            kw["uv_scale"] = spec.get("uvScale", 1.0)
            mats[role] = v3.material(spec["name"], **kw)
        else:
            mats[role] = v3.material(spec["name"], spec["color"], **kw)
    return mats


# --------------------------------------------------------------------------- generic meshes

#: Primitive operations of a ``mesh`` element: argument kinds (n number, m material role,
#: i integer, p point, P list of points), then optional keyword arguments.
OPS = {
    "floor": "nnnnnm",
    "wall_x": "nnnnnmi",
    "wall_y": "nnnnnmi",
    "box": "nnnnnnm",
    "face": "Pm",
    "beam": "ppnnm",
    "cylinder": "nnnnnm",
}


def run_op(c: Ctx, mb: MeshBuilder, op: list) -> None:
    name, args = op[0], list(op[1:])
    kwargs = args.pop() if args and isinstance(args[-1], dict) else {}
    kinds = OPS[name]
    if len(args) != len(kinds):
        raise ValueError(f"{name}: expected {len(kinds)} arguments, got {args}")
    values = []
    for kind, a in zip(kinds, args):
        if kind == "n":
            values.append(c.V.num(a))
        elif kind == "i":
            values.append(int(a))
        elif kind == "m":
            values.append(c.mat(a))
        elif kind == "p":
            values.append(c.V.point(a))
        else:
            values.append([c.V.point(p) for p in a])
    if "skip" in kwargs:
        kwargs = {**kwargs, "skip": tuple(kwargs["skip"])}
    getattr(mb, name)(*values, **kwargs)


def el_mesh(c: Ctx, el: dict) -> None:
    """An object made of primitive operations (walls, floors, ceilings, small builds)."""
    mb = c.shared[el["into"]] if "into" in el else MeshBuilder(el["object"])
    for op in el["ops"]:
        run_op(c, mb, op)
    if "into" not in el:
        mb.finalize(c.C[el.get("collection", "ARCHI")], lightmap=el.get("lightmap"))


# --------------------------------------------------------------------------- architecture


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


def el_mezzanine(c: Ctx, el: dict) -> None:
    """Mezzanine slabs of the plan: floor, underside, edge fascias facing the void with an LED
    line under each, plus extra operations (bulkheads…)."""
    b = c.L["building"]
    rects = [(r["x"][0], r["x"][1], r["y"][0], r["y"][1]) for r in c.L["mezzanine"]]

    def solid(px: float, py: float) -> bool:
        if px <= b["minX"] or px >= b["maxX"] or py <= b["minY"] or py >= b["maxY"]:
            return True
        return any(x0 < px < x1 and y0 < py < y1 for x0, x1, y0, y1 in rects)

    slab = MeshBuilder(el.get("object", "lvl1_slabs"))
    led = c.shared["strips1"]
    top, bottom, edge, led_mat = (c.mat(el[k]) for k in ("top", "bottom", "edge", "led"))
    mz, under = c.mz, c.under
    for x0, x1, y0, y1 in rects:
        slab.floor(x0, x1, y0, y1, mz, top)
        slab.floor(x0, x1, y0, y1, under, bottom, up=False)
        for axis, k, a0, a1, n in (("y", y0, x0, x1, -1), ("y", y1, x0, x1, +1),
                                   ("x", x0, y0, y1, -1), ("x", x1, y0, y1, +1)):  # fmt: skip
            for s0, s1 in exposed_spans(axis, k, a0, a1, n, solid):
                if axis == "y":
                    slab.wall_y(k, s0, s1, under, mz, edge, n)
                    led.box(s0, s1, k, k + n * 0.035, under - 0.035, under, led_mat)
                else:
                    slab.wall_x(k, s0, s1, under, mz, edge, n)
                    led.box(k, k + n * 0.035, s0, s1, under - 0.035, under, led_mat)
    for op in el.get("ops", []):
        run_op(c, slab, op)
    slab.finalize(c.C["LVL1"], lightmap=el.get("lightmap", 2048))


def rail(metal: MeshBuilder, glass: MeshBuilder, p0, p1, height: float, metal_mat, glass_mat,
         step: float = 1.5) -> None:  # fmt: skip
    a, b = Vector(p0), Vector(p1)
    d = b - a
    n = max(1, math.ceil(d.length / step))
    for i in range(n + 1):
        p = a + d * (i / n)
        metal.box(p.x - 0.022, p.x + 0.022, p.y - 0.022, p.y + 0.022, p.z, p.z + height, metal_mat)
    up = Vector((0, 0, height))
    metal.beam(a + up, b + up, 0.06, 0.05, metal_mat)
    g0, g1 = a + Vector((0, 0, 0.08)), b + Vector((0, 0, 0.08))
    g2, g3 = b + Vector((0, 0, height - 0.06)), a + Vector((0, 0, height - 0.06))
    glass.face([tuple(g0), tuple(g1), tuple(g2), tuple(g3)], glass_mat)


def el_railings(c: Ctx, el: dict) -> None:
    """Glass balustrades of the plan's railings, on the mezzanine."""
    metal = MeshBuilder(el.get("object", "lvl1_railing"))
    h = c.L["heights"]["railing"]
    for seg in c.L["railings"]:
        (ax, ay), (bx, by) = seg["from"], seg["to"]
        rail(metal, c.shared["glass1"], (ax, ay, c.mz), (bx, by, c.mz), h, c.mat(el["metal"]), c.mat(el["glass"]))
    metal.finalize(c.C["LVL1"])


def el_columns(c: Ctx, el: dict) -> None:
    mb = MeshBuilder(el.get("object", "columns"))
    s, mat = el.get("half", 0.17), c.mat(el["material"])
    for x, y in c.L["columns"]:
        mb.box(x - s, x + s, y - s, y + s, 0, c.under, mat, skip=("-z", "+z"))
    mb.finalize(c.C["ARCHI"], lightmap=el.get("lightmap", 512))


def el_stairs(c: Ctx, el: dict) -> None:
    """Straight flights of the plan, an LED nosing per step and glass handrails."""
    mat = c.mat(el["material"])
    metal, glass = c.mat(el["rail"]["metal"]), c.mat(el["rail"]["glass"])
    rail_metal, rail_glass = c.shared[el["rail"].get("into", "rig")], c.shared[el["rail"].get("glassInto", "glass")]
    mb = MeshBuilder(el.get("object", "stairs"))
    strips = c.shared["strips"]
    h = c.L["heights"]["railing"]
    for s in c.L["stairs"]:
        led = c.mat(el["led"][s["id"]])
        n = s["steps"]
        rise = c.mz / n
        x0, x1 = s["x"]
        y0, y1 = s["y"]
        if s["bottom"] == "south":  # climbs towards +y
            run = (y1 - y0) / n
            for i in range(n):
                z, a, bb = (i + 1) * rise, y0 + i * run, y0 + (i + 1) * run
                mb.floor(x0, x1, a, bb, z, mat)
                mb.wall_y(a, x0, x1, z - rise, z, mat, -1)
                mb.wall_x(x1, a, bb, 0, z, mat, +1)
                strips.box(x0 + 0.06, x1 - 0.06, a - 0.012, a + 0.012, z - 0.035, z - 0.012, led)
            rail(rail_metal, rail_glass, (x1 - 0.04, y0, 0.0), (x1 - 0.04, y1, c.mz), h, metal, glass)
        elif s["bottom"] == "west":  # climbs towards +x
            run = (x1 - x0) / n
            for i in range(n):
                z, a, bb = (i + 1) * rise, x0 + i * run, x0 + (i + 1) * run
                mb.floor(a, bb, y0, y1, z, mat)
                mb.wall_x(a, y0, y1, z - rise, z, mat, -1)
                mb.wall_y(y0, a, bb, 0, z, mat, -1)
                mb.wall_y(y1, a, bb, 0, z, mat, +1)
                strips.box(a - 0.012, a + 0.012, y0 + 0.06, y1 - 0.06, z - 0.035, z - 0.012, led)
            for yy in (y0 + 0.04, y1 - 0.04):
                rail(rail_metal, rail_glass, (x0, yy, 0.0), (x1, yy, c.mz), h, metal, glass)
        else:
            raise ValueError(f"stairs {s['id']}: bottom '{s['bottom']}' not supported yet (south, west)")
    mb.finalize(c.C["ARCHI"], lightmap=el.get("lightmap", 1024))


# --------------------------------------------------------------------------- bar & stage


def el_bar(c: Ctx, el: dict) -> None:
    """Island bar of the plan: chamfered counter, stone top, back-bar island with lit bottle
    shelves, glow lines; optional emblems on the long faces."""
    M = {k: c.mat(r) for k, r in el["materials"].items()}
    bar = c.L["bar"]
    x0, x1 = bar["x"]
    y0, y1 = bar["y"]
    ch, h, d = bar["chamfer"], bar["height"], 0.75
    outer = v3.chamfered_rect(x0, x1, y0, y1, ch)
    inner = v3.chamfered_rect(x0 + d, x1 - d, y0 + d, y1 - d, max(0.25, ch - 0.31))
    kick = v3.chamfered_rect(x0 + 0.06, x1 - 0.06, y0 + 0.06, y1 - 0.06, ch - 0.025)
    top_o = v3.chamfered_rect(x0 - 0.08, x1 + 0.08, y0 - 0.08, y1 + 0.08, ch + 0.033)
    top_i = v3.chamfered_rect(x0 + d + 0.06, x1 - d - 0.06, y0 + d + 0.06, y1 - d - 0.06, max(0.2, ch - 0.33))

    mb = MeshBuilder(el.get("object", "bar"))
    mb.prism(kick, 0.0, 0.09, M["base"], top=False)
    mb.prism(outer, 0.09, h - 0.06, M["body"], top=False)
    mb.prism(top_o, h - 0.06, h, M["top"], top=False)
    mb.ring(top_o, top_i, h, M["top"])
    mb.prism(list(reversed(top_i)), h - 0.06, h, M["top"], top=False)
    mb.prism(list(reversed(inner)), 0.0, h - 0.06, M["base"], top=False)
    emblems = el.get("emblems")
    if emblems:
        # concentric rings on the long faces (stand-ins for the club's logo)
        yc = (y0 + y1) / 2
        r, z = emblems["radius"], emblems["z"]
        for off in emblems["offsets"]:
            yy = yc + off
            for xx, sgn in ((x0, -1), (x1, +1)):
                m = Matrix.Translation((xx + sgn * 0.004, yy, z)) @ Matrix.Rotation(math.radians(90 * sgn), 4, "Y")
                ring_o = [(math.cos(a) * r, math.sin(a) * r) for a in (k * math.tau / 40 for k in range(40))]
                ring_i = [(x * 0.86, y * 0.86) for x, y in ring_o]
                for poly_o, poly_i in ((ring_o, ring_i), ([(x * 0.42, y * 0.42) for x, y in ring_o],
                                                           [(x * 0.3, y * 0.3) for x, y in ring_o])):  # fmt: skip
                    for k in range(40):
                        kk = (k + 1) % 40
                        quad = [(poly_o[k][0], poly_o[k][1], 0), (poly_o[kk][0], poly_o[kk][1], 0),
                                (poly_i[kk][0], poly_i[kk][1], 0), (poly_i[k][0], poly_i[k][1], 0)]  # fmt: skip
                        c.shared["signs"].face([tuple(m @ Vector(p)) for p in quad], c.mat(emblems["material"]))
    # back-bar island with glowing shelves
    bx0, bx1 = (x0 + x1) / 2 - 0.55, (x0 + x1) / 2 + 0.55
    by0, by1 = y0 + d + 0.9, y1 - d - 0.9
    mb.box(bx0, bx1, by0, by1, 0, 2.15, M["body"], skip=("-z",))
    mb.finalize(c.C["ARCHI"], lightmap=el.get("lightmap", 1024))

    rng = v3.seeded(el.get("seed", 3))
    bottles = MeshBuilder("fx_bottles")
    strips = c.shared["strips"]
    kinds = [c.mat(r) for r in el["bottles"]]
    for side, xs in ((-1, bx0), (+1, bx1)):
        for zs in (1.15, 1.55, 1.95):
            strips.box(xs, xs + side * 0.2, by0 + 0.1, by1 - 0.1, zs - 0.025, zs, M["shelf"])
            y = by0 + 0.2
            while y < by1 - 0.2:
                mat = rng.choice(kinds)
                bottles.cylinder(xs + side * 0.1, y, zs, zs + rng.uniform(0.22, 0.32), 0.034, mat, sides=8)
                y += rng.uniform(0.1, 0.15)
    bottles.finalize(c.C["FX"])
    # glow lines: under the counter overhang and along the toe-kick
    glow_top = v3.chamfered_rect(x0 - 0.03, x1 + 0.03, y0 - 0.03, y1 + 0.03, ch + 0.012)
    glow_kick = v3.chamfered_rect(x0 + 0.03, x1 - 0.03, y0 + 0.03, y1 - 0.03, ch - 0.012)
    for poly, z, mat in ((glow_top, h - 0.075, M["glowTop"]), (glow_kick, 0.05, M["glowKick"])):
        for i in range(len(poly)):
            (ax, ay), (bx, by) = poly[i], poly[(i + 1) % len(poly)]
            strips.beam((ax, ay, z), (bx, by, z), 0.02, 0.02, mat)


def el_stage(c: Ctx, el: dict) -> None:
    """Stage, DJ booth with its gear, LED fronts and the LED wall (``fx_screen``)."""
    M = {k: c.mat(r) for k, r in el["materials"].items()}
    st, dj, sc = c.L["stage"], c.L["dj"], c.L["screen"]
    sh = c.L["heights"]["stage"]
    x0, x1 = st["x"]
    y0, y1 = st["y"]
    dx0, dx1 = dj["x"]
    dy0, dy1 = dj["y"]
    mb = MeshBuilder(el.get("object", "stage"))
    mb.box(x0, x1, y0, y1, 0, sh, M["deck"], skip=("-z", "+y"))
    mb.box(dx0, dx1, dy0, dy1, sh, sh + 1.12, M["booth"], skip=("-z",))
    mb.box(dx0 - 0.05, dx1 + 0.05, dy0 - 0.05, dy1 + 0.05, sh + 1.12, sh + 1.16, M["top"])
    gear = el["gear"]
    for i, w in enumerate(gear["widths"]):
        cx = gear["x0"] + i * gear["step"]
        mb.box(cx - w / 2, cx + w / 2, dy0 + 0.2, dy0 + 0.62, sh + 1.16, sh + 1.24, M["booth"])
    mb.finalize(c.C["ARCHI"], lightmap=el.get("lightmap", 1024))

    strips = c.shared["strips"]
    strips.wall_y(dy0 - 0.012, dx0 + 0.1, dx1 - 0.1, sh + 0.12, sh + 1.0, M["boothLed"], -1)
    strips.box(x0, x1, y0 - 0.025, y0, sh - 0.045, sh - 0.012, M["edgeLed"])

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


def el_slats(c: Ctx, el: dict) -> None:
    """Horizontal slats along the east wall of a zone, backlit."""
    zone = c.zones[el["zone"]]
    ya, yb = zone["y"]
    xw = c.L["building"]["maxX"]
    mb = MeshBuilder(el.get("object", "slats"))
    mat = c.mat(el["material"])
    z = 0.95
    while z < c.under - 0.3:
        mb.box(xw - 0.14, xw - 0.06, ya, yb, z, z + 0.07, mat, skip=("+x",))
        z += 0.17
    mb.finalize(c.C["ARCHI"], lightmap=el.get("lightmap", 1024))
    c.shared["strips"].wall_x(xw - 0.02, ya, yb, 0.9, c.under - 0.3, c.mat(el["glow"]), -1)


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


def el_trusses(c: Ctx, el: dict) -> None:
    """Box trusses between pairs of points."""
    mb, mat = c.shared[el.get("into", "rig")], c.mat(el["material"])
    for p0, p1 in el["segments"]:
        truss(mb, c.V.point(p0), c.V.point(p1), mat, size=el.get("size", 0.3))


def el_led_rain_frame(c: Ctx, el: dict) -> None:
    """Truss frame holding the LED rain (``layout.ledRain``)."""
    mb, mat = c.shared[el.get("into", "rig")], c.mat(el["material"])
    lr = c.L["ledRain"]
    fz = lr["z"] + el.get("lift", 0.18)
    corners = [(lr["x"][0], lr["y"][0]), (lr["x"][1], lr["y"][0]), (lr["x"][1], lr["y"][1]), (lr["x"][0], lr["y"][1])]
    for i in range(4):
        (ax, ay), (bx, by) = corners[i], corners[(i + 1) % 4]
        truss(mb, (ax, ay, fz), (bx, by, fz), mat, size=el.get("size", 0.22))


def el_moving_heads(c: Ctx, el: dict) -> None:
    """Moving-head fixtures at ``layout.movingHeads`` (the web animates their beams)."""
    rig, mat, lens = c.shared[el.get("into", "rig")], c.mat(el["material"]), c.mat(el["lens"])
    strips = c.shared["strips"]
    for x, y, zz in c.L["movingHeads"]:
        rig.box(x - 0.17, x + 0.17, y - 0.17, y + 0.17, zz, zz + 0.12, mat)
        rig.box(x - 0.17, x - 0.13, y - 0.05, y + 0.05, zz - 0.32, zz, mat)
        rig.box(x + 0.13, x + 0.17, y - 0.05, y + 0.05, zz - 0.32, zz, mat)
        rig.cylinder(x, y, zz - 0.42, zz - 0.06, 0.12, mat, sides=12, cap_bottom=False)
        strips.cylinder(x, y, zz - 0.43, zz - 0.42, 0.095, lens, sides=12, cap_top=False, cap_bottom=True)


def el_speakers(c: Ctx, el: dict) -> None:
    """Hanging line arrays: ``count`` cabinets curving down from ``top``."""
    rig, mat = c.shared[el.get("into", "rig")], c.mat(el["material"])
    for item in el["items"]:
        sx, sy = c.V.num(item["x"]), c.V.num(item["y"])
        for i in range(el.get("count", 8)):
            tilt = math.radians(el.get("tilt", 2.5) * i)
            m = Matrix.Translation((sx, sy, el.get("top", 7.35) - i * el.get("step", 0.31))) @ Matrix.Rotation(tilt, 4, "X")
            rig.box(-0.48, 0.48, -0.28, 0.28, -0.14, 0.14, mat, matrix=m)
        rig.box(sx - 0.006, sx + 0.006, sy - 0.006, sy + 0.006, el.get("hang", 7.5), c.ceil, mat)


def el_diamonds(c: Ctx, el: dict) -> None:
    """Diamond panels on a wall facing +x: ``[y, z centre, half size]``."""
    rig, mat = c.shared[el.get("into", "rig")], c.mat(el["material"])
    x = c.V.num(el["x"])
    for y, zc, s in el["items"]:
        rig.face([(x, y, zc - s), (x, y + s, zc), (x, y, zc + s), (x, y - s, zc)], mat)


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


def el_led_rain(c: Ctx, el: dict) -> None:
    """Hanging LED tubes (``layout.ledRain``). UV0.y = 0 top -> 1 bottom, UV1 ('data') =
    (phase, speed) per tube for the web shader (``fx_ledrain``)."""
    lr = c.L["ledRain"]
    rng = v3.seeded(el.get("seed", 7))
    (x0, x1), (y0, y1), sp = lr["x"], lr["y"], lr["spacing"]
    lmin, lmax = lr["length"]
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    verts, faces, uv0, data = [], [], [], []
    s = el.get("tube", 0.017)
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
    fx_mesh("fx_ledrain", verts, faces, uv0, data, [c.mat(el["material"])], [0] * len(faces), c.C["FX"],
            smooth=False)  # fmt: skip


def el_globes(c: Ctx, el: dict) -> None:
    """Glowing globes hung from the ceiling (``fx_spheres``): ``[x, y, z, radius]``.
    UV1 ('data') = (phase, colour slot) for the web light show."""
    rng = v3.seeded(el.get("seed", 17))
    tmp = bmesh.new()
    bmesh.ops.create_icosphere(tmp, subdivisions=3, radius=1.0)
    tv = [v.co.copy() for v in tmp.verts]
    tf = [[v.index for v in f.verts] for f in tmp.faces]
    tmp.free()
    mats = [c.mat(r) for r in el["materials"]]
    weights = el.get("weights", [1] * len(mats))
    slots = list(range(len(mats)))
    last = max(1, len(mats) - 1)
    wire, rig = c.mat(el["wire"]), c.shared[el.get("into", "rig")]
    verts, faces, uv0, data, idx = [], [], [], [], []
    for x, y, z, r in el["items"]:
        slot = rng.choices(slots, weights=weights)[0]
        phase = rng.random()
        base = len(verts)
        verts += [(x + v.x * r, y + v.y * r, z + v.z * r) for v in tv]
        faces += [tuple(base + i for i in f) for f in tf]
        idx += [slot] * len(tf)
        uv0 += [(0.5 + v.x * 0.5, 0.5 + v.z * 0.5) for v in tv]
        data += [(phase, slot / last)] * len(tv)
        rig.box(x - 0.006, x + 0.006, y - 0.006, y + 0.006, z + r, c.ceil, wire)
    fx_mesh("fx_spheres", verts, faces, uv0, data, mats, idx, c.C["FX"], smooth=True)


# --------------------------------------------------------------------------- signs


def logo_strokes(logo: dict, height: float) -> list:
    """The club's logo as tube strokes, centred, ``height`` = cap height."""
    k = height / logo["capHeight"]
    cx, cy = logo["center"]

    def local(x: float, y: float) -> tuple[float, float]:
        return ((x - cx) * k, (cy - y) * k)

    strokes = []
    for st in logo["strokes"]:
        if isinstance(st, dict):
            sx, sy, r = st["circle"]
            lx, ly = local(sx, sy)
            strokes.append(("circle", lx, ly, r * k))
        else:
            strokes.append([local(x, y) for x, y in st])
    return strokes


def el_logo(c: Ctx, el: dict) -> None:
    """The club's logo (scene.json ``logo``) in neon tubes; its own object when ``object`` is
    set (``fx_sign_wall_<n|s|e|w>``: hidden by the web when seen from behind)."""
    mb = MeshBuilder(el["object"]) if "object" in el else c.shared[el.get("into", "signs")]
    mb.tubes(logo_strokes(c.S["logo"], el["height"]), el["tube"], c.mat(el["material"]), placement(c, el))
    if "object" in el:
        mb.finalize(c.C[el.get("collection", "FX")])


def el_text(c: Ctx, el: dict) -> None:
    """Lettering: solid (``extrude``) or neon outlines (``outline`` = tube radius)."""
    mb = c.shared[el.get("into", "signs")]
    kw = {k: el[k] for k in ("extrude", "outline", "spacing") if k in el}
    if "font" in el:
        kw["font"] = c.fonts[el["font"]]
    mb.text(el["text"], c.mat(el["material"]), el["size"], placement(c, el), **kw)


def el_starburst(c: Ctx, el: dict) -> None:
    """Neon star: ``spokes`` tubes crossing at the centre."""
    r, n = el["radius"], el.get("spokes", 4)
    spokes = []
    for k in range(n):
        a = k * math.pi / n
        spokes.append([(math.cos(a) * r, math.sin(a) * r), (-math.cos(a) * r, -math.sin(a) * r)])
    c.shared[el.get("into", "signs")].tubes(spokes, el["tube"], c.mat(el["material"]), placement(c, el))


# --------------------------------------------------------------------------- furniture & decor


def bottle(mb: MeshBuilder, x: float, y: float, z: float, mat, foil, m: Matrix, body: float = 0.26) -> None:
    """Bottle with shoulder, neck and foil (local booth frame)."""
    mb.cylinder(x, y, z, z + body, 0.04, mat, sides=12, cap_top=False, matrix=m)
    mb.cylinder(x, y, z + body, z + body + 0.07, 0.04, mat, sides=12, cap_top=False, matrix=m, radius_top=0.016)
    mb.cylinder(x, y, z + body + 0.07, z + body + 0.12, 0.016, mat, sides=10, cap_top=False, matrix=m)
    mb.cylinder(x, y, z + body + 0.1, z + body + 0.155, 0.018, foil, sides=10, matrix=m)


def booth(mb: MeshBuilder, c: Ctx, M: dict, t: dict, f: dict, z: float, glass: MeshBuilder) -> None:
    """U-shaped booth around a low table, guests facing local +X (``facing``)."""
    kind = t["kind"]
    W, D, sd = f["width"], f["depth"], f["seatDepth"]
    velvet = M[f"velvet_{kind}"]
    m = v3.facing_matrix(t["x"], t["y"], z, t["facing"])
    back_t, base_h, seat_h = 0.2, 0.1, 0.44
    back_h = 0.86 if kind == "lounge" else 0.94
    xb, xf = -D / 2, D / 2

    # plinths
    mb.box(xb, xb + sd, -W / 2, W / 2, 0, base_h, M["plinth"], skip=("-z",), matrix=m)
    for s in (-1, 1):
        ya, yb = sorted((s * (W / 2 - sd), s * W / 2))
        mb.box(xb + sd, xf, ya, yb, 0, base_h, M["plinth"], skip=("-z",), matrix=m)
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
        mb.box(tx - td / 2 + 0.08, tx + td / 2 - 0.08, ty - w / 2 + 0.08, ty + w / 2 - 0.08, 0, 0.34, M["frame"],
               skip=("-z",), matrix=m)  # fmt: skip
        mb.box(tx - td / 2 - 0.012, tx + td / 2 + 0.012, ty - w / 2 - 0.012, ty + w / 2 + 0.012, 0.34, 0.37,
               M["trim"], matrix=m)  # fmt: skip
        mb.box(tx - td / 2, tx + td / 2, ty - w / 2, ty + w / 2, 0.37, 0.41, M["top"], skip=("-z",), matrix=m)
        lx, ly = tx + td / 2 - 0.1, ty + w / 2 - 0.12
        mb.cylinder(lx, ly, 0.41, 0.53, 0.045, M["lamp"], sides=10, matrix=m)
        c.lamp_points.append(m @ Vector((lx, ly, 0.75)))
        if kind != "lounge":
            # champagne bucket with two bottles, and a bottle served on the table
            mb.cylinder(tx - 0.08, ty, 0.41, 0.6, 0.11, M["trim"], sides=18, matrix=m)
            bottle(mb, tx - 0.11, ty + 0.035, 0.47, M["frame"], M["trim"], m)
            bottle(mb, tx - 0.05, ty - 0.04, 0.45, M["bottleGreen"], M["trim"], m)
            bottle(mb, tx + 0.16, ty - w / 4, 0.41, M["bottleClear"], M["trim"], m, body=0.24)
    if kind == "prestige":
        for s in (-1, 1):
            mb.cylinder(xf + 0.4, s * 0.85, 0.0, 0.42, 0.27, velvet, sides=20, matrix=m)
            g = [m @ Vector(p) for p in ((xb, s * (W / 2 + 0.06), 0.1), (xf, s * (W / 2 + 0.06), 0.1),
                                          (xf, s * (W / 2 + 0.06), 1.7), (xb, s * (W / 2 + 0.06), 1.7))]  # fmt: skip
            glass.face([tuple(p) for p in g], M["glass"])
            mb.box(xb, xf, s * (W / 2 + 0.06) - 0.025, s * (W / 2 + 0.06) + 0.025, 1.7, 1.75, M["trim"], matrix=m)


def el_booths(c: Ctx, el: dict) -> None:
    """A booth at every table of the plan, sized by ``layout.furniture[kind]``."""
    M = {k: c.mat(r) for k, r in el["materials"].items()}
    F = c.L["furniture"]
    for t in c.L["tables"]:
        level = c.zones[t["zone"]]["level"]
        glass = c.shared["glass1" if level == 1 else "glass"]
        booth(c.furn(level), c, M, t, F[t["kind"]], c.level_z(level), glass)


def high_table(mb: MeshBuilder, M: dict, x: float, y: float, z: float, seed: int) -> None:
    mb.cylinder(x, y, z, z + 0.03, 0.28, M["frame"], sides=20, smooth=False)
    mb.cylinder(x, y, z + 0.03, z + 1.06, 0.035, M["frame"], sides=10)
    mb.cylinder(x, y, z + 1.06, z + 1.09, 0.37, M["trim"], sides=24, smooth=False)
    mb.cylinder(x, y, z + 1.09, z + 1.12, 0.36, M["top"], sides=24, smooth=False)
    rng = v3.seeded(seed)
    a0 = rng.uniform(0, math.tau)
    for k in range(3):
        a = a0 + k * math.tau / 3
        sx, sy = x + math.cos(a) * 0.62, y + math.sin(a) * 0.62
        mb.cylinder(sx, sy, z, z + 0.72, 0.03, M["frame"], sides=8)
        mb.cylinder(sx, sy, z + 0.72, z + 0.8, 0.19, M["seat"], sides=16)


def plant(mb: MeshBuilder, M: dict, x: float, y: float, z: float, seed: int) -> None:
    mb.cylinder(x, y, z, z + 0.72, 0.3, M["frame"], sides=18)
    mb.cylinder(x, y, z + 0.72, z + 0.76, 0.32, M["trim"], sides=18, smooth=False)
    rng = v3.seeded(seed)
    for k in range(4):
        dx, dy = rng.uniform(-0.18, 0.18), rng.uniform(-0.18, 0.18)
        r = rng.uniform(0.32, 0.45)
        mb.blob((x + dx, y + dy, z + 0.95 + k * 0.32), (r, r, r * 1.2), M["foliage"], seed=seed * 10 + k)


def el_back_bar(c: Ctx, el: dict) -> None:
    """Counter at ``layout.decor.vipBar`` with lit bottle shelves on the wall behind it (``wallY``)."""
    M = {k: c.mat(r) for k, r in el["materials"].items()}
    spec = c.L["decor"]["vipBar"]
    z = c.level_z(spec["level"])
    x0, x1 = spec["x"]
    y0, y1 = spec["y"]
    mb = c.furn(spec["level"])
    mb.box(x0, x1, y0, y1, z, z + 1.05, M["body"], skip=("-z",))
    mb.box(x0 - 0.06, x1 + 0.06, y0 - 0.1, y1 + 0.02, z + 1.05, z + 1.11, M["top"])
    wall_y = c.V.num(el["wallY"])
    rng = v3.seeded(el.get("seed", 99))
    level1 = spec["level"] == 1
    bottles = MeshBuilder("lvl1_fx_bottles" if level1 else "fx_back_bottles")
    strips = c.shared["strips1" if level1 else "strips"]
    kinds = [c.mat(r) for r in el["bottles"]]
    for zs in (z + 1.35, z + 1.8, z + 2.25):
        strips.box(x0, x1, wall_y + 0.02, wall_y + 0.24, zs - 0.025, zs, M["shelf"])
        xx = x0 + 0.15
        while xx < x1 - 0.15:
            mat = rng.choice(kinds)
            bottles.cylinder(xx, wall_y + 0.12, zs, zs + rng.uniform(0.22, 0.32), 0.034, mat, sides=8)
            xx += rng.uniform(0.1, 0.16)
    bottles.finalize(c.C["LVL1" if level1 else "FX"])
    strips.beam((x0, y1 + 0.03, z + 1.0), (x1, y1 + 0.03, z + 1.0), 0.02, 0.02, M["shelf"])


def el_decor(c: Ctx, el: dict) -> None:
    """High tables with stools and potted plants of ``layout.decor``."""
    M = {k: c.mat(r) for k, r in el["materials"].items()}
    d = c.L["decor"]
    for i, h in enumerate(d["highTables"]):
        high_table(c.furn(h["level"]), M, h["x"], h["y"], c.level_z(h["level"]), el.get("tableSeed", 200) + i)
    for i, p in enumerate(d["plants"]):
        plant(c.furn(p["level"]), M, p["x"], p["y"], c.level_z(p["level"]), el.get("plantSeed", 300) + i)


ELEMENTS = {
    "mesh": el_mesh,
    "mezzanine": el_mezzanine,
    "railings": el_railings,
    "columns": el_columns,
    "stairs": el_stairs,
    "bar": el_bar,
    "stage": el_stage,
    "slats": el_slats,
    "trusses": el_trusses,
    "ledRainFrame": el_led_rain_frame,
    "movingHeads": el_moving_heads,
    "speakers": el_speakers,
    "diamonds": el_diamonds,
    "ledRain": el_led_rain,
    "globes": el_globes,
    "logo": el_logo,
    "text": el_text,
    "starburst": el_starburst,
    "booths": el_booths,
    "backBar": el_back_bar,
    "decor": el_decor,
}

#: Shared objects, finalized after every element: (builder, collection, lightmap px)
SHARED_OUTPUT = (
    ("furn0", "FURNITURE", 2048),
    ("furn1", "FURNITURE", 2048),
    ("strips", "FX", None),
    ("strips1", "LVL1", None),
    ("glass", "ARCHI", None),
    ("glass1", "LVL1", None),
    ("rig", "ARCHI", None),
    ("signs", "FX", None),
)


# --------------------------------------------------------------------------- lights & render


def series(c: Ctx, spec: dict):
    """Expands ``values`` or ``count`` into one set of named values per item: ``i`` (index),
    ``v`` (a number value) or ``v0``, ``v1``… (the components of a list value)."""
    if "values" in spec:
        out = []
        for i, v in enumerate(spec["values"]):
            local = {"i": i}
            if isinstance(v, list):
                local.update({f"v{k}": x for k, x in enumerate(v)})
            else:
                local["v"] = v
            out.append(local)
        return out
    return [{"i": i} for i in range(spec.get("count", 1))]


def build_lights(c: Ctx) -> None:
    """Bake-only lights (never exported): lamps and a pinspot per table, then the club's
    downlights, wall washers, stage washes and fills (scene.json ``lights``)."""
    spec = c.S["lights"]
    coll, under, ch = c.C["LIGHTS_BAKE"], c.under, c.ceil

    def spot(name, pos, target, energy, color, size_deg=70.0, blend=0.5, radius=0.05):
        rot = (Vector(target) - Vector(pos)).to_track_quat("-Z", "Y").to_euler()
        v3.add_light(coll, name, "SPOT", pos, energy, color, radius, rot, size_deg, blend)

    lamp = spec["lamps"]
    for i, p in enumerate(c.lamp_points):
        v3.add_light(coll, f"lamp_{i:02d}", "POINT", tuple(p), lamp["energy"], tuple(lamp["color"]), lamp["radius"])
    # a pinspot per table: the tables are the product, they must read from afar
    pin = spec["pins"]
    for tid, p in c.table_points.items():
        zl = under - 0.05 if p.z < 1.0 and c.under_slab(p.x, p.y) else ch - 0.3
        dist = zl - p.z
        spot(f"pin_{tid}", (p.x, p.y, zl), tuple(p), pin["energy"] * dist * dist, tuple(pin["color"]), pin["size"],
             pin["blend"])  # fmt: skip
    for group in spec.get("spots", []):
        for local in series(c, group):
            pos, target = c.V.point(group["at"], **local), c.V.point(group["target"], **local)
            spot(f"{group['name']}_{local['i']}", pos, target, group["energy"], tuple(group["color"]),
                 group.get("size", 70.0), group.get("blend", 0.5))  # fmt: skip
    for group in spec.get("areas", []):
        for local in series(c, group):
            pos = c.V.point(group["at"], **local)
            v3.add_light(coll, f"{group['name']}_{local['i']}", "AREA", pos, group["energy"], tuple(group["color"]),
                         group["size"])  # fmt: skip


def setup_world(slug: str, color) -> None:
    name = f"{slug}_world"
    world = bpy.data.worlds.get(name) or bpy.data.worlds.new(name)
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs[0].default_value = (*color, 1.0)
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


def clean_default_scene(root: str, blend_path: str) -> None:
    if bpy.data.filepath not in ("", blend_path):
        return
    for name in ("Cube", "Light", "Camera"):
        obj = bpy.data.objects.get(name)
        if obj is not None and not any(col.name.startswith(root) for col in obj.users_collection):
            bpy.data.objects.remove(obj, do_unlink=True)


# --------------------------------------------------------------------------- report & previews


def build_report(slug: str, colls: dict, seconds: float) -> dict:
    """Objects, triangles and lightmaps of the scene, with the automatic checks."""
    meshes = {}
    for coll in colls.values():
        for obj in coll.objects:
            if obj.type == "MESH":
                meshes[obj.name] = {
                    "collection": coll.name,
                    "triangles": sum(len(p.vertices) - 2 for p in obj.data.polygons),
                    "lightmap": obj.get("vyra_lm"),
                }
    tris = sum(m["triangles"] for m in meshes.values())
    expected = ["ground_floor", "fx_spheres", "fx_led_strips", "fx_signs", "furniture"]
    checks = [
        {"name": "triangles", "ok": tris <= BUDGET["triangles"], "value": tris, "max": BUDGET["triangles"]},
        {"name": "objects", "ok": len(meshes) <= BUDGET["objects"], "value": len(meshes), "max": BUDGET["objects"]},
        {"name": "expected objects", "ok": all(n in meshes for n in expected),
         "missing": [n for n in expected if n not in meshes]},  # fmt: skip
        {"name": "lightmapped surfaces", "ok": any(m["lightmap"] for m in meshes.values()),
         "value": sum(1 for m in meshes.values() if m["lightmap"])},  # fmt: skip
    ]
    return {"club": slug, "seconds": round(seconds, 2), "objects": len(meshes), "triangles": tris,
            "lights": len(colls["LIGHTS_BAKE"].objects), "checks": checks, "meshes": meshes}  # fmt: skip


def render_previews(c: Ctx, out_dir: str, samples: int = 24) -> list[str]:
    """Quick Cycles renders for review (no lightmaps: the bake lights light the scene)."""
    os.makedirs(out_dir, exist_ok=True)
    scn = bpy.context.scene
    scn.cycles.samples = samples
    scn.render.resolution_x, scn.render.resolution_y = 960, 540
    cam = scn.camera
    shots = []
    ov = c.L["cameras"]["overview"]
    views = [("overview", ov["position"], ov["target"], 30)]
    b = c.L["building"]
    cx, cy = (b["minX"] + b["maxX"]) / 2, (b["minY"] + b["maxY"]) / 2
    views.append(("top", (cx, cy, 60.0), (cx, cy, 0.0), 24))
    for t in c.L["tables"][:: max(1, len(c.L["tables"]) // 4)][:4]:
        p = c.table_points.get(t["id"])
        if p is None:
            continue
        f = Vector((math.cos(math.radians(t["facing"])), math.sin(math.radians(t["facing"])), 0))
        eye = p + f * 3.2 + Vector((0, 0, 1.6))
        views.append((f"table-{t['id']}", tuple(eye), tuple(p), 26))
    # from outside, the ceiling and the walls hide the room: keep them in the light paths only,
    # like the web cutaway (single-sided walls)
    shell = [o for coll in c.C.values() for o in coll.objects if o.name.startswith(("ceiling", "wall_", "walls_"))]
    for name, pos, target, lens in views:
        outside = not name.startswith("table-")
        for obj in shell:
            obj.visible_camera = not outside
        cam.data.lens = lens
        cam.location = pos
        cam.rotation_euler = (Vector(target) - Vector(pos)).to_track_quat("-Z", "Y").to_euler()
        path = os.path.join(out_dir, f"{name}.png")
        scn.render.filepath = path
        bpy.ops.render.render(write_still=True)
        shots.append(path)
    for obj in shell:
        obj.visible_camera = True
    setup_preview_camera(c)
    return shots


# --------------------------------------------------------------------------- entry point


def parse_args(argv: list[str]) -> dict:
    args = argv[argv.index("--") + 1 :] if "--" in argv else []
    opts = {"club": None, "save": True, "previews": False}
    i = 0
    while i < len(args):
        if args[i] == "--club":
            opts["club"] = args[i + 1]
            i += 1
        elif args[i] == "--no-save":
            opts["save"] = False
        elif args[i] == "--previews":
            opts["previews"] = True
        i += 1
    if not opts["club"]:
        raise SystemExit("build_club: --club <slug> is required")
    return opts


def build(slug: str, save: bool = True, previews: bool = False) -> dict:
    t0 = time.time()
    club_dir = os.path.join(REPO, "clubs", slug)
    build_dir = os.path.join(club_dir, "build")
    blend_path = os.path.join(build_dir, f"{slug}.blend")
    with open(os.path.join(club_dir, "layout.json"), encoding="utf-8") as fh:
        layout = json.load(fh)
    with open(os.path.join(club_dir, "scene.json"), encoding="utf-8") as fh:
        scene = json.load(fh)

    root_name = slug.upper()
    clean_default_scene(root_name, blend_path)
    root = v3.ensure_collection(root_name)
    v3.purge_collection(root)
    colls = {n: v3.ensure_collection(f"{root_name}_{n}", root) for n in COLLECTIONS}
    c = Ctx(slug, layout, scene, make_materials(scene, os.path.join(build_dir, "textures")), colls)

    for el in scene["elements"]:
        kind = el["type"]
        if kind not in ELEMENTS:
            raise ValueError(f"scene.json: unknown element type '{kind}'")
        ELEMENTS[kind](c, el)
    for key, coll, lightmap in SHARED_OUTPUT:
        c.shared[key].finalize(colls[coll], lightmap=lightmap)

    build_lights(c)
    setup_world(slug, scene["world"]["color"])
    setup_render()
    setup_preview_camera(c)
    colls["LIGHTS_BAKE"].hide_viewport = False

    report = build_report(slug, colls, time.time() - t0)
    if previews:
        report["previews"] = [os.path.relpath(p, club_dir) for p in render_previews(c, os.path.join(build_dir, "previews"))]
    if save:
        os.makedirs(build_dir, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=blend_path)
        bpy.ops.file.make_paths_relative()
        bpy.ops.wm.save_mainfile()
        with open(os.path.join(build_dir, "report.json"), "w", encoding="utf-8") as fh:
            json.dump(report, fh, indent=2)
    return report


if __name__ == "__main__":
    opts = parse_args(sys.argv)
    rep = build(opts["club"], save=opts["save"], previews=opts["previews"])
    print(json.dumps({k: rep[k] for k in ("club", "objects", "triangles", "lights", "seconds")}))
    for check in rep["checks"]:
        print(f"[check] {'ok ' if check['ok'] else 'FAIL'} {check['name']}")
