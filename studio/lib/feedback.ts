import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { clubPaths } from "@studio/lib/paths"

/*
 * Human feedback and ratings of a club (clubs/<slug>/studio): versioned with the club, fed to the next
 * review by the agent, and kept as history to measure progress club after club.
 */

export interface FeedbackItem {
  id: string
  text: string
  /** What it is about: a render (`overview`, `table-v4`), a capture, a zone… */
  target?: string
  createdAt: string
  status: "open" | "addressed" | "dismissed"
  addressedIn?: string
}

export interface Evaluation {
  at: string
  /** 1-5: does it look like a real, premium club? */
  realism: number
  /** 1-5: is it this club (identity, layout, signature elements)? */
  fidelity: number
  note?: string
  /** Build at the time of the rating. */
  triangles?: number
}

export function readFeedback(slug: string): { items: FeedbackItem[] } {
  const file = clubPaths(slug).feedback
  return existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")) as { items: FeedbackItem[] })
    : { items: [] }
}

export function writeFeedback(slug: string, data: { items: FeedbackItem[] }): void {
  const file = clubPaths(slug).feedback
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(data, null, 2))
}

export function addFeedback(slug: string, text: string, target?: string): FeedbackItem {
  const data = readFeedback(slug)
  const item: FeedbackItem = {
    id: `f${data.items.length + 1}`,
    text: text.trim(),
    target: target?.trim() || undefined,
    createdAt: new Date().toISOString(),
    status: "open",
  }
  writeFeedback(slug, { items: [...data.items, item] })
  return item
}

export function readEvals(slug: string): Evaluation[] {
  const file = clubPaths(slug).evals
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Evaluation[]) : []
}

export function addEval(slug: string, evaluation: Omit<Evaluation, "at">): Evaluation {
  const file = clubPaths(slug).evals
  const entry = { at: new Date().toISOString(), ...evaluation }
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify([...readEvals(slug), entry], null, 2))
  return entry
}
