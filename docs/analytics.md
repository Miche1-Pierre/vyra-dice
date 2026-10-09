# Analytics — mesurer H1–H5

Outil : **PostHog (EU cloud)** — funnels, session replays, cohortes. Pas de dashboard maison.
Responsable : Pierre (data/analytics). Les définitions H1–H5 viennent du cadrage Linear.

## Principes

- Une demande ≠ une confirmation ≠ un encaissement : trois mesures distinctes.
- Ce qui est inconnu reste inconnu (source manquante, montant manquant) — jamais imputé.
- Aucun ROAS sans coûts et revenus rapprochés.
- RGPD : pas de cookie d'analyse avant consentement (PostHog en persistance mémoire tant que pas d'accord) ; pas de donnée personnelle (nom, téléphone) dans les événements.

## Taxonomie d'événements (snake_case, propriétés communes : `club`, `event`, `session_id`, `utm_*`, `ref`, `device`)

| Événement                  | Quand                                                            | Propriétés clés                                          | Sert à   |
| -------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------- | -------- |
| `experience_viewed`        | Page chargée                                                     | `source`, `webgl_supported`                              | H2       |
| `scene_ready`              | 3D interactive                                                   | `load_ms`, `gpu_tier`, `fallback_2d`                     | H1, perf |
| `intro_skipped`            | Skip de l'ouverture                                              | `at_ms`                                                  | UX       |
| `zone_viewed`              | Zone ouverte (marqueur ou liste)                                 | `zone_id`, `tier`                                        | H1       |
| `table_viewed`             | Panneau d'une table ouvert                                       | `table_id`, `zone_id`, `tier`, `minimum_spend`, `status` | H1, H3   |
| `table_view_from_seat`     | « Vue depuis la table » activée                                  | `table_id`                                               | H1       |
| `tables_compared`          | Comparateur ouvert                                               | `table_ids[]`                                            | H1       |
| `level_filter_changed`     | Filtre de niveau changé (tout / RDC / mezzanine)                 | `level` (`all`, `0`, `1`)                                | UX       |
| `list_view_opened`         | Vue liste des tables ouverte                                     | —                                                        | H1, UX   |
| `request_started`          | Premier champ du formulaire touché                               | `table_id`                                               | H2       |
| `request_submitted`        | Demande enregistrée côté serveur                                 | `request_id`, `table_id`, `party_size`, `demo`           | H2       |
| `request_failed`           | Erreur d'envoi                                                   | `table_id`, `reason`                                     | H4       |
| `fallback_contact_clicked` | Contact du club utilisé (WhatsApp, Instagram, téléphone, e-mail) | `channel`, `context`                                     | H4       |
| `ticket_viewed`            | Espace debout (billet) ouvert                                    | `ticket_id`                                              | H1       |
| `ticket_link_clicked`      | Redirection billetterie (Shotgun)                                | `url`                                                    | contexte |

Typage côté code : `src/lib/analytics/events.ts`. Avant le choix du visiteur, les événements attendent en mémoire :
envoyés s'il accepte (avec leur horodatage d'origine), supprimés s'il refuse.

Événements serveur (saisis à la main ou via back-office, rapprochés par `request_id`) :
`request_confirmed`, `request_refused`, `request_cancelled`, `request_no_show`, `request_paid { amount }`.

## Lecture H1–H5

| Hypothèse        | Indicateurs                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| H1 Compréhension | % visiteurs qui ouvrent ≥ 1 table ; test qualitatif « localiser l'offre / expliquer son prix » |
| H2 Conversion    | demandes qualifiées / visiteur ; confirmations / visiteur ; confirmations / demande            |
| H3 Valeur        | part premium vendue ; revenu encaissé total / par réservation / par visiteur                   |
| H4 Opérations    | temps de traitement, nb d'échanges, questions répétées, échecs et reprises                     |
| H5 Adoption      | usage récurrent par le club ; disposition à payer (mesurée séparément)                         |

Comparaison : mêmes tables / mêmes prix / publics comparables si trafic suffisant, sinon soirées historiques
similaires en documentant les limites (DJ, lieu, prix, campagne). Une soirée = un signal, pas une preuve.
