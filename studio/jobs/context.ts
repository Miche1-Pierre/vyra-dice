import { spawn } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import type { RunStatus } from "@studio/lib/jobs"
import { withoutLocalPaths, withoutLocalPathsDeep } from "@studio/lib/local-paths"
import { clubPaths, REPO, type ClubPaths } from "@studio/lib/paths"

export const BLENDER =
  process.env.VYRA_BLENDER ?? "C:/Program Files/Blender Foundation/Blender 5.1/blender.exe"

/** What a step gets: its club, its options, a log and phase bookkeeping persisted in status.json. */
export class RunContext {
  readonly paths: ClubPaths
  private readonly statusFile: string

  constructor(
    readonly slug: string,
    readonly id: string,
  ) {
    this.paths = clubPaths(slug)
    this.statusFile = path.join(this.paths.runs, id, "status.json")
  }

  get status(): RunStatus {
    return JSON.parse(readFileSync(this.statusFile, "utf8")) as RunStatus
  }

  get options(): Record<string, unknown> {
    return this.status.options ?? {}
  }

  update(patch: Partial<RunStatus>): void {
    const next = withoutLocalPathsDeep({ ...this.status, ...patch })
    writeFileSync(this.statusFile, JSON.stringify(next, null, 2))
  }

  setResult(patch: Record<string, unknown>): void {
    this.update({ result: { ...(this.status.result ?? {}), ...patch } })
  }

  log(message: string): void {
    const time = new Date().toLocaleTimeString("fr-FR", { hour12: false })
    // plain text: no terminal colours from the tools we run
    const plain = withoutLocalPaths(message.replace(/\u001b\[[0-9;]*m/g, ""))
    for (const line of plain.split("\n")) process.stdout.write(`[${time}] ${line}\n`)
  }

  /** Runs `fn` as a named phase: logged, timed, recorded in status.json. */
  async phase<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const startedAt = new Date().toISOString()
    this.update({ phases: [...this.status.phases, { name, startedAt }] })
    this.log(`▶ ${name}`)
    const t0 = Date.now()
    const close = (ok: boolean) => {
      const phases = this.status.phases.map((p) =>
        p.name === name && p.startedAt === startedAt
          ? { ...p, endedAt: new Date().toISOString(), ok }
          : p,
      )
      this.update({ phases })
      this.log(`${ok ? "✔" : "✖"} ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`)
    }
    try {
      const out = await fn()
      close(true)
      return out
    } catch (error) {
      close(false)
      throw error
    }
  }

  /** Runs a program, streaming its output into the log; rejects on a non-zero exit. */
  exec(
    command: string,
    args: string[],
    { cwd = REPO, filter }: { cwd?: string; filter?: (line: string) => boolean } = {},
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        windowsHide: true,
        env: { ...process.env, FORCE_COLOR: "0" },
      })
      let out = ""
      const onData = (chunk: Buffer) => {
        const text = chunk.toString("utf8")
        out += text
        for (const line of text.split(/\r?\n/)) {
          if (line.trim() && (!filter || filter(line))) this.log(`  ${line}`)
        }
      }
      child.stdout.on("data", onData)
      child.stderr.on("data", onData)
      child.on("error", reject)
      child.on("close", (code) =>
        code === 0
          ? resolve(out)
          : reject(
              Object.assign(new Error(`${path.basename(command)} a échoué (code ${code})`), {
                output: out,
              }),
            ),
      )
    })
  }
}

/** The useful end of a failed program's output (a Python traceback, an error line). */
export function errorTail(error: unknown, lines = 25): string {
  const output = (error as { output?: string })?.output ?? ""
  const all = output.split(/\r?\n/).filter((l) => l.trim() && blenderNoise(l))
  const start = all.findIndex((l) => l.startsWith("Traceback"))
  return (start >= 0 ? all.slice(start) : all).slice(-lines).join("\n") || String(error)
}

/** Blender's chatter we do not need in the log. */
export const blenderNoise = (line: string) =>
  !/HIPEW|Read blend|BlenderMCP|Blender quit|^Blender \d|Fra:|Sample \d|Mem:|Path Tracing/.test(
    line,
  )
