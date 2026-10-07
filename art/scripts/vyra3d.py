"""Generic helpers to build club venues in Blender from a layout spec.

Runs inside Blender (bpy, bmesh, numpy are bundled). Kept free of venue specifics so the
same toolkit can build the next club (VYR-35: reproducible venue creation).

Conventions
- Blender axes: x = east, y = north, z = up. 1 unit = 1 metre.
- Every exported mesh that should receive baked lighting carries the custom property
  ``vyra_lm`` (lightmap size in px). Emissive / glass meshes don't.
- Objects whose name starts with ``lvl1_`` belong to the mezzanine level (the web viewer can
  fade them out to reveal the ground floor).
"""

from __future__ import annotations

import math
import os
import random

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------


def srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_linear(hex_color: str) -> tuple[float, float, float, float]:
    """'#rrggbb' (sRGB) -> linear RGBA tuple for shader inputs."""
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


# ---------------------------------------------------------------------------
# Collections
# ---------------------------------------------------------------------------


def ensure_collection(name: str, parent: bpy.types.Collection | None = None) -> bpy.types.Collection:
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
    parent = parent or bpy.context.scene.collection
    if coll.name not in parent.children:
        parent.children.link(coll)
    return coll


def purge_collection(coll: bpy.types.Collection) -> None:
    """Delete every object (and child collection) inside ``coll``."""
    for child in list(coll.children):
        purge_collection(child)
        bpy.data.collections.remove(child)
    for obj in list(coll.objects):
        data = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        if data is not None and getattr(data, "users", 1) == 0:
            if isinstance(data, bpy.types.Mesh):
                bpy.data.meshes.remove(data)
            elif isinstance(data, bpy.types.Light):
                bpy.data.lights.remove(data)
            elif isinstance(data, bpy.types.Curve):
                bpy.data.curves.remove(data)


# ---------------------------------------------------------------------------
# Procedural textures (numpy, tileable)
# ---------------------------------------------------------------------------


def fractal_noise(size: int, beta: float = 2.0, seed: int = 0, shape: tuple[int, int] | None = None) -> np.ndarray:
    """Periodic 1/f^beta noise, zero mean, unit variance."""
    rng = np.random.default_rng(seed)
    h, w = shape or (size, size)
    white = rng.standard_normal((h, w))
    spec = np.fft.fft2(white)
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    radius = np.sqrt(fx**2 + fy**2)
    radius[0, 0] = 1.0
    spec /= radius ** (beta / 2)
    spec[0, 0] = 0
    out = np.real(np.fft.ifft2(spec))
    return (out - out.mean()) / (out.std() + 1e-9)


def box_blur_wrap(a: np.ndarray, r: int) -> np.ndarray:
    """Separable box blur with wrap-around (keeps textures tileable)."""
    out = a.astype(np.float32)
    for axis in (0, 1):
        acc = np.zeros_like(out)
        for k in range(-r, r + 1):
            acc += np.roll(out, k, axis=axis)
        out = acc / (2 * r + 1)
    return out


def save_png(pixels_rgb: np.ndarray, path: str, name: str, non_color: bool = False) -> bpy.types.Image:
    """Write an (H, W, 3) float array in [0, 1] (already display-encoded) to PNG and load it."""
    h, w, _ = pixels_rgb.shape
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img = bpy.data.images.get(name)
    if img is not None:
        bpy.data.images.remove(img)
    img = bpy.data.images.new(name, width=w, height=h, alpha=False)
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[..., :3] = np.clip(pixels_rgb, 0, 1)
    # Blender images are stored bottom-up.
    img.pixels.foreach_set(rgba[::-1].ravel())
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    if non_color:
        img.colorspace_settings.name = "Non-Color"
    return img


def tex_tiles(size: int = 512, tiles: int = 2, seed: int = 11) -> np.ndarray:
    """Dark grey stone floor tiles (sRGB values). ``tiles`` x ``tiles`` per texture."""
    rng = np.random.default_rng(seed)
    n = fractal_noise(size, beta=2.4, seed=seed)
    fine = fractal_noise(size, beta=0.6, seed=seed + 1)
    base = np.full((size, size), 0.235) + n * 0.012 + fine * 0.006
    cell = size // tiles
    for ty in range(tiles):
        for tx in range(tiles):
            base[ty * cell : (ty + 1) * cell, tx * cell : (tx + 1) * cell] += rng.uniform(-0.018, 0.018)
    grout = max(2, size // 160)
    yy, xx = np.mgrid[0:size, 0:size]
    line = ((yy % cell) < grout) | ((xx % cell) < grout)
    base[line] = 0.12
    rgb = np.stack([base * 0.98, base * 0.99, base * 1.03], axis=-1)
    return rgb


def tex_concrete(size: int = 1024, seed: int = 21, tone: float = 0.16) -> np.ndarray:
    """Black waxed concrete (béton ciré) — subtle cloudy trowel marks (sRGB)."""
    clouds = fractal_noise(size, beta=2.6, seed=seed)
    trowel = fractal_noise(size, beta=1.4, seed=seed + 1, shape=(size, size // 8))
    trowel = np.repeat(trowel, 8, axis=1)
    trowel = box_blur_wrap(trowel, 2)
    v = tone + clouds * 0.025 + trowel * 0.008
    return np.stack([v, v * 0.995, v * 0.99], axis=-1)


def tex_wood(size: int = 1024, planks: int = 8, seed: int = 31) -> np.ndarray:
    """Dark smoked oak planks running along u (sRGB)."""
    rng = np.random.default_rng(seed)
    grain = fractal_noise(size, beta=1.8, seed=seed, shape=(size, size // 32))
    grain = np.repeat(grain, 32, axis=1)
    grain = box_blur_wrap(grain, 3)
    warp = fractal_noise(size, beta=3.0, seed=seed + 1)
    img = np.zeros((size, size, 3), dtype=np.float32)
    ph = size // planks
    for p in range(planks):
        tone = rng.uniform(0.17, 0.24)
        tint = np.array([1.0, 0.82, 0.66]) * tone
        rows = slice(p * ph, (p + 1) * ph)
        streak = 1.0 + grain[rows] * 0.10 + warp[rows] * 0.05
        img[rows] = tint[None, None, :] * streak[..., None]
        img[p * ph : p * ph + 2] *= 0.55  # long seam
        joint = rng.integers(0, size)
        img[rows, joint : joint + 2] *= 0.6  # end joint
    return img


def tex_foliage(size: int = 1024, seed: int = 41, leaves: int = 3400) -> np.ndarray:
    """Dense green wall: layered leaves with a few orange flowers (sRGB)."""
    rng = np.random.default_rng(seed)
    col = np.zeros((size, size, 3), dtype=np.float32)
    col[:] = (0.03, 0.06, 0.035)
    height = np.zeros((size, size), dtype=np.float32)
    greens = np.array(
        [
            (0.22, 0.42, 0.15),
            (0.14, 0.33, 0.11),
            (0.30, 0.52, 0.20),
            (0.11, 0.27, 0.13),
            (0.36, 0.50, 0.14),
            (0.18, 0.40, 0.22),
            (0.42, 0.58, 0.24),
        ],
        dtype=np.float32,
    )
    for i in range(leaves):
        length = rng.uniform(22, 62)
        width = length * rng.uniform(0.32, 0.5)
        ang = rng.uniform(0, math.pi)
        cx, cy = rng.uniform(0, size, 2)
        r = int(length / 2) + 2
        dy, dx = np.mgrid[-r : r + 1, -r : r + 1].astype(np.float32)
        u = dx * math.cos(ang) + dy * math.sin(ang)
        v = -dx * math.sin(ang) + dy * math.cos(ang)
        un = u / (length / 2)
        # pointed leaf: width shrinks towards both tips
        half = (width / 2) * np.clip(1 - un**2, 0, 1) ** 0.6
        mask = (np.abs(un) <= 1) & (np.abs(v) <= half)
        if not mask.any():
            continue
        base = greens[rng.integers(0, len(greens))] * rng.uniform(0.75, 1.2)
        shade = 0.72 + 0.28 * (un + 1) / 2  # darker at the stem
        midrib = np.abs(v) < 0.9
        leaf = base[None, None, :] * shade[..., None]
        leaf = np.where(midrib[..., None], leaf * 1.25, leaf)
        ys = (np.arange(-r, r + 1) + int(cy)) % size
        xs = (np.arange(-r, r + 1) + int(cx)) % size
        sub_col = col[np.ix_(ys, xs)]
        sub_h = height[np.ix_(ys, xs)]
        level = i / leaves + 0.15 * (1 - (v / (half + 1e-3)) ** 2)
        sub_col[mask] = leaf[mask]
        sub_h[mask] = level[mask]
        col[np.ix_(ys, xs)] = sub_col
        height[np.ix_(ys, xs)] = sub_h
    # a few orange/red flowers (seen on the real wall)
    for _ in range(int(leaves * 0.012)):
        cx, cy = rng.integers(0, size, 2)
        rad = rng.uniform(2.5, 5)
        r = int(rad) + 1
        dy, dx = np.mgrid[-r : r + 1, -r : r + 1]
        mask = dx**2 + dy**2 <= rad**2
        ys = (np.arange(-r, r + 1) + cy) % size
        xs = (np.arange(-r, r + 1) + cx) % size
        sub = col[np.ix_(ys, xs)]
        sub[mask] = np.array((0.85, 0.32, 0.08)) * rng.uniform(0.7, 1.0)
        col[np.ix_(ys, xs)] = sub
    # cavity darkening between leaves + large patches of tone variation
    ao = height - box_blur_wrap(height, 8)
    col *= np.clip(0.8 + ao[..., None] * 1.6, 0.45, 1.2)
    patches = fractal_noise(size, beta=3.2, seed=seed + 7)
    col *= np.clip(1.0 + patches[..., None] * 0.18, 0.7, 1.3)
    return col


# ---------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------


def _principled(mat: bpy.types.Material):
    return next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def _set_input(node, names: tuple[str, ...], value) -> None:
    for sock in node.inputs:
        if sock.identifier in names or sock.name in names:
            sock.default_value = value
            return


def material(
    name: str,
    color: str = "#808080",
    roughness: float = 0.6,
    metallic: float = 0.0,
    emission: str | None = None,
    strength: float = 0.0,
    alpha: float = 1.0,
    image: bpy.types.Image | None = None,
    uv_scale: float = 1.0,
) -> bpy.types.Material:
    """Create (or reset) a glTF-friendly Principled material.

    ``uv_scale`` (metres per texture repeat) is stored on the material and used by
    :func:`MeshBuilder.finalize` to box-project UV0 in world space.
    """
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    tree = mat.node_tree
    for node in list(tree.nodes):
        if node.type not in {"BSDF_PRINCIPLED", "OUTPUT_MATERIAL"}:
            tree.nodes.remove(node)
    bsdf = _principled(mat)
    _set_input(bsdf, ("Base Color",), hex_linear(color))
    _set_input(bsdf, ("Roughness",), roughness)
    _set_input(bsdf, ("Metallic",), metallic)
    _set_input(bsdf, ("Alpha",), alpha)
    if emission:
        _set_input(bsdf, ("Emission Color", "Emission"), hex_linear(emission))
        _set_input(bsdf, ("Emission Strength",), strength)
    else:
        _set_input(bsdf, ("Emission Strength",), 0.0)
    if image is not None:
        tex = tree.nodes.new("ShaderNodeTexImage")
        tex.image = image
        tex.location = (-400, 200)
        tex.name = "albedo"
        base = next(s for s in bsdf.inputs if s.identifier == "Base Color" or s.name == "Base Color")
        tree.links.new(tex.outputs["Color"], base)
    if alpha < 1.0:
        try:
            mat.surface_render_method = "BLENDED"
        except (AttributeError, TypeError):
            pass
    # Single-sided by default: walls/ceiling face inwards, so the web viewer gets a free
    # cutaway from outside. Glass stays double-sided.
    mat.use_backface_culling = alpha >= 1.0
    mat["uv_scale"] = uv_scale
    mat["vyra_emissive"] = bool(emission)
    mat.diffuse_color = hex_linear(emission or color)
    return mat


# ---------------------------------------------------------------------------
# Mesh building
# ---------------------------------------------------------------------------


class MeshBuilder:
    """Accumulates faces (with materials) in one bmesh, then emits one object."""

    def __init__(self, name: str):
        self.name = name
        self.bm = bmesh.new()
        self.mats: list[bpy.types.Material] = []
        self.uv1: list[tuple[float, float]] | None = None  # optional per-face-vertex extra data

    def mat_index(self, mat: bpy.types.Material) -> int:
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    # --- primitives -------------------------------------------------------
    def face(self, pts, mat, smooth: bool = False):
        verts = [self.bm.verts.new(p) for p in pts]
        f = self.bm.faces.new(verts)
        f.material_index = self.mat_index(mat)
        f.smooth = smooth
        return f

    def box(self, x0, x1, y0, y1, z0, z1, mat, skip: tuple[str, ...] = (), matrix: Matrix | None = None):
        """Axis-aligned box (optionally transformed). ``skip`` in {'-x','+x','-y','+y','-z','+z'}."""
        x0, x1 = min(x0, x1), max(x0, x1)
        y0, y1 = min(y0, y1), max(y0, y1)
        z0, z1 = min(z0, z1), max(z0, z1)
        c = {
            "000": (x0, y0, z0), "100": (x1, y0, z0), "110": (x1, y1, z0), "010": (x0, y1, z0),
            "001": (x0, y0, z1), "101": (x1, y0, z1), "111": (x1, y1, z1), "011": (x0, y1, z1),
        }  # fmt: skip
        if matrix is not None:
            c = {k: tuple(matrix @ Vector(v)) for k, v in c.items()}
        faces = {
            "-z": ("000", "010", "110", "100"),
            "+z": ("001", "101", "111", "011"),
            "-y": ("000", "100", "101", "001"),
            "+y": ("010", "011", "111", "110"),
            "-x": ("000", "001", "011", "010"),
            "+x": ("100", "110", "111", "101"),
        }
        for key, quad in faces.items():
            if key in skip:
                continue
            self.face([c[k] for k in quad], mat)

    def floor(self, x0, x1, y0, y1, z, mat, up: bool = True):
        pts = [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)]  # normal +z
        return self.face(pts if up else list(reversed(pts)), mat)

    def wall_x(self, x, ya, yb, za, zb, mat, normal: int):
        """Vertical quad in the plane x = const; ``normal`` is +1 (east) or -1 (west)."""
        pts = [(x, ya, za), (x, yb, za), (x, yb, zb), (x, ya, zb)]  # normal +x
        return self.face(pts if normal > 0 else list(reversed(pts)), mat)

    def wall_y(self, y, xa, xb, za, zb, mat, normal: int):
        """Vertical quad in the plane y = const; ``normal`` is +1 (north) or -1 (south)."""
        pts = [(xa, y, za), (xb, y, za), (xb, y, zb), (xa, y, zb)]  # normal -y
        return self.face(pts if normal < 0 else list(reversed(pts)), mat)

    def beam(self, p0, p1, width, height, mat):
        """Box of section ``width`` x ``height`` running from p0 to p1 (any direction)."""
        a, b = Vector(p0), Vector(p1)
        d = b - a
        rot = d.normalized().to_track_quat("X", "Z").to_matrix().to_4x4()
        self.box(0, d.length, -width / 2, width / 2, -height / 2, height / 2, mat,
                 matrix=Matrix.Translation(a) @ rot)  # fmt: skip

    def soft_box(self, x0, x1, y0, y1, z0, z1, mat, bevel: float = 0.04, segments: int = 2,
                 matrix: Matrix | None = None):  # fmt: skip
        """Bevelled box (cushions, furniture). Built in a temp bmesh then merged."""
        tmp = bmesh.new()
        bmesh.ops.create_cube(tmp, size=1.0)
        sx, sy, sz = x1 - x0, y1 - y0, z1 - z0
        bmesh.ops.scale(tmp, vec=(sx, sy, sz), verts=tmp.verts)
        bmesh.ops.translate(tmp, vec=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), verts=tmp.verts)
        b = min(bevel, sx * 0.45, sy * 0.45, sz * 0.45)
        if b > 0.002:
            bmesh.ops.bevel(tmp, geom=list(tmp.edges), offset=b, segments=segments, profile=0.5, affect="EDGES")
        self._merge(tmp, mat, matrix, smooth=True)
        tmp.free()

    def cylinder(self, cx, cy, z0, z1, radius, mat, sides: int = 16, cap_top=True, cap_bottom=False,
                 smooth=True, matrix: Matrix | None = None):  # fmt: skip
        ring0, ring1 = [], []
        for i in range(sides):
            a = 2 * math.pi * i / sides
            ring0.append((cx + radius * math.cos(a), cy + radius * math.sin(a), z0))
            ring1.append((cx + radius * math.cos(a), cy + radius * math.sin(a), z1))
        if matrix is not None:
            ring0 = [tuple(matrix @ Vector(p)) for p in ring0]
            ring1 = [tuple(matrix @ Vector(p)) for p in ring1]
        for i in range(sides):
            j = (i + 1) % sides
            self.face([ring0[i], ring0[j], ring1[j], ring1[i]], mat, smooth=smooth)
        if cap_top:
            self.face(ring1, mat)
        if cap_bottom:
            self.face(list(reversed(ring0)), mat)

    def sphere(self, center, radius, mat, subdiv: int = 2):
        tmp = bmesh.new()
        bmesh.ops.create_icosphere(tmp, subdivisions=subdiv, radius=radius)
        bmesh.ops.translate(tmp, vec=center, verts=tmp.verts)
        self._merge(tmp, mat, None, smooth=True)
        tmp.free()

    def blob(self, center, radii, mat, seed: int = 0, roughness: float = 0.18, subdiv: int = 2):
        """Organic lumpy ellipsoid (foliage clumps)."""
        rng = random.Random(seed)
        tmp = bmesh.new()
        bmesh.ops.create_icosphere(tmp, subdivisions=subdiv, radius=1.0)
        for v in tmp.verts:
            k = 1.0 + rng.uniform(-roughness, roughness)
            v.co = Vector((v.co.x * radii[0] * k, v.co.y * radii[1] * k, v.co.z * radii[2] * k)) + Vector(center)
        self._merge(tmp, mat, None, smooth=True)
        tmp.free()

    def prism(self, poly, z0, z1, mat, top=True, bottom=False, sides=True, top_mat=None):
        """Vertical extrusion of a CCW polygon [(x, y), ...]."""
        n = len(poly)
        if sides:
            for i in range(n):
                (ax, ay), (bx, by) = poly[i], poly[(i + 1) % n]
                self.face([(ax, ay, z0), (bx, by, z0), (bx, by, z1), (ax, ay, z1)], mat)
        if top:
            self.face([(x, y, z1) for x, y in poly], top_mat or mat)
        if bottom:
            self.face([(x, y, z0) for x, y in reversed(poly)], mat)

    def ring(self, outer, inner, z, mat):
        """Flat horizontal ring between two CCW polygons with matching vertex counts."""
        n = len(outer)
        for i in range(n):
            j = (i + 1) % n
            self.face(
                [(outer[i][0], outer[i][1], z), (outer[j][0], outer[j][1], z),
                 (inner[j][0], inner[j][1], z), (inner[i][0], inner[i][1], z)],
                mat,
            )  # fmt: skip

    def text(self, body: str, mat, size: float, matrix: Matrix, extrude: float = 0.02, align: str = "CENTER"):
        curve = bpy.data.curves.new(f"_txt_{body}", type="FONT")
        curve.body = body
        curve.size = size
        curve.extrude = extrude
        curve.align_x = align
        curve.align_y = "CENTER"
        tmp_obj = bpy.data.objects.new("_txt", curve)
        bpy.context.scene.collection.objects.link(tmp_obj)
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(tmp_obj.evaluated_get(dg))
        tmp = bmesh.new()
        tmp.from_mesh(me)
        self._merge(tmp, mat, matrix, smooth=False)
        tmp.free()
        bpy.data.objects.remove(tmp_obj, do_unlink=True)
        bpy.data.curves.remove(curve)
        bpy.data.meshes.remove(me)

    def _merge(self, src: bmesh.types.BMesh, mat, matrix: Matrix | None, smooth: bool):
        idx = self.mat_index(mat)
        vmap = {}
        for v in src.verts:
            co = matrix @ v.co if matrix is not None else v.co.copy()
            vmap[v] = self.bm.verts.new(co)
        for f in src.faces:
            nf = self.bm.faces.new([vmap[v] for v in f.verts])
            nf.material_index = idx
            nf.smooth = smooth

    # --- output -----------------------------------------------------------
    def finalize(self, coll: bpy.types.Collection, lightmap: int | None = None, props: dict | None = None,
                 extra_uv: list | None = None) -> bpy.types.Object:  # fmt: skip
        """Create the object. UV0 = world box projection scaled by each material's ``uv_scale``.

        ``extra_uv``: optional callable(face, loop) -> (u, v) written to a second UV map
        ``data`` (used by FX meshes for per-instance animation phases).
        """
        bm = self.bm
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bm.normal_update()
        uv0 = bm.loops.layers.uv.new("UVMap")
        for f in bm.faces:
            scale = float(self.mats[f.material_index].get("uv_scale", 1.0)) or 1.0
            n = f.normal
            ax = max(range(3), key=lambda i: abs(n[i]))
            for loop in f.loops:
                co = loop.vert.co
                if ax == 2:
                    u, v = co.x, co.y
                elif ax == 0:
                    u, v = co.y * (1 if n.x > 0 else -1), co.z
                else:
                    u, v = co.x * (-1 if n.y > 0 else 1), co.z
                loop[uv0].uv = (u / scale, v / scale)
        if extra_uv is not None:
            uv1 = bm.loops.layers.uv.new("data")
            for f in bm.faces:
                for loop in f.loops:
                    loop[uv1].uv = extra_uv(f, loop)
        # sharp edges above 50° so cushions shade smooth but boxes stay crisp
        for e in bm.edges:
            if len(e.link_faces) == 2:
                ang = e.link_faces[0].normal.angle(e.link_faces[1].normal, 0)
                e.smooth = ang < math.radians(50)
        mesh = bpy.data.meshes.get(self.name)
        if mesh is not None:
            mesh.clear_geometry()
            mesh.materials.clear()
        else:
            mesh = bpy.data.meshes.new(self.name)
        bm.to_mesh(mesh)
        bm.free()
        for m in self.mats:
            mesh.materials.append(m)
        obj = bpy.data.objects.new(self.name, mesh)
        coll.objects.link(obj)
        if lightmap:
            obj["vyra_lm"] = int(lightmap)
        for k, v in (props or {}).items():
            obj[k] = v
        return obj


# ---------------------------------------------------------------------------
# Small geometry utilities
# ---------------------------------------------------------------------------


def chamfered_rect(x0, x1, y0, y1, c):
    """CCW octagon from a rectangle with corner chamfer ``c``."""
    return [
        (x0 + c, y0), (x1 - c, y0), (x1, y0 + c), (x1, y1 - c),
        (x1 - c, y1), (x0 + c, y1), (x0, y1 - c), (x0, y0 + c),
    ]  # fmt: skip


def facing_matrix(x: float, y: float, z: float, facing_deg: float) -> Matrix:
    """Local frame where +X is the direction guests face (facing 0 = east, 90 = north)."""
    return Matrix.Translation((x, y, z)) @ Matrix.Rotation(math.radians(facing_deg), 4, "Z")


def seeded(seed: int) -> random.Random:
    return random.Random(seed)


def add_light(coll, name, kind, location, energy, color=(1, 1, 1), size=0.1, rotation=(0, 0, 0),
              spot_size_deg=60.0, blend=0.3):  # fmt: skip
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    data.color = color
    if kind == "AREA":
        data.size = size
    elif kind in {"POINT", "SPOT"}:
        data.shadow_soft_size = size
    if kind == "SPOT":
        data.spot_size = math.radians(spot_size_deg)
        data.spot_blend = blend
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    obj.rotation_euler = rotation
    coll.objects.link(obj)
    return obj
