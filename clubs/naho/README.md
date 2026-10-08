# Naho Club — La Garde

Démo de prospection (VYR-55, refonte Night Glass VYR-56), en ligne sur `/naho/samedi`.

| Statut         |                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------- |
| Offres         | **démo** : tables, capacités, prix et statuts provisoires, non validés par le club       |
| Demandes       | mode démo, rien n'est transmis (`demo: true`)                                            |
| Plan           | reconstitué depuis le croquis de Pierre (`reference/plan-sketch.png`), cotes provisoires |
| Accord du club | aucun pour l'instant : aucune offre réelle avant l'accord écrit (VYR-15)                 |

## Lecture du croquis

Rouge = étage, hachures violettes / bleues = VIP à l'étage, bleu = une table très chère par zone (prestige), vert =
rez-de-chaussée (lounges). D'où les teintes des niveaux dans `brand.json` : vert, violet, bleu.

## Fichiers

| Fichier            | Contenu                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------- |
| `content.json`     | soirée du samedi : 7 zones, 22 tables, prestations, conditions                               |
| `layout.json`      | plan en mètres (mezzanine en U, bar central, scène DJ, mur végétal, pluie de LED)            |
| `brand.json`       | or de l'enseigne, Jost, logo NΛHO redessiné (A sans barre), soleil levant                    |
| `ambiance.json`    | light show des globes (124 BPM, blanc chaud / rose / lilas / bleu / ambre), finitions        |
| `blender/build.py` | construction de la salle (`blender -b -P clubs/naho/blender/build.py`)                       |
| `public/`          | bundle web : `naho.glb` (~2,1 Mo) et 15 lightmaps WebP (~0,9 Mo)                             |
| `naho.test.ts`     | ce que la démo affiche : ordre des prix par niveau, tables vendues, cadrages propres au lieu |
| `private/photos/`  | photos du club (Instagram, site) pour modéliser — locales, jamais versionnées ni publiées    |

## À valider avec le club

Plan et cotes, nombre et position des tables, capacités, minimums de consommation, prestations par zone,
conditions de la soirée, contacts de secours (e-mail, Instagram, téléphone ou WhatsApp).
