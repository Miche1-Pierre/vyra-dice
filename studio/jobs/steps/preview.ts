import { spawn } from "node:child_process"
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"

import { Browser } from "@studio/jobs/browser"
import type { RunContext } from "@studio/jobs/context"
import { keepCaptures } from "@studio/jobs/history"
import { REPO } from "@studio/lib/paths"
import { clubIndexSource, writeRegistration } from "@studio/lib/registry-file"

const require = createRequire(path.join(REPO, "package.json"))

/** Ports where a dev server of the product app may already run (one per project at a time). */
const VIEWERS = (process.env.VYRA_VIEWER ?? "http://localhost:3000,http://localhost:3100").split(
  ",",
)

async function reachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    return res.status < 500
  } catch {
    return false
  }
}

/** The product app's dev server: an existing one, or a new one on the first port. */
export async function ensureViewer(log: (m: string) => void): Promise<string> {
  for (const url of VIEWERS) if (await reachable(url)) return url
  const url = VIEWERS[0]
  const port = new URL(url).port || "3000"
  log(`Démarrage du viewer sur ${url}`)
  const out = openSync(path.join(os.tmpdir(), "vyra-viewer.log"), "a")
  const next = path.join(path.dirname(require.resolve("next/package.json")), "dist", "bin", "next")
  const child = spawn(process.execPath, [next, "dev", "--port", port], {
    cwd: REPO,
    detached: true,
    stdio: ["ignore", out, out],
    windowsHide: true,
  })
  child.unref()
  for (let i = 0; i < 120; i++) {
    if (await reachable(url)) return url
    await Browser.sleep(1000)
  }
  throw new Error(`Le viewer ne répond pas sur ${url}`)
}

const READY =
  "!!document.querySelector('canvas') && !document.querySelector('[aria-label^=\"Chargement de la visite\"]')"

/**
 * Aperçu: the club joins the registry (index.ts + one line), passes the contract tests, and its
 * demo is captured in the local viewer — desktop overview, first zone, first table, phone.
 */
export async function preview(ctx: RunContext): Promise<void> {
  const p = ctx.paths
  if (!existsSync(p.files.assets))
    throw new Error("Pas de bundle web : lancer l'éclairage précalculé")
  const content = JSON.parse(readFileSync(p.files.content, "utf8")) as {
    club: { name: string; city: string }
    event: { slug: string }
  }

  await ctx.phase("Enregistrement dans clubs/registry.ts", async () => {
    if (!existsSync(p.files.index)) {
      writeFileSync(p.files.index, clubIndexSource(content.club.name, content.club.city))
      ctx.log("index.ts créé")
    }
    ctx.log(writeRegistration(ctx.slug) ? "club ajouté au registre" : "déjà enregistré")
  })

  await ctx.phase("Tests de contrat (tous les clubs)", () =>
    ctx.exec(
      process.execPath,
      [
        path.join(path.dirname(require.resolve("vitest/package.json")), "vitest.mjs"),
        "run",
        "src/lib/clubs",
        "src/lib/venue",
        "src/components/experience/view-model.test.ts",
      ],
      { filter: (l) => /✓|✗|×|FAIL|Tests|Test Files|Error/.test(l) },
    ),
  )

  const viewer = await ctx.phase("Viewer local", () => ensureViewer((m) => ctx.log(m)))
  const url = `${viewer}/${ctx.slug}/${content.event.slug}?freeze=12`
  ctx.setResult({ viewer: `${viewer}/${ctx.slug}/${content.event.slug}` })

  await ctx.phase("Captures", async () => {
    rmSync(p.captures, { recursive: true, force: true })
    mkdirSync(p.captures, { recursive: true })
    const b = await Browser.open()
    try {
      await b.viewport(1440, 900)
      await b.goto(url)
      if (!(await b.waitFor(READY))) throw new Error("La scène ne s'est pas chargée (3 min)")
      await Browser.sleep(2500)
      await b.click(720, 450) // skip the intro
      await Browser.sleep(3500)
      await b.screenshot(path.join(p.captures, "desktop-overview.jpg"))
      const zone = await b.evaluate<string | null>(`(() => {
        const items = [...document.querySelectorAll("nav[aria-label='Dock'] [aria-label]")];
        return items[1]?.getAttribute("aria-label") ?? null;
      })()`)
      if (
        zone &&
        (await b.clickOn(`nav[aria-label='Dock'] [aria-label=${JSON.stringify(zone)}]`))
      ) {
        await Browser.sleep(3500)
        await b.screenshot(path.join(p.captures, "desktop-zone.jpg"))
      }
      if (await b.clickOn("[aria-label^='Table ']")) {
        await Browser.sleep(3500)
        await b.screenshot(path.join(p.captures, "desktop-table.jpg"))
      }
      await b.viewport(390, 844, true)
      await b.goto(url)
      if (await b.waitFor(READY)) {
        await Browser.sleep(2500)
        await b.click(195, 420)
        await Browser.sleep(3500)
        await b.screenshot(path.join(p.captures, "mobile-overview.jpg"))
      }
      if (b.errors.length)
        ctx.log(`Erreurs de la page :\n${[...new Set(b.errors)].slice(0, 10).join("\n")}`)
    } finally {
      b.close()
    }
  })
  keepCaptures(ctx)
}
