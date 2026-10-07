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

| Couche          | Choix                                                        | Pourquoi                                                    |
| --------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| App             | Next.js 16 (App Router, RSC, Server Actions), TypeScript     | SSR rapide du shell, une seule app front+API, déploiement Vercel |
| UI              | Tailwind v4 + shadcn/ui, `motion` pour les transitions       | Composants accessibles, design maîtrisé                     |
| 3D              | three.js + React Three Fiber + drei + postprocessing         | Écosystème le plus mûr pour le web 3D en React              |
| Assets          | Blender → glTF (GLB) → gltf-transform (meshopt + WebP)       | Lumière bakée = rendu « pro » à coût GPU quasi nul sur mobile |
| État client     | zustand                                                      | Partage scène 3D ↔ UI sans re-render React à chaque frame   |
| Formulaires     | react-hook-form + zod                                        | Même schéma validé côté client et serveur                   |
| Données (à brancher G1) | Supabase (Postgres, région EU)                       | Demandes + statuts + RLS multi-clubs ; dashboard club plus tard |
| Notifications (G1) | Email transactionnel (Resend) + lien WhatsApp pré-rempli  | Réception fiable côté club sans intégration profonde        |
| Analytics       | PostHog (EU cloud)                                           | Funnels, replays, feature flags — rien à coder from scratch |
| Hébergement     | Vercel                                                       | Previews par PR, edge cache des GLB                         |

## Arborescence cible

```
src/
  app/
    page.tsx                         # landing VYRA (pitch promoteurs)
    [club]/[event]/page.tsx          # expérience publique (RSC : charge la config club)
    [club]/[event]/request/actions.ts# Server Action : valider, persister, notifier
  components/
    ui/                              # shadcn (ne pas éditer à la main sauf thème)
    scene/                           # R3F : <Venue>, <TableMarker>, <CameraRig>, <Effects>
    booking/                         # panneau table, comparateur, formulaire, accusé de réception
  content/clubs/<slug>.ts            # config club typée (offres validées) — source MVP
  lib/
    schema.ts                        # zod : Club, Event, Zone, Table, Offer, BookingRequest
    analytics/                       # wrapper PostHog + taxonomie d'événements
    store.ts                         # zustand : table sélectionnée, mode caméra, etc.
public/models/<slug>.glb             # GLB optimisé
art/                                 # sources Blender (LFS)
```

## Modèle de données (v0)

```
Club     { slug, name, city, contact: { whatsapp, phone, email }, brand: { colors, logo } }
Event    { slug, clubSlug, name, date, doorsOpen, ticketUrl? (Shotgun), status }
Zone     { id, name, description }                     # uniquement si le club a des zones
Table    { id, zoneId?, label, capacity: {min,max}, priceType: "minimum"|"fixed"|"on_request",
           price?, currency, perks[], conditions[], status: "available"|"limited"|"on_request"|"sold",
           node: "table_<id>", viewpoint: "cam_<id>", media[] }
BookingRequest { id (court, lisible ex. VYR-7K2Q), eventSlug, tableId, name, phone, email?,
           partySize, arrivalTime?, message?, consent, createdAt,
           status: "received"|"forwarded"|"confirmed"|"refused"|"cancelled"|"no_show",
           finalAmount?, source (utm/ref) }
```

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
