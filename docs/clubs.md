# Clubs — un dossier par club

Tout ce qui est propre à un club vit dans `clubs/<slug>/` : son contenu commercial, son plan, son modèle 3D, son
identité visuelle et son ambiance. Le code commun (`src/`, `art/scripts/`) ne nomme aucun club : il lit la
définition validée du club et l'applique. **Ajouter un club = créer son dossier et l'enregistrer dans
`clubs/registry.ts`**, rien d'autre.

## Arborescence d'un club

```
clubs/
  registry.ts               les clubs servis (`clubs`) et les brouillons du Studio (`drafts`) — le seul endroit où enregistrer un club
  <slug>/
    index.ts                defineClub({ content, layout, brand, ambiance, assets }) : valide et recoupe les fichiers
    content.json            la soirée en vente : club, événement, zones, tables, prix, conditions
    layout.json             plan en mètres (zones, tables, escaliers…), lu par Blender et par le web
    brand.json              identité dans l'interface : accent, dorure, teintes des niveaux, police, logo, emblème
    ambiance.json           ambiance 3D : light show, couleurs des FX, panneaux de reflets, finition des matières
    public/                 bundle web versionné, servi sous /clubs/<slug>/ : <slug>.glb, lm/*.webp, lightmaps.json
    scene.json              scène Blender : palette de matières, murs, enseignes, structure, globes, décor, éclairage
    reference/              croquis et plans que l'on a le droit de versionner
    README.md               sources, statut (démo, pilote…), ce qui reste à valider avec le club
    <slug>.test.ts          attentes propres au club (facultatif)
    studio/                 historique VYRA Studio : brief, note de recherche, runs (journaux, rendus, captures), revues, retours, notes, leçons
    build/                  .blend, textures générées, export brut — ignoré par git, régénérable
    private/                photos et plans tiers (sources) — ignoré par git, jamais publié (le dépôt est public)
```

`public/` est recopié dans `public/clubs/<slug>/` (ignoré par git) par `scripts/sync-club-assets.mjs`, lancé
automatiquement par `pnpm dev`, `pnpm build` et `pnpm assets:optimize` (`pnpm assets:sync` à la main).

La page `/<slug>/<event>` charge le club côté serveur et transmet sa seule définition au client : ajouter des clubs
n'alourdit pas la page des autres.

## Ajouter un club

Le plus simple : **VYRA Studio** (`pnpm studio`, voir `studio/README.md`) fait tout ce qui suit à partir d’un brief et
de photos, et partage le club par une pull request. À la main :

1. **Dossier** : `clubs/<slug>/` (minuscules, chiffres et tirets : `809-social-club`). Les photos reçues du club
   vont dans `private/`, les croquis et plans diffusables dans `reference/`.
2. **Plan** — `layout.json` : bâtiment, niveaux, zones (`tier` : `lounge` / `vip` / `prestige`, niveau 0 ou 1),
   tables (id, zone, type, position, orientation), caméras, et le cas échéant les espaces debout `standing`
   (voir plus bas). Axes et champs : `docs/3d-pipeline.md`, schéma : `src/lib/venue/layout.ts`. `club` = le slug.
3. **Contenu** — `content.json` (schéma : `src/lib/schema.ts`) : mêmes ids de zones et de tables que le plan, même
   tier par zone. Une démo porte `"demo": true`, une mention qui commence par « Démo » et
   `"offersValidatedAt": null` (aucune offre réelle avant l'accord écrit du club, VYR-15).
4. **Modèle 3D** — `scene.json` décrit tout ce que le plan ne dit pas (partir de celui du Naho) ; le constructeur
   générique `art/scripts/build_club.py` en tire la salle, sans code propre au club. Puis :

   ```bash
   "C:/Program Files/Blender Foundation/Blender 5.1/blender.exe" -b -P art/scripts/build_club.py -- --club <slug> --previews
   "C:/Program Files/Blender Foundation/Blender 5.1/blender.exe" -b clubs/<slug>/build/<slug>.blend -P art/scripts/bake_export.py
   pnpm assets:optimize <slug>
   ```

5. **Identité** — `brand.json` et **ambiance** — `ambiance.json` : partir de ceux du Naho (référence ci-dessous).
   Chaque matière du GLB qui mérite mieux que l'aspect « bake seul » reçoit une finition.
6. **Définition** — `index.ts` :

   ```ts
   import { defineClub } from "@/lib/clubs/club"

   import ambiance from "./ambiance.json"
   import brand from "./brand.json"
   import content from "./content.json"
   import layout from "./layout.json"
   import assets from "./public/lightmaps.json"

   export default defineClub({ content, layout, brand, ambiance, assets })
   ```

7. **Enregistrement** — dans `clubs/registry.ts` : `import monClub from "./<slug>"` et l'ajouter à `clubs` (en ligne)
   ou à `drafts` (brouillon : servi en local, dans les tests et sur les previews Vercel, jamais sur le site en ligne —
   c'est là que VYRA Studio enregistre les clubs qu'il génère). Publier un brouillon = le passer dans `clubs`.
8. **Vérifier** — `pnpm check`, puis `pnpm dev` → `http://localhost:3000/<slug>/<event>`. La page d'accueil liste les
   démos automatiquement.

## Ce qui est vérifié

| Quand                                    | Quoi                                                                                                                                                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Au chargement (`defineClub`)             | chaque fichier contre son schéma zod ; contenu ↔ plan zone par zone et table par table (ids, tiers, zone de chaque table) ; même club partout. Une erreur liste tous les problèmes et fait échouer le build.                                      |
| `pnpm test`, pour chaque club enregistré | bundle présent et versionné (empreintes) ; finitions ↔ matières du GLB, lightmaps ↔ nœuds ; couleurs fournies pour chaque FX du modèle ; cadrages caméra (vue d'ensemble, zones, tables, place assise) ; vue des offres ; démo étiquetée « Démo » |
| `clubs/<slug>/<slug>.test.ts`            | ce qui est propre au club (ex. Naho : ordre des prix par tier, table vendue du lounge Gold)                                                                                                                                                       |

## Référence — les tables de `content.json`

| Champ                    | Rôle                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `capacity.min` / `max`   | groupe accepté pour la table : bornes du sélecteur de personnes, vérifiées aussi à l'envoi de la demande    |
| `minimumSpend`           | minimum de consommation de la table, en euros entiers ; `null` = prix sur demande (jamais `0`)              |
| `surcharge` (facultatif) | `{ "includedGuests": 6, "perGuest": 150 }` : au-delà de 6 personnes, +150 € de minimum par personne ajoutée |
| `deposit` (facultatif)   | acompte demandé à la confirmation, déduit du minimum : `{ "percent": 20 }` ou `{ "amount": 200 }`           |
| `status`                 | `available`, `on_request` ou `sold`, déclaré par le club : jamais un stock en temps réel                    |

Quand l'acheteur change le nombre de personnes, la fiche recalcule le minimum, la part par personne et
l'acompte ; la demande enregistre les montants affichés. Une demande ne déclenche aucun paiement.

Une soirée à l'affiche (un DJ, un artiste) prend un sous-titre, `event.subtitle` (« DJ guest », 40 caractères au plus) :
son nom (`event.name`) passe alors en grandes capitales à l'ouverture, sur la vue d'ensemble et sur la page d'accueil.

## Référence — espaces debout et billets

Un club qui vend des entrées par zone (fosse, front row…) les montre dans la visite sans les vendre : chaque espace
debout du plan a un billet dans le contenu, avec le même id. La visite place un repère sur la vue d'ensemble, montre
l'espace à hauteur d'yeux (on regarde autour, sans se déplacer) et renvoie vers la billetterie, nommée.

| Fichier        | Champ                        | Rôle                                                                                                                                |
| -------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `layout.json`  | `standing[]`                 | `{ "id", "level", "x": [min, max], "y": [min, max], "facing" }` : rectangle de l'espace et direction du regard (0 = est, 90 = nord) |
| `content.json` | `tickets[]`                  | `{ "id", "name", "shortName", "description", "fromPrice" }` : texte court, prix « dès » par personne en euros entiers               |
| `content.json` | `tickets[].url` (facultatif) | page de billetterie de ce billet ; sinon `event.ticketUrl`                                                                          |

Les ids des espaces debout ne doivent pas reprendre ceux des zones. `defineClub` vérifie qu'un billet a son espace et
qu'un espace a son billet.

## Référence — `brand.json`

| Champ                          | Rôle                                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `accent.color` / `deep` / `on` | accent (action principale, prix, focus), son extrémité sombre, texte posé dessus               |
| `accent.pill`                  | haut et bas du dégradé du bouton principal (l'accent au milieu)                                |
| `accent.foil`                  | dorure (clair, milieu, sombre) des prix, du logo et de l'emblème                               |
| `accent.name`                  | nom français de la couleur, pour les textes (« le meilleur est **en or** »)                    |
| `tiers.<tier>.color` / `deep`  | teinte de chaque niveau d'offre : pastilles, tuiles de zone, sol des zones, halos des tables   |
| `font`                         | police de l'interface parmi celles de `src/app/fonts.ts` (`jost`)                              |
| `wordmark` (facultatif)        | nom dessiné : `viewBox`, `strokeWidth`, tracés SVG — sinon le nom en capitales espacées        |
| `tagline` (facultatif)         | petites capitales sous le logo à l'ouverture (« C L U B »)                                     |
| `emblem` (facultatif)          | emblème : formes pleines (montent) et traits `stroke` (se dessinent) — sinon l'initiale        |
| `ui.tone` (facultatif)         | `vivid` (défaut) : tuiles brillantes aux couleurs des niveaux ; `sober` : tuiles graphite      |
|                                | avec un point de couleur, angles plus droits, bouton principal sans brillance                  |
| `ui.compare` (facultatif)      | `true` (défaut) : comparatif des tables ; `false` le retire (fiche, dock, recherche, touche C) |

La page du club pose ces valeurs en propriétés CSS sur `:root` (`--brand`, `--brand-deep`, `--brand-on`,
`--brand-hi`, `--brand-lo`, `--foil-hi`, `--foil`, `--foil-lo`, `--lounge`, `--lounge-deep`…, `--club-font`) ;
l'interface ne lit que ces jetons. Ajouter une police : la charger dans `src/app/fonts.ts` (variable
`--font-<clé>`) et ajouter la clé à `fontKeySchema` (`src/lib/clubs/brand.ts`).

## Référence — `ambiance.json`

| Champ                       | Rôle                                                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `show.bpm`, `show.palette`  | light show des globes (`fx_spheres`) : tempo et couleurs HDR linéaires `[r, g, b]` (2 à 8), compilés dans le shader         |
| `beams.palettes`            | couleurs des lyres, par paires, une paire toutes les 9 s                                                                    |
| `ledRain` (si `fx_ledrain`) | deux couleurs `#rrggbb` et intensité de la pluie de LED                                                                     |
| `screen` (si `fx_screen`)   | mur LED : barres de `low` à `high`, fond `backdrop` (gauche, droite), en HDR linéaire                                       |
| `environment`               | reflets : fond et panneaux lumineux (`form` rect / ring / circle, `color`, `intensity`, `position`, `target`, `scale`)      |
| `finishes`                  | finition par nom de matière Blender : un préréglage, ou `{ "preset", "tint", "roughness", "metalness", "envMapIntensity" }` |
| `intro` (facultatif)        | ouverture : `flight` (défaut, vol de caméra sur `cameras.intro`) ou `neon` (le club se dessine en néon, puis se construit)  |
| `night` (facultatif)        | `{ "color" }` : propose l'ambiance de nuit (salle sombre, toutes les lumières dans cette couleur, fumée) ; colore le néon   |

Les panneaux de reflets sont en espace three.js (mètres, y vers le haut) et regardent `target` (l'origine par défaut).
Ils ne servent qu'aux reflets et au brillant ; la lumière diffuse vient du bake.

Préréglages de finition (`src/components/scene/fx/finishes.ts`) :

| Préréglage       | Rendu                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| `glazed-tiles`   | carrelage émaillé : brillance et relief tirés de la texture           |
| `concrete`       | béton : mat, relief marqué                                            |
| `lacquered-wood` | bois verni                                                            |
| `foliage`        | mur végétal : relief fort, semi-mat                                   |
| `brushed-metal`  | métal brossé (couleur Blender) ; garde ses reflets même sans lightmap |
| `brushed-gold`   | laiton brossé ; garde ses reflets même sans lightmap                  |
| `satin-metal`    | métal satiné (lames, profilés) ; garde ses reflets même sans lightmap |
| `marble`         | marbre veiné procédural, vernis en qualité haute                      |
| `leather`        | cuir grainé, léger vernis                                             |
| `velvet`         | velours : reflet satiné dans la couleur du tissu                      |
| `glass`          | verre physique transparent, double face                               |

Une matière absente de `finishes` garde l'aspect du bake (et un léger assombrissement si elle n'a pas de lightmap).
