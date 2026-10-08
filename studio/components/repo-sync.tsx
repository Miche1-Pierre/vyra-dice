"use client"

import { GitBranch, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

interface RepoState {
  branch: string
  uncommitted: string[]
  behind: number
}

/**
 * Where this checkout stands, and "Mettre à jour": back to an up-to-date main once the work is
 * shared (pull request merged) — how the team gets each other's clubs and histories.
 */
export function RepoSync() {
  const router = useRouter()
  const [state, setState] = useState<RepoState | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const load = () =>
    fetch("/api/git", { cache: "no-store" })
      .then((r) => r.json() as Promise<RepoState>)
      .then(setState)
      .catch(() => setState(null))
  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {state ? (
          <span
            className="text-footnote text-label-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.06] px-3"
            title={
              state.uncommitted.length
                ? `Pas encore partagé :\n${state.uncommitted.join("\n")}`
                : "Tout est partagé"
            }
          >
            <GitBranch className="size-3.5" />
            <span className="font-code max-w-56 truncate">{state.branch}</span>
            {state.uncommitted.length ? (
              <span className="text-wait">· {state.uncommitted.length} à partager</span>
            ) : null}
          </span>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setMessage(null)
            const res = await fetch("/api/git", { method: "POST" })
            const body = (await res.json()) as { ok: boolean; message: string }
            setMessage({ ok: body.ok, text: body.message })
            setBusy(false)
            await load()
            router.refresh()
          }}
          className="text-footnote text-label inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.08] px-3.5 font-medium hover:bg-white/[0.12] disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
          {busy
            ? "Mise à jour…"
            : state?.behind
              ? `Mettre à jour (${state.behind} nouveauté${state.behind > 1 ? "s" : ""})`
              : "Mettre à jour"}
        </button>
      </div>
      {message ? (
        <p
          className={cn(
            "text-caption max-w-md text-right",
            message.ok ? "text-label-2" : "text-[#ff6961]",
          )}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  )
}
