# VYRA Studio

L'outil de l'équipe qui génère l'expérience 3D d'un club (VYR-62) : des photos, un plan, un brief → l'agent écrit le
club, Blender le construit et l'éclaire, l'équipe le revoit, la démo part en pull request. Il tourne **en local**, sur
la machine de chacun, avec le compte Claude de l'équipe et le Blender de la machine.

Le dépôt est public : le Studio, son guide et l'historique des clubs le sont aussi. Seules les **sources tierces**
(photos, plans reçus d'un club) n'y entrent jamais : elles restent dans `clubs/<club>/private/` (ignoré par git).

## Installer sur une nouvelle machine

1. **Outils** : Git avec Git LFS (`git lfs install`), Node 24 et pnpm 9 (`corepack enable`), Google Chrome,
   [Blender 5.1](https://www.blender.org/download/) (chemin par défaut, sinon variable `VYRA_BLENDER`), GitHub CLI.
2. **Comptes** :
   - Claude Code ≥ 2.1.280 connecté au compte Claude de l'équipe : `claude`, puis `/login` ; vérifier avec
     `claude auth status`. Aucune clé API : l'agent consomme le quota de l'abonnement.
   - GitHub : `gh auth login` (accès au dépôt), pour partager les clubs.
3. **Dépôt** :

   ```bash
   git clone https://github.com/Miche1-Pierre/vyra-dice.git
   cd vyra-dice
   pnpm install
   ```

4. **Lancer** : `pnpm studio`, puis <http://localhost:3300>.

Le site en local (`pnpm dev`, <http://localhost:3000>) sert d'aperçu : l'étape « Aperçu » le démarre s'il ne tourne
pas. Windows et macOS sont pris en charge (Cycles sur OptiX, CUDA, HIP, Metal ou oneAPI selon la carte graphique) ;
`VYRA_BLENDER`, `VYRA_CHROME` et `VYRA_CLAUDE` remplacent les chemins par défaut.

## Le workflow d'un club

1. **Nouveau club** : nom, ville, liens publics, brief, photos et plans.
2. **Tout générer** (≈ 25 min, suivi en direct dans le Journal) : note de recherche → spécification → 3D → revue des
   rendus par l'agent → éclairage précalculé → aperçu et captures → leçons. Chaque étape se relance seule.
3. **Revoir** : onglets Rendus et Aperçu, « Ouvrir la démo ».
4. **Corriger par des retours** (onglet Retours, sur un rendu ou une capture), puis relancer « Revue des rendus » et
   « Tout générer » (éclairage et captures). Autant de tours que nécessaire.
5. **Leçons** : accepter ou refuser ce que l'agent propose pour les clubs suivants.
6. **Partage et mise en ligne** : la dernière étape partage le club par une pull request.

## Partager, récupérer, mettre en ligne

Tout passe par des pull requests vers `main` : **le Studio ne commite jamais sur `main`**.

- **Partager** (étape « Partage et mise en ligne ») : le dossier du club — définition, bundle web, scène Blender et
  tout son historique — part sur une branche de travail (créée au besoin depuis `main`, sans toucher aux fichiers),
  qui est poussée avec sa pull request. Le club reste un **brouillon** : visible en local et sur la preview Vercel de
  la PR, jamais sur le site en ligne. Repartager met la même PR à jour. Les leçons acceptées voyagent avec.
- **Mettre en ligne** : même étape, case « Mettre en ligne » cochée. Au merge, le club passe des brouillons
  (`drafts`) aux clubs du site (`clubs`, dans `clubs/registry.ts`) et Vercel le déploie en production.
- **Récupérer le travail des autres** : une fois la PR mergée, bouton **Mettre à jour** (page Clubs). Le Studio revient
  sur `main` et le met à jour. Il refuse plutôt que de perdre quelque chose (changements pas encore partagés, PR pas
  encore mergée, étape en cours). Si les dépendances ont changé : `pnpm install`, puis relancer le Studio.

Les sources ne voyagent pas : `studio/sources.json` les liste (nom, taille, empreinte), et l'onglet Sources indique
celles qui manquent sur la machine. Il suffit de les redéposer pour qu'elles reprennent leur nom.

## Ce qui est versionné

| Où                                | Quoi                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `clubs/<club>/*.json`, `index.ts` | le club tel que le site le lit (contenu, plan, identité, ambiance)                                   |
| `clubs/<club>/scene.json`         | sa scène Blender (pour le reconstruire sur n'importe quelle machine)                                 |
| `clubs/<club>/public/`            | le bundle web : GLB, lightmaps WebP, empreintes                                                      |
| `clubs/<club>/studio/`            | l'historique : brief, note de recherche, revues, retours, notes, leçons, captures, liste des sources |
| `clubs/<club>/studio/runs/<run>/` | chaque étape lancée : état, phases, durées, coût, journal, rendus de chaque construction, captures   |
| `studio/playbook/`                | le guide de l'agent, enrichi club après club                                                         |
| `clubs/<club>/build/` (ignoré)    | `.blend`, rapport, rendus du moment : reconstruits localement (« Construction 3D », 30 s)            |
| `clubs/<club>/private/` (ignoré)  | les sources tierces : jamais versionnées, jamais publiées                                            |

Les journaux nomment les fichiers relativement au dépôt et le dossier personnel `~` : aucun chemin de la machine.

## Le pipeline

| Étape                    | Qui                   | Produit                                                                       |
| ------------------------ | --------------------- | ----------------------------------------------------------------------------- |
| Brief et sources         | l'équipe (formulaire) | `studio/brief.json`, `studio/sources.json`, `private/sources/*`               |
| Note de recherche        | agent                 | `studio/research.md` (faits / suppositions / manques)                         |
| Spécification            | agent + validation    | `content`, `layout`, `brand`, `ambiance`, `scene.json`, `README.md`           |
| Construction 3D          | Blender               | `build/` (scène, rapport, rendus) ; rendus gardés dans le run                 |
| Revue des rendus         | agent + retours       | corrections + `studio/reviews/*.json`, puis reconstruction                    |
| Éclairage précalculé     | Blender + optimiseur  | `public/` (GLB, lightmaps WebP, empreintes)                                   |
| Aperçu et captures       | Studio                | brouillon dans `clubs/registry.ts`, tests de contrat, captures du site        |
| Leçons pour le guide     | agent + équipe        | propositions ; acceptées → `studio/playbook/lessons.md` (commit)              |
| Partage et mise en ligne | Studio                | commit sur une branche de travail, push, pull request (brouillon ou en ligne) |

Chaque étape tourne dans son propre processus (`pnpm studio:job <club> <run>`) et écrit `status.json` et `log.txt`
dans `studio/runs/<run>/` : le Studio peut redémarrer sans perdre un run.

## L'agent

Claude Code en mode headless, avec le compte connecté de l'équipe (aucune clé API dans son environnement : rien n'est
facturé à l'API), modèle `claude-opus-5-5`. Isolé (`--safe-mode`, aucun serveur MCP), il lit tout le dépôt mais
**n'écrit que dans `clubs/<club>/`** (`--permission-mode dontAsk` + règles `Edit(clubs/<club>/**)`) et n'exécute rien :
le Studio valide, construit et lui renvoie les problèmes dans la même session (jusqu'à trois corrections, construction
Blender d'essai comprise). Le coût affiché est l'estimation de Claude Code au tarif de l'API.

Son guide est `studio/playbook/` : procédure, conventions, dimensions de référence, leçons des clubs précédents. Le
passage sur serveur remplacera ce runner par un runner API (SDK Anthropic officiel) derrière la même interface
`AgentRunner` (`studio/jobs/agent.ts`).

## Règles

- Sources tierces (photos, plans) : `clubs/<club>/private/` — ignoré par git, jamais publié, jamais copié par l'agent.
- Une démo reste une démo : `demo: true`, mention « Démo », aucune offre réelle avant l'accord écrit du club (VYR-15).
- Rien ne part en production sans pull request mergée : brouillon par défaut, mise en ligne explicite.
