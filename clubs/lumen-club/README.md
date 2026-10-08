# Lumen Club — Toulon

Club **fictif**, créé pour tester VYRA Studio. Aucune source réelle : tout vient du brief de l'équipe
(`studio/brief.json`) et de la note de recherche (`studio/research.md`).

| Statut   |                                                                                    |
| -------- | ---------------------------------------------------------------------------------- |
| Offres   | **démo** : tables, capacités, prix et statuts imaginés (`offersValidatedAt: null`) |
| Demandes | mode démo, rien n'est transmis (`demo: true`)                                      |
| Plan     | imaginé d'après le brief, cotes supposées                                          |
| Identité | nom, ville, laiton `#c9a46a` : brief ; adresse et contacts : aucun (ville seule)   |

## Écart volontaire avec le brief : plan tourné de 180°

Le brief place la scène au sud et la mezzanine en L au nord et à l'est. Les briques de `art/scripts/build_club.py`
ne savent poser la scène que contre un mur **nord** (écran en `stage.y1`, tourné vers le sud) et les escaliers qu'avec
un départ `south` ou `west`. Le plan est donc tourné de 180° : **scène au nord, mezzanine en L au sud et à l'ouest,
loge prestige au sud face à la scène**. La disposition relative du brief est conservée (L sur deux côtés, loge
dans l'axe de la scène, bar central entre la piste et la loge).

## Le lieu (suppositions)

- Nef 16 × 24 m, 8 m sous plafond ; mezzanine à 3,6 m (dalle 0,4 m) : branche sud 4,8 m de profondeur, branche
  ouest 4 m, petit palier à l'est pour l'escalier.
- Escalier droit de 20 marches à l'est, qui monte d'ouest en est vers le palier (emplacement inventé).
- Entrée au milieu du mur sud, sous la mezzanine ; WC au rez-de-chaussée, coin sud-ouest ; petit bar de mezzanine
  derrière Tribord.
- Bar central 3,6 × 6 m, laiton et marbre vert ; pluie de LED bleu pétrole au-dessus (emplacement non précisé par
  le brief).
- Scène DJ de 10 × 3 m, mur d'écrans de 12 × 4 m ; 20 globes ambrés au-dessus de la piste, entre 5,4 et 6,9 m,
  groupés côté est et devant la scène pour laisser libres les vues du site ; 10 lyres sur une structure devant la
  scène (y 5 à 8,6 m).
- Charpente apparente : quatre fermes en treillis à 7,65 m (deux au-dessus de la tribune sud, deux au-dessus de la
  scène) et deux longerons le long des murs. Aucune ferme au-dessus du centre de la nef : vues d'en haut par les
  caméras du site, elles barraient les banquettes. À juger : la charpente se lit-elle encore assez ?
- Lounge Quai (L1–L4) entre y -1,4 et 7,6 : plus au sud, l'escalier masque la vue de table.
- Matières : brique sombre (teinte unie + finition `concrete`, faute de texture brique), béton ciré au sol,
  plancher bois sur la mezzanine, acier noir, velours aux couleurs des niveaux.

## L'offre (démo)

| Zone            | Niveau   | Tables | Capacité | Minimum   | Statuts     |
| --------------- | -------- | ------ | -------- | --------- | ----------- |
| Lounge Quai     | lounge   | L1–L4  | 4–6      | 350–450 € | L2 vendue   |
| Les Arcades     | lounge   | L5–L8  | 4–6      | 300–450 € |             |
| La Coursive     | VIP      | V1–V4  | 6–8      | 650–850 € | V3 vendue   |
| Bâbord          | VIP      | V5     | 6–8      | 750 €     |             |
| Tribord         | VIP      | V6     | 6–8      | 900 €     | sur demande |
| Le Phare (loge) | prestige | P1     | 10–15    | 2 500 €   | sur demande |

Soirée « Samedi soir » (`samedi-soir`), 10/10/2026, ouverture 23:30 (date et horaire supposés), sans billetterie.

## Fichiers

| Fichier         | Contenu                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------- |
| `content.json`  | soirée du samedi : 6 zones, 15 tables, prestations, conditions                            |
| `layout.json`   | plan en mètres (mezzanine en L, bar central, scène DJ au nord, pluie de LED, charpente)   |
| `brand.json`    | laiton, Jost, LUMEN en capitales fines ; niveaux vert / bleu pétrole / cuivre             |
| `ambiance.json` | light show des globes (122 BPM, ambre / blanc chaud / laiton / pétrole / cyan), finitions |
| `scene.json`    | scène Blender : palette, murs de brique, enseigne LUMEN, charpente, 20 globes, bake       |

## À vérifier dans les rendus

- Le corps du bar en laiton métallique (`metallic` 0,9) : risque de paraître sombre une fois cuit dans la lightmap ;
  si c'est le cas, baisser le `metallic` ou passer le corps en marbre et le dessus en laiton.
- La brique en teinte unie : à juger ; une texture brique demanderait une nouvelle brique dans `vyra3d`.
- Le passage derrière la loge (1,25 m) et entre Tribord et le bar de la mezzanine (1,25 m).

## À valider par l'équipe

Orientation du plan (rotation de 180°), emplacement de l'escalier, de l'entrée et de la pluie de LED, répartition
des 6 VIP (4 Coursive + Bâbord + Tribord), noms de zones (thème portuaire), teintes secondaires et tracé du logo,
prix et statuts de démo, texte du disclaimer.
