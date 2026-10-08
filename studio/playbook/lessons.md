# Leçons

Ce que chaque club nous a appris. Le Studio ajoute ici les leçons acceptées par l'équipe, avec leur date et leur club ;
l'historique git garde la trace des ajouts.

## Naho Club (La Garde) — 2026-10-07

- **Les tables sont le produit** : une douche lumineuse par table, des banquettes en velours de la teinte du tier, des
  étiquettes de prix lisibles depuis la vue d'ensemble. Une table qu'on ne voit pas ne se vend pas.
- **Coupe (cutaway)** : murs et plafond mono-face tournés vers l'intérieur ; vus de l'extérieur ils disparaissent et
  la vue d'ensemble montre la salle. Ne jamais faire de murs double face.
- **Enseigne murale** vue à travers la coupe = lettres inversées : la mettre dans son propre objet
  `fx_sign_wall_<direction>` pour que le site la cache quand on voit le dos du mur.
- **Nœud multi-matériaux** : glTF le découpe en `<nœud>_1`, `<nœud>_2`… ; la lightmap appartient au nœud. Garder les
  objets lightmappés simples (une matière principale) quand c'est possible.
- **Globes** : trop gros ou trop bas, ils masquent les tables en vue zone ; rayon ≤ 0,5 m, au-dessus de 5 m, et
  jamais à l'aplomb direct d'une table VIP.
- **Mobile d'abord** : cadrage portrait plus large, étiquettes qui ne se chevauchent pas, ≤ 300 000 triangles.
- **Identité** : reprendre le logo et sa couleur dans l'interface (accent, logo dessiné), pas seulement dans la 3D.

## Lumen Club (Toulon) — 2026-10-08

- **Émissifs : une teinte saturée et une intensité modérée, sinon le rendu tire au blanc** : Avec une forte émission, la couleur d'une source lumineuse part vers le blanc au rendu et la signature disparaît. Au Lumen, la pluie de LED bleu pétrole à 12 sortait cyan presque blanc, et les globes ambrés à 4 sortaient blanc rosé. Choisir une teinte plus profonde et plus saturée que la couleur visée (pétrole `#0b8796`, ambre/miel bien saturés) et partir de faibles intensités : environ 6 pour une pluie de LED, 2,4 à 2,6 pour les globes. Même logique pour le wash de scène : 600 W écrasaient le mur d'écrans, il a fallu descendre à environ 420 W. Reporter les mêmes couleurs dans `ambiance.json` (pluie, lightformer) pour que le site corresponde au bake. Ces valeurs viennent d'un seul club et restent à confirmer sur les suivants.
- **Vérifier les orientations permises par les briques avant de dessiner le plan** : La brique `stage` ne pose la scène que contre un mur nord (écran en `stage.y1`, tourné vers le sud) et les escaliers ne partent que vers le sud ou l'ouest. Si le brief place la scène ailleurs, décider dès la note de recherche de tourner le plan (le Lumen l'a été de 180°), le signaler comme écart dans le README du club, puis relire tous les textes qui citent une direction ou un voisinage : `description` et `view` des zones et des tables. Au Lumen, la description de Tribord est restée fausse après la rotation. Brique à proposer : une option d'orientation (`side: n|s|e|w`) pour `stage` et pour les escaliers.
