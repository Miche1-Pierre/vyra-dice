# art/

Boîte à outils 3D commune à tous les clubs. Rien ici n'est servi au navigateur ni propre à un club.

| Dossier    | Contenu                                                                               |
| ---------- | ------------------------------------------------------------------------------------- |
| `scripts/` | `vyra3d.py` (bibliothèque Blender : maillages, matières, textures, texte) et `bake_export.py` (bake des lightmaps + export GLB) |
| `fonts/`   | Polices (OFL) utilisables pour les enseignes modélisées                               |

Les sources de chaque club vivent dans `clubs/<slug>/` : plan (`layout.json`), script de construction
Blender (`blender/build.py`), intermédiaires générés (`build/`, ignoré par git) et bundle web
(`public/`). Pipeline et conventions de nommage : `docs/3d-pipeline.md`.
