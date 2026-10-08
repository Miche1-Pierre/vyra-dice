# VYRA Studio

L'outil **privé et local** qui génère l'expérience 3D d'un club (VYR-62) : des photos, un plan, un brief → l'agent écrit
le club, Blender le construit et l'éclaire, l'équipe le revoit, la démo part en pull request. Les démos sont publiques ;
l'outil, son savoir-faire et les sources restent sur la machine.

> Branche locale `studio/v2` : un hook `pre-push` refuse de pousser `studio/*` tant que la visibilité du dépôt n'est
> pas décidée. La publication d'un club passe par une branche à part, qui ne contient que le club.

## Lancer

```bash
pnpm studio          # http://localhost:3300
```

Prérequis sur la machine : Blender 5.1 (`VYRA_BLENDER` sinon), Chrome (`VYRA_CHROME`), Claude Code connecté au compte
de l'équipe (`claude auth status`), `gh` connecté pour publier. Le viewer de démo est le serveur de dev du site
(`pnpm dev`, port 3000 ou 3100) ; l'étape « Aperçu » le démarre s'il ne tourne pas.

## Le pipeline

| Étape                | Qui                   | Produit                                                                                                                              |
| -------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Brief et sources     | l'équipe (formulaire) | `studio/brief.json`, `private/sources/*`                                                                                             |
| Note de recherche    | agent                 | `studio/research.md` (faits / suppositions / manques)                                                                                |
| Spécification        | agent + validation    | `content`, `layout`, `brand`, `ambiance`, `scene.json`, `README.md`                                                                  |
| Construction 3D      | Blender               | `build/<slug>.blend`, `build/report.json`, `build/previews/*.png`                                                                    |
| Revue des rendus     | agent + retours       | corrections + `studio/reviews/*.json`, puis reconstruction                                                                           |
| Éclairage précalculé | Blender + optimiseur  | `public/` (GLB, lightmaps WebP, empreintes)                                                                                          |
| Aperçu et captures   | Studio                | entrée dans `clubs/registry.ts`, tests de contrat, captures                                                                          |
| Leçons pour le guide | agent + équipe        | propositions ; acceptées → `studio/playbook/lessons.md` (commit)                                                                     |
| Publication          | Studio                | branche depuis `origin/main` + pull request (essai à blanc possible, au besoin depuis une branche pas encore mergée : option `base`) |

Chaque étape tourne dans son propre processus (`pnpm studio:job <club> <run>`), écrit `status.json` (état, phases,
durées, résultats) et `log.txt` dans `studio/runs/<run>/` : une étape en échec se relance seule, et le Studio
peut redémarrer sans perdre un run.

## L'agent

Claude Code en mode headless, avec le compte connecté de l'équipe (aucune clé API dans son environnement : rien n'est
facturé à l'API), modèle `claude-opus-5-5`. Isolé (`--safe-mode`, aucun serveur MCP), il lit tout le dépôt mais
**n'écrit que dans `clubs/<club>/`** (`--permission-mode dontAsk` + règles `Edit(clubs/<club>/**)`) et n'exécute rien :
le Studio valide, construit et lui renvoie les problèmes dans la même session (jusqu'à trois corrections, construction
Blender d'essai comprise). Le coût affiché est l'estimation de Claude Code au tarif de l'API.

Son guide est `studio/playbook/` : procédure, conventions, dimensions de référence, leçons des clubs précédents. Le
passage sur serveur remplacera ce runner par un runner API (SDK Anthropic officiel) derrière la même interface
`AgentRunner` (`studio/jobs/agent.ts`).

## Confidentialité

- Sources tierces (photos, plans) : `clubs/<club>/private/` — ignoré par git, jamais publié, jamais copié par l'agent.
- Ce qui part en PR : `content.json`, `layout.json`, `brand.json`, `ambiance.json`, `index.ts`, `README.md`, `public/`,
  `reference/`, plus les captures (`docs/media/clubs/<club>/`). Jamais `scene.json`, `build/` ni `private/`.
- Une démo reste une démo : `demo: true`, mention « Démo », aucune offre réelle avant l'accord écrit du club (VYR-15).
