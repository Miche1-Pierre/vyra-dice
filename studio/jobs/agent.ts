import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

import type { RunContext } from "@studio/jobs/context"
import { REPO } from "@studio/lib/paths"

/*
 * The Studio's agent: Claude Code run headless on this machine, with the team's logged-in
 * Claude account (no API key: the child environment drops ANTHROPIC_API_KEY so the run never
 * switches to API billing). Isolated from local customisations (--safe-mode, no MCP), it can
 * read the repo but write only inside the club's folder (dontAsk + Edit(clubs/<slug>/**)).
 *
 * `AgentRunner` is the seam for the server version: an Anthropic API runner (official SDK,
 * claude-opus-5-5) can implement the same contract when the Studio leaves this machine.
 */

export interface AgentRequest {
  /** What to do, with the paths to read and write. */
  prompt: string
  /** Continue a previous session (validation errors, review feedback) instead of a new one. */
  resume?: string
  maxTurns?: number
  maxBudgetUsd?: number
  /** Extra folders it may write to, relative to the repo (the club folder is always allowed). */
  writable?: string[]
}

export interface AgentResult {
  sessionId: string
  ok: boolean
  subtype: string
  turns: number
  durationMs: number
  /** Client-side estimate of what the run would cost on the API (the subscription pays). */
  costUsd: number
  inputTokens: number
  outputTokens: number
  denials: string[]
  text: string
}

export interface AgentRunner {
  run(ctx: RunContext, request: AgentRequest): Promise<AgentResult>
}

const MODEL = process.env.VYRA_AGENT_MODEL ?? "claude-opus-5-5"

function claudeBinary(): string {
  if (process.env.VYRA_CLAUDE) return process.env.VYRA_CLAUDE
  const candidates = [
    path.join(
      process.env.APPDATA ?? "",
      "npm",
      "node_modules",
      "@anthropic-ai",
      "claude-code",
      "bin",
      "claude.exe",
    ),
    path.join(os.homedir(), ".local", "bin", "claude.exe"),
    path.join(os.homedir(), ".local", "bin", "claude"),
  ]
  return candidates.find((c) => existsSync(c)) ?? "claude"
}

/** One line per tool call, so the run log reads like a work journal. */
function describeTool(name: string, input: Record<string, unknown>): string {
  const rel = (p: unknown) =>
    typeof p === "string" ? path.relative(REPO, path.resolve(REPO, p)).replaceAll("\\", "/") : ""
  switch (name) {
    case "Read":
      return `lit ${rel(input.file_path)}`
    case "Write":
      return `écrit ${rel(input.file_path)}`
    case "Edit":
      return `modifie ${rel(input.file_path)}`
    case "Glob":
      return `cherche ${String(input.pattern ?? "")}`
    case "Grep":
      return `cherche « ${String(input.pattern ?? "")} »`
    default:
      return name
  }
}

export const claudeCode: AgentRunner = {
  async run(ctx, request) {
    const studioTmp = path.join(os.tmpdir(), "vyra-studio")
    mkdirSync(studioTmp, { recursive: true })
    const mcp = path.join(studioTmp, "mcp-empty.json")
    writeFileSync(mcp, JSON.stringify({ mcpServers: {} }))
    const rules = path.join(studioTmp, `rules-${ctx.slug}.md`)
    writeFileSync(
      rules,
      [
        "Tu es l'agent de génération de VYRA Studio. Tu travailles pour l'équipe VYRA (Pierre, Jonathan).",
        `Tu n'écris QUE dans clubs/${ctx.slug}/ (et ses sous-dossiers). Tu lis ce que tu veux dans le dépôt.`,
        "Tu ne publies rien, tu n'exécutes rien : le Studio construit, valide et te renvoie les résultats.",
        "Toute supposition (dimensions, tables, prix, matières) est marquée comme telle ; les offres sont des données de démo.",
        "Réponds en français dans tes notes et textes destinés à l'équipe.",
      ].join("\n"),
    )
    const sessionId = request.resume ?? randomUUID()
    const writable = [`clubs/${ctx.slug}/**`, ...(request.writable ?? [])]
    const args = [
      "-p",
      request.prompt,
      "--output-format",
      "stream-json",
      "--verbose",
      ...(request.resume ? ["--resume", request.resume] : ["--session-id", sessionId]),
      "--safe-mode",
      "--model",
      MODEL,
      "--max-turns",
      String(request.maxTurns ?? 60),
      "--max-budget-usd",
      String(request.maxBudgetUsd ?? 15),
      "--tools",
      "Read,Glob,Grep,Edit,Write",
      "--allowedTools",
      ["Read", "Glob", "Grep", ...writable.map((w) => `Edit(${w})`)].join(","),
      "--permission-mode",
      "dontAsk",
      "--permission-prompts",
      "none",
      "--strict-mcp-config",
      "--mcp-config",
      mcp,
      "--disallowedTools",
      "mcp__*",
      "--append-system-prompt-file",
      rules,
    ]
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DISABLE_AUTOUPDATER: "1",
      ENABLE_CLAUDEAI_MCP_SERVERS: "false",
    }
    for (const key of Object.keys(env)) {
      if (
        key === "ANTHROPIC_API_KEY" ||
        key === "ANTHROPIC_AUTH_TOKEN" ||
        key.startsWith("CLAUDE_CODE_USE_")
      )
        delete env[key]
    }

    ctx.log(`agent ${MODEL} — session ${sessionId}${request.resume ? " (reprise)" : ""}`)
    return new Promise<AgentResult>((resolve, reject) => {
      const child = spawn(claudeBinary(), args, { cwd: REPO, env, windowsHide: true })
      let buffer = ""
      let result: AgentResult | null = null
      const denials: string[] = []
      const onLine = (line: string) => {
        if (!line.trim()) return
        let event: Record<string, unknown>
        try {
          event = JSON.parse(line) as Record<string, unknown>
        } catch {
          ctx.log(`  ${line.slice(0, 300)}`)
          return
        }
        if (event.type === "assistant") {
          const content = ((event.message as { content?: unknown[] })?.content ?? []) as Record<
            string,
            unknown
          >[]
          for (const block of content) {
            if (block.type === "text" && typeof block.text === "string" && block.text.trim()) {
              ctx.log(`  💬 ${block.text.trim().replace(/\s+/g, " ").slice(0, 400)}`)
            } else if (block.type === "tool_use") {
              ctx.log(
                `  · ${describeTool(String(block.name), (block.input ?? {}) as Record<string, unknown>)}`,
              )
            }
          }
        } else if (event.type === "system" && event.subtype === "permission_denied") {
          const what = `${String(event.tool_name)} ${String(event.message ?? "")}`.trim()
          denials.push(what)
          ctx.log(`  ⛔ refusé : ${what.slice(0, 200)}`)
        } else if (event.type === "result") {
          const usage = (event.usage ?? {}) as Record<string, number>
          result = {
            sessionId: String(event.session_id ?? sessionId),
            ok: event.subtype === "success" && !event.is_error,
            subtype: String(event.subtype),
            turns: Number(event.num_turns ?? 0),
            durationMs: Number(event.duration_ms ?? 0),
            costUsd: Number(event.total_cost_usd ?? 0),
            inputTokens:
              (usage.input_tokens ?? 0) +
              (usage.cache_read_input_tokens ?? 0) +
              (usage.cache_creation_input_tokens ?? 0),
            outputTokens: usage.output_tokens ?? 0,
            denials,
            text: typeof event.result === "string" ? event.result : "",
          }
        }
      }
      child.stdout.on("data", (chunk: Buffer) => {
        buffer += chunk.toString("utf8")
        let nl: number
        while ((nl = buffer.indexOf("\n")) >= 0) {
          onLine(buffer.slice(0, nl))
          buffer = buffer.slice(nl + 1)
        }
      })
      child.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8").trim()
        if (text) ctx.log(`  [claude] ${text.slice(0, 500)}`)
      })
      child.on("error", reject)
      child.on("close", (code) => {
        if (buffer.trim()) onLine(buffer)
        const r = result as AgentResult | null
        if (!r) return reject(new Error(`Claude Code s'est arrêté sans résultat (code ${code})`))
        ctx.log(
          `agent : ${r.subtype}, ${r.turns} tours, ${(r.durationMs / 1000).toFixed(0)} s, ` +
            `≈ ${r.costUsd.toFixed(2)} $ estimés, ${r.inputTokens.toLocaleString("fr-FR")} jetons lus / ${r.outputTokens.toLocaleString("fr-FR")} écrits`,
        )
        resolve(r)
      })
    })
  },
}

/** Adds an agent run to the step's totals (turns, cost, sessions). */
export function recordAgent(ctx: RunContext, r: AgentResult): void {
  const prev = (ctx.status.result ?? {}) as {
    agentRuns?: number
    turns?: number
    costUsd?: number
    sessions?: string[]
  }
  ctx.setResult({
    agentRuns: (prev.agentRuns ?? 0) + 1,
    turns: (prev.turns ?? 0) + r.turns,
    costUsd: Math.round(((prev.costUsd ?? 0) + r.costUsd) * 100) / 100,
    sessions: [...new Set([...(prev.sessions ?? []), r.sessionId])],
  })
}
