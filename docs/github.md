# GitHub — workflow du repo

Repo : https://github.com/Miche1-Pierre/vyra-dice · Linear : https://linear.app/vyra-dice (team `VYR`)

## Responsabilités

| Domaine (label Linear)      | Responsable           | Où ça vit dans le repo                            |
| --------------------------- | --------------------- | ------------------------------------------------- |
| Dev                         | Pierre                | `src/`, `scripts/`, `art/`, `.github/`            |
| Data / analytics            | Pierre                | `src/lib/analytics/`, `docs/analytics.md`         |
| Vente                       | Jonathan              | `docs/sales/`                                     |
| Audit                       | Jonathan              | `docs/audit/`                                     |
| Produit / design            | Pierre + Jonathan     | `docs/`, `src/content/` (offres, textes, médias)  |
| Implémentation / adoption   | Pierre + Jonathan     | `docs/clubs/<slug>.md` (onboarding par club)      |
| Opérations / support        | Pierre + Jonathan     | `docs/ops/` (runbooks, contact de secours)        |

`CODEOWNERS` reflète ce tableau : une PR qui touche `docs/sales/` demande la review de Jonathan, `src/` celle de Pierre.

## Branches

- `main` : toujours déployable (Vercel prod). Protégée : PR obligatoire, CI verte, historique linéaire, pas de force-push.
- Branches courtes depuis `main`, nommées avec l'identifiant Linear (lien automatique via l'intégration GitHub de Linear) :

```
<type>/VYR-<n>-<slug-court>
feat/VYR-47-scene-3d-mobile
fix/VYR-48-accuse-reception
docs/VYR-5-audit-artefact
```

Types : `feat`, `fix`, `chore`, `docs`, `refactor`, `perf`, `test`, `art` (assets 3D), `data` (analytics).

## Commits

- **Atomiques** : un commit = un changement cohérent qui compile. Pas de "wip", pas de "fix typo" empilés — on `git commit --fixup` puis `git rebase --autosquash` avant review.
- **Conventional Commits**, en anglais, impératif : `feat(scene): add camera fly-to on table select`.
- Scopes usuels : `scene`, `ui`, `form`, `api`, `analytics`, `content`, `3d`, `ci`, `github`, `tooling`.
- Référence Linear dans le corps si utile : `Refs VYR-47`.
- Auteur : la personne qui pousse (identité git locale). Les commits faits par l'agent IA sont signés avec l'identité de Pierre, **sans trailer Co-Authored-By**.

## Pull requests

1. Une PR = une issue Linear (ou un petit groupe cohérent). Titre = Conventional Commit.
2. Description : template auto (`Closes VYR-<n>` → Linear passe l'issue en Done au merge).
3. Visuel/3D : captures ou vidéo mobile obligatoires.
4. Merge : **Rebase and merge** (garde les commits atomiques, historique linéaire). Squash autorisé seulement pour une PR à 1 commit logique.
5. Branche supprimée automatiquement après merge.

## CI (`.github/workflows/ci.yml`)

`format:check` → `lint` → `typecheck` → `test` → `build`. En local : `pnpm check`.

## Secrets / env

Jamais commités (`.env*` ignoré). Liste des variables : `.env.example`. Prod/preview : variables Vercel.

## Assets 3D

Sources (`art/**/*.blend`, textures, HDRI) en **Git LFS**. Les GLB optimisés servis au navigateur (`public/models/`) sont commités normalement. Voir `docs/3d-pipeline.md`.
