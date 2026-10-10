# 809 Social Club — La Garde

Démo de prospection (VYR-59) pour la soirée **Rudboy** (DJ guest, 10/10/2026), sur le modèle du Naho. Sources :
`studio/brief.json`, `studio/research.md`, `private/sources/` (photos Instagram / Facebook, logo, flyer, croquis et
coupe de l'équipe). Rien n'en est copié.

| Statut         |                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------- |
| Offres         | **démo** : tables, capacités, prix, statuts et prestations supposés (`offersValidatedAt: null`) |
| Demandes       | mode démo (`demo: true`), rien n'est transmis au club (VYR-15)                                  |
| Contacts       | ceux de l'équipe (WhatsApp, e-mail, Instagram `809_club`), pas ceux du club                     |
| Plan           | reconstitué depuis le croquis rez-de-chaussée / étage, **aucune cote mesurée**                  |
| Soirée         | Rudboy, 10/10/2026 (flyer) ; ouverture 23:30 **supposée** ; pas de billetterie connue           |
| Accord du club | aucun : aucune offre réelle avant l'accord écrit                                                |

## Le lieu (suppositions)

- Salle de 37,5 × 30 m (x −18,75…18,75, y −15…15) : la première version (25 × 20 m) a été agrandie ×1,5 à la demande
  de l'équipe. Mezzanine à 3,5 m (dalle 0,4 m), plafond à 8 m, estimés sur les photos (personnes, garde-corps,
  marches) et inchangés.
- Orientation du croquis conservée : nord en haut, **entrée à l'est** par un sas de 4,5 m (y 2,25…6,75).
- Étage en plateformes autour du grand vide central : bande nord sur toute la largeur (4,5 m), **dalle ouest
  au-dessus du lounge Côté Cabine** (circulation sans tables, garde-corps côté piste, choix de l'équipe), palier
  ouest où arrive l'escalier ouest, carré prestige en L au-dessus du nord du bar, bande est (6,15 m), balcon sud
  au-dessus des alcôves et une **passerelle sud-est** (supposée) où arrive l'escalier est.
- Escaliers (sens donné par l'équipe, flèches du croquis = sens de montée) : l'escalier nord-ouest part de l'est
  (x −9,6) et monte vers l'ouest jusqu'au palier ouest ; l'escalier est part du nord (y −6) et monte vers le sud
  jusqu'à la passerelle sud-est. 20 marches de 0,33 m : leur longueur n'a pas été agrandie.
- Bar central 7,5 × 6 m chanfreiné. À son angle sud-ouest, un **pilier** Ø 0,9 m du sol au plafond, habillé de bandes
  LED vertes qui s'écartent au plafond (photo fb-salle-verte-arche-led-bar, précision de l'équipe) ; déclaré dans
  `layout.columns`.
- Cabine DJ en biais au sud-ouest, tournée vers le nord-est, sur une plateforme de 0,9 m (6,6 m de long), sous le vide
  double hauteur (aucun plancher au-dessus).
- **Scène DJ** (retour f8, photos ig-cabine-dj-faisceaux-co2, fb-salle-rouge-cabine-escalier,
  fb-salle-ambre-mezzanine-escalier, ig-salle-rouge-mezzanine-ecrans) : une estrade de 0,9 m prolonge la cabine
  jusqu'aux murs du coin sud-ouest (x ≤ −7,7, y ≤ −7,75). **Écrans** (retour f9, photos de l'équipe) : un grand écran
  autoportant de 6 × 3,4 m sur la scène, parallèle à la façade de la cabine, 4,2 m derrière elle, le bas à 3,2 m
  (au-dessus de la tête du DJ), encadré de deux écrans verticaux de 1 × 3 m ; deux écrans-rubans de 10 × 1,2 m,
  légèrement incurvés, sur les nez de mezzanine ouest et nord, tournés vers la piste ; « RUDBOY » en grandes lettres
  blanches sur les trois. Boule à facettes au-dessus de la piste et deux grappes d'enceintes suspendues de part et
  d'autre de la cabine. Positions et tailles **supposées** (décrites par l'équipe, sans cotes) ; derrière la cabine, 4 à 7 m
  d'espace debout pour les artistes, les MC et les percussionnistes. Colonnes d'enceintes au sol de part et d'autre, retours sur le pupitre, barre de cinq
  lyres au-dessus, quatre jets de CO2 au bord, garde-corps en verre sur les bords en surplomb. Un escalier de quatre
  marches contre le mur sud, sous le balcon sud, donne accès à la scène. Forme, profondeur et position de l'accès sont
  **supposées**.
- Lounges sur **estrades de 0,4 m** (`raised`), nez de marche LED ambre, garde-corps en verre clair d'environ 1 m côté
  piste, et une ouverture de 1,2 m avec deux marches à chaque extrémité (précisions de l'équipe).
- Élément « table » au nord du rez-de-chaussée : modélisé en comptoir mange-debout de 6 m (`comptoir_nord`). **À
  confirmer.**
- Bar VIP coudé à l'étage : comptoir le long du mur nord (x 5,4…16,65), puis retour le long du mur est.
- WC au rez-de-chaussée, angle nord-est, sous la bande nord : emplacement **inventé**.
- Matières : noir mat partout (albédo des murs `#47444b`, pour qu'ils ne cuisent pas au noir), sol béton, estrades en
  pierre sombre, garde-corps métal noir avec un vitrage presque invisible (alpha 0,06). Velours aux couleurs des
  niveaux et plateaux crème (le papier du logo), en fort contraste avec les trois velours. Aucune banquette n'est
  visible sur les photos.

## Écarts aux briques (à proposer en leçon)

- **Cabine DJ en biais** : la brique `stage` ne pose qu'une estrade alignée contre un mur nord. La cabine est construite
  en `beam` (plateforme, pupitre, plateau, platines). La façade a quatre bandeaux LED ambre et les tubes rouge et bleu
  sont aux deux extrémités. La scène DJ est construite en `mesh` (objet `scene_dj` : plateau polygonal, marches en `box` ;
  écrans en `face` dans `fx_signs`, caissons et poteaux dans `rig`), son équipement va dans `rig` (enceintes, retours et jets de CO2 en `beam` / `cylinder`).
  `layout.stage` / `layout.dj` ne sont que des rectangles englobants. Brique à proposer : `stage` avec un `angle` et une
  emprise polygonale.
- **Estrades des lounges** : construites en `mesh` (box, face, beam) dans l'objet `estrades`, le verre dans `glass`, la
  main courante dans `rig`. Brique à proposer : « estrade » lue depuis `raised` (plateau, nez LED, garde-corps et
  marches aux ouvertures).
- **Pilier LED** : un `cylinder` et 32 `beam` verts (8 bandes verticales, puis un éventail de 3,2 m de rayon sous le
  plafond). Brique à proposer : « pilier LED » (rayon, nombre de bandes, éventail).
- **Pas d'écran animé** : `fx_screen` n'existe qu'avec la brique `stage`. Les trois écrans de la scène sont des
  panneaux émissifs fixes (vert, menthe) sur un liseré blanc, posés en biais sur un caisson noir ; leurs coins arrondis
  sont approchés par des polygones de 12 points (`face`), coins à 45°, calculés à la main. Les rubans sont six
  segments plans par ruban (objet `lvl1_ecrans` + `lvl1_fx_strips`, ils s'effacent avec l'étage). `ambiance.screen`
  est donc omis. Brique à proposer : un « écran » posable n'importe où (centre, orientation, taille, rayon des coins,
  courbure), animé par le site, avec un texte optionnel.
- **Boule à facettes** : quatre troncs de cône à 12 facettes (matière `mirror`), sans reflets animés. Brique à
  proposer : « boule à facettes » avec ses éclats de lumière animés par le site.
- **Grappes d'enceintes** : brique `speakers`, caissons alignés sur l'axe x (la brique ne sait pas les orienter en
  biais vers la piste).
- **Lignes LED du plafond** : quatre lignes droites ambre à 7,75 m. Les arcs des photos ne sont pas reproduits.
- **Bannières blanches verticales** : non modélisées. **Jets de CO2** : buses fixes seulement, sans panache animé.
- **Sans globes** ni pluie de LED (brief). `layout.ledRain` est une valeur de remplissage exigée par le schéma : rien
  n'est construit.
- RUDBOY est en néon sur le mur nord, dans l'objet partagé `fx_signs` (la brique `text` n'a pas d'objet propre). Vu de
  l'extérieur côté nord, il apparaîtra inversé ; le logo 809, lui, est dans `fx_sign_wall_s`. Sur les écrans, RUDBOY
  est posé devant un caisson noir : vu de dos, le caisson le cache. Les deux rubans sont sur les nez qui font face
  aux vues d'ensemble (ouest et nord) pour que le nom s'y lise à l'endroit ; un ruban sur le nez sud aurait été vu de
  dos.

## L'offre (démo)

| Zone          | Niveau   | Tables  | Capacité | Minimum       | Statuts         |
| ------------- | -------- | ------- | -------- | ------------- | --------------- |
| Côté Cabine   | lounge   | L1–L3   | 4–6      | 300–350 €     | L2 vendue       |
| Bord de Piste | lounge   | L4–L7   | 4–6      | 350–450 €     | L6 vendue       |
| Les Alcôves   | lounge   | L8–L10  | 4–6      | 300 €         |                 |
| Galerie Nord  | VIP      | V1–V5   | 6–8      | 700–800 €     | V2 vendue       |
| Balcon Sud    | VIP      | V6–V9   | 6–8      | 650–750 €     |                 |
| Galerie Est   | VIP      | V10–V13 | 6–8      | 700–750 €     | V10 sur demande |
| Carré 809     | prestige | P1–P3   | 8–14     | 1 800–2 500 € | P1 sur demande  |

26 tables, placées selon les gabarits de `dimensions.md` (gabarits inchangés après l'agrandissement), pas selon les
hachures du croquis. Préfixe des demandes : `SCL` (de « Social Club », le nom commence par des chiffres). Conditions
reprises du Naho (arrivée avant 01h00, tenue, 18 ans) : à faire valider.

## Fichiers

| Fichier         | Contenu                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| `content.json`  | soirée Rudboy : 7 zones, 26 tables, prestations, conditions                                          |
| `layout.json`   | plan en mètres (mezzanines en anneau, bar central et pilier, cabine en biais, estrades, 2 escaliers) |
| `brand.json`    | rouge 809, Jost, wordmark « 809. » redessiné et simplifié, niveaux vert / bleu / jaune               |
| `ambiance.json` | faisceaux vert laser / menthe / blanc / rouge, reflets (pilier, cabine, estrades, bar), finitions    |
| `scene.json`    | scène Blender : cabine en biais, estrades, pilier LED, écrans, boule, RUDBOY, logo, lyres, bake      |

## À vérifier dans les rendus

- Le vert du pilier (`#0cb444`, émission 6) et le rouge du logo (émission 4) : gardent-ils leur teinte ?
- Les tables sous dalle (Côté Cabine sous la dalle ouest, Alcôves sous le balcon sud) par rapport aux tables à
  découvert : downlights à 170–200 W, à ajuster.
- La vue d'ensemble du site (distance fixe dans `camera.ts`) : la salle agrandie tient-elle dans le cadre ?

## À valider avec le club

Dimensions et hauteurs, contour de chaque plateforme (le prestige passe-t-il au-dessus du bar ? la passerelle sud-est
existe-t-elle ?), hauteur des estrades et de la cabine, forme de la scène DJ et position de son accès, nature de l'élément « table » au nord, nombre et position des
tables, capacités, minimums, prestations, couleur des banquettes, heure d'ouverture et conditions de la soirée,
contact de secours affichable, accord écrit avant toute offre réelle.
