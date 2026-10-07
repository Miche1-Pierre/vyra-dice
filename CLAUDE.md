@AGENTS.md

# VYRA-dice — guide pour agents IA

Visite 3D mobile d'un club → comparaison des tables → demande transmise au club. Lire avant de coder :

- `docs/linear.md` — cadrage, jalons G0–G6, règles produit non négociables, qui fait quoi
- `docs/architecture.md` — stack, modèle de données, flux d'une demande, principes 3D
- `docs/3d-pipeline.md` — Blender → GLB, **contrat de nommage** des objets (`table_<id>`, `cam_<id>`…)
- `docs/analytics.md` — taxonomie d'événements PostHog ↔ H1–H5
- `docs/github.md` — branches, commits, PR

## Règles

- Commits atomiques, Conventional Commits, en anglais. Identité git de Pierre, **sans trailer Co-Authored-By**.
- Jamais de commit direct sur `main` : branche `<type>/VYR-<n>-<slug>` + PR (`Closes VYR-<n>`), merge en rebase.
- `pnpm check` (lint + typecheck + test) doit passer avant de pousser ; `pnpm format` avant commit.
- Next.js 16 : lire `node_modules/next/dist/docs/` avant d'utiliser une API dont tu n'es pas sûr.
- `src/components/ui/` = shadcn généré ; ajouter des composants via `pnpm dlx shadcn@latest add <name>`.
- Code 3D client-only (`"use client"`, `dynamic(..., { ssr: false })`). Pas d'état React mis à jour dans `useFrame`.
- Wording utilisateur : une demande n'est **jamais** présentée comme une réservation confirmée.
- Données de démo = lieu fictif, étiqueté « démo ». Aucune offre réelle avant accord écrit du club (VYR-15).

## Commandes

```bash
pnpm dev              # http://localhost:3000
pnpm check            # lint + typecheck + test
pnpm assets:optimize  # art/export/*.glb -> public/models/*.glb
```
