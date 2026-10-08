import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { claudeCode, recordAgent, type AgentResult } from "@studio/jobs/agent"
import { BLENDER, errorTail, type RunContext } from "@studio/jobs/context"
import { build } from "@studio/jobs/steps/build"
import { readFeedback, writeFeedback } from "@studio/lib/feedback"
import { readBrief } from "@studio/lib/state"
import { validateClub } from "@studio/lib/validate"

/*
 * The steps the agent does: research, spec (with automatic correction rounds), review of the
 * renders (with rebuilds), lessons. The Studio validates and builds between agent turns; the
 * agent only reads the repo and writes in the club's folder.
 */

const MAX_FIX_ROUNDS = 3

function sourcesList(ctx: RunContext): string {
  if (!existsSync(ctx.paths.sources)) return "aucune (brief seul)"
  const files = readdirSync(ctx.paths.sources)
  return files.length
    ? files.map((f) => `clubs/${ctx.slug}/private/sources/${f}`).join("\n")
    : "aucune (brief seul)"
}

function header(ctx: RunContext): string {
  const brief = readBrief(ctx.slug)
  if (!brief) throw new Error("Pas de brief : créer le club depuis le Studio")
  return [
    `Club : ${brief.name} (${brief.city}) — dossier clubs/${ctx.slug}/, slug « ${ctx.slug} ».`,
    `Brief de l'équipe : clubs/${ctx.slug}/private/studio/brief.json`,
    `Sources :\n${sourcesList(ctx)}`,
    "Commence par lire studio/playbook/README.md (le guide), studio/playbook/lessons.md et studio/playbook/dimensions.md.",
  ].join("\n")
}

/** A quick Blender build (no renders, no save): what the schema cannot catch, Blender will. */
async function blenderProblems(ctx: RunContext): Promise<string[]> {
  try {
    await ctx.exec(
      BLENDER,
      ["-b", "-P", "art/scripts/build_club.py", "--", "--club", ctx.slug, "--no-save"],
      {
        filter: (line) => /\[check\]|Error|Traceback/.test(line),
      },
    )
    return []
  } catch (error) {
    return [`La construction Blender a échoué (art/scripts/build_club.py) :\n${errorTail(error)}`]
  }
}

/** Validation rounds: the agent fixes what the Studio reports, in the same session. */
async function fixUntilValid(ctx: RunContext, first: AgentResult): Promise<void> {
  let session = first.sessionId
  for (let round = 1; ; round++) {
    const v = validateClub(ctx.slug)
    const problems = v.ok
      ? await ctx.phase("Construction d'essai", () => blenderProblems(ctx))
      : v.problems
    if (!problems.length) {
      ctx.log("spécification valide, la scène se construit")
      return
    }
    ctx.log(`validation : ${problems.length} problème(s)\n${problems.join("\n").slice(0, 4000)}`)
    if (round > MAX_FIX_ROUNDS)
      throw new Error(`Spécification encore invalide après ${MAX_FIX_ROUNDS} corrections`)
    const r = await ctx.phase(`Correction ${round}`, () =>
      claudeCode.run(ctx, {
        resume: session,
        maxTurns: 30,
        prompt: [
          "Le Studio a validé tes fichiers et trouvé ces problèmes :",
          problems.join("\n\n"),
          "Corrige-les tous (rien d'autre), puis résume tes corrections en une phrase.",
        ].join("\n\n"),
      }),
    )
    recordAgent(ctx, r)
    session = r.sessionId
  }
}

export async function research(ctx: RunContext): Promise<void> {
  mkdirSync(ctx.paths.studio, { recursive: true })
  const r = await ctx.phase("Lecture des sources et note de recherche", () =>
    claudeCode.run(ctx, {
      maxTurns: 50,
      prompt: [
        header(ctx),
        "Puis lis clubs/naho/README.md et clubs/naho/content.json (ce qu'on produit), et chaque source (images : outil Read).",
        `Écris clubs/${ctx.slug}/private/studio/research.md en suivant studio/playbook/research-template.md.`,
        "Sépare strictement faits, suppositions et manques ; n'invente ni adresse, ni contact, ni prix réel.",
        "Termine ta réponse par trois lignes : ce qui frappe, ce qui manque le plus, la dimension la plus incertaine.",
      ].join("\n\n"),
    }),
  )
  recordAgent(ctx, r)
  if (!existsSync(ctx.paths.research)) throw new Error("La note de recherche n'a pas été écrite")
}

export async function spec(ctx: RunContext): Promise<void> {
  const existing = validateClub(ctx.slug)
  const restart = Object.values(existing.files).some(Boolean)
  const r = await ctx.phase(
    restart ? "Révision de la spécification" : "Écriture de la spécification",
    () =>
      claudeCode.run(ctx, {
        maxTurns: 90,
        maxBudgetUsd: 25,
        prompt: [
          header(ctx),
          `Note de recherche : clubs/${ctx.slug}/private/studio/research.md`,
          "Référence complète à imiter : clubs/naho/{content,layout,brand,ambiance,scene}.json et clubs/naho/README.md.",
          "Schémas : src/lib/schema.ts, src/lib/venue/layout.ts, src/lib/clubs/brand.ts, src/lib/clubs/ambiance.ts, studio/lib/scene-schema.ts ; briques Blender : art/scripts/build_club.py.",
          `Écris dans clubs/${ctx.slug}/ : content.json, layout.json, brand.json, ambiance.json, scene.json et README.md.`,
          restart
            ? "Ces fichiers existent déjà : améliore-les en gardant ce qui est juste plutôt que de repartir de zéro."
            : "Pars des fichiers du Naho et remplace tout ce qui est propre au Naho (plan, offre, identité, ambiance, scène).",
          "Termine par cinq lignes : les principales suppositions que l'équipe doit faire valider.",
        ].join("\n\n"),
      }),
  )
  recordAgent(ctx, r)
  await ctx.phase("Validation et corrections", () => fixUntilValid(ctx, r))
}

export async function review(ctx: RunContext): Promise<void> {
  if (!existsSync(ctx.paths.report)) throw new Error("Pas de rendus : lancer la construction 3D")
  const iterations = Math.max(1, Math.min(3, Number(ctx.options.iterations ?? 1)))
  const reviews = path.join(ctx.paths.studio, "reviews")
  mkdirSync(reviews, { recursive: true })
  let session: string | undefined
  for (let i = 1; i <= iterations; i++) {
    const feedback = readFeedback(ctx.slug).items.filter((f) => f.status === "open")
    const id = `${new Date()
      .toISOString()
      .replace(/[-:.TZ]/g, "")
      .slice(0, 14)}`
    const previews = readdirSync(ctx.paths.previews).map(
      (f) => `clubs/${ctx.slug}/build/previews/${f}`,
    )
    // what the client sees: the zone and table views are framed by the site, not by Blender
    const captures =
      !session && existsSync(ctx.paths.captures)
        ? readdirSync(ctx.paths.captures)
            .filter((f) => f.endsWith(".png"))
            .map((f) => `clubs/${ctx.slug}/private/studio/captures/${f}`)
        : []
    const r = await ctx.phase(`Revue des rendus ${i}/${iterations}`, () =>
      claudeCode.run(ctx, {
        resume: session,
        maxTurns: 60,
        prompt: [
          session ? "Nouveaux rendus après tes corrections." : header(ctx),
          `Rapport de construction : clubs/${ctx.slug}/build/report.json`,
          `Rendus à regarder (outil Read) :\n${previews.join("\n")}`,
          captures.length
            ? `Captures du site, ce que voit le client (dernier aperçu, peut dater d'avant ce build) :\n${captures.join("\n")}\nLes vues de zone et de table sont cadrées par le site depuis le plan (src/lib/venue/camera.ts) : rien ne doit masquer une table ou une zone depuis sa caméra (escalier, poteau, structure, globe).`
            : "",
          `Compare-les aux sources, à la note de recherche (clubs/${ctx.slug}/private/studio/research.md) et au brief.`,
          feedback.length
            ? `Retours de l'équipe à traiter en priorité :\n${feedback.map((f) => `- [${f.id}] ${f.target ? `(${f.target}) ` : ""}${f.text}`).join("\n")}`
            : "Pas de retour de l'équipe en attente.",
          "Corrige dans layout.json, scene.json, ambiance.json (et content.json si une table bouge ou si un texte est faux) ce qui nuit au réalisme ou à la lisibilité : proportions, éléments signature absents, collisions, tables masquées, éclairage.",
          `Puis écris clubs/${ctx.slug}/private/studio/reviews/${id}.json : {"issues": [...], "changes": [...], "feedbackAddressed": ["<id>"], "remaining": [...]} (phrases courtes en français).`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      }),
    )
    recordAgent(ctx, r)
    session = r.sessionId
    const file = path.join(reviews, `${id}.json`)
    if (existsSync(file)) {
      const done =
        (JSON.parse(readFileSync(file, "utf8")) as { feedbackAddressed?: string[] })
          .feedbackAddressed ?? []
      if (done.length) {
        const fb = readFeedback(ctx.slug)
        for (const item of fb.items) {
          if (done.includes(item.id)) Object.assign(item, { status: "addressed", addressedIn: id })
        }
        writeFeedback(ctx.slug, fb)
        ctx.log(`retours traités : ${done.join(", ")}`)
      }
    } else {
      writeFileSync(
        file,
        JSON.stringify(
          { issues: [], changes: [r.text.slice(0, 2000)], feedbackAddressed: [], remaining: [] },
          null,
          2,
        ),
      )
    }
    await ctx.phase("Validation et corrections", () => fixUntilValid(ctx, r))
    await build(ctx)
    // the pass ends with the rebuild it asked for: only a later rebuild makes it stale
    const report = JSON.parse(readFileSync(ctx.paths.report, "utf8")) as {
      objects?: number
      triangles?: number
    }
    const saved = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>
    writeFileSync(
      file,
      JSON.stringify(
        {
          ...saved,
          rebuilt: {
            objects: report.objects,
            triangles: report.triangles,
            at: new Date().toISOString(),
          },
        },
        null,
        2,
      ),
    )
  }
}

export async function lessons(ctx: RunContext): Promise<void> {
  const r = await ctx.phase("Leçons pour le guide", () =>
    claudeCode.run(ctx, {
      maxTurns: 30,
      prompt: [
        header(ctx),
        `Le club est généré. Relis sa note de recherche (clubs/${ctx.slug}/private/studio/research.md), ses revues (clubs/${ctx.slug}/private/studio/reviews/), les retours de l'équipe (clubs/${ctx.slug}/private/studio/feedback.json s'il existe) et studio/playbook/lessons.md.`,
        "Propose 1 à 5 leçons générales, utiles aux clubs suivants (dimensions, pièges de modélisation, règles de style), sans répéter le guide.",
        `Écris clubs/${ctx.slug}/private/studio/lessons.json : {"proposals": [{"id": "l1", "title": "…", "text": "…"}]}.`,
      ].join("\n\n"),
    }),
  )
  recordAgent(ctx, r)
  if (!existsSync(ctx.paths.lessons)) throw new Error("Aucune proposition écrite")
}
