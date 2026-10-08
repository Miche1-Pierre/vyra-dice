import { decideLesson } from "@studio/lib/clubs"

/** Accept (into studio/playbook/lessons.md) or reject a lesson: `{ id, decision }`. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const body = (await request.json()) as { id?: string; decision?: "accepted" | "rejected" }
  try {
    if (!body.id || (body.decision !== "accepted" && body.decision !== "rejected"))
      throw new Error("Décision invalide")
    decideLesson(slug, body.id, body.decision)
    return Response.json({ ok: true })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    )
  }
}
