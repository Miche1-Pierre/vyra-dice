import { clubDetail } from "@studio/lib/detail"

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const run = new URL(request.url).searchParams.get("run") ?? undefined
  try {
    return Response.json(clubDetail(slug, run))
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 404 },
    )
  }
}
