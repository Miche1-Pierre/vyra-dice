import { existsSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

import { insideClub } from "@studio/lib/paths"

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
}

/** A file of the club folder (renders, captures, sources, notes): `?path=build/previews/top.png`. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const rel = new URL(request.url).searchParams.get("path") ?? ""
  try {
    const file = insideClub(slug, rel)
    const type = TYPES[path.extname(file).toLowerCase()]
    if (!type || !existsSync(file) || !statSync(file).isFile())
      return new Response("Introuvable", { status: 404 })
    return new Response(readFileSync(file), {
      headers: { "Content-Type": type, "Cache-Control": "no-store" },
    })
  } catch {
    return new Response("Refusé", { status: 403 })
  }
}
