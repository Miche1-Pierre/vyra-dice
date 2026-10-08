"""Bake lightmaps and export the web bundle of a venue built by ``clubs/<club>/blender/build.py``.

Headless (recommended — runs on the GPU without freezing the UI):
    blender -b clubs/<club>/build/<club>.blend -P art/scripts/bake_export.py
Options:
    --club SLUG      club folder (default: the name of the open .blend file)
    --samples N      Cycles samples per texel (default 384)
    --res-scale F    multiply every object's ``vyra_lm`` size (e.g. 0.5 for a quick pass)
    --only a,b       bake only these objects (others keep their previous lightmap file)
    --no-bake        export the GLB only

Outputs in ``clubs/<club>/build/export/`` (gitignored, consumed by ``scripts/optimize-glb.mjs``):
    <club>.glb             geometry + materials (UV0 albedo, UV1 lightmap/data)
    lm/<object>.png        lightmaps, sRGB-encoded (value / scale) ** (1/2.2)
    lightmaps.json         manifest: object -> {file, scale, size}

Web side: ``texture.colorSpace = SRGBColorSpace`` and ``material.lightMapIntensity = scale * PI``.
"""

from __future__ import annotations

import json
import math
import os
import sys
import time

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
EXPORT_COLLECTIONS = ("ARCHI", "LVL1", "FURNITURE", "FX")


def parse_args() -> dict:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    club = os.path.splitext(os.path.basename(bpy.data.filepath))[0]
    opts = {"club": club, "samples": 384, "res_scale": 1.0, "only": None, "bake": True}
    i = 0
    while i < len(argv):
        key = argv[i]
        if key == "--club":
            opts["club"] = argv[i + 1]
            i += 1
        elif key == "--samples":
            opts["samples"] = int(argv[i + 1])
            i += 1
        elif key == "--res-scale":
            opts["res_scale"] = float(argv[i + 1])
            i += 1
        elif key == "--only":
            opts["only"] = set(argv[i + 1].split(","))
            i += 1
        elif key == "--no-bake":
            opts["bake"] = False
        i += 1
    return opts


def setup_cycles(samples: int) -> None:
    scn = bpy.context.scene
    scn.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA", "HIP", "ONEAPI"):
        try:
            prefs.compute_device_type = kind
        except TypeError:
            continue
        prefs.get_devices()
        devices = [d for d in prefs.devices if d.type == kind]
        if devices:
            for d in prefs.devices:
                d.use = d.type == kind
            scn.cycles.device = "GPU"
            print(f"[bake] device {kind}: {[d.name for d in devices]}")
            break
    else:
        scn.cycles.device = "CPU"
        print("[bake] device CPU")
    scn.cycles.samples = samples
    scn.cycles.use_adaptive_sampling = False
    scn.render.bake.margin = 8
    scn.render.bake.margin_type = "EXTEND"


def exportables(club_root: str) -> list[bpy.types.Object]:
    objs = []
    for key in EXPORT_COLLECTIONS:
        coll = bpy.data.collections.get(f"{club_root}_{key}")
        if coll is not None:
            objs += [o for o in coll.objects if o.type == "MESH"]
    return objs


def select_only(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def unwrap_lightmap(obj: bpy.types.Object) -> None:
    me = obj.data
    layer = me.uv_layers.get("lightmap") or me.uv_layers.new(name="lightmap")
    me.uv_layers.active = layer
    select_only(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    margin = 0.004 if obj["vyra_lm"] >= 2048 else 0.007
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=margin, area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=False)  # fmt: skip
    bpy.ops.object.mode_set(mode="OBJECT")
    me.uv_layers.active = me.uv_layers["UVMap"]


def bake_object(obj: bpy.types.Object, size: int) -> np.ndarray:
    img = bpy.data.images.get(f"lm_{obj.name}")
    if img is not None:
        bpy.data.images.remove(img)
    img = bpy.data.images.new(f"lm_{obj.name}", size, size, alpha=False, float_buffer=True)
    added = []
    for slot in obj.material_slots:
        tree = slot.material.node_tree
        node = tree.nodes.new("ShaderNodeTexImage")
        node.image = img
        tree.nodes.active = node
        added.append((tree, node))
    select_only(obj)
    try:
        bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"}, margin=8, margin_type="EXTEND",
                            use_clear=True, target="IMAGE_TEXTURES", uv_layer="lightmap")  # fmt: skip
    finally:
        for tree, node in added:
            tree.nodes.remove(node)
    px = np.empty(size * size * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(size, size, 4)[..., :3]


def denoise(rgb: np.ndarray, radius: int = 2) -> np.ndarray:
    """Cheap separable blur — lightmaps are low frequency and the bake margin pads the islands."""
    out = rgb.copy()
    k = np.exp(-0.5 * (np.arange(-radius, radius + 1) / (radius * 0.6)) ** 2)
    k /= k.sum()
    for axis in (0, 1):
        acc = np.zeros_like(out)
        for off, w in zip(range(-radius, radius + 1), k):
            acc += np.roll(out, off, axis=axis) * w
        out = acc
    return out


def save_lightmap(rgb: np.ndarray, path: str) -> float:
    """Store (value / scale) ** (1/2.2) in an 8-bit PNG; returns ``scale``."""
    lum = rgb.max(axis=-1)
    valid = lum[lum > 1e-5]
    scale = float(np.percentile(valid, 99.6)) if valid.size else 1.0
    scale = max(scale, 1e-3)
    enc = np.clip(rgb / scale, 0, 1) ** (1 / 2.2)
    h, w, _ = enc.shape
    img = bpy.data.images.new("_lm_out", w, h, alpha=False)
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[..., :3] = enc
    img.pixels.foreach_set(rgba.ravel())
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    return scale


def export_glb(objs: list[bpy.types.Object], path: str) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.hide_set(False)
        o.select_set(True)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_extras=True,
        export_yup=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_cameras=False,
        export_lights=False,
        export_animations=False,
    )


def main() -> None:
    opts = parse_args()
    club = opts["club"]
    if not club:
        sys.exit("[bake] unknown club: open clubs/<club>/build/<club>.blend or pass --club")
    root = club.upper()
    export_dir = os.path.join(REPO, "clubs", club, "build", "export")
    lm_dir = os.path.join(export_dir, "lm")
    manifest_path = os.path.join(export_dir, "lightmaps.json")
    manifest = {"version": 1, "club": club, "encoding": "srgb", "lightmaps": {}}
    if os.path.exists(manifest_path):
        with open(manifest_path, encoding="utf-8") as fh:
            manifest["lightmaps"] = json.load(fh).get("lightmaps", {})

    for o in bpy.context.scene.objects:
        o.hide_render = False
    objs = exportables(root)
    targets = [o for o in objs if o.get("vyra_lm")]
    t0 = time.time()
    if opts["bake"]:
        setup_cycles(opts["samples"])
        for obj in targets:
            unwrap_lightmap(obj)
        for obj in targets:
            if opts["only"] and obj.name not in opts["only"]:
                continue
            size = max(128, int(obj["vyra_lm"] * opts["res_scale"]))
            t = time.time()
            rgb = denoise(bake_object(obj, size))
            path = os.path.join(lm_dir, f"{obj.name}.png")
            scale = save_lightmap(rgb, path)
            manifest["lightmaps"][obj.name] = {"file": f"lm/{obj.name}.png", "scale": round(scale, 5), "size": size}
            print(f"[bake] {obj.name:18s} {size:5d}px scale={scale:.4f} {time.time() - t:6.1f}s", flush=True)
    else:
        for obj in targets:
            if "lightmap" not in obj.data.uv_layers:
                unwrap_lightmap(obj)

    export_glb(objs, os.path.join(export_dir, f"{club}.glb"))
    with open(manifest_path, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
    print(f"[bake] done in {time.time() - t0:.1f}s -> {export_dir}", flush=True)


if __name__ == "__main__":
    main()
