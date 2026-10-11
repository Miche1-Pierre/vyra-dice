"use client"

import { useState, useSyncExternalStore } from "react"

import { debugHistory, debugRequested, debugTrace, subscribeDebug } from "@/lib/debug"

const noSubscription = () => () => {}
const NONE: ReturnType<typeof debugHistory> = []

/**
 * The diagnostics on the phone itself, for a visit whose address asks for them (`debug`): the
 * latest events, and a button that copies them all, to paste where they are needed. Nothing shows
 * otherwise.
 */
export function DebugPanel() {
  const requested = useSyncExternalStore(noSubscription, debugRequested, () => false)
  const events = useSyncExternalStore(subscribeDebug, debugHistory, () => NONE)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<"yes" | "no" | null>(null)
  if (!requested) return null

  const copy = () => {
    // an insecure page or an old browser has no clipboard: the trace then shows to select by hand
    const clipboard = navigator.clipboard as Clipboard | undefined
    if (!clipboard) {
      setCopied("no")
      return
    }
    void clipboard.writeText(debugTrace()).then(
      () => setCopied("yes"),
      () => setCopied("no"),
    )
  }

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+6rem)] left-3 z-[60] font-mono text-[11px]">
      {open ? (
        <div className="flex w-[min(92vw,440px)] flex-col gap-2 rounded-xl bg-black/90 p-3 text-white shadow-[0_0_0_1px_rgb(255_255_255/0.15)]">
          <div className="flex items-center justify-between gap-2">
            <span>Diagnostic · {events.length} événements</span>
            <div className="flex gap-2">
              <button type="button" className="rounded bg-white/15 px-2 py-1" onClick={copy}>
                {copied === "yes" ? "Copié" : "Copier tout"}
              </button>
              <button
                type="button"
                className="rounded bg-white/15 px-2 py-1"
                onClick={() => setOpen(false)}
              >
                Fermer
              </button>
            </div>
          </div>
          {copied === "no" ? (
            // no clipboard: the trace to select by hand
            <textarea
              readOnly
              value={debugTrace()}
              className="h-[40vh] w-full rounded bg-white/10 p-2 text-[10px]"
            />
          ) : (
            <ol className="max-h-[40vh] overflow-y-auto leading-4">
              {events
                .slice(-80)
                .reverse()
                .map(({ t, event, ...data }, i) => (
                  // several events can share a millisecond: their place in the list keys them
                  <li key={events.length - i} className="break-all">
                    <span className="text-white/50">{(t / 1000).toFixed(1)}s</span> {event}{" "}
                    <span className="text-white/70">
                      {Object.entries(data)
                        .map(([k, v]) => `${k}=${String(v)}`)
                        .join(" ")}
                    </span>
                  </li>
                ))}
            </ol>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="rounded-full bg-black/80 px-3 py-1.5 text-white shadow-[0_0_0_1px_rgb(255_255_255/0.2)]"
          onClick={() => setOpen(true)}
        >
          Diagnostic · {events.length}
        </button>
      )}
    </div>
  )
}
