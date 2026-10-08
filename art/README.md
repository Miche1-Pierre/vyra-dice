# art/

Boîte à outils 3D commune à tous les clubs. Rien ici n'est servi au navigateur ni propre à un club.

| Dossier    | Contenu                                                                               |
| ---------- | ------------------------------------------------------------------------------------- |
| `scripts/` | `build_club.py` (constructeur générique : plan + `scene.json` → scène, rapport, aperçus), `vyra3d.py` (bibliothèque Blender), `bake_export.py` (bake des lightmaps + export GLB), `fingerprint.py` (comparaison de deux constructions) |
| `fonts/`   | Polices (OFL) utilisables pour les enseignes modélisées                               |

Les sources de chaque club vivent dans `clubs/<slug>/` : plan (`layout.json`), scène Blender
(`scene.json`, des données), intermédiaires générés (`build/`, ignoré par git) et bundle web (`public/`). Pipeline et conventions de nommage : `docs/3d-pipeline.md`.
