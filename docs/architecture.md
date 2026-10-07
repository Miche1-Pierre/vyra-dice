# Architecture

> Cadrage produit : projet Linear « Réservation immersive pour clubs » (voir `docs/linear.md`).
> Ce document décrit le _comment_. Toute décision qui change le _quoi_ passe par Linear.

## Ce que fait le produit (MVP G1)

Lien partagé par le club (Instagram / Komi / WhatsApp) → **visite 3D mobile du lieu** → l'acheteur compare
les tables (emplacement, vue, capacité, prix/minimum, prestations, conditions) → **formulaire court** →
la demande est transmise au club, qui confirme/refuse et encaisse **dans ses propres outils**.

Règles non négociables (issues du cadrage) :

- Une demande **n'est pas** une réservation confirmée ni un blocage de stock. L'accusé de réception le dit.
- Seules les offres/médias **validés par le club** sont affichés.
- Toujours un **contact de secours** (WhatsApp/téléphone du club) si la 3D, la page ou l'envoi échoue.
- Mobile d'abord : la 3D doit être légère et rapide ; fallback 2D si WebGL indisponible ou trop lent.

## Stack

| Couche                  | Choix                                                    | Pourquoi                                                         |
| ----------------------- | -------------------------------------------------------- | ---------------------------------------------------------------- |
| App                     | Next.js 16 (App Router, RSC, Server Actions), TypeScript | SSR rapide du shell, une seule app front+API, déploiement Vercel |
| UI                      | Tailwind v4 + shadcn/ui, `motion` pour les transitions   | Composants accessibles, design maîtrisé                          |
| 3D                      | three.js + React Three Fiber + drei + postprocessing     | Écosystème le plus mûr pour le web 3D en React                   |
| Assets                  | Blender → glTF (GLB) → gltf-transform (meshopt + WebP)   | Lumière bakée = rendu « pro » à coût GPU quasi nul sur mobile    |
| État client             | zustand                                                  | Partage scène 3D ↔ UI sans re-render React à chaque frame        |
| Formulaires             | react-hook-form + zod                                    | Même schéma validé côté client et serveur                        |
| Données (à brancher G1) | Supabase (Postgres, région EU)                           | Demandes + statuts + RLS multi-clubs ; dashboard club plus tard  |
| Notifications (G1)      | Email transactionnel (Resend) + lien WhatsApp pré-rempli | Réception fiable côté club sans intégration profonde             |
| Analytics               | PostHog (EU cloud)                                       | Funnels, replays, feature flags — rien à coder from scratch      |
| Hébergement             | Vercel                                                   | Previews par PR, edge cache des GLB                              |

## Arborescence

```
art/
  layouts/<club>.json                # plan en mètres : zones, tables, escaliers… (source de vérité géométrique)
  scripts/                           # vyra3d.py (toolkit), build_<club>.py, bake_export.py — voir 3d-pipeline.md
  ref/<club>/                        # croquis (versionné) + photos de référence (locales, non versionnées)
public/models/<club>/                # bundle web : <club>.glb, lm/*.webp, lightmaps.json
src/
  app/
    page.tsx                         # landing VYRA (pitch promoteurs)
    [club]/[event]/page.tsx          # expérience publique (RSC : charge le contenu du club)
    [club]/[event]/actions.ts        # Server Action submitBookingRequest : valider, limiter, enregistrer
  components/
    ui/                              # shadcn (base-ui) — ne pas éditer à la main sauf thème
    scene/                           # R3F : modèle + lightmaps, FX, caméra, zones, halos, marqueurs, effets
    experience/                      # UI : sidebar, barre, fiche table, formulaire, accusé, comparatif, liste
    analytics/                       # provider PostHog + bandeau de consentement
  content/clubs/<club>.ts            # contenu commercial typé (prix, capacités, statuts) — démo pour Naho
  lib/
    schema.ts                        # zod : club, événement, zones, tables, demande, résultat d'envoi
    store.ts                         # zustand : vue (intro/ensemble/zone/table/assis), sélection, panneaux
    venue/                           # layout.ts (géométrie typée), camera.ts (cadrages), offers.ts, tiers.ts
    analytics/                       # client PostHog typé + taxonomie d'événements
  server/requests/                   # puits de demandes (démo en mémoire), rate limit
```

## Modèle de données (POC)

```
Layout (art/layouts)  zones { id, tier: lounge|vip|prestige, level: 0|1, rect }
                      tables { id, zone, kind, x, y, facing }        ← géométrie, partagée Blender / web
Content (src/content) club { slug, name, address, requestPrefix, contact, demo, disclaimer }
                      event { slug, name, date, doors, ticketUrl?, offersValidatedAt | null }
                      zones { id, tier, name, shortName, description, perks[] }
                      tables { id, label, zoneId, capacity {min,max}, minimumSpend | null,
                               status: available|on_request|sold, perks[], view }
BookingRequest        { clubSlug, eventSlug, tableId, fullName, phone, email?, partySize,
                        arrivalTime, message?, consent, idempotencyKey, attribution? }
                      → requestId lisible (ex. NHO-7K2QX), statut "received", transmission "not_sent_demo"
```

`status` des tables = déclaratif (saisi par le club), jamais un stock temps réel. `offersValidatedAt: null`
signifie « non validé par le club » : l'interface affiche alors la mention démo.

`status` des tables = déclaratif (saisi par le club), jamais un stock temps réel (hors MVP).

## Flux d'une demande

1. Client : validation zod → Server Action `submitRequest`.
2. Serveur : re-validation, rate-limit, insertion `booking_requests`, génération de l'ID.
3. Notification au responsable nommé du club (email + récap WhatsApp-ready).
4. Réponse : écran d'accusé honnête (« Demande reçue, le club vous recontacte sous X h. Ce n'est pas une confirmation. ») + bouton contact de secours.
5. Suivi statuts : mis à jour par nous/le club (G1 : manuellement ; plus tard mini back-office).

## Expérience 3D (principes)

- **Ouverture cinématique** courte (2–3 s) puis contrôle libre (orbit contraint) — skip possible.
- Sélection d'une table → **fly-to caméra** vers `cam_<id>` (« vue depuis la table ») + panneau offre (bottom sheet mobile).
- Marqueurs flottants HTML (prix, statut couleur) ancrés aux tables, déclutter selon zoom.
- Comparateur : 2–3 tables côte à côte (prix/pers, capacité, vue, prestations).
- Ambiance : lumière bakée + bloom sur néons/LED, brouillard volumétrique léger, son optionnel off par défaut.
- Budget perf : GLB ≤ 4 Mo, ≤ 100 draw calls, 60 fps iPhone 12 / 30 fps Android milieu de gamme, interactif < 3 s en 4G. DPR adaptatif (`<PerformanceMonitor>`), fallback plan 2D.

Détails de production : `docs/3d-pipeline.md`. Événements de mesure : `docs/analytics.md`.
