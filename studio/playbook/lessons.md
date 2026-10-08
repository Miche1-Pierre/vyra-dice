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
