# Pipeline 3D — Blender → web

Objectif : une visite qui « fait pro » sur un téléphone moyen. Le levier n'est pas le nombre de polygones,
c'est la **lumière bakée**, des **matériaux crédibles** et une **caméra bien mise en scène**.

## Outils

- Blender 5.1 (piloté aussi via le MCP `blender` — addon `blender_mcp` → onglet N « BlenderMCP » → _Connect to Claude_, port 9876).
- Sources d'assets (licences compatibles usage commercial) : Poly Haven (CC0 : HDRI, textures, modèles), ambientCG (CC0), Sketchfab (vérifier licence par modèle). Photos/relevés du club pour la fidélité.
- `pnpm assets:optimize` (gltf-transform : meshopt + WebP ≤ 2048 px).

## Un fichier par lieu : `art/blender/<club-slug>.blend`

Collections :

| Collection    | Contenu                                                         | Exporté |
| ------------- | --------------------------------------------------------------- | ------- |
| `ARCHI`       | Murs, sol, plafond, arches, bar, scène — fusionnés par matériau | oui     |
| `FURNITURE`   | Mobilier non interactif (enceintes, barrières, déco)            | oui     |
| `TABLES`      | Une mesh/empty par table réservable                             | oui     |
| `CAMERAS`     | Points de vue (empties)                                         | oui     |
| `LIGHTS_BAKE` | Lumières utilisées pour le bake uniquement                      | non     |
| `REF`         | Plans, photos de référence                                      | non     |

## Conventions de nommage (contrat avec le code)

Le code retrouve les objets **par nom** — ne pas renommer sans mettre à jour `src/content/clubs/<slug>.ts`.

| Nom Blender         | Rôle côté web                                                          |
| ------------------- | ---------------------------------------------------------------------- |
| `table_<id>`        | Table cliquable ; `<id>` = `Table.id` de la config club (`table_b1`)   |
| `table_<id>_anchor` | Empty : position du marqueur prix (au-dessus de la table)              |
| `cam_<id>`          | Empty : caméra « vue depuis la table » (axe -Z = direction de vue)     |
| `cam_intro_<n>`     | Keyframes de l'ouverture cinématique                                   |
| `cam_overview`      | Vue d'ensemble par défaut                                              |
| `zone_<id>`         | Volume/sol d'une zone (surbrillance), seulement si le club a des zones |
| `emissive_*`        | Matériaux néon/LED → bloom côté web                                    |

## Éclairage & bake

1. Modéliser à l'échelle réelle (1 unité = 1 m), origine au centre de la salle, sol à Z=0.
2. Éclairer en Cycles (ambiance club : bases sombres, accents saturés de la DA du club).
3. Bake **Combined/Diffuse** dans une lightmap (UV2) ou atlas par groupe de meshes statiques ; 2048–4096 px puis réduit à l'export.
4. Matériaux exportés : Principled BSDF simple (base color, roughness/metal, normal) — pas de nœuds procéduraux (non exportables).
5. Les tables restent avec un matériau propre (pas bakées dans l'atlas) pour pouvoir les surligner.

## Export glTF

- Format **glTF Binary (.glb)**, `+Y Up`, appliquer les modifiers, inclure custom properties (extras) et empties.
- Exclure `LIGHTS_BAKE` et `REF`. Compression : laisser à gltf-transform.
- Fichier : `art/export/<club-slug>.glb` → `pnpm assets:optimize` → `public/models/<club-slug>.glb`.

## Budget (mobile)

| Mesure              | Cible                    |
| ------------------- | ------------------------ |
| Poids GLB final     | ≤ 4 Mo                   |
| Triangles           | ≤ 300 k                  |
| Draw calls          | ≤ 100                    |
| Textures            | ≤ 2048 px, WebP          |
| Lumières dynamiques | 0–2 (le reste est bakée) |

Checklist avant merge d'un asset : nommage OK, échelle OK, poids OK, test sur un vrai téléphone, capture jointe à la PR.
