# Pipeline 3D — du plan au navigateur

Objectif : une visite qui « fait pro » sur un téléphone moyen. Le levier n'est pas le nombre de polygones,
c'est la **lumière précalculée** (lightmaps Cycles), des **matériaux crédibles** et une **caméra mise en scène**.

Tout est **généré par script** : on ne retouche pas un `.blend` à la main, on modifie le layout ou le script puis on
régénère. C'est ce qui rend la production d'un nouveau club reproductible (VYR-35).

## Vue d'ensemble

```
clubs/<club>/layout.json             plan en mètres (source de vérité, partagée avec le web)
        │  clubs/<club>/blender/build.py  (+ art/scripts/vyra3d.py)   ~3 s
        ▼
clubs/<club>/build/<club>.blend      scène générée (non versionnée)
        │  art/scripts/bake_export.py  (Cycles GPU, headless)          ~1 min (rapide) / ~10 min (final)
        ▼
clubs/<club>/build/export/           <club>.glb (UV0 albedo, UV1 lightmap / données FX) · lm/*.png · lightmaps.json
        │  pnpm assets:optimize <club>  (gltf-transform)
        ▼
clubs/<club>/public/                 <club>.glb (meshopt, WebP) · lm/*.webp · lightmaps.json   ← versionné
        │  scripts/sync-club-assets.mjs (pnpm dev / build)
        ▼
public/clubs/<club>/                 servi sous /clubs/<club>/ (copie, non versionnée)
```

Organisation d'un dossier de club et procédure d'ajout : `docs/clubs.md`.

## Commandes

```bash
# 1. construire la scène (Blender ouvert avec le MCP, ou en headless)
"C:/Program Files/Blender Foundation/Blender 5.1/blender.exe" -b -P clubs/naho/blender/build.py

# 2. précalculer l'éclairage et exporter (GPU OptiX si dispo)
"C:/Program Files/Blender Foundation/Blender 5.1/blender.exe" -b clubs/naho/build/naho.blend -P art/scripts/bake_export.py
#    passe rapide pour itérer : --samples 128 --res-scale 0.5
#    ne refaire qu'un objet :   --only bar,stage
#    (le club est déduit du nom du .blend ; sinon -- --club <slug>)

# 3. optimiser pour le web
pnpm assets:optimize naho
```

Depuis Claude Code, le MCP `blender` permet de lancer l'étape 1 dans le Blender ouvert et de regarder le résultat
(`look`) avant de précalculer.

## Le layout (`clubs/<club>/layout.json`)

Axes Blender : x = est, y = nord, z = haut, en mètres (three.js : `(x, z, -y)`, voir `toThree`). Contient le bâtiment,
les vides double hauteur, les dalles de mezzanine, garde-corps, poteaux, escaliers, bar, scène, écran, WC, entrée,
pluie de LED, lyres, décor, **zones** (tier `lounge` / `vip` / `prestige`, niveau 0/1), **tables** (id, zone, type,
position, orientation `facing`), gabarits de mobilier et caméras (vue d'ensemble, intro).

Le web lit ce même fichier (`src/lib/venue/layout.ts`, validé par zod) pour placer marqueurs, zones cliquables,
halos et points de vue. Le contenu commercial (prix, capacités, statuts) vit à part : `clubs/<club>/content.json`.
`defineClub` vérifie au chargement que les deux correspondent zone par zone et table par table.

## Contrat de nommage GLB ↔ web

| Objet (nom Blender = nœud glTF)                  | Traitement côté web (`venue-model.tsx`)                                                         |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| propriété `vyra_lm` (taille px)                  | reçoit sa lightmap (`lightmaps.json`) + une finition PBR selon son matériau (ci-dessous)        |
| préfixe `lvl1_`                                  | appartient à la mezzanine : fondu quand on n'affiche que le RDC                                 |
| `fx_ledrain`                                     | shader « pluie » : UV0.v = position le long du tube, UV1 = (phase, vitesse)                     |
| `fx_spheres`                                     | light show du club (`ambiance.json` → `fx/show.ts`) + halo par globe, UV1.x = phase             |
| `fx_screen`                                      | shader égaliseur (UV0 0→1 sur l'écran)                                                          |
| `fx_sign_wall_<n\|s\|e\|w>`                      | enseigne murale, affichée seulement du côté qu'elle regarde (sinon inversée à travers la coupe) |
| matériau émissif (`Emission Strength` > 0)       | couleur HDR → bloom (néons, LED, bouteilles)                                                    |
| matériau listé dans `ambiance.json` → `finishes` | finition PBR du préréglage choisi (verre, métal, velours…), voir ci-dessous                     |
| matériau transparent sans finition               | voile de verre neutre, double face                                                              |

Un nœud multi-matériaux devient dans glTF un groupe `<nœud>` avec des enfants `<nœud>_1`, `<nœud>_2`… : le
propriétaire (lightmap, rôle FX, mezzanine) est toujours le **nœud**, résolu en remontant les parents.

### Finitions (`ambiance.json` → `src/components/scene/fx/finishes.ts`)

Chaque club associe ses matières Blender à des préréglages génériques (`glazed-tiles`, `brushed-gold`, `velvet`,
`glass`… liste dans `docs/clubs.md`). La lightmap porte la lumière diffuse ; un environnement de reflets
(`club-environment.tsx`, panneaux lumineux de `ambiance.json` placés comme les sources du club, rendu une fois)
apporte ce qu'elle ne peut pas contenir : reflets, métal, brillant du
velours. Son terme diffus est coupé dans le shader pour ne pas teinter les surfaces. Cartes de relief et de rugosité
générées côté client (`fx/surfaces.ts`) : dérivées de l'albedo (carrelage, béton, bois, végétal) ou procédurales
(velours, cuir, marbre noir veiné, métal brossé). Relief + vernis seulement en qualité haute ; sol miroir
(`fx/floor-gloss.tsx`, second rendu de la scène) seulement sur desktop.

### Versionnage des fichiers

`pnpm assets:optimize` écrit dans `lightmaps.json` une empreinte de contenu du GLB et de chaque lightmap ; le web les
ajoute aux URLs (`?v=<hash>`), servies avec `Cache-Control: immutable`. Un nouveau bake n'est jamais servi périmé.

Les murs et le plafond sont **mono-face, tournés vers l'intérieur** : vus de l'extérieur ils disparaissent, ce qui
donne la coupe (cutaway) de la vue d'ensemble sans aucune logique.

## Éclairage précalculé

- Sources du bake (exemple du Naho) : tubes LED, sphères, écran, néons, rubans LED (matériaux émissifs) + spots non
  exportés (`NAHO_LIGHTS_BAKE`) : douches sur chaque table, plafonniers sous mezzanine, wall-washers du mur végétal,
  wash de scène, ambiances violette (salle) et magenta (mezzanine).
- Bake `DIFFUSE` direct + indirect (sans la couleur) par objet, UV dédiées (`smart_project`), marge 8 px, débruitage
  léger. Stockage 8 bits : `(valeur / échelle) ^ (1/2.2)` ; l'échelle (percentile 99,6) est dans le manifest.
- Web : `lightMapIntensity = échelle × π × exposition`, tone mapping AgX en post-process, bloom sur les émissifs.

## Budget mobile (mesuré sur Naho)

| Mesure              | Cible        | Naho (POC) |
| ------------------- | ------------ | ---------- |
| Triangles           | ≤ 300 k      | ~106 k     |
| GLB optimisé        | ≤ 4 Mo total | ~2,1 Mo    |
| Lightmaps (WebP)    | (inclus)     | ~0,9 Mo    |
| Objets / draw calls | ≤ 100        | ~45 + FX   |

## Textures

Générées en numpy (tileables, déterministes) : carrelage, béton ciré noir, chêne fumé, mur végétal avec quelques
fleurs orange. Lettrage : Jost (SIL OFL, `art/fonts/`), la typo de l'interface ; `MeshBuilder.text(font=…, outline=…)`
pour les lettres pleines ou en néon détouré, `MeshBuilder.tubes()` pour les tracés en tubes (logo NΛHO). Aucune image tierce n'entre dans le produit. Les photos de référence restent locales
(`clubs/<club>/private/`, ignoré par git) : elles servent à modéliser, pas à être republiées.
