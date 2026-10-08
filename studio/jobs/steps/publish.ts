import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import type { RunContext } from "@studio/jobs/context"
import { CLUB_TEXT, formatFiles } from "@studio/jobs/format"
import { commitPaths, ensureWorkBranch, MAIN } from "@studio/lib/git"
import { IMAGE, REPO } from "@studio/lib/paths"
import { publishClub, registerClub } from "@studio/lib/registry-file"
import { validateClub } from "@studio/lib/validate"

const GITHUB = "https://github.com/Miche1-Pierre/vyra-dice"

/**
 * Sharing a club: its whole folder — definition, web bundle, Blender scene and Studio history,
 * never private/ (third-party sources) nor build/ — is committed on a work branch (never on
 * main) and reaches main through a pull request:
 *   - by default the club stays a draft: on Vercel previews and locally, not on the live site;
 *   - `live` moves it from the drafts to the clubs of the live site.
 * `dryRun` commits without pushing. This run's own folder is left for the next share: it is
 * still being written while the commit is made.
 */
export async function publish(ctx: RunContext): Promise<void> {
  const p = ctx.paths
  const live = ctx.options.live === true
  const issue =
    typeof ctx.options.issue === "string" && /^VYR-\d+$/.test(ctx.options.issue)
      ? ctx.options.issue
      : undefined
  const content = existsSync(p.files.content)
    ? (JSON.parse(readFileSync(p.files.content, "utf8")) as {
        club: { name: string; city: string }
        event: { slug: string }
      })
    : null
  const name = content?.club.name ?? ctx.slug
  const bundled = existsSync(p.files.assets) && existsSync(p.files.index)
  const captures = existsSync(p.captures)
    ? readdirSync(p.captures).filter((f) => IMAGE.test(f))
    : []
  if (live) {
    if (!validateClub(ctx.slug).ok) throw new Error("Spécification invalide")
    if (!bundled) throw new Error("Pas de bundle web : lancer l'éclairage précalculé puis l'aperçu")
    if (!captures.length) throw new Error("Pas de captures : lancer l'aperçu")
  }

  const branch = await ctx.phase("Branche de travail", async () => {
    const b = ensureWorkBranch(ctx.slug, issue)
    ctx.log(`branche ${b} (jamais main)`)
    return b
  })

  await ctx.phase(live ? "Mise en ligne dans le registre" : "Registre", async () => {
    // a club joins the registry once it has its bundle: before, only its history is shared
    if (!bundled) return ctx.log("pas encore de bundle web : historique seul, club non enregistré")
    const registry = path.join(REPO, "clubs", "registry.ts")
    const before = readFileSync(registry, "utf8")
    const after = live ? publishClub(ctx.slug, before) : registerClub(ctx.slug, before)
    if (after !== before) writeFileSync(registry, after)
    ctx.log(live ? "en ligne au merge de la pull request" : "brouillon (previews et local)")
  })

  const title = live
    ? `feat(clubs): put the ${name} demo online`
    : `chore(clubs): share the ${name} draft and its Studio history`
  const committed = await ctx.phase("Commit", async () => {
    // the CI checks the format: the club's files leave formatted like the rest of the repo
    await formatFiles(ctx, [...CLUB_TEXT.map((f) => `clubs/${ctx.slug}/${f}`), "clubs/registry.ts"])
    const done = commitPaths([`clubs/${ctx.slug}`, "clubs/registry.ts"], title, {
      body: [
        "Generated with VYRA Studio: plan, offers and prices are provisional, not validated by the club.",
        live ? "Moves the club from the drafts to the clubs served on the live site." : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      exclude: [`clubs/${ctx.slug}/studio/runs/${ctx.id}`],
    })
    ctx.log(done ? "commit fait" : "rien de nouveau à commiter")
    return done
  })

  if (ctx.options.dryRun) {
    ctx.log(`Essai à blanc : ${committed ? "commit" : "rien"} sur ${branch}, rien n'a été poussé.`)
    ctx.setResult({ branch, live, dryRun: true })
    return
  }

  const prUrl = await ctx.phase("Push et pull request", async () => {
    await ctx.exec("git", ["push", "-u", "origin", branch])
    const gh = (args: string[]) =>
      execFileSync("gh", args, { cwd: REPO, encoding: "utf8", windowsHide: true }).trim()
    const open = gh(["pr", "list", "--head", branch, "--state", "open", "--json", "url"])
    const existing = (JSON.parse(open || "[]") as { url: string }[])[0]?.url
    if (existing) {
      ctx.log(`pull request mise à jour : ${existing}`)
      return existing
    }
    const raw = (f: string) =>
      `${GITHUB}/blob/${branch}/clubs/${ctx.slug}/studio/captures/${f}?raw=true`
    const body = [
      issue ? `## Linear\n\n${live ? "Closes" : "Refs"} ${issue}\n` : "",
      `## Quoi\n\n${live ? "Mise en ligne" : "Brouillon"} de **${name}**${content ? ` (${content.club.city}) : \`/${ctx.slug}/${content.event.slug}\`` : ""}, généré par VYRA Studio, avec tout son historique (\`clubs/${ctx.slug}/studio/\`).`,
      live
        ? "Au merge, le club passe des brouillons au site en ligne."
        : "Le club reste un brouillon : visible sur la preview Vercel de cette PR et en local, jamais sur le site en ligne.",
      "Plan, tables, capacités et prix **provisoires, non validés par le club** ; mode démo, aucune demande transmise.",
      captures.length
        ? `\n## Captures\n\n${captures.map((f) => `![${f}](${raw(f)})`).join("\n")}`
        : "",
      `\n## À valider avec le club\n\nVoir \`clubs/${ctx.slug}/README.md\`.`,
    ]
      .filter(Boolean)
      .join("\n")
    const url = gh([
      "pr",
      "create",
      "--base",
      MAIN,
      "--head",
      branch,
      "--title",
      title,
      "--body",
      body,
    ])
    ctx.log(`pull request : ${url}`)
    return url.split(/\s+/).find((w) => w.startsWith("https://")) ?? url
  })
  ctx.log("Une fois la pull request mergée : « Mettre à jour » (page Clubs) pour revenir sur main.")
  ctx.setResult({ branch, prUrl, live })
}
