import { startRun, STEPS, type StepId } from "@studio/lib/jobs"

/** Starts a step: `{ step, options }`. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  try {
    const body = (await request.json()) as { step?: string; options?: Record<string, unknown> }
    if (!body.step || !(STEPS as readonly string[]).includes(body.step))
      throw new Error("Étape inconnue")
    return Response.json(startRun(slug, body.step as StepId, body.options ?? {}))
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 409 },
    )
  }
}
