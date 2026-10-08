import { currentBranch, git, MAIN, syncMain, uncommitted } from "@studio/lib/git"
import { activeRun } from "@studio/lib/jobs"
import { listClubSlugs } from "@studio/lib/state"

/** Where the checkout stands: branch, changes not shared yet, commits of main not pulled yet. */
export async function GET() {
  try {
    const behind = Number(git(["rev-list", "--count", `HEAD..origin/${MAIN}`]) || 0)
    return Response.json({ branch: currentBranch(), uncommitted: uncommitted(), behind })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

/** "Mettre à jour": back to an up-to-date main once the work is shared and merged. */
export async function POST() {
  const running = listClubSlugs().find((slug) => activeRun(slug))
  if (running) {
    return Response.json(
      { ok: false, message: `Une étape tourne pour ${running} : attendre qu'elle finisse.` },
      { status: 409 },
    )
  }
  try {
    const result = syncMain()
    return Response.json(result, { status: result.ok ? 200 : 409 })
  } catch (error) {
    const detail = (error as { stderr?: string }).stderr?.trim()
    return Response.json(
      {
        ok: false,
        message: `git a refusé : ${detail || (error instanceof Error ? error.message : String(error))}`,
      },
      { status: 409 },
    )
  }
}
