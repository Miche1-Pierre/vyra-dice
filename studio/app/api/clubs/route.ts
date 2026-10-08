import { createClub, saveSources } from "@studio/lib/clubs"
import { clubState, listClubSlugs } from "@studio/lib/state"

/** Every club folder with its progress. */
export function GET() {
  return Response.json(listClubSlugs().map((slug) => clubState(slug)))
}

/** New club: brief fields and source files (multipart). */
export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const text = (key: string) => {
      const v = form.get(key)
      return typeof v === "string" && v.trim() ? v.trim() : undefined
    }
    const brief = createClub({
      name: text("name") ?? "",
      city: text("city") ?? "",
      address: text("address"),
      website: text("website"),
      instagram: text("instagram"),
      brief: text("brief"),
      eventName: text("eventName"),
    })
    const files = form.getAll("sources").filter((f): f is File => f instanceof File)
    const saved = await saveSources(brief.slug, files)
    return Response.json({ slug: brief.slug, sources: saved })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    )
  }
}
