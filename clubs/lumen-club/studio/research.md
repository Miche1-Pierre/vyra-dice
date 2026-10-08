# Lumen Club — note de recherche

> Générée par VYRA Studio le 2026-10-08. Sources : 0 photo, 0 plan, brief de l'équipe (seule source).

## En bref

Lumen Club est un club **fictif** (le brief le dit explicitement) imaginé à Toulon pour tester VYRA Studio : un ancien
entrepôt portuaire reconverti en nef d'environ 24 × 16 m sous 8 m de plafond. Le style est industriel chic : brique
sombre, charpente métallique apparente, bar en laiton et marbre vert. Ce qui doit frapper dans la démo, c'est le
contraste entre les globes ambrés suspendus au-dessus de la piste et la pluie de LED bleu pétrole, vu depuis la
mezzanine en L et la loge prestige face au mur d'écrans de la scène.

## Identité

- **Nom** : Lumen Club (slug `lumen-club`). Fait (brief).
- **Ville** : Toulon. Fait (brief).
- **Adresse** : aucune. Club fictif : on n'en invente pas. `club.address` = « Toulon » seul.
- **Contacts** : aucun (ni e-mail, ni Instagram, ni téléphone). `club.contact` restera vide (`{}`, le schéma l'accepte),
  pas de `ticketUrl`.
- **Style** : industriel chic, entrepôt portuaire. Fait (brief).
- **Couleur signature** : laiton `#c9a46a`. Fait (brief) → `accent`, `accent.name` « laiton ».
- **Couleurs secondaires** (codes **supposés**, le brief ne donne que les noms) :
  - bleu pétrole (pluie de LED) ≈ `#0f5f6b` ;
  - vert marbre (bar) ≈ `#1e4a3c` ;
  - brique sombre (murs) ≈ `#4a2b23` ;
  - ambre (globes) ≈ `#ffb05a`.
- **Logo** : le nom LUMEN en capitales fines. Fait (brief). La forme exacte n'est pas donnée ; je propose un
  `wordmark` en traits fins (L, U, M, E, N : droites et un arc, faisables proprement en M/L/V/A). Pas d'emblème :
  rien dans le brief ne l'appelle, je l'omets.
- **Ton** : sobre, premium, vocabulaire de lumière et de port (nef, quai, laiton, halo), à garder discret.

## Le lieu

Toutes les cotes ci-dessous viennent du brief (« environ ») ou sont des **suppositions** de mise en plan : aucune photo
ni aucun plan ne permet de les estimer.

**Volume** : une seule nef double hauteur, ~24 × 16 m, 8 m sous plafond (brief). Orientation **supposée** : grand axe
nord-sud (16 m en x, 24 m en y), pour que la scène au sud soit sur un mur pignon et que la loge prestige, au nord,
lui fasse face sur toute la longueur. Origine au centre de la nef : x ∈ [-8 ; 8], y ∈ [-12 ; 12].

**Mezzanine en L** (brief : côtés nord et est) — proportions supposées :
- branche nord : x ∈ [-8 ; 8], y ∈ [7,5 ; 12] (~4,5 m de profondeur), accueille la loge prestige au centre ;
- branche est : x ∈ [4 ; 8], y ∈ [-6 ; 7,5] (~4 m de profondeur), s'arrête avant la scène pour la laisser dégagée ;
- plancher à 3,6 m, dalle 0,4 m (valeurs du Naho, dans la fourchette de `dimensions.md`) → ~4 m libres au-dessus de
  la mezzanine sous les 8 m ;
- garde-corps 1,05 m, à traiter en acier noir et main courante laiton (supposition cohérente avec le style) ;
- escalier droit de 20 marches (~5 m de course) : position supposée le long du mur ouest, montant vers la branche
  nord ; un second accès VIP n'est pas prévu.

**Rez-de-chaussée** (implantation supposée, du sud au nord) :
- **scène DJ** au sud (brief), y ∈ [-12 ; -9], plateau ~0,9 m, **mur d'écrans LED** sur tout le pignon sud (brief),
  disons 10–12 m × 4 m (supposition) ;
- **piste** devant la scène, y ∈ [-9 ; -1], sous les globes ;
- **bar central** en laiton et marbre vert (brief) : îlot rectangulaire supposé ~6 × 2,5 m, centré vers y ≈ 2,5,
  entre la piste et la loge ; comptoir 1,12 m ;
- **poteaux** : la charpente métallique apparente (brief) suggère des fermes de toit ; des poteaux portant la
  mezzanine sont supposés en bordure de dalle (≈ tous les 4 m), à éviter dans l'implantation des tables ;
- **circulation** : entrée supposée à l'ouest ou au nord-ouest (inconnue), passage ≥ 1,2 m devant chaque rangée.

**Éléments signature** (brief) : charpente métallique apparente (fermes en `trusses` sous le plafond), globes ambrés
au-dessus de la piste, pluie de LED bleu pétrole, mur d'écrans LED derrière le DJ, bar laiton / marbre vert.
L'emplacement de la pluie de LED n'est pas précisé : je propose de la mettre **au-dessus du bar central** (6,5–7,5 m),
pour séparer les deux signatures — ambre sur la piste, bleu pétrole sur le bar — et éviter qu'elles se noient l'une
dans l'autre.

**Matières** (brief + finitions supposées) : brique sombre (`concrete` à défaut d'un préréglage brique, à tester),
acier noir de charpente (`satin-metal`), laiton (`brushed-gold`), marbre vert (`marble`), banquettes en velours
(`velvet`) ou cuir (`leather`), sol béton ciré (supposition, `concrete`).

## L'offre

D'après le brief (« environ ») ; répartition par zone, capacités et prix sont des **suppositions de démo** :

| Zone (id proposé)  | Tier     | Niveau | Tables      | Capacité | Minimum (démo) | Implantation supposée                                |
| ------------------ | -------- | ------ | ----------- | -------- | -------------- | ---------------------------------------------------- |
| `lounge-quai`      | lounge   | 0      | l1–l4       | 4–6      | 300–400 €      | mur ouest, face à la piste                           |
| `lounge-nef`       | lounge   | 0      | l5–l8       | 4–6      | 350–450 €      | sous la branche est de la mezzanine, face à l'ouest  |
| `vip-coursive`     | vip      | 1      | v1–v4       | 6–8      | 650–850 €      | branche est, le long du garde-corps, vue piste/scène |
| `vip-verriere`     | vip      | 1      | v5–v6       | 6–8      | 750–900 €      | branche nord, de part et d'autre de la loge          |
| `prestige-loge`    | prestige | 1      | p1          | 10–15    | 2 500 €        | centre de la branche nord, dans l'axe de la scène    |

Contrôle d'encombrement (gabarits de `dimensions.md`) :
- branche est : 13,5 m de long, 4 VIP à 3,1 m + 0,3 m → 13,6 m : **juste** ; si ça ne passe pas avec l'escalier et
  les poteaux, passer à 3 VIP à l'est et 3 au nord ;
- branche nord : 16 m − 4 m (angle de l'est) = 12 m utiles ; loge 4,4 m + 2 VIP à 3,1 m + marges → ~11,8 m :
  **juste** aussi, l'escalier doit arriver à l'ouest hors de cette rangée ;
- rez-de-chaussée : 4 lounges à 2,7 m + 0,3 m le long de chaque côté → 12 m, tient entre la scène et le bar.

`requestPrefix` : `LMN`. `event` : slug `samedi-soir`, nom « Samedi soir » (brief ; le playbook propose `samedi` par
défaut, le brief prime), date supposée 2026-10-10 (samedi suivant), ouverture supposée 23:30, `offersValidatedAt: null`.
Quelques statuts pour faire vivre la démo : l2 et v3 `sold`, v6 `on_request`, p1 `on_request` (supposition).

## Ambiance

- **Lumières** (brief) : globes ambrés suspendus au-dessus de la piste ; pluie de LED bleu pétrole ; mur d'écrans LED
  derrière le DJ. Suppositions : 18–24 globes de rayon ≤ 0,5 m entre 5,5 et 7 m, jamais à l'aplomb d'une table VIP
  (leçon Naho) ; 8–10 lyres sur les fermes de la charpente.
- **Light show** (supposé) : palette ambre / blanc chaud / laiton / bleu pétrole / cyan froid, ~122 BPM ; paires de
  lyres ambre + bleu pétrole, blanc chaud + cyan.
- **Lightformers** (supposé) : un panneau chaud au-dessus de la piste (globes), un panneau bleu pétrole au-dessus du
  bar (pluie de LED), un panneau froid au sud (écrans).
- **Son et scène** : rien dans le brief sur la programmation musicale. Enceintes supposées de part et d'autre de la
  scène.
- **Soirée type** : samedi soir (brief). Ambiance supposée : lumière chaude et basse au rez-de-chaussée, la nef qui
  s'allume progressivement vers la scène.

## Faits, suppositions, manques

| Sujet                      | Statut      | Détail et source                                                                  |
| -------------------------- | ----------- | --------------------------------------------------------------------------------- |
| Existence du club          | fait        | Club **fictif**, créé pour tester le Studio (brief)                               |
| Nom, slug, ville           | fait        | Lumen Club, `lumen-club`, Toulon (brief)                                          |
| Adresse                    | manque      | Aucune ; ville seule dans `content.json`                                          |
| Contacts, billetterie      | manque      | Aucun ; `contact: {}`, pas de `ticketUrl`                                         |
| Couleur signature          | fait        | Laiton `#c9a46a` (brief)                                                          |
| Bleu pétrole, vert, brique, ambre | supposition | Noms dans le brief, codes hex choisis par le Studio                       |
| Logo                       | supposition | « LUMEN en capitales fines » (brief) ; tracé exact dessiné par le Studio          |
| Dimensions de la nef       | fait*       | ~24 × 16 m, 8 m sous plafond (brief, « environ ») — *fait fictif               |
| Orientation du grand axe   | supposition | Nord-sud, pour mettre la scène sur un pignon                                      |
| Mezzanine en L nord + est  | fait        | Brief ; profondeurs (4–4,5 m) et hauteur (3,6 m) supposées                        |
| Escalier                   | manque      | Non mentionné ; supposé le long du mur ouest                                      |
| Entrée                     | manque      | Non mentionnée ; supposée à l'ouest                                               |
| Poteaux                    | supposition | Déduits de la mezzanine ; trame de 4 m supposée                                   |
| Bar central laiton / marbre vert | fait  | Brief ; dimensions et position exacte supposées                                   |
| Scène DJ au sud + mur LED  | fait        | Brief ; hauteur 0,9 m et taille du mur d'écrans supposées                         |
| Globes ambrés sur la piste | fait        | Brief ; nombre, rayon, hauteur supposés                                           |
| Pluie de LED bleu pétrole  | fait        | Brief ; **emplacement non précisé**, supposé au-dessus du bar                     |
| Nombre de tables           | fait*       | ~8 lounges, 6 VIP, 1 prestige (brief, « environ »)                                |
| Découpage en zones         | supposition | 2 zones lounge, 2 zones VIP, 1 loge                                               |
| Capacités et prix          | supposition | Fourchettes de `dimensions.md`, données de démo                                   |
| Statuts des tables         | supposition | Choisis pour la démo                                                              |
| Soirée                     | fait        | Samedi soir, slug `samedi-soir` (brief) ; date et horaire supposés                |
| Matières (sol, banquettes) | supposition | Béton ciré, velours ; non précisées                                               |

## Questions pour le club

Le club étant fictif, ces questions s'adressent à l'équipe VYRA (et serviraient de trame pour un vrai club) :

1. Confirmer l'orientation (grand axe nord-sud, scène sur le pignon sud) et la profondeur de la mezzanine.
2. Où sont l'entrée et l'escalier (ou les escaliers) vers la mezzanine ?
3. La pluie de LED est-elle au-dessus du bar, de la piste, ou ailleurs ?
4. Répartition des 6 VIP entre les deux branches du L (4 + 2 proposé) et place exacte de la loge prestige.
5. Valider les teintes secondaires (bleu pétrole, vert marbre) et le tracé du logo LUMEN.
6. Valider les prix de démo (lounge 300–450 €, VIP 650–900 €, loge 2 500 €) et les statuts.
7. Faut-il un disclaimer qui précise « club fictif » en plus de « Démo — » ? Proposition :
   « Démo — club fictif, plan, tables et prix imaginés pour illustrer VYRA. »
