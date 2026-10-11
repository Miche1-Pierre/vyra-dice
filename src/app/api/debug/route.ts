/**
 * On-device diagnostics (src/lib/debug.ts): a visit opened with `debug` in its address posts what its
 * music and page go through; it is written to the server's logs, nothing is stored.
 */
export async function POST(request: Request) {
  const body = await request.text()
  if (body.length > 64_000) return new Response(null, { status: 413 })
  console.log(`[debug] ${body}`)
  return new Response(null, { status: 204 })
}
