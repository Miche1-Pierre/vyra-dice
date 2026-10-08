"""Fingerprint of a generated venue scene, to prove two builds are the same.

Runs a build script inside Blender without saving, then hashes every object of the venue
collection: mesh vertices, faces, materials, UV layers and custom properties; light type,
transform, energy and colour. Two builds with equal fingerprints export the same GLB.

Headless (e.g. before and after a change to the builder or to a club's scene.json):
    blender -b -P art/scripts/fingerprint.py -- --script art/scripts/build_club.py --out a.json -- --club naho
Compare:
    python art/scripts/fingerprint.py --compare a.json b.json      (plain Python, no Blender)

Arguments after a second ``--`` are passed to the build script.
"""

from __future__ import annotations

import hashlib
import json
import runpy
import struct
import sys


def _digest(values) -> str:
    h = hashlib.sha1()
    for v in values:
        h.update(struct.pack("<d", float(v)) if isinstance(v, float) else repr(v).encode())
    return h.hexdigest()[:16]


def _floats(seq, attr: str, size: int) -> list[float]:
    import array

    buf = array.array("f", [0.0]) * (len(seq) * size)
    seq.foreach_get(attr, buf)
    return list(buf)


def fingerprint_scene() -> dict:
    import bpy

    out: dict = {"objects": {}, "materials": {}}
    for obj in sorted(bpy.data.objects, key=lambda o: o.name):
        colls = sorted(c.name for c in obj.users_collection)
        entry: dict = {"type": obj.type, "collections": colls,
                       "matrix": _digest(v for row in obj.matrix_world for v in row)}  # fmt: skip
        if obj.type == "MESH":
            me = obj.data
            entry.update(
                verts=len(me.vertices),
                polys=len(me.polygons),
                co=_digest(_floats(me.vertices, "co", 3)),
                loops=_digest([lp.vertex_index for lp in me.loops]),
                poly_mat=_digest([p.material_index for p in me.polygons]),
                smooth=_digest([p.use_smooth for p in me.polygons]),
                materials=[m.name if m else None for m in me.materials],
                uvs={uv.name: _digest(_floats(uv.data, "uv", 2)) for uv in me.uv_layers},
                props={k: obj[k] for k in obj.keys() if k.startswith("vyra")},
            )
        elif obj.type == "LIGHT":
            li = obj.data
            entry.update(
                light=li.type,
                energy=round(li.energy, 6),
                color=[round(c, 6) for c in li.color],
                size=round(getattr(li, "shadow_soft_size", 0.0), 6),
                spot=[round(getattr(li, "spot_size", 0.0), 6), round(getattr(li, "spot_blend", 0.0), 6)],
            )
        out["objects"][obj.name] = entry
    for mat in sorted(bpy.data.materials, key=lambda m: m.name):
        if not mat.users:
            continue
        nodes = mat.node_tree.nodes if mat.use_nodes and mat.node_tree else []
        values = []
        for node in sorted(nodes, key=lambda n: n.name):
            for inp in node.inputs:
                dv = getattr(inp, "default_value", None)
                if dv is None:
                    continue
                values.append((node.type, inp.identifier, tuple(dv) if hasattr(dv, "__len__") else dv))
            img = getattr(node, "image", None)
            if img is not None:
                values.append((node.type, "image", img.name))
        out["materials"][mat.name] = _digest(values)
    world = bpy.context.scene.world
    out["world"] = world.name if world else None
    return out


def compare(a_path: str, b_path: str) -> int:
    with open(a_path, encoding="utf-8") as fh:
        a = json.load(fh)
    with open(b_path, encoding="utf-8") as fh:
        b = json.load(fh)
    issues = []
    for section in ("objects", "materials"):
        for name in sorted(set(a[section]) | set(b[section])):
            if name not in a[section]:
                issues.append(f"{section}: + {name}")
            elif name not in b[section]:
                issues.append(f"{section}: - {name}")
            elif a[section][name] != b[section][name]:
                if isinstance(a[section][name], dict):
                    keys = [k for k in a[section][name] if a[section][name].get(k) != b[section][name].get(k)]
                    issues.append(f"{section}: ~ {name} ({', '.join(keys)})")
                else:
                    issues.append(f"{section}: ~ {name}")
    if a.get("world") != b.get("world"):
        issues.append(f"world: {a.get('world')} != {b.get('world')}")
    for line in issues:
        print(line)
    print(f"{len(issues)} difference(s), {len(a['objects'])} vs {len(b['objects'])} objects")
    return 1 if issues else 0


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    if argv and argv[0] == "--compare":
        sys.exit(compare(argv[1], argv[2]))
    script_args: list[str] = []
    if "--" in argv:
        i = argv.index("--")
        argv, script_args = argv[:i], argv[i + 1 :]
    opts = dict(zip(argv[::2], argv[1::2]))
    script, out = opts["--script"], opts["--out"]
    # the build script sees its own arguments, plus --no-save
    sys.argv = [script, "--", *script_args, "--no-save"]
    runpy.run_path(script, run_name="__main__")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(fingerprint_scene(), fh, indent=1, sort_keys=True)
    print(f"[fingerprint] {out}")


if __name__ == "__main__":
    main()
