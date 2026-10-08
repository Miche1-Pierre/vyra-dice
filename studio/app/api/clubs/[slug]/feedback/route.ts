import { addFeedback, readFeedback, writeFeedback, type FeedbackItem } from "@studio/lib/feedback"

/** New feedback: `{ text, target? }`. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const body = (await request.json()) as { text?: string; target?: string }
  if (!body.text?.trim()) return Response.json({ error: "Retour vide" }, { status: 400 })
  return Response.json(addFeedback(slug, body.text.slice(0, 2000), body.target?.slice(0, 80)))
}

/** Changes a feedback status: `{ id, status }`. */
export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const body = (await request.json()) as { id?: string; status?: FeedbackItem["status"] }
  const data = readFeedback(slug)
  const item = data.items.find((f) => f.id === body.id)
  if (!item || !body.status || !["open", "addressed", "dismissed"].includes(body.status)) {
    return Response.json({ error: "Retour introuvable" }, { status: 404 })
  }
  item.status = body.status
  writeFeedback(slug, data)
  return Response.json(item)
}
