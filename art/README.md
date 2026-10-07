# art/

Sources 3D (Git LFS). Rien ici n'est servi au navigateur.

| Dossier     | Contenu                                                       |
| ----------- | ------------------------------------------------------------- |
| `blender/`  | Fichiers `.blend` sources, un par lieu : `<club-slug>.blend`  |
| `textures/` | Textures sources (PNG/JPG/PSD) avant bake                     |
| `hdri/`     | Environnements HDR pour éclairage / reflets                   |
| `export/`   | Exports glTF binaires bruts depuis Blender (`<club-slug>.glb`) |

Pipeline : `art/export/x.glb` → `pnpm assets:optimize` → `public/models/x.glb` (meshopt + WebP).
Conventions de nommage des objets Blender : voir `docs/3d-pipeline.md`.
