import { existsSync, readFileSync } from "node:fs"

import { addEval } from "@studio/lib/feedback"
import { clubPaths } from "@studio/lib/paths"

/** Human rating of the current build: `{ realism, fidelity, note? }` (1–5). */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const body = (await request.json()) as { realism?: number; fidelity?: number; note?: string }
  const ok = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 5
  if (!ok(body.realism) || !ok(body.fidelity))
    return Response.json({ error: "Notes de 1 à 5" }, { status: 400 })
  const report = clubPaths(slug).report
  const triangles = existsSync(report)
    ? (JSON.parse(readFileSync(report, "utf8")) as { triangles?: number }).triangles
    : undefined
  return Response.json(
    addEval(slug, {
      realism: body.realism!,
      fidelity: body.fidelity!,
      note: body.note?.trim().slice(0, 1000) || undefined,
      triangles,
    }),
  )
}
