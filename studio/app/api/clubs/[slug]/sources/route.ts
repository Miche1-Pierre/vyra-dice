import { saveSources } from "@studio/lib/clubs"

/** More photos or plans for a club (multipart `sources`). */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  try {
    const form = await request.formData()
    const files = form.getAll("sources").filter((f): f is File => f instanceof File)
    return Response.json({ saved: await saveSources(slug, files) })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    )
  }
}
