# Linear — comment on pilote le projet

Workspace : https://linear.app/vyra-dice · Team `VYRA-dice` (clé **`VYR`**) · Projet unique : **Réservation immersive pour clubs**.

Linear est la **source de vérité** du _quoi_ et du _pourquoi_. GitHub porte le _comment_ (code, PR). Aucune tâche
ne vit seulement dans GitHub : les issues GitHub sont désactivées et renvoient vers Linear.

## Documents de référence (dans Linear → Projet → Resources)

| Document                                     | Statut                                                     |
| -------------------------------------------- | ---------------------------------------------------------- |
| Vision de référence — décision du 07/10/2026 | **Fait foi.** Remplace tout cadrage antérieur              |
| Audit préliminaire Artefact — 07/10/2026     | Preuves préliminaires (3 captures), pas de décision        |
| Vision et stratégie — markdown source        | Historique (plateforme VIP, Stripe, CRM…) — **non engagé** |

Règles produit à ne jamais violer dans le code (extraites de la vision) :

1. Une **demande** n'est ni une réservation confirmée ni un blocage de stock. Clic WhatsApp ≠ transmission prouvée. Lien de paiement ≠ encaissement.
2. Le club confirme, refuse et **encaisse dans ses outils**. Pas de paiement intégré au MVP (VYR-20/21 différés).
3. Offres et médias **validés par le club**, datés. Pas de disponibilité « temps réel » sans source fiable.
4. Contact de secours toujours visible en cas d'échec page / rendu / envoi.
5. Inconnu = inconnu : pas de montant, source ou ROAS inventés.

## Jalons (milestones) = portes de décision

| Jalon                                 | Sortie attendue                                                | Issues                    |
| ------------------------------------- | -------------------------------------------------------------- | ------------------------- |
| **G0** Audit ciblé et qualification   | Workflow + protocole H1–H5 documentés ; 3D légère cadrée       | 5, 6, 7, 8, 9, 10, 47, 48 |
| **G1** Accord gratuit et MVP          | Accord écrit, contenus validés, demandes reçues, répétition OK | 11–19, 22–27, 49          |
| **G2** Première soirée et bilan       | Bilan H1–H5 honnête, décision itérer/simplifier/arrêter        | 28, 29, 30                |
| **G3** Itérations et récurrence       | Plusieurs usages réels du 1er club                             | 31, 32, 33, 50            |
| **G4** Dix autres clubs               | 11 clubs en usage réel, stabilité, négociation                 | 34–36, 38–42, 51          |
| **G5** V2 conditionnelle link-in-bio  | Décision fondée                                                | 43, 52                    |
| **G6** V3 conditionnelle signaux Meta | Décision + protocole                                           | 45, 46, 53                |
| Options différées                     | Non engagé (label _Hors périmètre engagé_)                     | 20, 21, 37, 44, 54        |

Un jalon ne démarre que si la porte précédente est validée (issues « Valider Gx »). Les dépendances
(_blocked by_) sont des prérequis concrets : on ne passe pas une issue en _In Progress_ si un bloquant est ouvert,
sauf travail exploratoire explicitement marqué comme tel.

## Labels de domaine → responsable

| Label                     | Responsable       |
| ------------------------- | ----------------- |
| Dev                       | Pierre            |
| Data / analytics          | Pierre            |
| Vente                     | Jonathan          |
| Audit                     | Jonathan          |
| Produit / design          | Pierre + Jonathan |
| Implémentation / adoption | Pierre + Jonathan |
| Opérations / support      | Pierre + Jonathan |
| Hors périmètre engagé     | personne (gelé)   |

Pour un label partagé, l'assignee est celui qui **pilote** l'issue ; l'autre est abonné.

### Issues Pierre (Dev + Data) — vue de travail

- G0 : **VYR-8** protocole H1–H5 · contribue à **VYR-47** (3D légère) et **VYR-48** (transmission)
- G1 : **VYR-12** expérience 3D mobile · **VYR-17** socle données · **VYR-18** publier offres validées · **VYR-19** formulaire + transmission + accusé · **VYR-22** suivi demandes · **VYR-23** refus/annulations · **VYR-24** instrumentation · **VYR-25** contact de secours
- G2 : **VYR-29** bilan H1–H5 · G3 : **VYR-50** · G4 : **VYR-34, 35, 36, 38**

## Le prototype de démo (avant G1)

La vision interdit la **production personnalisée** pour un club avant l'accord écrit (VYR-15). Le prototype
construit maintenant est donc une **démo générique sur un lieu fictif** (données et marque inventées, clairement
étiquetées « démo ») qui sert à :

- **VYR-14** — montrer la proposition au décideur (support de vente de Jonathan) ;
- **VYR-47** — trancher la 3D légère : perf mobile mesurée, coût de production d'un lieu, critère de simplification ;
- **VYR-49** — tester la compréhension des tables / écarts de prix avec de vrais acheteurs ;
- poser le socle technique réutilisé par VYR-12/17/18/19/24/25 une fois l'accord signé.

Il ne publie aucune offre réelle et ne collecte aucune demande réelle tant que G1 n'est pas ouvert.

## Workflow d'une issue

```
Backlog → Todo → In Progress → In Review → Done      (+ Canceled)
```

1. **Todo** : prérequis levés, priorité claire.
2. **In Progress** : branche créée depuis Linear (`Ctrl/Cmd + Shift + .` copie le nom de branche) — format `<type>/VYR-<n>-<slug>` (voir `docs/github.md`). L'intégration GitHub passe l'issue en _In Progress_ au premier push.
3. **In Review** : PR ouverte avec `Closes VYR-<n>`.
4. **Done** : PR mergée **et** « Preuve attendue » jointe (captures, mesures, décision). Chaque issue du projet exige
   une preuve avant Done, en distinguant hypothèses / déclarations du club / résultats vérifiés.

## Écrire une issue (format du projet)

```
### Objectif et périmètre
### Prérequis            (liens VYR-x)
### Critères de validation   (- [ ] …)
### Preuve attendue
### Source et arbitrage  (lien vers la Vision de référence)
```

Conventions : titre à l'infinitif, un seul label de domaine, un jalon, priorité selon la règle du projet
(haute = 1er pilote, moyenne = itérations/déploiement, basse = conditionnel/différé). **Aucun responsable, délai
ou estimation inventé** — on n'assigne que ce qui a été convenu.

## Mises à jour projet

Chaque fin de semaine ou franchissement de porte : _Project update_ (santé On track / At risk / Off track) avec
ce qui est fait, ce qui bloque, les décisions prises, la prochaine étape.

## Outillage

- **MCP Linear** pour l'agent IA : `claude mcp add --transport http linear-server https://mcp.linear.app/mcp` puis `/mcp` pour s'authentifier.
- **Intégration GitHub** (Linear → Settings → Integrations → GitHub) : à activer sur `Miche1-Pierre/vyra-dice` pour le lien auto branches/PR ↔ issues.
