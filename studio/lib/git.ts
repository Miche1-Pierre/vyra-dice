import { execFileSync } from "node:child_process"

import { REPO } from "@studio/lib/paths"

/*
 * The Studio works in the repo checkout and shares through pull requests: it never commits on
 * main. Its commits go to the current branch, or — when the checkout is on main — to a new branch
 * made at the same commit (no file moves). Once the pull request is merged, "Mettre à jour" brings
 * the checkout back to an up-to-date main.
 */

export const MAIN = "main"

export function git(args: string[]): string {
  return execFileSync("git", args, {
    cwd: REPO,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  }).trim()
}

/** The checked-out branch (`HEAD` when detached). */
export function currentBranch(): string {
  return git(["rev-parse", "--abbrev-ref", "HEAD"])
}

/** `studio/<what>-20261008-1642`, or `feat/VYR-59-<club>` for a Linear issue. */
export function workBranchName(what: string, issue?: string, now = new Date()): string {
  if (issue) return `feat/${issue}-${what}`
  const stamp = now.toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-")
  return `studio/${what}-${stamp}`
}

/** Makes sure the Studio's commits do not land on main; returns the branch they go to. */
export function ensureWorkBranch(what: string, issue?: string): string {
  const branch = currentBranch()
  if (branch !== MAIN && branch !== "HEAD") return branch
  const name = workBranchName(what, issue)
  git(["switch", "-c", name])
  return name
}

/**
 * Commits these paths only, minus `exclude` (anything else modified or staged stays as it is).
 * False when nothing changed in them.
 */
export function commitPaths(
  paths: string[],
  subject: string,
  { body, exclude = [] }: { body?: string; exclude?: string[] } = {},
): boolean {
  const spec = ["--", ...paths, ...exclude.map((p) => `:(exclude)${p}`)]
  git(["add", "-A", ...spec])
  if (!git(["diff", "--cached", "--name-only", ...spec])) return false
  git(["commit", "-q", "-m", subject, ...(body ? ["-m", body] : []), ...spec])
  return true
}

/** Commits of the current branch that main does not have yet (rebase-merged ones count as in). */
export function unmergedCommits(): string[] {
  return git(["cherry", "-v", `origin/${MAIN}`, "HEAD"])
    .split("\n")
    .filter((l) => l.startsWith("+"))
    .map((l) => l.slice(2))
}

/** Tracked files with changes not committed yet (untracked files are left out). */
export function uncommitted(): string[] {
  return git(["status", "--porcelain", "--untracked-files=no"])
    .split("\n")
    .filter(Boolean)
    .map((l) => l.slice(3))
}

export interface SyncResult {
  ok: boolean
  message: string
  branch: string
}

/**
 * Back to an up-to-date main, once the work is shared and merged. Refuses rather than lose
 * anything: uncommitted changes to tracked files, or commits main does not have yet.
 */
export function syncMain(): SyncResult {
  git(["fetch", "-q", "origin", MAIN])
  const branch = currentBranch()
  const dirty = uncommitted()
  if (dirty.length) {
    return {
      ok: false,
      branch,
      message: `Changements pas encore partagés : ${dirty.slice(0, 6).join(", ")}${dirty.length > 6 ? "…" : ""}. Partage le club d'abord (étape Publication).`,
    }
  }
  if (branch !== MAIN) {
    const pending = unmergedCommits()
    if (pending.length) {
      return {
        ok: false,
        branch,
        message: `La branche ${branch} a ${pending.length} commit(s) pas encore dans main : merge sa pull request d'abord.`,
      }
    }
    git(["switch", MAIN])
  }
  const before = git(["rev-parse", "HEAD"])
  git(["merge", "--ff-only", `origin/${MAIN}`])
  const changed = git(["diff", "--name-only", before, "HEAD"]).split("\n").filter(Boolean)
  const install = changed.some((f) => f === "package.json" || f === "pnpm-lock.yaml")
  return {
    ok: true,
    branch: MAIN,
    message: changed.length
      ? `main à jour (${changed.length} fichier(s) modifié(s))${install ? " — dépendances changées : lance pnpm install puis relance le Studio" : ""}.`
      : "main était déjà à jour.",
  }
}
