# Guide de l'agent VYRA Studio

Tu génères l'expérience 3D d'un club pour VYRA : une visite mobile du lieu où le client compare les tables et
envoie une demande au club. Ce guide est versionné et s'enrichit à chaque club (`lessons.md`). Il fait autorité sur
tes habitudes.

## Ce que tu produis

Le dossier `clubs/<slug>/`, sur le modèle exact de `clubs/naho/` (la référence, à lire avant d'écrire) :

| Fichier         | Lu par             | Schéma (à lire)                                                       |
| --------------- | ------------------ | --------------------------------------------------------------------- |
| `content.json`  | le site            | `src/lib/schema.ts` (`venueContentSchema`)                            |
| `layout.json`   | le site et Blender | `src/lib/venue/layout.ts` (`venueLayoutSchema`)                       |
| `brand.json`    | le site            | `src/lib/clubs/brand.ts` (`brandSchema`)                              |
| `ambiance.json` | le site (3D)       | `src/lib/clubs/ambiance.ts` (`ambianceSchema`)                        |
| `scene.json`    | Blender            | `studio/lib/scene-schema.ts`, `art/scripts/build_club.py`             |
| `README.md`     | l'équipe           | statut, sources, ce qui reste à valider (voir `clubs/naho/README.md`) |

Tu n'écris rien d'autre, nulle part ailleurs. Le Studio valide tes fichiers, construit la scène, te montre les rendus
et te renvoie les erreurs : corrige ce qu'il signale, rien de plus.

## Règles non négociables

- **C'est une démo.** `club.demo: true`, `club.disclaimer` commence par « Démo — », `event.offersValidatedAt: null`.
  Prix, tables et capacités sont des suppositions plausibles, jamais présentées comme réelles.
- **Faits, suppositions, manques** : la note de recherche les sépare ; le `README.md` du club liste ce qu'il faut faire
  valider par le club.
- **Pas de contenu tiers republié** : les photos de `private/sources/` servent à modéliser, rien n'en est copié.
- **Pas d'invention sur l'identité** : nom, adresse, contacts viennent du brief ou des sources ; sinon tu les omets
  (l'adresse est requise : écris la ville seule si elle est inconnue, et signale-le).
- Les textes visibles par les clients sont en français, sobres et premium (voir le Naho).

## Le plan (`layout.json`)

- Unités en mètres, axes Blender : x = est, y = nord, z = haut. L'origine est au milieu de la salle principale.
- `building` : emprise extérieure ; `groundFloor` : la salle du rez-de-chaussée.
- Niveaux : 0 = rez-de-chaussée, 1 = mezzanine/étage (`heights.mezzanine` = hauteur du plancher).
- `mezzanine` : dalles de l'étage (rectangles nommés) ; `void` : zones double hauteur (sans dalle au-dessus).
- `zones` : `tier` `lounge` | `vip` | `prestige`, `level`, rectangle, et `raised` (m) pour une zone sur estrade : ses
  banquettes, son étiquette et ses vues montent d'autant (l'estrade elle-même se construit en `mesh`). `tables` :
  `id`, `zone`, `kind` (= tier de la zone), centre `x`/`y`, `facing` en degrés (0 = est, 90 = nord) = la direction que
  regardent les clients assis, donc vers la piste ou la scène.
- `stairs` : volées droites, `bottom` = côté du départ (`north`, `south`, `east` ou `west`), on monte vers l'opposé.
- Ids : zones en slug lisible (`vip-balcon`), tables `l1…` (lounge), `v1…` (VIP), `p1…` (prestige), uniques.
- Une table doit tenir dans sa zone avec son gabarit (`furniture[kind]`), sans chevaucher sa voisine
  (espacement ≥ largeur + 0,3 m) ni un poteau, un escalier ou un garde-corps.
- `cameras.overview` : vue de trois quarts qui montre toute la salle ; `cameras.intro` : 3 à 5 poses, du lointain
  vers la piste, la dernière = `overview`.
- Dimensions types : `dimensions.md`.

## L'offre (`content.json`)

- Zones : mêmes ids et tiers que le plan, `name` évocateur (le lieu, pas le tier), `shortName` ≤ 10 caractères,
  `description` en une phrase, `perks` cohérents avec le tier, `icon` parmi `leaf martini disc sunrise sofa crown gem`.
- Tables : mêmes ids et zones que le plan ; `label` = id en majuscules ; capacités `{min, max}` ; `minimumSpend` en
  euros entiers (ou `null` = sur demande) croissant lounge < VIP < prestige ; quelques tables `sold` ou `on_request`
  pour que la démo vive ; `view` décrit ce qu'on voit depuis la table, en quelques mots.
- `requestPrefix` : trois lettres majuscules tirées du nom ; `event` : `samedi` par défaut (ou le brief).

## L'identité (`brand.json`)

- `accent` : la couleur signature du club (logo, enseigne) ; `pill` = haut/bas d'un dégradé autour de l'accent ;
  `foil` = version métallisée claire/moyenne/sombre ; `on` = texte sur l'accent (sombre si l'accent est clair).
  `accent.name` en français (« or », « argent », « rouge »).
- `tiers` : trois teintes distinctes et lisibles sur fond noir (évite deux teintes proches).
- `wordmark` : le nom dessiné en traits (viewBox, chemins SVG simples M/L/H/V/A, épaisseur ~1,5) — seulement si tu
  peux le faire proprement ; sinon omets-le (le site écrit le nom en capitales espacées). `emblem` : idem, facultatif.
- `font` : `jost` (seule police disponible pour l'instant).
- `ui` (facultatif) : `{ "tone": "sober", "compare": false }` pour une interface plus sobre (tuiles graphite, angles
  droits) sans comparatif de tables, si le brief le demande ; sinon omets-le.

## L'ambiance 3D (`ambiance.json`)

- `show.palette` : 4 à 6 couleurs HDR linéaires du light show des globes, dans l'esprit du club ; `bpm` 118–128.
- `beams.palettes` : paires de couleurs `#rrggbb` des lyres.
- `ledRain` / `screen` : obligatoires si la scène contient une pluie de LED / un écran.
- `intro` : `neon` si le brief demande que le club se dessine à l'ouverture, sinon omets-le (vol de caméra).
  `night` : `{ "color": "#rrggbb" }` pour proposer l'ambiance de nuit (salle sombre, une seule couleur, fumée).
- `environment.lightformers` : panneaux placés comme les sources du club (espace three.js : y vers le haut ; un point
  `(x, y, z)` du plan devient `(x, z, -y)`), chacun regarde `target` (l'origine par défaut).
- `finishes` : pour chaque matière Blender qui le mérite (nom = `materials.*.name` de `scene.json`), un préréglage :
  `glazed-tiles concrete lacquered-wood foliage brushed-metal brushed-gold satin-metal marble leather velvet glass`.

## La scène Blender (`scene.json`)

Lis `art/scripts/build_club.py` (les briques et leurs paramètres) et `clubs/naho/scene.json` (exemple complet).

- `materials` : rôle → matière du club. Nomme les matières `<slug>_<rôle>` (tirets du slug → `_`). Les briques
  attendent les rôles qu'elles nomment (`black`, `gold`, `stone`, `leather`, `velvet_lounge|vip|prestige`, `lamp`,
  `bottle_*`, `glass`, `led_*`, `neon_*`, `sphere_*`…) : garde ces noms de rôles, change les couleurs.
- `elements` dans l'ordre de construction : sol (`mesh` → `ground_floor`), murs (`mesh` → `wall_*`/`walls_*`,
  mono-face tournés vers l'intérieur : `normal` +1 = vers +x/+y), plafond (`floor` avec `{"up": false}`),
  mezzanine, garde-corps, poteaux, escaliers, bar, scène, structures (`trusses`), lyres, enceintes, banquettes
  (`booths`), comptoir (`backBar`), décor, pluie de LED, globes, logo et textes en néon.
- Les nombres peuvent être des expressions sur les valeurs nommées du plan (`under - 0.05`, `maxX - 0.04`,
  `mezzanine_<id>_y1`…) : préfère-les aux nombres recopiés, la scène suit alors le plan.
- Objets : préfixe `lvl1_` = étage (le site l'efface quand on filtre le rez-de-chaussée) ; une enseigne murale vue
  d'un seul côté va dans son objet `fx_sign_wall_<n|s|e|w>` (direction qu'elle regarde).
- Éclairage du bake (`lights`) : une lampe et une douche par table sont automatiques ; ajoute downlights sous les
  dalles, wall-washers sur les murs signature, wash de scène et quelques `areas` de remplissage colorées.
- Budget mobile : ≤ 300 000 triangles, ≤ 100 objets (le Naho : 106 000 triangles, 29 objets).

## Bibliothèque

- Les briques du constructeur (`ELEMENTS` dans `art/scripts/build_club.py`) sont le catalogue de ce qui se construit.
- Les scènes des clubs déjà faits (`clubs/*/scene.json`) sont réutilisables : reprends l’élément d’un club proche
  (enseigne, structure, décor, éclairage) plutôt que de repartir de zéro, et adapte-le au plan.
- S’il manque une brique pour un élément signature (anneaux lumineux, cabine vitrée…), approche-le avec les briques
  existantes, signale-le dans le `README.md` du club et propose la brique en leçon : l’équipe l’ajoutera au
  constructeur pour tous les clubs.

## Procédure

1. **Recherche** : lis le brief, toutes les sources (photos, plans) et le Naho ; écris
   `studio/research.md` (modèle dans `research-template.md`).
2. **Spécification** : écris les six fichiers ; pars des fichiers du Naho et adapte tout ce qui est propre au club.
3. **Revue** : le Studio te montre les rendus (`build/previews/*.png`) et le rapport (`build/report.json`) ; compare
   aux sources et au brief, corrige `layout.json` / `scene.json` / `ambiance.json`, note tes changements.
4. **Leçons** : propose ce que le club suivant devrait savoir (dimensions, pièges, règles de style).
