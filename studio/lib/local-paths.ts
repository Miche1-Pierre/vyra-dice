import os from "node:os"

import { REPO } from "@studio/lib/paths"

/*
 * The Studio's history is versioned in a public repo: run logs and results name files relative to
 * the repo, and the user's home as `~`, never with this machine's absolute paths.
 */

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const forms = (p: string) => [...new Set([p, p.replace(/\\/g, "/"), p.replace(/\//g, "\\")])]

const RULES: [RegExp, string][] = [
  // the repo first: it may live in the home folder
  ...forms(REPO).map((p): [RegExp, string] => [new RegExp(`${escape(p)}[\\\\/]?`, "gi"), ""]),
  ...forms(os.homedir()).map((p): [RegExp, string] => [new RegExp(escape(p), "gi"), "~"]),
]

export function withoutLocalPaths(text: string): string {
  return RULES.reduce((s, [pattern, by]) => s.replace(pattern, by), text)
}

/** Same, through every string of a JSON-like value (run status, results). */
export function withoutLocalPathsDeep<T>(value: T): T {
  if (typeof value === "string") return withoutLocalPaths(value) as T
  if (Array.isArray(value)) return value.map((v: unknown) => withoutLocalPathsDeep(v)) as T
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, withoutLocalPathsDeep(v)]),
    ) as T
  }
  return value
}
